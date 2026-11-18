import { describe, expect, it } from "vitest";
import {
  PRESENTATION_MIN_GAP_MINUTES,
  PRESENTATION_SLOTS_PER_ROOM,
  PRESENTATION_WINDOW_END,
  PRESENTATION_WINDOW_START,
  formatPresentationTime,
  gapViolations,
  groupSlots,
  schedulePresentations,
  type PresentationRequest,
} from "./sponsor-presentations";

const ids = (prefix: string, n: number) =>
  Array.from({ length: n }, (_, i) => `${prefix}${String(i).padStart(2, "0")}`);

/** Every slot in its sponsor's room, inside the window, no double booking. */
function expectValid(
  requests: PresentationRequest[],
  result: ReturnType<typeof schedulePresentations>,
) {
  expect(gapViolations(result.slots)).toEqual([]);
  const rooms = new Map(requests.map((r) => [r.sponsorId, r.room]));
  const taken = new Set<string>();
  for (const s of result.slots) {
    expect(s.room).toBe(rooms.get(s.sponsorId));
    expect(s.start).toBeGreaterThanOrEqual(PRESENTATION_WINDOW_START);
    expect(s.start + 5).toBeLessThanOrEqual(PRESENTATION_WINDOW_END);
    const key = `${s.sponsorId}@${s.start}`;
    expect(taken.has(key)).toBe(false);
    taken.add(key);
  }
  // Nothing dropped: each requested pair is placed, unplaced or no-room.
  const accounted = new Set([
    ...result.slots.map((s) => `${s.sponsorId}:${s.teamId}`),
    ...result.unplaced.map((u) => `${u.sponsorId}:${u.teamId}`),
    ...result.noRoom.flatMap((n) =>
      n.teamIds.map((t) => `${n.sponsorId}:${t}`),
    ),
  ]);
  const requested = new Set(
    requests.flatMap((r) => r.teamIds.map((t) => `${r.sponsorId}:${t}`)),
  );
  expect(accounted).toEqual(requested);
}

describe("schedulePresentations", () => {
  it("has 18 five-minute slots per room from 10:00 to 11:30", () => {
    expect(PRESENTATION_SLOTS_PER_ROOM).toBe(18);
    expect(PRESENTATION_MIN_GAP_MINUTES).toBe(10);
  });

  it("gives each shortlisted team one slot in the sponsor's room", () => {
    const requests = [
      { sponsorId: "scotia", room: "Rm 2110", teamIds: ["a", "b", "c"] },
    ];
    const result = schedulePresentations(requests);
    expect(result.slots.map((s) => [s.teamId, s.start])).toEqual([
      ["a", 600],
      ["b", 605],
      ["c", 610],
    ]);
    expect(result.unplaced).toEqual([]);
    expectValid(requests, result);
  });

  it("spreads a team on three shortlists at least 10 minutes apart", () => {
    const requests = [
      { sponsorId: "canada-life", room: "Rm 2230", teamIds: ["star", "x1"] },
      { sponsorId: "qnx", room: "Rm 2235", teamIds: ["star", "x2"] },
      { sponsorId: "scotia", room: "Rm 2110", teamIds: ["star", "x3"] },
    ];
    const result = schedulePresentations(requests);
    const star = result.slots
      .filter((s) => s.teamId === "star")
      .map((s) => s.start)
      .sort((a, b) => a - b);
    expect(star).toHaveLength(3);
    expect(star[1]! - star[0]!).toBeGreaterThanOrEqual(10);
    expect(star[2]! - star[1]!).toBeGreaterThanOrEqual(10);
    expectValid(requests, result);
  });

  it("fits many teams on every shortlist by rearranging", () => {
    // 9 teams in all 3 rooms: each team needs 3 starts 10 minutes apart,
    // and every room is half full of them.
    const shared = ids("s", 9);
    const requests = [
      { sponsorId: "a", room: "A", teamIds: [...shared, ...ids("a", 9)] },
      { sponsorId: "b", room: "B", teamIds: [...shared, ...ids("b", 9)] },
      { sponsorId: "c", room: "C", teamIds: [...shared, ...ids("c", 9)] },
    ];
    const result = schedulePresentations(requests);
    expect(result.unplaced).toEqual([]);
    expect(result.slots).toHaveLength(54);
    expectValid(requests, result);
  });

  it("repairs by moving placed teams when a later team is stuck", () => {
    // Five 5-minute slots, two full rooms. Placing teams one at a time in
    // free slots leaves t5 with no slot in C that keeps its 10-minute gap;
    // the repair step moves teams already in C to make one.
    const all = ["t1", "t2", "t3", "t4", "t5"];
    const requests = [
      { sponsorId: "a", room: "A", teamIds: ["t1"] },
      { sponsorId: "b", room: "B", teamIds: all },
      { sponsorId: "c", room: "C", teamIds: all },
    ];
    const window = { start: 600, end: 625, slotMinutes: 5, minGapMinutes: 10 };
    const result = schedulePresentations(requests, window);
    expect(result.unplaced).toEqual([]);
    expect(result.slots).toHaveLength(11);
    expect(gapViolations(result.slots)).toEqual([]);
  });

  it("flags teams that don't fit instead of dropping them", () => {
    const requests = [
      { sponsorId: "scotia", room: "Rm 2110", teamIds: ids("t", 21) },
    ];
    const result = schedulePresentations(requests);
    expect(result.slots).toHaveLength(18);
    expect(result.unplaced).toHaveLength(3);
    expect(result.unplaced.every((u) => u.sponsorId === "scotia")).toBe(true);
    expectValid(requests, result);
  });

  it("flags a sponsor with no room and still schedules the others", () => {
    const requests = [
      { sponsorId: "qnx", room: "Rm 2235", teamIds: ["a"] },
      { sponsorId: "roomless", room: null, teamIds: ["b", "a"] },
      { sponsorId: "blank", room: "  ", teamIds: ["c"] },
    ];
    const result = schedulePresentations(requests);
    expect(result.noRoom).toEqual([
      { sponsorId: "blank", teamIds: ["c"] },
      { sponsorId: "roomless", teamIds: ["a", "b"] },
    ]);
    expect(result.slots.map((s) => s.teamId)).toEqual(["a"]);
    expectValid(requests, result);
  });

  it("is deterministic, whatever order the input comes in", () => {
    const requests = [
      { sponsorId: "a", room: "A", teamIds: ["t3", "t1", "t2", "t9"] },
      { sponsorId: "b", room: "B", teamIds: ["t2", "t3", "t4"] },
      { sponsorId: "c", room: "C", teamIds: ["t1", "t2", "t3", "t5", "t5"] },
    ];
    const first = schedulePresentations(requests);
    const again = schedulePresentations(requests);
    const shuffled = schedulePresentations(
      [...requests]
        .reverse()
        .map((r) => ({ ...r, teamIds: [...r.teamIds].reverse() })),
    );
    expect(again).toEqual(first);
    expect(shuffled).toEqual(first);
    expectValid(requests, first);
  });

  it("follows changed constants", () => {
    const result = schedulePresentations(
      [
        { sponsorId: "a", room: "A", teamIds: ["x", "y"] },
        { sponsorId: "b", room: "B", teamIds: ["x"] },
      ],
      { start: 600, end: 630, slotMinutes: 10, minGapMinutes: 20 },
    );
    const x = result.slots.filter((s) => s.teamId === "x").map((s) => s.start);
    expect(Math.abs(x[0]! - x[1]!)).toBeGreaterThanOrEqual(20);
    expect(result.unplaced).toEqual([]);
  });
});

describe("helpers", () => {
  it("formats times", () => {
    expect(formatPresentationTime(600)).toBe("10:00 AM");
    expect(formatPresentationTime(725)).toBe("12:05 PM");
  });

  it("groups by room and by team, each in time order", () => {
    const { slots } = schedulePresentations([
      { sponsorId: "a", room: "A", teamIds: ["x", "y"] },
      { sponsorId: "b", room: "B", teamIds: ["x"] },
    ]);
    const byTeam = groupSlots(slots, "teamId");
    const x = byTeam.find((g) => g.key === "x")!;
    expect(x.slots).toHaveLength(2);
    expect(x.slots[0]!.start).toBeLessThan(x.slots[1]!.start);
    expect(
      groupSlots(slots, "sponsorId")
        .map((g) => g.key)
        .sort(),
    ).toEqual(["a", "b"]);
  });
});

describe("judgingRound", () => {
  it("is per sponsor: round 2 only with a placed slot of their own", async () => {
    const { judgingRound } = await import("./sponsor-presentations");
    const at = new Date();
    const open = { round2Open: true };
    expect(
      judgingRound({
        shortlistSent: null,
        scheduledAt: null,
        slots: [],
        ...open,
      }),
    ).toBe("shortlist");
    expect(
      judgingRound({
        shortlistSent: {},
        scheduledAt: null,
        slots: [],
        ...open,
      }),
    ).toBe("sent");
    // Someone else's schedule exists, none for this sponsor.
    expect(
      judgingRound({ shortlistSent: {}, scheduledAt: at, slots: [], ...open }),
    ).toBe("locked");
    expect(
      judgingRound({
        shortlistSent: {},
        scheduledAt: at,
        slots: [{}],
        ...open,
      }),
    ).toBe("rank");
  });

  it("waits on the sent shortlist until organizers open round 2", async () => {
    const { judgingRound } = await import("./sponsor-presentations");
    const at = new Date();
    const closed = { round2Open: false };
    expect(
      judgingRound({
        shortlistSent: {},
        scheduledAt: at,
        slots: [{}],
        ...closed,
      }),
    ).toBe("sent");
    expect(
      judgingRound({
        shortlistSent: {},
        scheduledAt: at,
        slots: [],
        ...closed,
      }),
    ).toBe("sent");
    expect(
      judgingRound({
        shortlistSent: null,
        scheduledAt: at,
        slots: [{}],
        ...closed,
      }),
    ).toBe("shortlist");
  });
});

describe("search limit", () => {
  it("drops nothing when the search gives up early", () => {
    // 12 rooms, everyone on every shortlist: far more than fits.
    const sponsors = ids("s", 12);
    const teams = ids("t", 10);
    const requests = sponsors.map((sponsorId, i) => ({
      sponsorId,
      room: `Rm ${2100 + i}`,
      teamIds: teams,
    }));
    for (const searchLimit of [1, 5, 200]) {
      const result = schedulePresentations(requests, undefined, {
        searchLimit,
      });
      expectValid(requests, result);
      expect(result.unplaced.length).toBeGreaterThan(0);
    }
  });

  it("finishes a hopeless team at the default limit", async () => {
    const { SEARCH_LIMIT } = await import("./sponsor-presentations");
    expect(SEARCH_LIMIT).toBe(50_000);
    // One team on 12 shortlists needs 12 slots 10 minutes apart: 9 fit.
    const requests = ids("s", 12).map((sponsorId, i) => ({
      sponsorId,
      room: `Rm ${i}`,
      teamIds: ["star"],
    }));
    const started = Date.now();
    const result = schedulePresentations(requests);
    expect(Date.now() - started).toBeLessThan(2000);
    expectValid(requests, result);
    expect(result.slots).toHaveLength(9);
    expect(result.unplaced).toHaveLength(3);
  });
});

describe("normalizeRoom and slotsKey", () => {
  it("clamps rooms to the column and keys slots by content", async () => {
    const { normalizeRoom, slotsKey } = await import("./sponsor-presentations");
    expect(normalizeRoom("  Rm   2110 ")).toBe("Rm 2110");
    expect(normalizeRoom("   ")).toBeNull();
    expect(normalizeRoom("x".repeat(100))).toHaveLength(64);
    const a = { sponsorId: "a", room: "Rm 1", start: 600 };
    const b = { sponsorId: "b", room: "Rm 2", start: 610 };
    expect(slotsKey([a, b])).toBe(slotsKey([b, a]));
    expect(slotsKey([a, b])).not.toBe(slotsKey([a, { ...b, start: 620 }]));
  });
});
