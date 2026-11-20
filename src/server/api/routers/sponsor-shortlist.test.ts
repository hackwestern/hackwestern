import { describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  coffeeChats,
  sponsorInterests,
  sponsorJudgingSponsors,
  sponsorScans,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";

// Sponsors aren't logged in: their private UUID is the credential.
const anon = createCaller(createInnerTRPCContext({ session: null }));

/** A signed-in organizer on the sponsor's portal link. */
async function organizer() {
  return createCaller(
    createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
  );
}

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Sponsor ${faker.string.alphanumeric(10)}` })
    .returning();
  return row!;
}

/**
 * Submitted chatting preferences worth `seats` hacker seats (one rep,
 * 1-on-1, free all morning and afternoon), which opens the shortlist.
 */
async function withSeats(sponsorId: string, seats: number) {
  await db
    .insert(coffeeChatPrefs)
    .values({ sponsorId, hackersPerChat: 1, submittedAt: new Date() });
  const [rep] = await db
    .insert(coffeeChatReps)
    .values({
      sponsorId,
      name: "Dana",
      phone: "5195550142",
      isPrimary: true,
      chatsWanted: seats,
    })
    .returning();
  await db.insert(coffeeChatRepSessions).values(
    ["10", "11", "15", "16"].map((sessionId) => ({
      repId: rep!.id,
      sessionId,
    })),
  );
}

async function hackerRanking(
  sponsorId: string | null,
  share: boolean,
  status: "CONFIRMED" | "DECLINED" = "CONFIRMED",
  name: { first: string; last: string } | null = null,
) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status,
    agreeShareWithSponsors: share,
    firstName: name?.first ?? (share ? "Shared" : "Private"),
    lastName: name?.last ?? "Hacker",
  });
  if (sponsorId) {
    await db
      .insert(sponsorInterests)
      .values({ userId: session.user.id, sponsorId, rank: 1 });
  }
  return session.user.id;
}

describe("sponsorShortlist.list", () => {
  test("rejects a sponsor id that isn't a UUID", async () => {
    await expect(
      anon.sponsorShortlist.list({ sponsor: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("unknown sponsor is NOT_FOUND", async () => {
    await expect(
      anon.sponsorShortlist.list({ sponsor: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("lists consenting hackers, the ones who ranked this sponsor first", async () => {
    const mine = await sponsor();
    const other = await sponsor();
    const sharedId = await hackerRanking(mine.id, true);
    const privateId = await hackerRanking(mine.id, false);
    const elsewhereId = await hackerRanking(other.id, true);

    const res = await anon.sponsorShortlist.list({
      sponsor: mine.id.toUpperCase(),
    });
    expect(res.sponsorName).toBe(mine.name);
    // Every admitted hacker who shares is a candidate (Lucas, 2026-11-20):
    // this sponsor's own ranking first, then everyone else.
    const ids = res.hackers.map((h) => h.userId);
    expect(ids[0]).toBe(sharedId);
    expect(ids).toContain(elsewhereId);
    expect(res.hackers[0]).toMatchObject({
      userId: sharedId,
      shortlisted: false,
    });
    const json = JSON.stringify(res);
    expect(json).not.toContain(privateId);
    expect(json).not.toContain("Private");
  });
});

describe("sponsorShortlist.add / remove", () => {
  test("rejects a sponsor id that isn't a UUID", async () => {
    await expect(
      anon.sponsorShortlist.add({ sponsor: "not-a-uuid", userId: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      anon.sponsorShortlist.remove({ sponsor: "not-a-uuid", userId: "x" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("adds an interested hacker once, and remove takes them off", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const userId = await hackerRanking(mine.id, true);

    await anon.sponsorShortlist.add({ sponsor: mine.id, userId });
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId });
    let res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.hackers.filter((h) => h.shortlisted)).toHaveLength(1);

    await anon.sponsorShortlist.remove({ sponsor: mine.id, userId });
    res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.hackers[0]!.shortlisted).toBe(false);
  });

  test("can't shortlist a hacker who didn't consent or isn't admitted", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 3);
    const notSharing = await hackerRanking(mine.id, false);
    const declined = await hackerRanking(mine.id, true, "DECLINED");
    // Invites only go to hackers who share, so a pick of theirs is refused.
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: notSharing }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: declined }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("a sharing hacker found by search can be shortlisted, is listed and takes a seat", async () => {
    const mine = await sponsor();
    const other = await sponsor();
    await withSeats(mine.id, 1);
    const rankedOther = await hackerRanking(other.id, true);
    const rankedNobody = await hackerRanking(null, true);
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: rankedOther });
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.hackers.find((h) => h.userId === rankedOther)?.shortlisted).toBe(
      true,
    );
    expect(res.picked).toBe(1);
    // The one seat is taken.
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: rankedNobody }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("unknown sponsor is NOT_FOUND", async () => {
    const userId = await hackerRanking(null, true);
    await expect(
      anon.sponsorShortlist.add({ sponsor: faker.string.uuid(), userId }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("sponsorShortlist: seats, submit, scanned", () => {
  test("locked until chatting preferences are submitted", async () => {
    const mine = await sponsor();
    const userId = await hackerRanking(mine.id, true);
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId }),
    ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.prefsSubmitted).toBe(false);
    expect(res.maxShortlist).toBe(0);
  });

  test("capped at the sponsor's hacker seats", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 1);
    const a = await hackerRanking(mine.id, true);
    const b = await hackerRanking(mine.id, true);
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: a });
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: b }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    expect(
      (await anon.sponsorShortlist.list({ sponsor: mine.id })).maxShortlist,
    ).toBe(1);
  });

  test("shortlist submit, reopen and picks leave coffee_chat_pref.updated_at alone", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const a = await hackerRanking(mine.id, true);
    const updatedAt = async () =>
      (
        await db
          .select()
          .from(coffeeChatPrefs)
          .where(eq(coffeeChatPrefs.sponsorId, mine.id))
      )[0]!.updatedAt.getTime();
    const before = await updatedAt();
    await new Promise((r) => setTimeout(r, 5));
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: a });
    await anon.sponsorShortlist.remove({ sponsor: mine.id, userId: a });
    await anon.sponsorShortlist.submit({ sponsor: mine.id });
    // Reopening a submitted shortlist is an organizer's (sponsors submit once).
    await (await organizer()).sponsorShortlist.reopen({ sponsor: mine.id });
    expect(await updatedAt()).toBe(before);
  });

  test("people you scanned take seats: cap = seats - scanned", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 2);
    const scannedOne = await hackerRanking(null, true);
    await db
      .insert(sponsorScans)
      .values({ sponsorId: mine.id, userId: scannedOne });
    const a = await hackerRanking(mine.id, true);
    const b = await hackerRanking(mine.id, true);
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect([res.seats, res.maxShortlist]).toEqual([2, 1]);
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: a });
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: b }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("seats lowered below the shortlist: kept, but submit is refused with how many to remove", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 3);
    const ids = [
      await hackerRanking(mine.id, true),
      await hackerRanking(mine.id, true),
      await hackerRanking(mine.id, true),
    ];
    for (const userId of ids)
      await anon.sponsorShortlist.add({ sponsor: mine.id, userId });
    await db
      .update(coffeeChatReps)
      .set({ chatsWanted: 1 })
      .where(eq(coffeeChatReps.sponsorId, mine.id));
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect([res.picked, res.maxShortlist]).toEqual([3, 1]);
    await expect(
      anon.sponsorShortlist.submit({ sponsor: mine.id }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: "You now have room for 1 on your shortlist. Remove 2.",
    });
    await anon.sponsorShortlist.remove({ sponsor: mine.id, userId: ids[0]! });
    await anon.sponsorShortlist.remove({ sponsor: mine.id, userId: ids[1]! });
    await anon.sponsorShortlist.submit({ sponsor: mine.id });
  });

  test("submitted once: a sponsor can't edit, re-submit or reopen it", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const a = await hackerRanking(mine.id, true);
    await anon.sponsorShortlist.submit({ sponsor: mine.id });
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.submittedAt).toBeInstanceOf(Date);
    expect(res.canEditSubmitted).toBe(false);
    await expect(
      anon.sponsorShortlist.add({ sponsor: mine.id, userId: a }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      anon.sponsorShortlist.remove({ sponsor: mine.id, userId: a }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    await expect(
      anon.sponsorShortlist.submit({ sponsor: mine.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
    const refused = await anon.sponsorShortlist
      .reopen({ sponsor: mine.id })
      .then(
        () => null,
        (e: { code?: string; message: string }) => e,
      );
    expect(refused?.code).toBe("FORBIDDEN");
    expect(refused?.message).toContain("ask your point of contact");
    const after = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(after.submittedAt).toEqual(res.submittedAt);
  });

  test("an organizer can reopen a submitted shortlist, edit and submit it", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const a = await hackerRanking(mine.id, true);
    await anon.sponsorShortlist.submit({ sponsor: mine.id });
    const org = await organizer();
    expect(
      (await org.sponsorShortlist.list({ sponsor: mine.id })).canEditSubmitted,
    ).toBe(true);
    await org.sponsorShortlist.reopen({ sponsor: mine.id });
    await org.sponsorShortlist.add({ sponsor: mine.id, userId: a });
    const after = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(after.submittedAt).toBeNull();
    expect(after.hackers.find((h) => h.userId === a)?.shortlisted).toBe(true);
  });

  test("never submitted (skipped): still open, nothing locks", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const a = await hackerRanking(mine.id, true);
    await anon.sponsorShortlist.reopen({ sponsor: mine.id });
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: a });
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.submittedAt).toBeNull();
    expect(res.hackers.find((h) => h.userId === a)?.shortlisted).toBe(true);
  });

  test("scanned hackers are listed first, on their own, first name only without consent", async () => {
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const scannedShared = await hackerRanking(mine.id, true);
    const scannedPrivate = await hackerRanking(null, false);
    await db.insert(sponsorScans).values([
      { sponsorId: mine.id, userId: scannedShared, repName: "Dana" },
      {
        sponsorId: mine.id,
        userId: scannedPrivate,
        scannedAt: new Date(Date.now() + 1000),
      },
    ]);
    const res = await anon.sponsorShortlist.list({ sponsor: mine.id });
    expect(res.scanned.map((h) => [h.name, h.repName])).toEqual([
      ["Shared Hacker", "Dana"],
      ["Private", null],
    ]);
    expect(res.scanned[1]).toMatchObject({ shared: false, github: null });
    expect(res.hackers.map((h) => h.userId)).not.toContain(scannedShared);
  });
});

describe("sponsorShortlist.chatPartners", () => {
  test("full profile only for hackers who agreed to share", async () => {
    const mine = await sponsor();
    const sharedId = await hackerRanking(null, true);
    const privateId = await hackerRanking(null, false);
    await db.insert(coffeeChats).values([
      { sponsorId: mine.id, userId: sharedId, slotTime: "10:00" },
      { sponsorId: mine.id, userId: privateId, slotTime: "10:15" },
    ]);

    const partners = await anon.sponsorShortlist.chatPartners({
      sponsor: mine.id,
    });
    const byName = Object.fromEntries(partners.map((p) => [p.name, p]));
    expect(byName["Shared Hacker"]).toMatchObject({ shared: true });
    expect(byName.Private).toMatchObject({
      shared: false,
      team: null,
      resume: null,
      github: null,
    });
    expect(JSON.stringify(partners)).not.toContain("@");
  });
});

describe("sponsorShortlist.forSponsor (organizers)", () => {
  test("logged out is UNAUTHORIZED", async () => {
    await expect(
      anon.sponsorShortlist.forSponsor({ sponsorId: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  test("a hacker is FORBIDDEN", async () => {
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(
      hacker.sponsorShortlist.forSponsor({ sponsorId: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("returns the sponsor's shortlist and drops hackers who withdrew consent", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const mine = await sponsor();
    await withSeats(mine.id, 4);
    const keep = await hackerRanking(mine.id, true);
    const withdraws = await hackerRanking(mine.id, true);
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: keep });
    await anon.sponsorShortlist.add({ sponsor: mine.id, userId: withdraws });
    await db
      .update(applications)
      .set({ agreeShareWithSponsors: false })
      .where(eq(applications.userId, withdraws));

    const res = await organizer.sponsorShortlist.forSponsor({
      sponsorId: mine.id,
    });
    expect(res.hackers.map((h) => h.userId)).toEqual([keep]);
  });
});

describe("sponsorShortlist.search", () => {
  test("finds admitted hackers by name; private hackers by first name only", async () => {
    const mine = await sponsor();
    const tag = faker.string.alpha({ length: 8, casing: "lower" });
    const shared = await hackerRanking(null, true, "CONFIRMED", {
      first: `Ada${tag}`,
      last: `Lovelace${tag}`,
    });
    const hidden = await hackerRanking(null, false, "CONFIRMED", {
      first: `Grace${tag}`,
      last: `Hopper${tag}`,
    });
    await hackerRanking(null, true, "DECLINED", {
      first: `Alan${tag}`,
      last: `Turing${tag}`,
    });

    const byLast = await anon.sponsorShortlist.search({
      sponsor: mine.id,
      q: `lovelace${tag}`,
    });
    expect(byLast.map((h) => [h.userId, h.name, h.shared])).toEqual([
      [shared, `Ada${tag} Lovelace${tag}`, true],
    ]);
    // A private hacker's last name never matches, and never shows.
    expect(
      await anon.sponsorShortlist.search({
        sponsor: mine.id,
        q: `hopper${tag}`,
      }),
    ).toEqual([]);
    const byFirst = await anon.sponsorShortlist.search({
      sponsor: mine.id,
      q: `grace${tag}`,
    });
    expect(
      byFirst.map((h) => [h.userId, h.name, h.shared, h.team, h.github]),
    ).toEqual([[hidden, `Grace${tag}`, false, null, null]]);
    // Not admitted: not found.
    expect(
      await anon.sponsorShortlist.search({
        sponsor: mine.id,
        q: `turing${tag}`,
      }),
    ).toEqual([]);
    expect(
      await anon.sponsorShortlist.search({ sponsor: mine.id, q: `alan${tag}` }),
    ).toEqual([]);
  });

  test("needs at least 2 characters, and % matches literally", async () => {
    const mine = await sponsor();
    await expect(
      anon.sponsorShortlist.search({ sponsor: mine.id, q: "a" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      await anon.sponsorShortlist.search({ sponsor: mine.id, q: "%%" }),
    ).toEqual([]);
  });
});
