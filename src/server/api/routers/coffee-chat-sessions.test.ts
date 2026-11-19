import { beforeAll, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import {
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  coffeeChatRoomBookings,
  sponsorJudgingSponsors,
} from "~/server/db/schema";
import { roomGridRows } from "~/server/api/utils/coffee-chat-room-grid-mirror";
import { loadBoardState } from "~/server/api/utils/coffee-chat-sessions-board";

const { names, ros } = vi.hoisted(() => {
  const stamp = Date.now();
  return {
    names: { work: `WorkCo${stamp}`, team: `TeamCo${stamp}`, late: `LateCo${stamp}` },
    /** Flip to make the run-of-show read fail. */
    ros: { fail: false },
  };
});

// WorkCo's workshop is 13:00-14:00 -> sessions 1-2 and 2-3 are blocked.
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/run-of-show-sheet")>()),
  sheetWritesEnabled: () => false,
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

const organizer = createCaller(createInnerTRPCContext({ session: await mockOrganizerSession(db) }));
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
    expect(work.blocked).toEqual(["13", "14"]);
    expect(work.status).toEqual({ kind: "need", done: 0, total: 1 });
    expect(late.status).toEqual({ kind: "not" });
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
  test("marks drafts sent, writes nothing to the sheet, invites not built", async () => {
    const res = await organizer.coffeeChatSessions.send();
    expect(res).toMatchObject({ sheet: "disabled", invites: "not-built" });
    expect(res.sent).toBeGreaterThan(0);
    const rows = await db.select().from(coffeeChatPlacements);
    expect(rows.every((r) => r.status === "sent" && r.sentAt)).toBe(true);
    const board = await organizer.coffeeChatSessions.getBoard();
    expect(board.sponsors.find((s) => s.name === names.team)!.status.kind).toBe("sent");
    expect(board.draftCount).toBe(0);
    expect((await organizer.coffeeChatSessions.send()).sent).toBe(0);
  });

  test("moving a sent chat puts it back to draft", async () => {
    const [wes] = await placementOf("Wes");
    await organizer.coffeeChatSessions.movePlacement({ placementId: wes!.id, room: "1356", sessionId: "10" });
    expect((await placementOf("Wes"))[0]).toMatchObject({ status: "draft", sentAt: null });
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
