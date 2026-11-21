import { describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { COFFEE_SESSION_IDS } from "~/lib/coffee-chat-sessions";

// Book an event's "+ Add a rep", and the 5-9 PM sessions (2026-11-21).

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `EventRep ${faker.string.alphanumeric(10)}` })
    .returning();
  return row!;
}
const organizer = async () =>
  createCaller(
    createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
  );
const freeOf = async (repId: string) =>
  (
    await db
      .select({ s: coffeeChatRepSessions.sessionId })
      .from(coffeeChatRepSessions)
      .where(eq(coffeeChatRepSessions.repId, repId))
  ).map((r) => r.s);

describe("addEventRep", () => {
  test("adds a rep with no chats, free all day, without touching the sponsor's setup", async () => {
    const s = await sponsor();
    const o = await organizer();
    const rep = await o.coffeeChatSessions.addEventRep({
      sponsorId: s.id,
      name: "Dana",
      phone: "5195550001",
    });
    const [row] = await db
      .select()
      .from(coffeeChatReps)
      .where(eq(coffeeChatReps.id, rep.id));
    expect(row).toMatchObject({
      name: "Dana",
      chatsWanted: 0,
      isPrimary: true,
    });
    expect((await freeOf(rep.id)).sort()).toEqual(
      [...COFFEE_SESSION_IDS].sort(),
    );
    // Not "changed after Send": no preferences row is written.
    const prefs = await db
      .select()
      .from(coffeeChatPrefs)
      .where(eq(coffeeChatPrefs.sponsorId, s.id));
    expect(prefs).toEqual([]);
  });

  test("is organizers only", async () => {
    const s = await sponsor();
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(
      hacker.coffeeChatSessions.addEventRep({
        sponsorId: s.id,
        name: "Dana",
        phone: "5195550001",
      }),
    ).rejects.toThrow();
  });
});

describe("evening sessions", () => {
  test("a sponsor's new rep starts free in the daytime only, not 5-9 PM", async () => {
    const s = await sponsor();
    const o = await organizer();
    const rep = await o.coffeeChatSetup.addRep({
      sponsor: s.id,
      name: "Eve",
      phone: "5195550002",
    });
    const free = await freeOf(rep.id);
    expect(free).not.toContain("17");
    expect(free).not.toContain("20");
  });
});
