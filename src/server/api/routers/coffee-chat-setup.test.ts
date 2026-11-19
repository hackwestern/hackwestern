import { describe, expect, test, vi } from "vitest";
import type * as InvitesModule from "~/server/api/utils/coffee-chat-invites";
import type * as RunOfShowModule from "~/server/api/utils/run-of-show-sheet";
import { asc, eq } from "drizzle-orm";
import { faker } from "@faker-js/faker";

import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockSession } from "~/server/auth";
import {
  applications,
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatReps,
  coffeeChats,
  sponsorJudgingSponsors,
  sponsorScans,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { layoutOf } from "~/server/api/utils/coffee-chat-invites";
import { loadBoardState } from "~/server/api/utils/coffee-chat-sessions-board";

const { stamp, ros, deliver } = vi.hoisted(() => ({
  stamp: Date.now(),
  /** Flip to make the run-of-show read fail. */
  ros: { fail: false },
  /** Spy on invite notices (nothing is ever sent from a test). */
  deliver: vi.fn((_jobs: { event: string }[]) =>
    Promise.resolve({ slack: 0, email: 0, failed: 0, skipped: 0 }),
  ),
}));

vi.mock("~/server/api/utils/coffee-chat-invites", async (importOriginal) => ({
  ...(await importOriginal<typeof InvitesModule>()),
  deliverInviteNotices: deliver,
}));

// "WorkCo<stamp>"'s workshop is 13:00-14:00 -> 1-2 blocked; with 15-min
// chats 2-3 is cut to 2:15-3:00 (with 30-min chats, 2:30-3:00).
// "LateCo<stamp>"'s runs 13:00-14:20 -> 2-3 keeps 2:45-3:00: one 15-min
// chat, no 30-min one.
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof RunOfShowModule>()),
  getRunOfShow: () =>
    ros.fail ? Promise.reject(new Error("sheet down")) : Promise.resolve({
      readAt: "2026-11-21T12:00:00.000Z",
      items: [
        {
          id: "Saturday-13:00-sponsor-workshop",
          day: "Saturday",
          start: "13:00",
          end: "14:00",
          column: "sponsor-workshop",
          title: `WorkCo${stamp} Workshop`,
          location: "Rm 2230",
          sponsors: [],
        },
        {
          id: "Saturday-13:00-sponsor-workshop-cut",
          day: "Saturday",
          start: "13:00",
          end: "14:00",
          column: "sponsor-workshop",
          title: `CutCo${stamp} Workshop`,
          location: "Rm 2232",
          sponsors: [],
        },
        {
          id: "Saturday-13:00-sponsor-workshop-late",
          day: "Saturday",
          start: "13:00",
          end: "14:20",
          column: "sponsor-workshop",
          title: `LateCo${stamp} Workshop`,
          location: "Rm 2231",
          sponsors: [],
        },
      ],
      tasks: [],
      coffeeChats: [],
      ceremonies: [],
      workshops: [],
      availability: { people: [], slots: [] },
    }),
}));

// Sponsors aren't logged in: their private UUID is the credential.
const anon = createCaller(createInnerTRPCContext({ session: null }));
const setup = anon.coffeeChatSetup;

let n = 0;
async function sponsor(name = `Co${stamp}-${n++}`) {
  const [row] = await db.insert(sponsorJudgingSponsors).values({ name }).returning();
  return row!.id;
}

const code = (p: Promise<unknown>) =>
  p.then(
    () => "ok",
    (e: { code?: string }) => e.code,
  );

async function admittedHacker(share = true) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status: "CONFIRMED",
    agreeShareWithSponsors: share,
    firstName: "Ada",
    lastName: "Lovelace",
  });
  return session.user.id;
}

describe("coffeeChatSetup: Your team", () => {
  test("unknown sponsor is NOT_FOUND, bad uuid BAD_REQUEST", async () => {
    expect(await code(setup.get({ sponsor: faker.string.uuid() }))).toBe("NOT_FOUND");
    expect(await code(setup.get({ sponsor: "nope" }))).toBe("BAD_REQUEST");
  });

  test("first rep gets the crown; reps start with every open session ticked", async () => {
    const id = await sponsor(`WorkCo${stamp}`);
    const a = await setup.addRep({ sponsor: id, name: "Dana W.", phone: "519-555-0142" });
    const b = await setup.addRep({ sponsor: id, name: "Leo T.", phone: "5195550164" });
    expect(a.isPrimary).toBe(true);
    expect(b.isPrimary).toBe(false);
    const res = await setup.get({ sponsor: id });
    // 1-2 is blocked; 2-3 is only cut (2:15-3:00), so it's open and ticked.
    expect(res.blocked).toEqual(["13"]);
    expect(res.partial).toEqual({ "14": { start: 855, end: 900 } });
    expect(res.workshops).toHaveLength(1);
    expect(res.reps.map((r) => r.name)).toEqual(["Dana W.", "Leo T."]);
    expect(res.reps[0]!.free).toEqual(["10", "11", "14", "15", "16"]);
    expect(res.reps[0]!.chatsWanted).toBe(4);
    // 1-on-1 by default: 4 chats each, 4 hackers each.
    expect(res.totals).toEqual({ chats: 8, hackers: 8 });
  });

  test("name and phone are required; phone needs 7 digits", async () => {
    const id = await sponsor();
    expect(await code(setup.addRep({ sponsor: id, name: "", phone: "5195550142" }))).toBe("BAD_REQUEST");
    expect(await code(setup.addRep({ sponsor: id, name: "Dana", phone: "" }))).toBe("BAD_REQUEST");
    expect(await code(setup.addRep({ sponsor: id, name: "Dana", phone: "555" }))).toBe("BAD_REQUEST");
  });

  test("the crown moves; removing the primary passes it on; reps are per sponsor", async () => {
    const id = await sponsor();
    const other = await sponsor();
    const a = await setup.addRep({ sponsor: id, name: "A", phone: "5195550001" });
    const b = await setup.addRep({ sponsor: id, name: "B", phone: "5195550002" });
    await setup.setPrimary({ sponsor: id, repId: b.id });
    let res = await setup.get({ sponsor: id });
    expect(res.reps.filter((r) => r.isPrimary).map((r) => r.name)).toEqual(["B"]);

    expect(await code(setup.setPrimary({ sponsor: other, repId: a.id }))).toBe("NOT_FOUND");
    expect(await code(setup.removeRep({ sponsor: other, repId: a.id }))).toBe("NOT_FOUND");

    await setup.updateRep({ sponsor: id, repId: a.id, name: "A2", phone: "5195550003" });
    await setup.removeRep({ sponsor: id, repId: b.id });
    res = await setup.get({ sponsor: id });
    expect(res.reps).toEqual([expect.objectContaining({ name: "A2", phone: "5195550003", isPrimary: true })]);
  });
});

describe("coffeeChatSetup: preferences", () => {
  test("save drops blocked sessions; chats 0 allowed; submit sets submittedAt", async () => {
    const id = await sponsor(`WorkCo${stamp}-b`);
    // Not the workshop sponsor (name differs), so nothing is blocked here.
    const a = await setup.addRep({ sponsor: id, name: "A", phone: "5195550001" });
    const b = await setup.addRep({ sponsor: id, name: "B", phone: "5195550002" });
    await setup.savePrefs({
      sponsor: id,
      hackersPerChat: 3,
      reps: [
        { id: a.id, chatsWanted: 5, free: ["10"] },
        { id: b.id, chatsWanted: 0, free: ["10", "11"] },
      ],
    });
    let res = await setup.get({ sponsor: id });
    expect(res.hackersPerChat).toBe(3);
    expect(res.chatMinutes).toBe(30);
    // A: 1 session x 2 chats (capped from 5); B: 0 chats.
    expect(res.totals).toEqual({ chats: 2, hackers: 6 });
    expect(res.submittedAt).toBeNull();

    await setup.submitPrefs({ sponsor: id });
    res = await setup.get({ sponsor: id });
    expect(res.submittedAt).toBeInstanceOf(Date);
  });

  test("blocked sessions are dropped for the workshop sponsor; cut ones stay", async () => {
    const [work] = await db
      .select()
      .from(sponsorJudgingSponsors)
      .where(eq(sponsorJudgingSponsors.name, `WorkCo${stamp}`));
    const res0 = await setup.get({ sponsor: work!.id });
    const rep = res0.reps[0]!;
    await setup.savePrefs({
      sponsor: work!.id,
      hackersPerChat: 1,
      reps: [{ id: rep.id, chatsWanted: 4, free: ["13", "14", "16"] }],
    });
    const res = await setup.get({ sponsor: work!.id });
    expect(res.reps.find((r) => r.id === rep.id)!.free).toEqual(["14", "16"]);
    // 4 at 4-5 is enough; the cut 2-3 holds 3 more.
    expect(res.totals.chats).toBe(4 + 4);
  });

  test("a cut session holds only its whole chats, for the chat length being saved", async () => {
    const id = await sponsor(`LateCo${stamp}`);
    const a = await setup.addRep({ sponsor: id, name: "Lu", phone: "5195550001" });
    // 1-on-1s: 2:45-3:00 fits one chat, so 2-3 can be ticked.
    await setup.savePrefs({ sponsor: id, hackersPerChat: 1, reps: [{ id: a.id, chatsWanted: 6, free: ["14", "16"] }] });
    let res = await setup.get({ sponsor: id });
    expect(res.blocked).toEqual(["13"]);
    expect(res.partial).toEqual({ "14": { start: 885, end: 900 } });
    expect(res.reps[0]!.free).toEqual(["14", "16"]);
    // 1 chat at 2:45 + 4 at 4-5: Lu asked for 6, gets up to 5.
    expect(res.totals).toEqual({ chats: 5, hackers: 5 });

    // Groups of 2 (30 min) in the same save: 2-3 no longer fits a chat and is dropped.
    await setup.savePrefs({ sponsor: id, hackersPerChat: 2, reps: [{ id: a.id, chatsWanted: 6, free: ["14", "16"] }] });
    res = await setup.get({ sponsor: id });
    expect(res.blocked).toEqual(["13", "14"]);
    expect(res.partial).toEqual({});
    expect(res.reps[0]!.free).toEqual(["16"]);
    expect(res.totals).toEqual({ chats: 2, hackers: 4 });
  });

  test("submit needs a rep with a chat at a free time", async () => {
    const id = await sponsor();
    expect(await code(setup.submitPrefs({ sponsor: id }))).toBe("BAD_REQUEST");
    const a = await setup.addRep({ sponsor: id, name: "A", phone: "5195550001" });
    await setup.savePrefs({ sponsor: id, hackersPerChat: 1, reps: [{ id: a.id, chatsWanted: 0, free: ["10"] }] });
    expect(await code(setup.submitPrefs({ sponsor: id }))).toBe("BAD_REQUEST");
    await setup.savePrefs({ sponsor: id, hackersPerChat: 1, reps: [{ id: a.id, chatsWanted: 2, free: [] }] });
    expect(await code(setup.submitPrefs({ sponsor: id }))).toBe("BAD_REQUEST");
  });

  test("savePrefs skips reps that aren't theirs (removed elsewhere, or another sponsor's)", async () => {
    const id = await sponsor();
    const other = await sponsor();
    const mine = await setup.addRep({ sponsor: id, name: "Me", phone: "5195550001" });
    const a = await setup.addRep({ sponsor: other, name: "A", phone: "5195550001" });
    const res = await setup.savePrefs({
      sponsor: id,
      hackersPerChat: 2,
      reps: [
        { id: a.id, chatsWanted: 1, free: [] },
        { id: mine.id, chatsWanted: 3, free: ["10"] },
      ],
    });
    expect(res.skipped).toBe(1);
    const [theirs] = await db.select().from(coffeeChatReps).where(eq(coffeeChatReps.id, a.id));
    expect(theirs!.chatsWanted).toBe(4);
    expect((await setup.get({ sponsor: id })).reps[0]!.chatsWanted).toBe(3);
  });
});

describe("coffeeChatSetup: every write bumps coffee_chat_pref.updated_at", () => {
  test("add, edit, crown, prefs, remove each move updated_at; longer 1-on-1s stay off", async () => {
    const id = await sponsor();
    const stamp = async () => {
      const [pref] = await db.select().from(coffeeChatPrefs).where(eq(coffeeChatPrefs.sponsorId, id));
      return pref;
    };
    // Each write must land after the one before.
    const tick = () => new Promise((r) => setTimeout(r, 5));
    const a = await setup.addRep({ sponsor: id, name: "A", phone: "5195550001" });
    let before = (await stamp())!.updatedAt.getTime();
    const writes: (() => Promise<unknown>)[] = [
      () => setup.addRep({ sponsor: id, name: "B", phone: "5195550002" }),
      () => setup.updateRep({ sponsor: id, repId: a.id, name: "A2", phone: "5195550003" }),
      async () => {
        const res = await setup.get({ sponsor: id });
        const b = res.reps.find((r) => r.name === "B")!;
        return setup.setPrimary({ sponsor: id, repId: b.id });
      },
      () => setup.savePrefs({ sponsor: id, hackersPerChat: 1, reps: [{ id: a.id, chatsWanted: 2, free: ["10"] }] }),
      () => setup.removeRep({ sponsor: id, repId: a.id }),
    ];
    for (const write of writes) {
      await tick();
      await write();
      const after = (await stamp())!.updatedAt.getTime();
      expect(after).toBeGreaterThan(before);
      before = after;
    }
    expect((await stamp())!.longerOneOnOne).toBe(false);
    // Submitting isn't an edit.
    await tick();
    await setup.addRep({ sponsor: id, name: "C", phone: "5195550009" });
    const res = await setup.get({ sponsor: id });
    await setup.savePrefs({
      sponsor: id,
      hackersPerChat: 1,
      reps: res.reps.map((r) => ({ id: r.id, chatsWanted: 2, free: ["10"] })),
    });
    const edited = (await stamp())!.updatedAt.getTime();
    await tick();
    await setup.submitPrefs({ sponsor: id });
    expect((await stamp())!.updatedAt.getTime()).toBe(edited);
  });
});

describe("coffeeChatSetup: after organizers send", () => {
  test("Your chats, seats and the after-invites warning", async () => {
    const id = await sponsor();
    const a = await setup.addRep({ sponsor: id, name: "Dana", phone: "5195550001" });
    await setup.savePrefs({ sponsor: id, hackersPerChat: 2, reps: [{ id: a.id, chatsWanted: 3, free: ["10", "11"] }] });
    await setup.submitPrefs({ sponsor: id });
    const sentAt = new Date(Date.now() + 1000);
    const [p10] = await db
      .insert(coffeeChatPlacements)
      .values([
        { repId: a.id, sessionId: "10", room: "2241", status: "sent", sentAt },
        { repId: a.id, sessionId: "11", room: "1352", status: "sent", sentAt },
      ])
      .returning();
    const hacker = await admittedHacker();
    await db.insert(coffeeChats).values({
      sponsorId: id,
      userId: hacker,
      slotTime: "10:00",
      durationMinutes: 30,
      status: "accepted",
      placementId: p10!.id,
    });

    const res = await setup.get({ sponsor: id });
    expect(res.confirmed).toBe(true);
    expect(res.chats.map((c) => [c.sessionId, c.room, c.building, c.chats, c.end])).toEqual([
      ["10", "2241", "near", 2, "11:00"],
      ["11", "1352", "ivey", 1, "11:30"],
    ]);
    expect(res.chats[0]!.hackers).toEqual([{ firstName: "Ada", status: "accepted" }]);
    expect(res.seats).toEqual({ total: 6, accepted: 1, invited: 1, changed: 0 });
    expect(res.editedAfterSend).toBe(false);

    // A change now needs the warning confirmed, and is then flagged.
    const refused = await setup
      .updateRep({ sponsor: id, repId: a.id, name: "Dana W.", phone: "5195550001" })
      .then(
        () => null,
        (e: { code?: string; message: string }) => e,
      );
    expect(refused?.code).toBe("PRECONDITION_FAILED");
    expect(refused?.message).toContain("Invites are already out");
    await db.update(coffeeChatPlacements).set({ sentAt: new Date(Date.now() - 1000) }).where(eq(coffeeChatPlacements.repId, a.id));
    await setup.updateRep({ sponsor: id, repId: a.id, name: "Dana W.", phone: "5195550001", confirmAfterInvites: true });
    const after = await setup.get({ sponsor: id });
    expect(after.editedAfterSend).toBe(true);
    const [pref] = await db.select().from(coffeeChatPrefs).where(eq(coffeeChatPrefs.sponsorId, id));
    expect(pref!.updatedAt.getTime()).toBeGreaterThan(after.sentAt!.getTime());
    expect(after.seats.changed).toBe(0);

    // Unticking 10-11 leaves its sent chat (1 invited hacker) until
    // organizers move it: the status card counts just that one.
    await setup.savePrefs({
      sponsor: id,
      hackersPerChat: 2,
      reps: [{ id: a.id, chatsWanted: 3, free: ["11"] }],
      confirmAfterInvites: true,
    });
    expect((await setup.get({ sponsor: id })).seats.changed).toBe(1);
  });
});

describe("coffeeChatSetup.recordScan", () => {
  test("records a scan once, updates the rep by id, refuses non-hackers and other sponsors' reps", async () => {
    const id = await sponsor();
    const other = await sponsor();
    const hacker = await admittedHacker(false);
    const dana = await setup.addRep({ sponsor: id, name: "Dana W.", phone: "5195550001" });
    const theirs = await setup.addRep({ sponsor: other, name: "Mallory", phone: "5195550002" });
    await setup.recordScan({ sponsor: id, userId: hacker });
    await setup.recordScan({ sponsor: id, userId: hacker, repId: dana.id });
    expect(await code(setup.recordScan({ sponsor: id, userId: hacker, repId: theirs.id }))).toBe("NOT_FOUND");
    await setup.recordScan({ sponsor: id, userId: hacker });
    const rows = await db.select().from(sponsorScans).where(eq(sponsorScans.sponsorId, id));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.repName).toBe("Dana W.");
    expect((await setup.get({ sponsor: id })).scannedCount).toBe(1);

    const notHacker = (await mockSession(db)).user.id;
    expect(await code(setup.recordScan({ sponsor: id, userId: notHacker }))).toBe("NOT_FOUND");
    expect(await code(setup.recordScan({ sponsor: faker.string.uuid(), userId: hacker }))).toBe("NOT_FOUND");
    // Scans never touch Your team.
    expect(await db.select().from(coffeeChatReps).where(eq(coffeeChatReps.sponsorId, id))).toHaveLength(1);
  });

  test("scanOf says whether a hacker is already on this sponsor's list", async () => {
    const id = await sponsor();
    const other = await sponsor();
    const hacker = await admittedHacker(false);
    expect(await setup.scanOf({ sponsor: id, userId: hacker })).toBeNull();
    const dana = await setup.addRep({ sponsor: id, name: "Dana W.", phone: "5195550001" });
    await setup.recordScan({ sponsor: id, userId: hacker, repId: dana.id });
    const row = await setup.scanOf({ sponsor: id, userId: hacker });
    expect(row?.repName).toBe("Dana W.");
    expect(row?.scannedAt).toBeInstanceOf(Date);
    expect(await setup.scanOf({ sponsor: other, userId: hacker })).toBeNull();
  });
});

describe("coffeeChatSetup: edits after Send update invites", () => {
  // Friday night, before round 1 closes: re-asked invites get Sat 10 AM.
  const FRI_1030PM = new Date("2026-11-20T22:30:00-05:00");

  /** A submitted sponsor with sent 1-on-1 chats: one placement per rep. */
  async function sentSponsor(reps: { name: string; chats: number; sessionId: "10" | "11"; room: string }[]) {
    const id = await sponsor();
    const out: { repId: string; placementId: string }[] = [];
    for (const r of reps) {
      const rep = await setup.addRep({ sponsor: id, name: r.name, phone: "5195550001" });
      out.push({ repId: rep.id, placementId: "" });
    }
    await setup.savePrefs({
      sponsor: id,
      hackersPerChat: 1,
      reps: reps.map((r, i) => ({ id: out[i]!.repId, chatsWanted: r.chats, free: [r.sessionId] })),
    });
    await setup.submitPrefs({ sponsor: id });
    for (const [i, r] of reps.entries()) {
      const [p] = await db
        .insert(coffeeChatPlacements)
        .values({ repId: out[i]!.repId, sessionId: r.sessionId, room: r.room, status: "sent", sentAt: new Date() })
        .returning();
      out[i]!.placementId = p!.id;
    }
    return { id, reps: out };
  }

  async function invite(sponsorId: string, placementId: string, slotTime: string, status: "pending" | "accepted", repName: string, room: string) {
    const userId = await admittedHacker();
    await db.insert(coffeeChats).values({
      sponsorId,
      userId,
      slotTime,
      durationMinutes: 15,
      status,
      placementId,
      room: `Rm ${room}`,
      repName,
      round: 1,
    });
    return userId;
  }

  const invitesOf = (sponsorId: string) =>
    db.select().from(coffeeChats).where(eq(coffeeChats.sponsorId, sponsorId)).orderBy(asc(coffeeChats.slotTime));

  test("removing a rep moves their hackers to an open seat first, cancels the rest, and tells them", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRI_1030PM);
    try {
      // Ana has 4 chats at 10; Ben 1 chat at 11.
      const sp = await sentSponsor([
        { name: "Ana", chats: 4, sessionId: "10", room: "1354" },
        { name: "Ben", chats: 1, sessionId: "11", room: "1356" },
      ]);
      const [ana, ben] = sp.reps;
      const kept = await invite(sp.id, ana!.placementId, "10:15", "accepted", "Ana", "1354");
      await invite(sp.id, ana!.placementId, "10:00", "pending", "Ana", "1354");
      deliver.mockClear();
      await setup.removeRep({ sponsor: sp.id, repId: ana!.repId, confirmAfterInvites: true });

      // The accepted hacker takes Ben's one seat and must confirm again; the
      // other invite is cancelled (and its row goes with Ana's chats).
      const rows = await invitesOf(sp.id);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        userId: kept,
        placementId: ben!.placementId,
        slotTime: "11:00",
        status: "pending",
        repName: "Ben",
        room: "Rm 1356",
        notifiedAt: null,
      });
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(deliver.mock.calls[0]![0].map((j) => j.event).sort()).toEqual(["cancelled", "reconfirm"]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("renaming a rep re-asks their hackers with the new name and tells them; a phone change doesn't", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRI_1030PM);
    try {
      const sp = await sentSponsor([{ name: "Ana", chats: 4, sessionId: "10", room: "1354" }]);
      const [ana] = sp.reps;
      await invite(sp.id, ana!.placementId, "10:15", "accepted", "Ana", "1354");
      deliver.mockClear();
      await setup.updateRep({ sponsor: sp.id, repId: ana!.repId, name: "Ana", phone: "5195550009", confirmAfterInvites: true });
      expect(deliver).not.toHaveBeenCalled();
      expect((await invitesOf(sp.id))[0]).toMatchObject({ status: "accepted", repName: "Ana" });

      await setup.updateRep({ sponsor: sp.id, repId: ana!.repId, name: "Ana Li", phone: "5195550009", confirmAfterInvites: true });
      expect((await invitesOf(sp.id))[0]).toMatchObject({
        placementId: ana!.placementId,
        status: "pending",
        repName: "Ana Li",
        notifiedAt: null,
      });
      expect(deliver).toHaveBeenCalledTimes(1);
      expect(deliver.mock.calls[0]![0].map((j) => j.event)).toEqual(["reconfirm"]);
    } finally {
      vi.useRealTimers();
    }
  });

  test("lowering a rep's chats cancels invites to the chats that are gone", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FRI_1030PM);
    try {
      const sp = await sentSponsor([{ name: "Cy", chats: 4, sessionId: "10", room: "2243" }]);
      const [cy] = sp.reps;
      const first = await invite(sp.id, cy!.placementId, "10:00", "accepted", "Cy", "2243");
      await invite(sp.id, cy!.placementId, "10:45", "pending", "Cy", "2243");
      deliver.mockClear();
      await setup.savePrefs({
        sponsor: sp.id,
        hackersPerChat: 1,
        reps: [{ id: cy!.repId, chatsWanted: 1, free: ["10"] }],
        confirmAfterInvites: true,
      });
      const rows = await invitesOf(sp.id);
      expect(rows.map((r) => [r.userId === first, r.slotTime, r.status])).toEqual([
        [true, "10:00", "accepted"],
        [false, "10:45", "cancelled"],
      ]);
      expect(deliver.mock.calls.flatMap((c) => c[0].map((j) => j.event))).toEqual(["cancelled"]);

      // A save that changes nothing about the chats leaves invites alone.
      deliver.mockClear();
      await setup.savePrefs({
        sponsor: sp.id,
        hackersPerChat: 1,
        reps: [{ id: cy!.repId, chatsWanted: 1, free: ["10"] }],
        confirmAfterInvites: true,
      });
      expect(deliver).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  test("with the run of show unreadable, removing a rep after Send is refused and nothing changes", async () => {
    const sp = await sentSponsor([{ name: "Di", chats: 4, sessionId: "10", room: "1348" }]);
    await invite(sp.id, sp.reps[0]!.placementId, "10:00", "accepted", "Di", "1348");
    ros.fail = true;
    try {
      expect(
        await code(setup.removeRep({ sponsor: sp.id, repId: sp.reps[0]!.repId, confirmAfterInvites: true })),
      ).toBe("PRECONDITION_FAILED");
    } finally {
      ros.fail = false;
    }
    expect(await invitesOf(sp.id)).toHaveLength(1);
    expect(await db.select().from(coffeeChatReps).where(eq(coffeeChatReps.sponsorId, sp.id))).toHaveLength(1);
  });

  test("before Send, rep edits never touch invites", async () => {
    const id = await sponsor();
    const a = await setup.addRep({ sponsor: id, name: "Ed", phone: "5195550001" });
    deliver.mockClear();
    await setup.savePrefs({ sponsor: id, hackersPerChat: 2, reps: [{ id: a.id, chatsWanted: 2, free: ["10"] }] });
    await setup.removeRep({ sponsor: id, repId: a.id });
    expect(deliver).not.toHaveBeenCalled();
  });
});

describe("coffeeChatSetup: Your chats times", () => {
  test("a session cut by their workshop starts late, at the same times hackers are invited to", async () => {
    // CutCo's workshop is 1-2, so with 30-min groups its 2-3 is only 2:30-3:00.
    const id = await sponsor(`CutCo${stamp}`);
    const a = await setup.addRep({ sponsor: id, name: "Ana", phone: "5195550001" });
    await setup.savePrefs({ sponsor: id, hackersPerChat: 2, reps: [{ id: a.id, chatsWanted: 3, free: ["14", "16"] }] });
    await setup.submitPrefs({ sponsor: id });
    await db.insert(coffeeChatPlacements).values([
      { repId: a.id, sessionId: "14", room: "2241", status: "sent", sentAt: new Date() },
      { repId: a.id, sessionId: "16", room: "2242", status: "sent", sentAt: new Date() },
    ]);

    const res = await setup.get({ sponsor: id });
    expect(res.chats.map((c) => [c.sessionId, c.chats, c.start, c.end])).toEqual([
      ["14", 1, "14:30", "15:00"],
      ["16", 2, "16:00", "17:00"],
    ]);

    // Track B's seats for the same placements: the same start times.
    const clock = (m: number) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
    const seats = layoutOf(await loadBoardState(), (p) => p.sponsorId === id);
    for (const c of res.chats) {
      const starts = seats.filter((x) => x.placementId === c.placementId).map((x) => x.start);
      expect(starts.length, c.sessionId).toBe(c.chats);
      expect(clock(starts[0]!)).toBe(c.start);
      expect(clock(starts.at(-1)! + seats[0]!.minutes)).toBe(c.end);
    }
  });
});
