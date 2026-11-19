import { describe, expect, test } from "vitest";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  chatMinutes,
  sessionsForChats,
} from "~/lib/coffee-chat-sessions";
import {
  applySuggestion,
  blockedSessions,
  boardFixes,
  cellKey,
  checkBoard,
  findFixes,
  invalidChats,
  parseKey,
  repCount,
  repKeyAt,
  repTally,
  schedule,
  workshopWindows,
  type Board,
  type Pin,
  type SchedSponsor,
} from "~/lib/coffee-chat-schedule";

const SESS = COFFEE_SESSIONS;
const ROOMS = COFFEE_ROOMS;

// The v8 mock's demo data (mocks/organizer-coffee-v8/index.html).
// sessions = sessions each rep's wanted chats need (sessionsForChats).
const sp = (
  id: string,
  sessions: number,
  frees: string[][],
  workshops: SchedSponsor["workshops"] = [],
  submitted = true,
): SchedSponsor => ({
  id,
  submitted,
  workshops,
  reps: frees.map((free, i) => ({ id: `${id}:${i}`, free, sessionsWanted: sessions })),
});
const DEMO: SchedSponsor[] = [
  sp("sunlife", 2, [["10", "11", "14", "16"], ["11", "16"], ["11", "16"]], [
    { setup: 840, start: 870, end: 930 },
  ]),
  sp("canadalife", 1, [["10", "11"], ["11", "15"]], [{ start: 780, end: 840 }]),
  sp("startech", 2, [["11", "14"], ["14", "15", "16"]]),
  sp("scotia", 1, [["13"], ["13"], ["13"]], [{ start: 600, end: 660 }]),
  sp("qnx", 4, [["10", "11", "14"], ["14", "16"]], [
    { setup: 960, start: 990, end: 1050 },
  ]),
  sp("commure", 2, [[], []], [], false),
  sp("cse", 3, [["11", "14", "15", "16"], ["14", "15", "16"], ["15", "16"]]),
];
const MENTORS: Pin = { room: "2241", session: "13", type: "booking", ref: "mentors" };

describe("blockedSessions", () => {
  test("blocks every session overlapping setup/start - 15 to end + 15", () => {
    const got = Object.fromEntries(
      DEMO.map((s) => [s.id, [...blockedSessions(s, SESS)].join()]),
    );
    expect(got).toMatchObject({
      sunlife: "13,14,15",
      canadalife: "13,14",
      scotia: "10,11",
      qnx: "15,16",
      startech: "",
    });
  });

  test("a window touching a session edge doesn't block it", () => {
    // 11:15-11:45 workshop -> window 11:00-12:00: only 11-12.
    expect([...blockedSessions({ workshops: [{ start: 675, end: 705 }] }, SESS)]).toEqual(["11"]);
  });
});

describe("schedule on the demo data", () => {
  const r = schedule(DEMO, ROOMS, SESS, [MENTORS]);

  test("passes every invariant", () => {
    expect(checkBoard(DEMO, ROOMS, SESS, r.board)).toEqual([]);
  });

  test("sessions per rep: Sun Life 2, CSE 3, QNX wants 4 but has 3 available", () => {
    expect(repCount(r.board, "sunlife:0")).toBe(2);
    expect(repCount(r.board, "cse:0")).toBe(3);
    expect(repCount(r.board, "qnx:0")).toBe(3);
  });

  test("ignores ticks inside a workshop window", () => {
    expect(repKeyAt(r.board, "sunlife:0", "14")).toBeNull();
    expect(repKeyAt(r.board, "qnx:1", "16")).toBeNull();
  });

  test("keeps the organizer booking and never places a non-submitted sponsor", () => {
    expect(r.board["2241|13"]).toEqual({ type: "booking", ref: "mentors", pinned: true });
    expect(repCount(r.board, "commure:0")).toBe(0);
  });

  test("Scotiabank's 3rd rep becomes one fix: Ivey together at 1348/1352/1354", () => {
    expect(r.fixes).toHaveLength(1);
    const fix = r.fixes[0]!;
    expect(fix).toMatchObject({ sponsor: "scotia", session: "13", reason: "near", problem: "group" });
    expect(fix.suggestion.kind).toBe("ivey");
    if (fix.suggestion.kind !== "ivey") return;
    expect(fix.suggestion.places.map((p) => p.room)).toEqual(["1348", "1352", "1354"]);
  });

  test("applying the fix leaves a valid board with no fixes", () => {
    const ap = applySuggestion(DEMO, SESS, r.board, {}, r.fixes[0]!.suggestion);
    expect(checkBoard(DEMO, ROOMS, SESS, ap.board)).toEqual([]);
    expect(findFixes(DEMO, ROOMS, SESS, ap.board)).toEqual([]);
    expect(repKeyAt(ap.board, "scotia:0", "13")).toBe("1348|13");
  });

  test("is deterministic", () => {
    expect(schedule(DEMO, ROOMS, SESS, [MENTORS])).toEqual(r);
  });

  test("status tally counts reps fully scheduled", () => {
    expect(repTally(DEMO[3]!, SESS, r.board)).toEqual({ done: 2, total: 3 });
    expect(repTally(DEMO[0]!, SESS, r.board)).toEqual({ done: 3, total: 3 });
  });
});

describe("pins", () => {
  test("a pinned chat is kept on re-run and counts toward hours", () => {
    const pin: Pin = { room: "1358", session: "16", type: "chat", rep: "sunlife:0" };
    const r = schedule(DEMO, ROOMS, SESS, [MENTORS, pin]);
    expect(r.board["1358|16"]).toEqual({ type: "chat", rep: "sunlife:0", pinned: true });
    expect(repCount(r.board, "sunlife:0")).toBe(2);
    expect(checkBoard(DEMO, ROOMS, SESS, r.board)).toEqual([]);
  });

  test("colliding pins never double-book a room", () => {
    const r = schedule(DEMO, ROOMS, SESS, [
      MENTORS,
      { room: "2241", session: "13", type: "chat", rep: "scotia:0" },
    ]);
    expect(r.board["2241|13"]?.type).toBe("booking");
  });

  test("a pin that would put a rep in two places is skipped", () => {
    const r = schedule(DEMO, ROOMS, SESS, [
      { room: "2241", session: "11", type: "chat", rep: "cse:0" },
      { room: "2242", session: "11", type: "chat", rep: "cse:0" },
    ]);
    expect(r.board["2242|11"]?.type === "chat" && r.board["2242|11"].rep).not.toBe("cse:0");
  });
});

describe("ordering and rooms", () => {
  const mini = (id: string, frees: string[][], hours = 1) => sp(id, hours, frees);
  const oneRoom = [{ id: "R1", building: "ivey" as const }];
  const two = SESS.slice(0, 2);

  test("most constrained sponsor goes first", () => {
    const r = schedule([mini("b", [["10", "11"]]), mini("a", [["10"]])], oneRoom, two, []);
    expect(r.board["R1|10"]).toMatchObject({ rep: "a:0" });
    expect(r.board["R1|11"]).toMatchObject({ rep: "b:0" });
  });

  test("near rooms before Ivey", () => {
    const r = schedule([mini("a", [["10"]])], ROOMS, two, []);
    expect(r.board["2241|10"]).toMatchObject({ rep: "a:0" });
  });

  test("a rep keeps their room from the hour before", () => {
    const r = schedule(
      [mini("x", [["10"]]), mini("a", [["10", "11"]], 2)],
      ROOMS,
      two,
      [{ room: "2241", session: "11", type: "booking", ref: "b" }],
    );
    const at10 = repKeyAt(r.board, "a:0", "10");
    const at11 = repKeyAt(r.board, "a:0", "11");
    expect(at10 && at11 && parseKey(at10).room).toBe(at11 && parseKey(at11).room);
  });

  test("no room anywhere -> fewer chats", () => {
    const r = schedule([mini("a", [["10"]]), mini("b", [["10"]])], oneRoom, two.slice(0, 1), []);
    expect(r.fixes).toHaveLength(1);
    expect(r.fixes[0]).toMatchObject({ reason: "full", suggestion: { kind: "fewer" } });
    const s = r.fixes[0]!.suggestion;
    if (s.kind !== "fewer") return;
    expect(s.caps[0]).toMatchObject({ sessions: 0, want: 1 });
    const ap = applySuggestion([mini("a", [["10"]]), mini("b", [["10"]])], two, r.board, {}, s);
    expect(Object.values(ap.maxSessions)).toEqual([0]);
  });

  test("a removed chat with a room free elsewhere -> another-session fix", () => {
    const r = schedule(DEMO, ROOMS, SESS, [MENTORS]);
    const board: Board = { ...r.board };
    delete board[repKeyAt(board, "cse:0", "11")!];
    const fix = findFixes(DEMO, ROOMS, SESS, board).find((f) => f.sponsor === "cse");
    expect(fix?.suggestion.kind).toBe("session");
    expect(fix?.problem).toBe("short");
  });

  test("applySuggestion refuses a blocked session and a double-booking", () => {
    const board: Board = { [cellKey("2241", "10")]: { type: "booking", ref: "x", pinned: true } };
    expect(() =>
      applySuggestion(DEMO, SESS, board, {}, {
        kind: "session",
        places: [{ rep: "scotia:0", room: "2242", session: "10" }],
      }),
    ).toThrow(/blocked/);
    expect(() =>
      applySuggestion(DEMO, SESS, board, {}, {
        kind: "session",
        places: [{ rep: "cse:0", room: "2241", session: "11" }, { rep: "cse:1", room: "2241", session: "11" }],
      }),
    ).toThrow(/double-books/);
  });
});

describe("randomized invariants", () => {
  // Small seeded PRNG so failures reproduce.
  function rng(seed: number) {
    let s = seed >>> 0;
    return () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 2 ** 32;
    };
  }

  test("200 random boards: no double-booking, caps, windows, pins kept, deterministic", () => {
    for (let seed = 1; seed <= 200; seed++) {
      const rand = rng(seed);
      const sponsors: SchedSponsor[] = Array.from({ length: 2 + Math.floor(rand() * 7) }, (_, i) => {
        const ws = rand() < 0.5 ? [] : [{ start: 600 + Math.floor(rand() * 7) * 60, end: 0 }];
        for (const w of ws) w.end = w.start + 60;
        // Workshops on the hour cut the sessions next to them at :15 / :45,
        // so with 15- or 30-min chats some sessions are partial.
        const chatMinutes = rand() < 0.5 ? 15 : 30;
        const base = sp(
          `s${i}`,
          1 + Math.floor(rand() * 4),
          Array.from({ length: 1 + Math.floor(rand() * 4) }, () =>
            SESS.filter(() => rand() < 0.5).map((s) => s.id),
          ),
          ws,
          rand() < 0.9,
        );
        return { ...base, chatMinutes };
      });
      const pins: Pin[] = [];
      if (rand() < 0.5) pins.push({ room: "2241", session: "13", type: "booking", ref: "b" });
      // A valid pinned chat: first submitted rep with a free unblocked session.
      const pinSp = sponsors.find((s) => s.submitted && s.reps[0]!.free.some((f) => !blockedSessions(s, SESS).has(f)));
      if (pinSp) {
        const f = pinSp.reps[0]!.free.find((x) => !blockedSessions(pinSp, SESS).has(x))!;
        pins.push({ room: "1358", session: f, type: "chat", rep: pinSp.reps[0]!.id });
      }
      const r = schedule(sponsors, ROOMS, SESS, pins);
      expect(checkBoard(sponsors, ROOMS, SESS, r.board), `seed ${seed}`).toEqual([]);
      for (const p of pins) expect(r.board[cellKey(p.room, p.session)], `seed ${seed}`).toBeDefined();
      if (pinSp) {
        expect(r.board[cellKey("1358", pins.at(-1)!.session)]).toMatchObject({ rep: pinSp.reps[0]!.id });
      }
      expect(schedule(sponsors, ROOMS, SESS, pins)).toEqual(r);
      // Every fix is applicable and never uses a blocked session.
      for (const fix of r.fixes) {
        const ap = applySuggestion(sponsors, SESS, r.board, {}, fix.suggestion);
        expect(checkBoard(sponsors, ROOMS, SESS, ap.board), `seed ${seed} fix ${fix.id}`).toEqual([]);
      }
    }
  });
});

describe("workshopWindows", () => {
  test("reads the sponsor's Saturday workshop-column items, setup included", () => {
    const item = (column: string, start: string, end: string, sponsors: string[], day = "Saturday") => ({
      day, column, start, end, sponsors,
    });
    const items = [
      item("sponsor-workshop", "14:30", "15:30", ["Sun Life"]),
      item("sponsor-workshop", "14:00", "14:30", ["Sun Life"]),
      item("sponsor-workshop", "10:00", "11:00", ["Scotiabank"]),
      item("big-event", "09:00", "10:00", ["Sun Life"]),
      item("sponsor-workshop", "18:30", "19:30", ["Sun Life"], "Friday"),
    ];
    const w = workshopWindows(items, "Sun Life");
    expect(w).toEqual([{ start: 840, end: 870 }, { start: 870, end: 930 }]);
    expect([...blockedSessions({ workshops: w }, SESS)]).toEqual(["13", "14", "15"]);
  });
});

describe("sessionsForChats", () => {
  test("ceil(chats x chat length / 60)", () => {
    const oneOnOne = chatMinutes({ hackersPerChat: 1, longerOneOnOne: false });
    const longer = chatMinutes({ hackersPerChat: 1, longerOneOnOne: true });
    const group = chatMinutes({ hackersPerChat: 3, longerOneOnOne: false });
    expect([oneOnOne, longer, group]).toEqual([15, 30, 30]);
    expect(sessionsForChats(4, oneOnOne)).toBe(1);
    expect(sessionsForChats(6, oneOnOne)).toBe(2);
    expect(sessionsForChats(3, group)).toBe(2);
    expect(sessionsForChats(1, longer)).toBe(1);
  });

  test("a rep wanting 6 one-on-ones gets 2 sessions, capped by availability", () => {
    const want = sessionsForChats(6, 15);
    const one = { id: "a", submitted: true, workshops: [], reps: [{ id: "a:0", free: ["10", "11", "13"], sessionsWanted: want }] };
    const r = schedule([one], ROOMS, SESS, []);
    expect(repCount(r.board, "a:0")).toBe(2);
    const few = { ...one, reps: [{ ...one.reps[0]!, free: ["10"] }] };
    expect(repCount(schedule([few], ROOMS, SESS, []).board, "a:0")).toBe(1);
  });
});
describe("pins are re-checked (boardFixes)", () => {
  // Sun Life blocks 13, 14 and 15; sunlife:0 is free 10, 11, 14 and 16.
  const pinned = (rep: string, room: string, session: string): Board => ({
    [cellKey(room, session)]: { type: "chat", rep, pinned: true },
  });

  test("a pinned chat now in a workshop window -> move to a free session", () => {
    const board = pinned("sunlife:0", "2241", "14");
    expect(invalidChats(DEMO, SESS, board)).toMatchObject([{ rep: "sunlife:0", session: "14", problem: "workshop", pinned: true }]);
    const fix = boardFixes(DEMO, ROOMS, SESS, board).find((f) => f.problem === "invalid")!;
    expect(fix).toMatchObject({ sponsor: "sunlife", session: "14", reason: "workshop" });
    expect(fix.suggestion).toEqual({ kind: "move", from: "2241|14", to: { rep: "sunlife:0", room: "2241", session: "10" } });
    const ap = applySuggestion(DEMO, SESS, board, {}, fix.suggestion);
    expect(ap.board).toEqual({ "2241|10": { type: "chat", rep: "sunlife:0", pinned: true } });
    expect(invalidChats(DEMO, SESS, ap.board)).toEqual([]);
  });

  test("a rep no longer free, or a sponsor that unsubmitted", () => {
    const notFree = pinned("startech:0", "2241", "10");
    expect(invalidChats(DEMO, SESS, notFree)).toMatchObject([{ problem: "notFree" }]);
    const unsub = pinned("commure:0", "2241", "10");
    const fix = boardFixes(DEMO, ROOMS, SESS, unsub).find((f) => f.problem === "invalid")!;
    expect(fix).toMatchObject({ reason: "notSubmitted", suggestion: { kind: "move", from: "2241|10", to: null } });
    expect(applySuggestion(DEMO, SESS, unsub, {}, fix.suggestion).board).toEqual({});
  });

  test("a valid board has no invalid fixes, and the scheduler's output is valid", () => {
    const r = schedule(DEMO, ROOMS, SESS, [MENTORS]);
    expect(invalidChats(DEMO, SESS, r.board)).toEqual([]);
    expect(boardFixes(DEMO, ROOMS, SESS, r.board)).toEqual(r.fixes);
  });
});
