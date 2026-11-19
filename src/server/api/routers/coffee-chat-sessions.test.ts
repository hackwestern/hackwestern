import { beforeAll, describe, expect, test, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  applications,
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  coffeeChatRoomBookings,
  coffeeChats,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { roomGridRows } from "~/server/api/utils/coffee-chat-room-grid-mirror";
import { loadBoardState } from "~/server/api/utils/coffee-chat-sessions-board";

const { names, ros, mirror, hw, deliver } = vi.hoisted(() => {
  const stamp = Date.now();
  return {
    /**
     * What HW Contacts says Noah's login email is: an email, null (no
     * login email) or "unreadable". Set to the organizer's email below.
     */
    hw: { sender: "unreadable" as string | null | "unreadable" },
    names: { work: `WorkCo${stamp}`, team: `TeamCo${stamp}`, late: `LateCo${stamp}`, busy: `BusyCo${stamp}` },
    /** Flip to make the run-of-show read fail, or to turn sheet writes on. */
    ros: { fail: false, writes: false },
    mirror: vi.fn(() => Promise.resolve({ ok: false as const, error: "disabled" })),
    /** Spy on invite notices (nothing is ever sent from a test). */
    deliver: vi.fn((_jobs: { event: string }[]) =>
      Promise.resolve({ slack: 0, email: 0, failed: 0, skipped: 0 }),
    ),
  };
});

vi.mock("~/server/api/utils/coffee-chat-invites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/coffee-chat-invites")>()),
  deliverInviteNotices: deliver,
}));

// WorkCo's workshop is 13:00-14:00 -> 1-2 is blocked, 2-3 is partial (2:15-3:00).
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/run-of-show-sheet")>()),
  sheetWritesEnabled: () => ros.writes,
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
          title: `${names.work} Workshop`,
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

// HW Contacts is never read in tests: the sender's login email comes from `hw`.
vi.mock("~/server/api/utils/coffee-chat-sender", async (importOriginal) => {
  const real = await importOriginal<typeof import("~/server/api/utils/coffee-chat-sender")>();
  return {
    ...real,
    checkCoffeeSender: (email: string | null | undefined) =>
      Promise.resolve(real.senderCheckOf(email, hw.sender)),
  };
});

// Spy on the Room Grid mirror (it never writes here: no sheet in tests).
vi.mock("~/server/api/utils/coffee-chat-room-grid-mirror", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/coffee-chat-room-grid-mirror")>()),
  mirrorRoomGrid: mirror,
}));

const noahSession = await mockOrganizerSession(db);
const organizer = createCaller(createInnerTRPCContext({ session: noahSession }));
const otherOrganizer = createCaller(createInnerTRPCContext({ session: await mockOrganizerSession(db) }));
// `organizer` is Noah: HW Contacts' Login email matches them.
hw.sender = noahSession.user.email!.toLowerCase();
const hacker = createCaller(createInnerTRPCContext({ session: await mockSession(db) }));
const anon = createCaller(createInnerTRPCContext({ session: null }));

const ids: Record<string, string> = {};

async function addSponsor(name: string, submitted: boolean, reps: { name: string; chats: number; free: string[] }[]) {
  const [sp] = await db.insert(sponsorJudgingSponsors).values({ name }).returning();
  ids[name] = sp!.id;
  if (submitted) {
    await db.insert(coffeeChatPrefs).values({ sponsorId: sp!.id, hackersPerChat: 1, submittedAt: new Date() });
  }
  for (const [i, r] of reps.entries()) {
    const [rep] = await db
      .insert(coffeeChatReps)
      .values({ sponsorId: sp!.id, name: r.name, phone: "5195550199", chatsWanted: r.chats, isPrimary: i === 0, position: i })
      .returning();
    ids[r.name] = rep!.id;
    if (r.free.length) {
      await db.insert(coffeeChatRepSessions).values(r.free.map((sessionId) => ({ repId: rep!.id, sessionId })));
    }
  }
}

/** Friday night, before round 1 closes: re-asked invites get Sat 10 AM. */
const FRI_1030PM = new Date("2026-11-20T22:30:00-05:00");
async function friday<T>(fn: () => Promise<T>): Promise<T> {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FRI_1030PM);
  try {
    return await fn();
  } finally {
    vi.useRealTimers();
  }
}

/** A hacker holding an invite to a placement's chat at `slotTime`. */
async function invite(
  placement: { id: string; room: string },
  sponsorId: string,
  repName: string,
  slotTime: string,
  status: "pending" | "accepted" = "accepted",
) {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status: "CONFIRMED",
    agreeShareWithSponsors: true,
  });
  const [row] = await db
    .insert(coffeeChats)
    .values({
      sponsorId,
      userId: session.user.id,
      slotTime,
      durationMinutes: 15,
      status,
      placementId: placement.id,
      room: "Rm " + placement.room,
      repName,
      round: 1,
    })
    .returning();
  return row!;
}
const chatRow = async (id: string) => (await db.select().from(coffeeChats).where(eq(coffeeChats.id, id)))[0];
const events = () => deliver.mock.calls.flatMap((c) => c[0].map((j) => j.event));

const code = (p: Promise<unknown>) => p.then(() => "ok", (e: { code?: string }) => e.code);
const placementOf = async (repName: string) =>
  db.select().from(coffeeChatPlacements).where(eq(coffeeChatPlacements.repId, ids[repName]!));

beforeAll(async () => {
  // 1-on-1 15 min: 4 chats = 1 session, 6 chats = 2 sessions.
  await addSponsor(names.work, true, [{ name: "Wes", chats: 4, free: ["10", "13", "14"] }]);
  await addSponsor(names.team, true, [
    { name: "Tia", chats: 6, free: ["10", "11", "15"] },
    { name: "Tom", chats: 4, free: ["11"] },
  ]);
  await addSponsor(names.late, false, [{ name: "Lou", chats: 4, free: [] }]);
  // Submitted, but no rep ticked a session.
  await addSponsor(names.busy, true, [{ name: "Bo", chats: 4, free: [] }]);
});

describe("access", () => {
  test("logged out is UNAUTHORIZED, a hacker is FORBIDDEN", async () => {
    expect(await code(anon.coffeeChatSessions.getBoard())).toBe("UNAUTHORIZED");
    expect(await code(hacker.coffeeChatSessions.getBoard())).toBe("FORBIDDEN");
    expect(await code(hacker.coffeeChatSessions.autoSchedule())).toBe("FORBIDDEN");
    expect(await code(hacker.coffeeChatSessions.send())).toBe("FORBIDDEN");
  });
});

describe("board and auto-schedule", () => {
  test("before Auto-schedule: statuses, blocked sessions, no fixes", async () => {
    const board = await organizer.coffeeChatSessions.getBoard();
    const work = board.sponsors.find((s) => s.name === names.work)!;
    const late = board.sponsors.find((s) => s.name === names.late)!;
    // 12:45-14:15 with travel: 1-2 is blocked, 2-3 is usable 2:15-3:00 (3 chats of 15 min).
    expect(work.blocked).toEqual(["13"]);
    expect(work.partial).toEqual({ "14": { start: 855, end: 900 } });
    expect(work.status).toEqual({ kind: "need", done: 0, total: 1 });
    expect(late.status).toEqual({ kind: "not" });
    expect(board.sponsors.find((s) => s.name === names.busy)!.status).toEqual({ kind: "unavailable" });
    expect(late.reps[0]!.isPrimary).toBe(true);
    expect(board.scheduled).toBe(false);
    expect(board.fixes).toEqual([]);
  });

  test("places reps by chats wanted, never in a workshop window", async () => {
    const res = await organizer.coffeeChatSessions.autoSchedule();
    expect(res.placed).toBe(4); // Wes 1, Tia 2, Tom 1
    const wes = await placementOf("Wes");
    expect(wes.map((p) => p.sessionId)).toEqual(["10"]);
    expect((await placementOf("Tia")).length).toBe(2);
    const board = await organizer.coffeeChatSessions.getBoard();
    expect(board.sponsors.find((s) => s.name === names.team)!.status).toEqual({ kind: "scheduled", done: 2, total: 2 });
    expect(board.draftCount).toBe(4);
  });
});

describe("guards", () => {
  test("move refuses a workshop window, a taken room and a rep in two places", async () => {
    const [wes] = await placementOf("Wes");
    const msg = (p: Promise<unknown>) => p.then(() => "", (e: Error) => e.message);
    expect(await msg(organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: "2243", sessionId: "13" }))).toBe(
      `That's during ${names.work}'s workshop.`,
    );
    const [tom] = await placementOf("Tom");
    // Into Tom's cell at 11-12: Wes isn't free then -> refused first.
    expect(await code(organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: tom!.room as "2241", sessionId: "11" }))).toBe("BAD_REQUEST");
    const tia = await placementOf("Tia");
    const tia10 = tia.find((p) => p.sessionId === "10")!;
    // Tia to Wes's room at 10: taken.
    expect(await code(organizer.coffeeChatSessions.movePlacement({ placementId: tia10.id, room: wes!.room as "2241", sessionId: "10" }))).toBe("CONFLICT");
    // Tia (6 chats = 10 and 11) to 11-12: she's already there.
    expect(await code(organizer.coffeeChatSessions.movePlacement({ placementId: tia10.id, room: tom!.room as "2241", sessionId: "11" }))).toBe("CONFLICT");
  });

  test("a valid move pins the chat and re-run keeps it", async () => {
    const [wes] = await placementOf("Wes");
    await organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: "1358", sessionId: "10" });
    await organizer.coffeeChatSessions.autoSchedule();
    const [after] = await placementOf("Wes");
    expect(after).toMatchObject({ room: "1358", sessionId: "10", pinned: true });
    expect((await placementOf("Wes")).length).toBe(1);
  });

  test("bookRoom refuses a taken cell; removing a chat makes a fix", async () => {
    expect(await code(organizer.coffeeChatSessions.bookRoom({ room: "1358", sessionId: "10", label: "Mentors" }))).toBe("CONFLICT");
    const { id } = await organizer.coffeeChatSessions.bookRoom({ room: "2241", sessionId: "16", label: "Mentors", note: "Resumes" });
    expect(await code(organizer.coffeeChatSessions.bookRoom({ room: "2241", sessionId: "16", label: "Again" }))).toBe("CONFLICT");
    // Chat into a booked cell, booking onto a chat: both refused.
    const [wes] = await placementOf("Wes");
    const used = (await db.select().from(coffeeChatPlacements)).filter((p) => p.sessionId === "10").map((p) => p.room);
    const emptyAt10 = (["2241", "2242", "2243", "1348", "1352", "1354", "1356"] as const).find((r) => !used.includes(r))!;
    const at10 = await organizer.coffeeChatSessions.bookRoom({ room: emptyAt10, sessionId: "10", label: "Organizers" });
    expect(await code(organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: emptyAt10, sessionId: "10" }))).toBe("CONFLICT");
    await organizer.coffeeChatSessions.removeBooking({ bookingId: at10.id });
    expect(await code(organizer.coffeeChatSessions.moveBooking({ bookingId: id, room: wes!.room as "2241", sessionId: wes!.sessionId as "10" }))).toBe("CONFLICT");
    // forSponsorId must be a registered sponsor.
    expect(await code(organizer.coffeeChatSessions.bookRoom({ room: "2242", sessionId: "16", label: "Ghost", forSponsorId: "00000000-0000-4000-8000-000000000000" }))).toBe("BAD_REQUEST");
    await organizer.coffeeChatSessions.removeBooking({ bookingId: id });
    expect(await db.select().from(coffeeChatRoomBookings)).toHaveLength(0);

    const [tom] = await placementOf("Tom");
    await organizer.coffeeChatSessions.removePlacement({ placementId: tom!.id });
    const board = await organizer.coffeeChatSessions.getBoard();
    const fix = board.fixes.find((f) => f.sponsor === ids[names.team]);
    expect(fix?.suggestion.kind).toBe("session");
    await organizer.coffeeChatSessions.applyFix({ fixId: fix!.id });
    expect((await placementOf("Tom"))[0]).toMatchObject({ sessionId: "11", pinned: true });
    expect((await organizer.coffeeChatSessions.getBoard()).fixes).toEqual([]);
    expect(await code(organizer.coffeeChatSessions.applyFix({ fixId: fix!.id }))).toBe("NOT_FOUND");
  });
});

describe("send", () => {
  test("only Noah sends; nobody can when HW Contacts can't be read", async () => {
    const msg = (p: Promise<unknown>) => p.then(() => "ok", (e: { code?: string; message?: string }) => `${e.code}: ${e.message}`);
    const other = await otherOrganizer.coffeeChatSessions.getBoard();
    expect(other.sender).toEqual({ canSend: false, reason: "notSender" });
    expect(await msg(otherOrganizer.coffeeChatSessions.send())).toBe("FORBIDDEN: Only Noah sends the confirmed schedule.");
    expect((await organizer.coffeeChatSessions.getBoard()).sender).toEqual({ canSend: true, reason: null });
    const was = hw.sender;
    try {
      hw.sender = "unreadable";
      expect((await organizer.coffeeChatSessions.getBoard()).sender).toEqual({ canSend: false, reason: "sheetUnreadable" });
      expect(await msg(organizer.coffeeChatSessions.send())).toBe(
        "PRECONDITION_FAILED: Can't read HW Contacts, so nobody can send right now. Try again in a minute.",
      );
      hw.sender = null;
      expect(await code(organizer.coffeeChatSessions.send())).toBe("PRECONDITION_FAILED");
    } finally {
      hw.sender = was;
    }
    // Nothing was sent by any refused call.
    expect((await db.select().from(coffeeChatPlacements)).every((r) => r.status === "draft")).toBe(true);
  });

  test("marks drafts sent, writes nothing to the sheet, runs the invite round (switched off in tests)", async () => {
    const res = await organizer.coffeeChatSessions.send();
    // The kill switch is off under vitest, so the round creates and sends nothing.
    expect(res).toMatchObject({
      sheet: "disabled",
      invites: { status: "disabled", created: 0, openSeats: 0, delivered: 0 },
    });
    expect(res.sent).toBeGreaterThan(0);
    const rows = await db.select().from(coffeeChatPlacements);
    expect(rows.every((r) => r.status === "sent" && r.sentAt)).toBe(true);
    const board = await organizer.coffeeChatSessions.getBoard();
    expect(board.sponsors.find((s) => s.name === names.team)!.status.kind).toBe("sent");
    expect(board.draftCount).toBe(0);
    expect((await organizer.coffeeChatSessions.send()).sent).toBe(0);
  });

  test("moving a sent chat keeps it sent and asks its invited hacker to confirm the new room", async () => {
    const [wes] = await placementOf("Wes");
    const chat = await invite(wes!, ids[names.work]!, "Wes", "10:00");
    deliver.mockClear();
    await friday(() =>
      organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: "1356", sessionId: "10" }),
    );
    expect((await placementOf("Wes"))[0]).toMatchObject({ status: "sent", sentAt: wes!.sentAt, room: "1356" });
    expect(await chatRow(chat.id)).toMatchObject({
      placementId: wes!.id,
      slotTime: "10:00",
      room: "Rm 1356",
      status: "pending",
      notifiedAt: null,
      expiresAt: new Date("2026-11-21T09:25:00-05:00"), // Ivey: 35 min before
    });
    expect(events()).toEqual(["reconfirm"]);
    // The sponsor isn't flagged as changed and there's nothing new to send.
    const board = await organizer.coffeeChatSessions.getBoard();
    expect(board.sponsors.find((s) => s.name === names.work)!.status.kind).toBe("sent");
    expect(board.draftCount).toBe(0);
  });

  test("room grid rows: header, 15-min rows, chat text in the session's first row", async () => {
    const rows = roomGridRows(await loadBoardState(), new Date("2026-11-21T02:00:00Z"));
    expect(rows[3]).toEqual(["Time", "Rm 2241", "Rm 2242", "Rm 2243", "Rm 1348", "Rm 1352", "Rm 1354", "Rm 1356", "Rm 1358"]);
    expect(rows[4]![0]).toBe("10:00 AM");
    expect(rows.at(-1)![0]).toBe("4:45 PM");
    expect(rows[4]![7]).toBe(`${names.work} · Wes · 1-on-1 · 15 min · 4 chats`);
    expect(rows[5]![7]).toBe("");
  });
});

describe("determinism", () => {
  test("reps with the same position and created time are ordered by id", async () => {
    const [sp] = await db.insert(sponsorJudgingSponsors).values({ name: `TieCo${Date.now()}` }).returning();
    const at = new Date("2026-11-01T00:00:00Z");
    const [hi, lo] = ["ffffffff-0000-4000-8000-000000000000", "00000000-0000-4000-8000-000000000001"];
    await db.insert(coffeeChatReps).values([
      { id: hi, sponsorId: sp!.id, name: "Hi", phone: "5195550199", position: 0, createdAt: at },
      { id: lo, sponsorId: sp!.id, name: "Lo", phone: "5195550199", position: 0, createdAt: at },
    ]);
    const state = await loadBoardState();
    expect(state.sponsors.find((s) => s.id === sp!.id)!.reps.map((r) => r.id)).toEqual([lo, hi]);
    await db.delete(sponsorJudgingSponsors).where(eq(sponsorJudgingSponsors.id, sp!.id));
  });
});

describe("pins are re-checked", () => {
  test("a sent chat the rep is no longer free for becomes a fix and stops counting", async () => {
    const tia = await placementOf("Tia");
    expect(tia.map((p) => p.sessionId).sort()).toEqual(["10", "11"]);
    await db
      .delete(coffeeChatRepSessions)
      .where(and(eq(coffeeChatRepSessions.repId, ids.Tia!), eq(coffeeChatRepSessions.sessionId, "11")));
    let board = await organizer.coffeeChatSessions.getBoard();
    const team = () => board.sponsors.find((s) => s.name === names.team)!;
    expect(team().status).toEqual({ kind: "need", done: 1, total: 2 });
    const fix = board.fixes.find((f) => f.sponsor === ids[names.team]);
    expect(fix).toMatchObject({ problem: "invalid", reason: "notFree", session: "11" });
    expect(fix!.suggestion).toMatchObject({ kind: "move", to: { rep: ids.Tia, session: "15" } });
    // Re-running keeps the pin (and the fix); applying the fix moves it.
    await organizer.coffeeChatSessions.autoSchedule();
    expect((await organizer.coffeeChatSessions.getBoard()).fixes.map((f) => f.id)).toContain(fix!.id);
    const at11 = tia.find((p) => p.sessionId === "11")!;
    const chat = await invite(at11, ids[names.team]!, "Tia", "11:00");
    deliver.mockClear();
    await friday(() => organizer.coffeeChatSessions.applyFix({ fixId: fix!.id }));
    expect((await placementOf("Tia")).map((p) => p.sessionId).sort()).toEqual(["10", "15"]);
    // Still sent; the invite follows the chat to 3:00 and must be confirmed again.
    expect((await placementOf("Tia")).find((p) => p.id === at11.id)).toMatchObject({ status: "sent", sentAt: at11.sentAt });
    expect(await chatRow(chat.id)).toMatchObject({ placementId: at11.id, slotTime: "15:00", status: "pending" });
    expect(events()).toEqual(["reconfirm"]);
    board = await organizer.coffeeChatSessions.getBoard();
    expect(board.fixes.filter((f) => f.sponsor === ids[names.team])).toEqual([]);
    expect(team().status).toEqual({ kind: "sent", done: 2, total: 2 });
  });
});

describe("run of show unreadable", () => {
  test("board says so and every write is refused with PRECONDITION_FAILED", async () => {
    const { id: bookingId } = await organizer.coffeeChatSessions.bookRoom({ room: "2243", sessionId: "16", label: "Mentors" });
    ros.fail = true;
    try {
      expect((await organizer.coffeeChatSessions.getBoard()).workshopsAvailable).toBe(false);
      const [wes] = await placementOf("Wes");
      const failed = (p: Promise<unknown>) =>
        p.then(() => "ok", (e: { code?: string; message?: string }) => `${e.code}: ${e.message}`);
      const want = "PRECONDITION_FAILED: Can't read the run of show, so workshop times are unknown. Try again in a minute.";
      const before = await db.select().from(coffeeChatPlacements);
      expect(await failed(organizer.coffeeChatSessions.autoSchedule())).toBe(want);
      expect(await failed(organizer.coffeeChatSessions.applyFix({ fixId: "x" }))).toBe(want);
      expect(await failed(organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: "2241", sessionId: "13" }))).toBe(want);
      expect(await failed(organizer.coffeeChatSessions.bookRoom({ room: "2242", sessionId: "16", label: "Mentors" }))).toBe(want);
      expect(await failed(organizer.coffeeChatSessions.moveBooking({ bookingId, room: "2242", sessionId: "16" }))).toBe(want);
      expect(await failed(organizer.coffeeChatSessions.send())).toBe(want);
      expect(await db.select().from(coffeeChatPlacements)).toEqual(before);
      expect(await db.select().from(coffeeChatRoomBookings)).toHaveLength(1);
    } finally {
      ros.fail = false;
    }
    await organizer.coffeeChatSessions.removeBooking({ bookingId });
  });
});

describe("sent changes re-mirror the Room Grid tab", () => {
  test("removing a sent chat or moving a booking after Send re-runs it, only with sheet writes on", async () => {
    // A draft nobody was invited to (moves and fixes keep chats sent now).
    const [draft] = await db
      .insert(coffeeChatPlacements)
      .values({ repId: ids.Bo!, room: "2243", sessionId: "16" })
      .returning();
    const rows = await db.select().from(coffeeChatPlacements);
    const sent = rows.filter((r) => r.status === "sent");
    expect(sent.length).toBeGreaterThan(1);
    ros.writes = true;
    try {
      mirror.mockClear();
      await organizer.coffeeChatSessions.removePlacement({ placementId: draft!.id });
      expect(mirror).not.toHaveBeenCalled();
      await organizer.coffeeChatSessions.removePlacement({ placementId: sent[0]!.id });
      expect(mirror).toHaveBeenCalledTimes(1);
      const { id } = await organizer.coffeeChatSessions.bookRoom({ room: "2243", sessionId: "16", label: "Mentors" });
      await organizer.coffeeChatSessions.moveBooking({ bookingId: id, room: "2242", sessionId: "16" });
      expect(mirror).toHaveBeenCalledTimes(2);
      ros.writes = false;
      await organizer.coffeeChatSessions.removeBooking({ bookingId: id });
      expect(mirror).toHaveBeenCalledTimes(2);
    } finally {
      ros.writes = false;
    }
  });
});

describe("0 chats and what changed", () => {
  test("all reps at 0 -> no chats asked; 0 plus blocked -> no availability; 0 is never placed", async () => {
    const zero = `ZeroCo${Date.now()}`;
    const mixed = `MixCo${Date.now()}`;
    await addSponsor(zero, true, [{ name: "Zed", chats: 0, free: ["10", "11"] }]);
    // Mo doesn't chat; Mia wants chats but ticked nothing.
    await addSponsor(mixed, true, [
      { name: "Mo", chats: 0, free: ["16"] },
      { name: "Mia", chats: 4, free: [] },
    ]);
    const board = await organizer.coffeeChatSessions.getBoard();
    expect(board.sponsors.find((s) => s.name === zero)!.status).toEqual({ kind: "none" });
    expect(board.sponsors.find((s) => s.name === mixed)!.status).toEqual({ kind: "unavailable" });
    await organizer.coffeeChatSessions.autoSchedule();
    expect(await placementOf("Zed")).toEqual([]);
    expect(await placementOf("Mo")).toEqual([]);
    expect((await organizer.coffeeChatSessions.getBoard()).fixes.filter((f) => f.sponsor === ids[zero] || f.sponsor === ids[mixed])).toEqual([]);
  });

  test("after Send with no sponsor edit, nothing is flagged as changed", async () => {
    await organizer.coffeeChatSessions.send();
    const board = await organizer.coffeeChatSessions.getBoard();
    const sent = board.sponsors.filter((s) => s.status.kind === "sent");
    expect(sent.length).toBeGreaterThan(0);
    for (const sp of sent) {
      expect(sp.changedAfterSend, sp.name).toBe(false);
      expect(sp.change, sp.name).toBeNull();
    }
  });

  test("a sponsor that edits after Send is flagged, with when", async () => {
    let board = await organizer.coffeeChatSessions.getBoard();
    const team = () => board.sponsors.find((s) => s.name === names.team)!;
    const later = new Date(Date.now() + 60_000);
    await db.update(coffeeChatPrefs).set({ updatedAt: later }).where(eq(coffeeChatPrefs.sponsorId, ids[names.team]!));
    board = await organizer.coffeeChatSessions.getBoard();
    expect(team().changedAfterSend).toBe(true);
    expect(team().change).toEqual({ kind: "editedAfterSend", at: later });
    expect(board.lastScheduledAt).not.toBeNull();
  });
});

describe("partial session shortfall", () => {
  test("a rep in a cut session gets an add-a-session fix; applying it places them and sets the cap", async () => {
    // WorkCo's 2-3 is usable 2:15-3:00: 3 one-on-ones. Wren wants 4.
    const [rep] = await db
      .insert(coffeeChatReps)
      .values({ sponsorId: ids[names.work]!, name: "Wren", phone: "5195550198", chatsWanted: 4, position: 5 })
      .returning();
    await db.insert(coffeeChatRepSessions).values(["14", "16"].map((sessionId) => ({ repId: rep!.id, sessionId })));
    await organizer.coffeeChatSessions.autoSchedule();
    const mine = () => db.select().from(coffeeChatPlacements).where(eq(coffeeChatPlacements.repId, rep!.id));
    const [placed] = await mine();
    expect(placed!.sessionId).toBe("16"); // the full session first
    const used = (await db.select().from(coffeeChatPlacements)).filter((p) => p.sessionId === "14").map((p) => p.room);
    const free14 = (["2241", "2242", "2243", "1348", "1352", "1354", "1356", "1358"] as const).find((r) => !used.includes(r))!;
    await organizer.coffeeChatSessions.movePlacement({ placementId: placed!.id, room: free14, sessionId: "14" });
    const board = await organizer.coffeeChatSessions.getBoard();
    expect(board.placements.find((p) => p.repId === rep!.id)!.window).toEqual({ start: 855, end: 900 });
    const fix = board.fixes.find((f) => f.reason === "partial" && f.items[0]!.rep === rep!.id)!;
    expect(fix).toMatchObject({ items: [{ chats: { got: 3, want: 4 } }], suggestion: { kind: "extra", place: { session: "16" } } });
    await organizer.coffeeChatSessions.applyFix({ fixId: fix.id });
    expect((await mine()).map((p) => p.sessionId).sort()).toEqual(["14", "16"]);
    const [row] = await db.select().from(coffeeChatReps).where(eq(coffeeChatReps.id, rep!.id));
    expect(row!.maxSessions).toBe(2);
    const after = await organizer.coffeeChatSessions.getBoard();
    expect(after.fixes.filter((f) => f.items.some((i) => i.rep === rep!.id))).toEqual([]);
  });
});

describe("invites follow sent chats", () => {
  test("removing a sent chat moves its hacker to another open seat of the sponsor", async () => {
    // TeamCo: Tia at 10 (4 chats) and 15 (2 chats), Tom at 11, all sent.
    const tia = await placementOf("Tia");
    const at15 = tia.find((p) => p.sessionId === "15")!;
    const at10 = tia.find((p) => p.sessionId === "10")!;
    expect([at15.status, at10.status]).toEqual(["sent", "sent"]);
    const chat = await invite(at15, ids[names.team]!, "Tia", "15:00");
    deliver.mockClear();
    await friday(() => organizer.coffeeChatSessions.removePlacement({ placementId: at15.id }));
    expect(await chatRow(chat.id)).toMatchObject({
      placementId: at10.id,
      slotTime: "10:00",
      status: "pending",
      notifiedAt: null,
    });
    // Both hackers on that chat (one from the fix above) move to Tia's 10-11 seats.
    expect(events()).toEqual(["reconfirm", "reconfirm"]);
  });
});
