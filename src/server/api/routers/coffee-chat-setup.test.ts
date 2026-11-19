import { describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
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

const { stamp } = vi.hoisted(() => ({ stamp: Date.now() }));

// "WorkCo<stamp>"'s workshop is 13:00-14:00 -> sessions 1-2 and 2-3 blocked.
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/run-of-show-sheet")>()),
  getRunOfShow: () =>
    Promise.resolve({
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
    expect(res.blocked).toEqual(["13", "14"]);
    expect(res.workshops).toHaveLength(1);
    expect(res.reps.map((r) => r.name)).toEqual(["Dana W.", "Leo T."]);
    expect(res.reps[0]!.free).toEqual(["10", "11", "15", "16"]);
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

  test("blocked sessions are dropped for the workshop sponsor", async () => {
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
    expect(res.reps.find((r) => r.id === rep.id)!.free).toEqual(["16"]);
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
    expect(res.seats).toEqual({ total: 6, accepted: 1, invited: 1 });
    expect(res.editedAfterSend).toBe(false);

    // A change now needs the warning confirmed, and is then flagged.
    const refused = await setup
      .updateRep({ sponsor: id, repId: a.id, name: "Dana W.", phone: "5195550001" })
      .then(
        () => null,
        (e: { code?: string; message: string }) => e,
      );
    expect(refused?.code).toBe("PRECONDITION_FAILED");
    expect(refused?.message).toContain("1 hacker");
    await db.update(coffeeChatPlacements).set({ sentAt: new Date(Date.now() - 1000) }).where(eq(coffeeChatPlacements.repId, a.id));
    await setup.updateRep({ sponsor: id, repId: a.id, name: "Dana W.", phone: "5195550001", confirmAfterInvites: true });
    const after = await setup.get({ sponsor: id });
    expect(after.editedAfterSend).toBe(true);
    const [pref] = await db.select().from(coffeeChatPrefs).where(eq(coffeeChatPrefs.sponsorId, id));
    expect(pref!.updatedAt.getTime()).toBeGreaterThan(after.sentAt!.getTime());
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
});
