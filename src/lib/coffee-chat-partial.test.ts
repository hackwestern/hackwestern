import { describe, expect, test } from "vitest";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  chatsBySession,
  usableWindow,
} from "~/lib/coffee-chat-sessions";
import {
  applySuggestion,
  availSessions,
  blockedSessions,
  boardFixes,
  cellKey,
  chatsAt,
  checkBoard,
  invalidChats,
  partialSessions,
  repCount,
  repKeyAt,
  repTally,
  schedule,
  type Board,
  type SchedSponsor,
} from "~/lib/coffee-chat-schedule";

const SESS = COFFEE_SESSIONS;
const ROOMS = COFFEE_ROOMS;
// Sun Life: setup 2:00, workshop 2:30-3:30 -> blocked 1:45-3:45.
const SUN_WORKSHOP = { setup: 840, start: 870, end: 930 };

describe("usableWindow (partial sessions)", () => {
  test("Sun Life's setup at 2:00 leaves 1-2 usable 1:00-1:30 with 30-min chats", () => {
    expect(usableWindow("13", [SUN_WORKSHOP], 30)).toEqual({
      start: 780,
      end: 810,
    });
  });

  test("15-min chats keep three chats before the cut: 1:00-1:45", () => {
    expect(usableWindow("13", [SUN_WORKSHOP], 15)).toEqual({
      start: 780,
      end: 825,
    });
  });

  test("the part after a cut runs up to the session's end", () => {
    // Workshop ends 3:30 -> free from 3:45; 3-4 keeps 3:45-4:00 for one 15-min chat.
    expect(usableWindow("15", [SUN_WORKSHOP], 15)).toEqual({
      start: 945,
      end: 960,
    });
    expect(usableWindow("15", [SUN_WORKSHOP], 30)).toBeNull();
    // 1:00-2:00 workshop -> free from 2:15: 2-3 is 2:30-3:00 at 30 min.
    expect(usableWindow("14", [{ start: 780, end: 840 }], 30)).toEqual({
      start: 870,
      end: 900,
    });
  });

  test("a session inside the window, or with no room for one chat, is blocked", () => {
    expect(usableWindow("14", [SUN_WORKSHOP], 15)).toBeNull();
    expect(usableWindow("nope", [], 15)).toBeNull();
  });

  test("untouched sessions are the whole hour; 60-min chats mean whole sessions only", () => {
    expect(usableWindow("10", [SUN_WORKSHOP], 15)).toEqual({
      start: 600,
      end: 660,
    });
    expect(usableWindow("13", [SUN_WORKSHOP], 60)).toBeNull();
  });

  test("chatsBySession fills a partial session only up to what it fits", () => {
    const fits = (id: string) => (id === "13" ? 1 : 2);
    expect([...chatsBySession(["13", "10"], 4, fits)]).toEqual([
      ["10", 2],
      ["13", 1],
    ]);
  });
});

const sun = (
  reps: { free: string[]; sessions: number }[],
  chatMinutes = 30,
): SchedSponsor => ({
  id: "sun",
  submitted: true,
  workshops: [SUN_WORKSHOP],
  chatMinutes,
  reps: reps.map((r, i) => ({
    id: `sun:${i}`,
    free: r.free,
    sessionsWanted: r.sessions,
  })),
});

describe("scheduling partial sessions", () => {
  test("blocked and partial sets follow the chat length", () => {
    const sp = sun([]);
    expect([...blockedSessions(sp, SESS)]).toEqual(["14", "15"]);
    expect(Object.fromEntries(partialSessions(sp, SESS))).toEqual({
      "13": { start: 780, end: 810 },
    });
    expect(chatsAt(sp, SESS[2]!)).toBe(1);
    expect(chatsAt(sp, SESS[0]!)).toBe(2);
  });

  test("a rep free only 1-2 gets the 1:00-1:30 part", () => {
    const sp = sun([{ free: ["13"], sessions: 1 }]);
    const r = schedule([sp], ROOMS, SESS, []);
    expect(repKeyAt(r.board, "sun:0", "13")).toBe("2241|13");
    expect(checkBoard([sp], ROOMS, SESS, r.board)).toEqual([]);
    expect(r.fixes).toEqual([]);
  });

  test("full sessions come first; the partial one is used only when needed", () => {
    const sp = sun([
      { free: ["10", "13", "16"], sessions: 2 },
      { free: ["10", "13", "16"], sessions: 3 },
    ]);
    expect(availSessions(sp, sp.reps[0]!, SESS)).toEqual(["10", "16", "13"]);
    const r = schedule([sp], ROOMS, SESS, []);
    expect(repKeyAt(r.board, "sun:0", "13")).toBeNull();
    expect(repCount(r.board, "sun:0")).toBe(2);
    expect(repCount(r.board, "sun:1")).toBe(3);
    expect(repKeyAt(r.board, "sun:1", "13")).not.toBeNull();
  });

  test("a full session without a room falls back to the partial one", () => {
    const sp = sun([{ free: ["10", "13"], sessions: 1 }]);
    const oneRoom = [{ id: "R1", building: "near" as const }];
    const r = schedule([sp], oneRoom, SESS, [
      { room: "R1", session: "10", type: "booking", ref: "b" },
    ]);
    expect(repKeyAt(r.board, "sun:0", "13")).toBe("R1|13");
  });

  test("moves and fixes never use a blocked part; a partial session is valid", () => {
    const sp = sun([{ free: ["13", "14"], sessions: 1 }]);
    const board: Board = {
      [cellKey("2241", "13")]: { type: "chat", rep: "sun:0", pinned: true },
    };
    expect(invalidChats([sp], SESS, board)).toEqual([]);
    expect(() =>
      applySuggestion(
        [sp],
        SESS,
        {},
        {},
        {
          kind: "session",
          places: [{ rep: "sun:0", room: "2241", session: "14" }],
        },
      ),
    ).toThrow(/blocked/);
  });
});

describe("reps who ask for 0 chats", () => {
  const zero = (free: string[]) => ({ id: "z:0", free, sessionsWanted: 0 });
  const sp = (reps: SchedSponsor["reps"]): SchedSponsor => ({
    id: "z",
    submitted: true,
    workshops: [],
    chatMinutes: 15,
    reps,
  });

  test("are never placed, never short, and don't count in the tally", () => {
    const s = sp([
      zero(["10", "11"]),
      { id: "z:1", free: ["10"], sessionsWanted: 1 },
    ]);
    const r = schedule([s], ROOMS, SESS, []);
    expect(repCount(r.board, "z:0")).toBe(0);
    expect(repCount(r.board, "z:1")).toBe(1);
    expect(r.fixes).toEqual([]);
    expect(repTally(s, SESS, r.board)).toEqual({ done: 1, total: 1 });
  });

  test("a chat still on the board for a rep now at 0 becomes a remove fix", () => {
    const s = sp([zero(["10"])]);
    const board: Board = {
      [cellKey("2241", "10")]: { type: "chat", rep: "z:0", pinned: true },
    };
    expect(invalidChats([s], SESS, board)).toMatchObject([
      { rep: "z:0", problem: "overCap" },
    ]);
    const fix = boardFixes([s], ROOMS, SESS, board)[0]!;
    expect(fix).toMatchObject({
      problem: "invalid",
      reason: "overCap",
      suggestion: { kind: "move", from: "2241|10", to: null },
    });
    expect(applySuggestion([s], SESS, board, {}, fix.suggestion).board).toEqual(
      {},
    );
  });

  test("over the cap: only the latest chats are flagged", () => {
    const s = sp([{ id: "z:0", free: ["10", "11"], sessionsWanted: 1 }]);
    const board: Board = {
      [cellKey("2242", "11")]: { type: "chat", rep: "z:0", pinned: true },
      [cellKey("2241", "10")]: { type: "chat", rep: "z:0", pinned: true },
    };
    expect(invalidChats([s], SESS, board).map((x) => x.session)).toEqual([
      "11",
    ]);
  });
});

describe("a partial session that leaves a rep short of chats", () => {
  // 15-min chats: Sun Life's 1-2 holds 3 chats (1:00-1:45), a full session 4.
  const one = (free: string[], chatsWanted: number, maxSessions: number | null = null): SchedSponsor => ({
    ...sun([{ free, sessions: 1 }], 15),
    reps: [{ id: "sun:0", free, sessionsWanted: 1, chatsWanted, maxSessions }],
  });
  const at13: Board = { [cellKey("2241", "13")]: { type: "chat", rep: "sun:0", pinned: true } };

  test("with a free session left: an add-a-session fix that raises the cap", () => {
    const sp = one(["10", "13"], 4);
    const fix = boardFixes([sp], ROOMS, SESS, at13).find((f) => f.reason === "partial")!;
    expect(fix).toMatchObject({
      session: "13",
      problem: "short",
      items: [{ rep: "sun:0", chats: { got: 3, want: 4 } }],
      suggestion: { kind: "extra", place: { rep: "sun:0", session: "10" }, cap: { rep: "sun:0", sessions: 2 } },
    });
    const ap = applySuggestion([sp], SESS, at13, {}, fix.suggestion);
    expect(ap.maxSessions).toEqual({ "sun:0": 2 });
    const after = { ...sp, reps: [{ ...sp.reps[0]!, maxSessions: 2 }] };
    expect(repCount(ap.board, "sun:0")).toBe(2);
    expect(checkBoard([after], ROOMS, SESS, ap.board)).toEqual([]);
    expect(boardFixes([after], ROOMS, SESS, ap.board)).toEqual([]);
  });

  test("no free session: fewer chats keeps what they have and stops the flag", () => {
    const sp = one(["13"], 4);
    const fix = boardFixes([sp], ROOMS, SESS, at13).find((f) => f.reason === "partial")!;
    expect(fix.suggestion).toEqual({ kind: "fewer", caps: [{ rep: "sun:0", sessions: 1, want: 1 }] });
    const ap = applySuggestion([sp], SESS, at13, {}, fix.suggestion);
    expect(boardFixes([one(["13"], 4, ap.maxSessions["sun:0"])], ROOMS, SESS, ap.board)).toEqual([]);
  });

  test("no fix when the partial session still holds enough, or nothing is partial", () => {
    expect(boardFixes([one(["10", "13"], 3)], ROOMS, SESS, at13)).toEqual([]);
    const at10: Board = { [cellKey("2241", "10")]: { type: "chat", rep: "sun:0" } };
    expect(boardFixes([one(["10", "13"], 4)], ROOMS, SESS, at10)).toEqual([]);
  });
});
