import { randomUUID } from "node:crypto";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { eq, inArray } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  applications,
  teamFinderCards,
  teamFinderReports,
  users,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { UserSeeder } from "~/server/db/seed/userSeeder";
import { RSVP_DEADLINE } from "~/lib/date";
import { REPORTS_PER_DAY, type CardInput } from "~/lib/team-finder";

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

// Another confirmed hacker looking at the board.
async function viewer() {
  const other = await mockSession(db);
  await seedApplication(other.user.id);
  otherUsers.push(other.user.id);
  return createCaller(createInnerTRPCContext({ session: other }));
}

// Returns the card's id.
async function seedCard(
  userId: string,
  over: Partial<typeof teamFinderCards.$inferInsert> = {},
) {
  const [card] = await db
    .insert(teamFinderCards)
    .values({
      userId,
      shown: true,
      lookingFor: "Anyone",
      discord: "them",
      ...over,
    })
    .returning({ id: teamFinderCards.id });
  return card!.id;
}

const ids = (list: { id: string }[]) => list.map((c) => c.id);

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

  test("saveMine refuses a cleaned contact too long for its column", async () => {
    await expect(
      caller.teamFinder.saveMine(
        input({ contacts: { discord: "a".repeat(101) } }),
      ),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "discord-too-long",
    });
    await expect(
      caller.teamFinder.saveMine(
        input({ contacts: { discord: "someone", phone: "1".repeat(33) } }),
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "phone-too-long" });
    expect((await caller.teamFinder.getMine()).card).toBeNull();

    const card = await caller.teamFinder.saveMine(
      input({ contacts: { discord: "a".repeat(100), phone: "1".repeat(32) } }),
    );
    expect(card.contacts.discord).toHaveLength(100);
    expect(card.contacts.phone).toHaveLength(32);
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
    const olderCard = await seedCard(older, {
      updatedAt: new Date(AFTER_RSVP - 3000),
    });
    const newerCard = await seedCard(newer, {
      updatedAt: new Date(AFTER_RSVP - 1000),
    });
    await seedCard(hidden, { shown: false });
    await seedCard(banned, { hiddenByOrganizerAt: new Date() });
    await seedCard(declined);
    await db
      .update(applications)
      .set({ status: "DECLINED" })
      .where(eq(applications.userId, declined));

    const list = await caller.teamFinder.list();
    expect(ids(list)).toEqual([newerCard, olderCard]);
  });

  test("list includes the caller's own hidden card, flagged", async () => {
    await seedCard(session.user.id, { shown: false });
    const list = await caller.teamFinder.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ isMine: true, shown: false });
  });

  test("setShown(true) on an organizer-hidden card keeps it off the board", async () => {
    const mine = await seedCard(session.user.id, {
      shown: false,
      hiddenByOrganizerAt: new Date(),
    });
    const board = await viewer();
    await caller.teamFinder.setShown({ shown: true });
    expect(ids(await board.teamFinder.list())).not.toContain(mine);
    await caller.teamFinder.saveMine(input({ shown: true }));
    expect(ids(await board.teamFinder.list())).not.toContain(mine);
    expect((await caller.teamFinder.getMine()).hiddenByOrganizer).toBe(true);
  });

  test("unhideCard puts the card back on the board with no owner action", async () => {
    const mine = await seedCard(session.user.id);
    await organizerCaller.teamFinder.hideCard({ cardId: mine });
    // The owner edits their card while it's hidden.
    await caller.teamFinder.saveMine(input({ lookingFor: "A designer" }));
    const board = await viewer();
    expect(ids(await board.teamFinder.list())).not.toContain(mine);

    await organizerCaller.teamFinder.unhideCard({ cardId: mine });
    expect(ids(await board.teamFinder.list())).toContain(mine);
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
    const other = await seedCard(await seedOther());
    const list = await organizerCaller.teamFinder.list();
    expect(ids(list)).toContain(other);
    await expect(organizerCaller.teamFinder.getMine()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
  });

  test("organizers also get organizer-hidden cards, flagged; hackers never do", async () => {
    const hidden = await seedCard(await seedOther(), {
      hiddenByOrganizerAt: new Date(),
    });
    const unshown = await seedCard(await seedOther(), {
      shown: false,
      hiddenByOrganizerAt: new Date(),
    });
    const visible = await seedCard(await seedOther());

    const board = await organizerCaller.teamFinder.list();
    expect(board.find((c) => c.id === hidden)).toMatchObject({
      hiddenByOrganizer: true,
    });
    expect(board.find((c) => c.id === visible)).toMatchObject({
      hiddenByOrganizer: false,
    });
    expect(ids(board)).not.toContain(unshown);

    const hackerBoard = ids(await caller.teamFinder.list());
    expect(hackerBoard).toContain(visible);
    expect(hackerBoard).not.toContain(hidden);
  });

  test("a confirmed hacker is refused before RSVP closes", async () => {
    vi.spyOn(Date, "now").mockReturnValue(RSVP_DEADLINE.getTime() - 1000);
    await expect(caller.teamFinder.list()).rejects.toMatchObject({
      message: "not-open",
    });
  });

  describe("photos", () => {
    const RANDOM_KEY = /^team-finder\/[0-9a-f-]{36}\.(webp|jpg)$/;
    const oldKey = "team-finder/00000000-0000-0000-0000-000000000000.webp";
    const photoOf = async () =>
      (
        await db.query.teamFinderCards.findFirst({
          where: eq(teamFinderCards.userId, session.user.id),
        })
      )?.photoKey;

    test("newPhotoKey is random, with no user id", () => {
      const key = photos.newPhotoKey("webp");
      expect(key).toMatch(RANDOM_KEY);
      expect(key.endsWith(".webp")).toBe(true);
      expect(photos.newPhotoKey("jpg").endsWith(".jpg")).toBe(true);
      expect(photos.newPhotoKey("webp")).not.toBe(key);
    });

    test("deletePhoto refuses a key outside team-finder/", async () => {
      const { deletePhoto } = await vi.importActual<typeof photos>(
        "~/server/storage/team-finder-photos",
      );
      await expect(deletePhoto("resumes/someone.pdf")).rejects.toThrow(
        "outside team-finder/",
      );
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

    test("uploadPhoto stores a random key and deletes only the caller's previous photo", async () => {
      const othersKey = "team-finder/11111111-1111-1111-1111-111111111111.webp";
      await seedCard(await seedOther(), { photoKey: othersKey });
      await seedCard(session.user.id, { photoKey: oldKey });
      const card = await caller.teamFinder.uploadPhoto({ photoBase64: webp() });
      const key = await photoOf();
      expect(key).toMatch(RANDOM_KEY);
      expect(key).not.toContain(session.user.id);
      expect(key).not.toBe(oldKey);
      expect(key?.endsWith(".webp")).toBe(true);
      expect(photos.putPhoto).toHaveBeenCalledWith(
        key,
        expect.anything(),
        "image/webp",
      );
      expect(photos.deletePhoto).toHaveBeenCalledTimes(1);
      expect(photos.deletePhoto).toHaveBeenCalledWith(oldKey);
      expect(card.photoUrl).toBe(`https://signed.test/${key}`);
    });

    test("uploadPhoto accepts JPEG (Safari can't make WebP)", async () => {
      await seedCard(session.user.id);
      await caller.teamFinder.uploadPhoto({ photoBase64: jpeg() });
      const key = await photoOf();
      expect(key).toMatch(RANDOM_KEY);
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

    test("list returns photoUrl when configured and none when not", async () => {
      await seedCard(session.user.id, { photoKey: oldKey });
      const [on] = await caller.teamFinder.list();
      expect(on?.photoUrl).toBe(`https://signed.test/${oldKey}`);

      vi.mocked(photos.photosConfigured).mockReturnValue(false);
      const [off] = await caller.teamFinder.list();
      expect(off?.photoUrl).toBeUndefined();
    });

    test("no card or photo link on the board carries a user id", async () => {
      const others = [await seedOther(), await seedOther(), await seedOther()];
      await seedCard(others[0]!, { photoKey: photos.newPhotoKey("webp") });
      await seedCard(others[1]!, { photoKey: photos.newPhotoKey("jpg") });
      // Organizers also get the cards they hid.
      await seedCard(others[2]!, {
        photoKey: photos.newPhotoKey("webp"),
        hiddenByOrganizerAt: new Date(),
      });
      await caller.teamFinder.saveMine(input());
      await caller.teamFinder.uploadPhoto({ photoBase64: jpeg() });
      const userIds = [session.user.id, organizer.user.id, ...others];

      for (const [board, count] of [
        [caller, 3],
        [organizerCaller, 4],
      ] as const) {
        const list = await board.teamFinder.list();
        expect(list).toHaveLength(count);
        for (const card of list) {
          expect(card).not.toHaveProperty("userId");
          expect(card.photoUrl).toBeDefined();
          for (const userId of userIds) {
            expect(JSON.stringify(card)).not.toContain(userId);
            expect(card.photoUrl).not.toContain(userId);
          }
        }
      }
    });
  });

  describe("report and hide", () => {
    test("report emails hello@ once, escaping the note", async () => {
      const other = await seedCard(await seedOther());
      vi.mocked(mailjet.sendViaMailjet).mockClear();
      await caller.teamFinder.report({ cardId: other, note: "<b>bad</b>" });
      expect(mailjet.sendViaMailjet).toHaveBeenCalledTimes(1);
      const [opts] = vi.mocked(mailjet.sendViaMailjet).mock.calls[0]!;
      expect(opts.to).toBe("hello@hackwestern.com");
      expect(opts.replyTo).toBe(session.user.email);
      expect(opts.subject).toMatch(/^Team finder report: /);
      expect(opts.html).toContain("&lt;b&gt;bad&lt;/b&gt;");
      expect(opts.html).not.toContain("<b>bad</b>");
    });

    test("reporting the same card twice succeeds, sends one email, keeps one row", async () => {
      const other = await seedCard(await seedOther());
      vi.mocked(mailjet.sendViaMailjet).mockClear();
      await caller.teamFinder.report({ cardId: other, note: "a" });
      await caller.teamFinder.report({ cardId: other, note: "b" });
      expect(mailjet.sendViaMailjet).toHaveBeenCalledTimes(1);
      const rows = await db
        .select()
        .from(teamFinderReports)
        .where(eq(teamFinderReports.reporterId, session.user.id));
      expect(rows).toHaveLength(1);
    });

    test("the sixth report in a day is refused and sends no email", async () => {
      vi.mocked(mailjet.sendViaMailjet).mockClear();
      for (let i = 0; i < REPORTS_PER_DAY; i++) {
        const card = await seedCard(await seedOther());
        await caller.teamFinder.report({ cardId: card, note: "x" });
      }
      const sixth = await seedCard(await seedOther());
      await expect(
        caller.teamFinder.report({ cardId: sixth, note: "x" }),
      ).rejects.toMatchObject({
        code: "TOO_MANY_REQUESTS",
        message: "report-limit",
      });
      expect(mailjet.sendViaMailjet).toHaveBeenCalledTimes(REPORTS_PER_DAY);
    });

    test("a report older than 24 hours doesn't count toward the cap", async () => {
      for (let i = 0; i < REPORTS_PER_DAY; i++) {
        await db.insert(teamFinderReports).values({
          reporterId: session.user.id,
          cardId: await seedCard(await seedOther()),
          createdAt: new Date(new Date().getTime() - 25 * 60 * 60 * 1000),
        });
      }
      const card = await seedCard(await seedOther());
      vi.mocked(mailjet.sendViaMailjet).mockClear();
      await caller.teamFinder.report({ cardId: card, note: "x" });
      expect(mailjet.sendViaMailjet).toHaveBeenCalledTimes(1);
    });

    test("a failed email leaves no row, and a retry sends it", async () => {
      const other = await seedCard(await seedOther());
      vi.mocked(mailjet.sendViaMailjet).mockClear();
      vi.mocked(mailjet.sendViaMailjet).mockResolvedValueOnce({
        data: null,
        error: new Error("down"),
      } as never);
      await expect(
        caller.teamFinder.report({ cardId: other, note: "x" }),
      ).rejects.toMatchObject({ message: "report-failed" });
      expect(
        await db
          .select()
          .from(teamFinderReports)
          .where(eq(teamFinderReports.reporterId, session.user.id)),
      ).toHaveLength(0);
      await caller.teamFinder.report({ cardId: other, note: "x" });
      expect(mailjet.sendViaMailjet).toHaveBeenCalledTimes(2);
    });

    test("report on a missing, unshown or own card is refused", async () => {
      const other = await seedCard(await seedOther(), { shown: false });
      await expect(
        caller.teamFinder.report({ cardId: other, note: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        caller.teamFinder.report({ cardId: randomUUID(), note: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      const mine = await seedCard(session.user.id);
      await expect(
        caller.teamFinder.report({ cardId: mine, note: "x" }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    });

    test("a user id doesn't name a card for report or hide", async () => {
      const other = await seedOther();
      const card = await seedCard(other);
      await expect(
        caller.teamFinder.report({ cardId: other, note: "x" }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      await expect(
        organizerCaller.teamFinder.hideCard({ cardId: other }),
      ).rejects.toMatchObject({ code: "NOT_FOUND" });
      expect(ids(await caller.teamFinder.list())).toContain(card);
    });

    test("a hacker cannot hide a card", async () => {
      const other = await seedCard(await seedOther());
      await expect(
        caller.teamFinder.hideCard({ cardId: other }),
      ).rejects.toMatchObject({ code: "FORBIDDEN" });
    });

    test("hideCard removes the card from list; unhideCard restores it", async () => {
      const mine = await seedCard(session.user.id);
      await organizerCaller.teamFinder.hideCard({ cardId: mine });
      expect((await caller.teamFinder.getMine()).hiddenByOrganizer).toBe(true);
      const other = await seedCard(await seedOther());
      await organizerCaller.teamFinder.hideCard({ cardId: other });
      expect(ids(await caller.teamFinder.list())).not.toContain(other);

      await organizerCaller.teamFinder.unhideCard({ cardId: other });
      expect(ids(await caller.teamFinder.list())).toContain(other);
    });
  });
});
