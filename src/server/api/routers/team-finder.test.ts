import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { applications, teamFinderCards, users } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { UserSeeder } from "~/server/db/seed/userSeeder";
import { RSVP_DEADLINE } from "~/lib/date";
import { type CardInput } from "~/lib/team-finder";

import * as mailjet from "~/server/mail-mailjet";
import * as photos from "~/server/storage/team-finder-photos";

vi.mock("~/server/storage/team-finder-photos", async (importOriginal) => ({
  ...(await importOriginal<typeof photos>()),
  photosConfigured: vi.fn(() => true),
  putPhoto: vi.fn(async () => undefined),
  deletePhoto: vi.fn(async () => undefined),
  presignPhotoGet: vi.fn(async (key: string) => `https://signed.test/${key}`),
}));

vi.mock("~/server/mail-mailjet", () => ({
  sendViaMailjet: vi.fn(async () => ({
    data: { delivered: [], queued: [], bounced: [] },
    error: null,
  })),
}));

const session = await mockSession(db);
const organizer = await mockOrganizerSession(db);
const caller = createCaller(createInnerTRPCContext({ session }));
const organizerCaller = createCaller(
  createInnerTRPCContext({ session: organizer }),
);

// A fixed moment after RSVP closes, so these tests keep working as time passes.
const AFTER_RSVP = RSVP_DEADLINE.getTime() + 24 * 60 * 60 * 1000;

const input = (over: Partial<CardInput> = {}): CardInput => ({
  needs: null,
  skills: ["Frontend"],
  firstHackathon: false,
  lookingFor: "A team for the weekend",
  idea: null,
  showSchool: true,
  showYear: false,
  contacts: { discord: "someone" },
  shown: true,
  ...over,
});

const seedApplication = (
  userId: string,
  status: "CONFIRMED" | "DECLINED" = "CONFIRMED",
) =>
  db
    .insert(applications)
    .values({ ...ApplicationSeeder.createRandomWithoutUser(), userId, status });

const otherUsers: string[] = [];
async function seedOther(status: "CONFIRMED" | "DECLINED" = "CONFIRMED") {
  const user = new UserSeeder().createRandom();
  await db.insert(users).values(user);
  await seedApplication(user.id, status);
  otherUsers.push(user.id);
  return user.id;
}

const seedCard = (
  userId: string,
  over: Partial<typeof teamFinderCards.$inferInsert> = {},
) =>
  db.insert(teamFinderCards).values({
    userId,
    shown: true,
    lookingFor: "Anyone",
    discord: "them",
    ...over,
  });

const webp = (extra = 0) => {
  const bytes = Buffer.alloc(32 + extra);
  bytes.write("RIFF", 0, "ascii");
  bytes.write("WEBP", 8, "ascii");
  return bytes.toString("base64");
};

const jpeg = () =>
  Buffer.concat([
    Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
    Buffer.alloc(28),
  ]).toString("base64");

describe("teamFinder", () => {
  beforeEach(async () => {
    vi.mocked(photos.photosConfigured).mockReturnValue(true);
    vi.spyOn(Date, "now").mockReturnValue(AFTER_RSVP);
    await seedApplication(session.user.id);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    vi.mocked(photos.putPhoto).mockClear();
    vi.mocked(photos.deletePhoto).mockClear();
    await db
      .delete(teamFinderCards)
      .where(inArray(teamFinderCards.userId, [session.user.id, ...otherUsers]));
    await db
      .delete(applications)
      .where(inArray(applications.userId, [session.user.id, ...otherUsers]));
    if (otherUsers.length)
      await db.delete(users).where(inArray(users.id, otherUsers));
    otherUsers.length = 0;
  });

  test("saveMine stores a hinted Instagram as null", async () => {
    const card = await caller.teamFinder.saveMine(
      input({
        contacts: {
          discord: "someone",
          instagram: "https://github.com/someone",
        },
      }),
    );
    expect(card.contacts.instagram).toBeUndefined();
    const row = await db.query.teamFinderCards.findFirst({
      where: eq(teamFinderCards.userId, session.user.id),
    });
    expect(row?.instagram).toBeNull();
  });

  test("saveMine without a messaging contact is saved hidden", async () => {
    const card = await caller.teamFinder.saveMine(
      input({ contacts: { github: "someone" }, shown: true }),
    );
    expect(card.shown).toBe(false);
  });

  test("list leaves out hidden, organizer-hidden and declined cards, newest first", async () => {
    const older = await seedOther();
    const newer = await seedOther();
    const hidden = await seedOther();
    const banned = await seedOther();
    const declined = await seedOther();
    await seedCard(older, { updatedAt: new Date(AFTER_RSVP - 3000) });
    await seedCard(newer, { updatedAt: new Date(AFTER_RSVP - 1000) });
    await seedCard(hidden, { shown: false });
    await seedCard(banned, { hiddenByOrganizerAt: new Date() });
    await seedCard(declined);
    await db
      .update(applications)
      .set({ status: "DECLINED" })
      .where(eq(applications.userId, declined));

    const list = await caller.teamFinder.list();
    expect(list.map((c) => c.userId)).toEqual([newer, older]);
  });

  test("list includes the caller's own hidden card, flagged", async () => {
    await seedCard(session.user.id, { shown: false });
    const list = await caller.teamFinder.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ isMine: true, shown: false });
  });

  test("setShown(true) on an organizer-hidden card stays hidden", async () => {
    await seedCard(session.user.id, {
      shown: false,
      hiddenByOrganizerAt: new Date(),
    });
    const card = await caller.teamFinder.setShown({ shown: true });
    expect(card.shown).toBe(false);
    const saved = await caller.teamFinder.saveMine(input({ shown: true }));
    expect(saved.shown).toBe(false);
    expect((await caller.teamFinder.getMine()).hiddenByOrganizer).toBe(true);
  });

  test("deleteMine removes the card", async () => {
    await seedCard(session.user.id);
    await caller.teamFinder.deleteMine();
    expect((await caller.teamFinder.getMine()).card).toBeNull();
  });

  test("an accepted hacker is refused", async () => {
    await db
      .update(applications)
      .set({ status: "ACCEPTED" })
      .where(eq(applications.userId, session.user.id));
    await expect(caller.teamFinder.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "not-confirmed",
    });
  });

  test("organizers can read the board but have no card", async () => {
    const other = await seedOther();
    await seedCard(other);
    const list = await organizerCaller.teamFinder.list();
    expect(list.map((c) => c.userId)).toContain(other);
    await expect(organizerCaller.teamFinder.getMine()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("a confirmed hacker is refused before RSVP closes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(RSVP_DEADLINE.getTime() - 1000);
    await expect(caller.teamFinder.list()).rejects.toMatchObject({
      message: "not-open",
    });
  });

  describe("photos", () => {
    const prefix = `team-finder/${session.user.id}/`;
    const oldKey = `${prefix}00000000-0000-0000-0000-000000000000.webp`;
    const photoOf = async () =>
      (
        await db.query.teamFinderCards.findFirst({
          where: eq(teamFinderCards.userId, session.user.id),
        })
      )?.photoKey;

    test("ownsPhotoKey refuses another user's key", () => {
      const key = "team-finder/u2/00000000-0000-0000-0000-000000000000.webp";
      expect(photos.ownsPhotoKey("u1", key)).toBe(false);
      expect(photos.ownsPhotoKey("u2", key)).toBe(true);
      expect(photos.ownsPhotoKey("u2", key.replace(".webp", ".jpg"))).toBe(
        true,
      );
      expect(photos.ownsPhotoKey("u2", key.replace(".webp", ".png"))).toBe(
        false,
      );
      expect(photos.ownsPhotoKey("u2", "other/u2/x.webp")).toBe(false);
    });

    test("uploadPhoto rejects PNG and files over 200 KB", async () => {
      await seedCard(session.user.id);
      const png = Buffer.from("\x89PNG\r\n\x1a\n and some more bytes").toString(
        "base64",
      );
      await expect(
        caller.teamFinder.uploadPhoto({ photoBase64: png }),
      ).rejects.toThrow("invalid-photo");
      await expect(
        caller.teamFinder.uploadPhoto({ photoBase64: webp(200 * 1024) }),
      ).rejects.toThrow("invalid-photo");
      expect(photos.putPhoto).not.toHaveBeenCalled();
    });

    test("uploadPhoto without a card is refused", async () => {
      await expect(
        caller.teamFinder.uploadPhoto({ photoBase64: webp() }),
      ).rejects.toThrow("no-card");
    });

    test("uploadPhoto says photos-unavailable when not configured", async () => {
      vi.mocked(photos.photosConfigured).mockReturnValue(false);
      await seedCard(session.user.id);
      await expect(
        caller.teamFinder.uploadPhoto({ photoBase64: webp() }),
      ).rejects.toThrow("photos-unavailable");
    });

    test("uploadPhoto stores a key under the caller and deletes the previous photo", async () => {
      await seedCard(session.user.id, { photoKey: oldKey });
      const card = await caller.teamFinder.uploadPhoto({ photoBase64: webp() });
      const key = await photoOf();
      expect(key?.startsWith(prefix)).toBe(true);
      expect(key).not.toBe(oldKey);
      expect(key?.endsWith(".webp")).toBe(true);
      expect(photos.putPhoto).toHaveBeenCalledWith(
        key,
        expect.anything(),
        "image/webp",
      );
      expect(photos.deletePhoto).toHaveBeenCalledWith(oldKey);
      expect(card.photoUrl).toBe(`https://signed.test/${key}`);
    });

    test("uploadPhoto accepts JPEG (Safari can't make WebP)", async () => {
      await seedCard(session.user.id);
      await caller.teamFinder.uploadPhoto({ photoBase64: jpeg() });
      const key = await photoOf();
      expect(key?.startsWith(prefix)).toBe(true);
      expect(key?.endsWith(".jpg")).toBe(true);
      expect(photos.putPhoto).toHaveBeenCalledWith(
        key,
        expect.anything(),
        "image/jpeg",
      );
    });

    test("removePhoto clears the key and deletes the object", async () => {
      await seedCard(session.user.id, { photoKey: oldKey });
      const card = await caller.teamFinder.removePhoto();
      expect(card.photoUrl).toBeUndefined();
      expect(await photoOf()).toBeNull();
      expect(photos.deletePhoto).toHaveBeenCalledWith(oldKey);
    });

    test("deleteMine deletes the photo", async () => {
      await seedCard(session.user.id, { photoKey: oldKey });
      await caller.teamFinder.deleteMine();
      expect(photos.deletePhoto).toHaveBeenCalledWith(oldKey);
    });

    test("list returns photoUrl when configured and none when not", async () => {
      await seedCard(session.user.id, { photoKey: oldKey });
      const [on] = await caller.teamFinder.list();
      expect(on?.photoUrl).toBe(`https://signed.test/${oldKey}`);

      vi.mocked(photos.photosConfigured).mockReturnValue(false);
      const [off] = await caller.teamFinder.list();
      expect(off?.photoUrl).toBeUndefined();
    });
  });

  describe("report and hide", () => {
    test("report emails hello@ once, escaping the note", async () => {
      const other = await seedOther();
      await seedCard(other);
      vi.mocked(mailjet.sendViaMailjet).mockClear();
      await caller.teamFinder.report({ userId: other, note: "<b>bad</b>" });
      expect(mailjet.sendViaMailjet).toHaveBeenCalledTimes(1);
      const [opts] = vi.mocked(mailjet.sendViaMailjet).mock.calls[0]!;
      expect(opts.to).toBe("hello@hackwestern.com");
      expect(opts.replyTo).toBe(session.user.email);
      expect(opts.subject).toMatch(/^Team finder report: /);
      expect(opts.html).toContain("&lt;b&gt;bad&lt;/b&gt;");
      expect(opts.html).not.toContain("<b>bad</b>");
    });

    test("report on a missing, unshown or own card is refused", async () => {
      const other = await seedOther();
      await seedCard(other, { shown: false });
      await expect(
        caller.teamFinder.report({ userId: other, note: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        caller.teamFinder.report({ userId: "nobody", note: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await seedCard(session.user.id);
      await expect(
        caller.teamFinder.report({ userId: session.user.id, note: "x" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    test("a hacker cannot hide a card", async () => {
      const other = await seedOther();
      await seedCard(other);
      await expect(
        caller.teamFinder.hideCard({ userId: other }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    test("hideCard removes the card from list; unhideCard restores it", async () => {
      await seedCard(session.user.id);
      await organizerCaller.teamFinder.hideCard({ userId: session.user.id });
      expect((await caller.teamFinder.getMine()).hiddenByOrganizer).toBe(true);
      const other = await seedOther();
      await seedCard(other);
      await organizerCaller.teamFinder.hideCard({ userId: other });
      const ids = (await caller.teamFinder.list()).map((c) => c.userId);
      expect(ids).not.toContain(other);

      await organizerCaller.teamFinder.unhideCard({ userId: other });
      const after = (await caller.teamFinder.list()).map((c) => c.userId);
      expect(after).toContain(other);
    });
  });
});
