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

describe("teamFinder", () => {
  beforeEach(async () => {
    vi.spyOn(Date, "now").mockReturnValue(AFTER_RSVP);
    await seedApplication(session.user.id);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
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
});
