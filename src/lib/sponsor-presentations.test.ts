import { describe, expect, it } from "vitest";
import {
  PRESENTATION_MIN_GAP_MINUTES,
  PRESENTATION_OVERFLOW_SLOTS,
  PRESENTATION_SLOTS_PER_ROOM,
  PRESENTATION_WINDOW_END,
  PRESENTATION_WINDOW_START,
  SHORTLIST_MAX,
  runsPastEnd,
  formatPresentationTime,
  gapViolations,
  groupSlots,
  schedulePresentations,
  type PresentationRequest,
} from "./sponsor-presentations";
import { MAX_SPONSOR_PICKS } from "./sponsor-picks";

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
    // No room (or a blank one) is null: times don't wait for it.
    const want = rooms.get(s.sponsorId)?.trim();
    expect(s.room).toBe(want ? want : null);
    expect(s.start).toBeGreaterThanOrEqual(PRESENTATION_WINDOW_START);
    // In the window, or in the overflow after it (shown as running past).
    expect(s.start + 5).toBeLessThanOrEqual(
      PRESENTATION_WINDOW_END + PRESENTATION_OVERFLOW_SLOTS * 6,
    );
    const key = `${s.sponsorId}@${s.start}`;
    expect(taken.has(key)).toBe(false);
    taken.add(key);
  }
  // Nothing dropped: each requested pair is placed, unplaced or over cap.
  const accounted = new Set([
    ...result.slots.map((s) => `${s.sponsorId}:${s.teamId}`),
    ...result.unplaced.map((u) => `${u.sponsorId}:${u.teamId}`),
    ...result.overCap.flatMap((o) =>
      o.teamIds.map((t) => `${o.sponsorId}:${t}`),
    ),
  ]);
  const requested = new Set(
    requests.flatMap((r) => r.teamIds.map((t) => `${r.sponsorId}:${t}`)),
  );
  expect(accounted).toEqual(requested);
}

describe("schedulePresentations", () => {
  it("has 18 six-minute slots per room from 10:00 to 11:48", () => {
    expect(PRESENTATION_SLOTS_PER_ROOM).toBe(18);
    expect(PRESENTATION_MIN_GAP_MINUTES).toBe(10);
  });

  it("caps the round 1 shortlist at one team per slot", () => {
    expect(SHORTLIST_MAX).toBe(PRESENTATION_SLOTS_PER_ROOM);
    expect(MAX_SPONSOR_PICKS).toBe(SHORTLIST_MAX);
  });

  it("gives each shortlisted team one slot in the sponsor's room", () => {
    const requests = [
      { sponsorId: "scotia", room: "Rm 2110", teamIds: ["a", "b", "c"] },
    ];
    const result = schedulePresentations(requests);
    expect(result.slots.map((s) => [s.teamId, s.start])).toEqual([
      ["a", 600],
      ["b", 606],
      ["c", 612],
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
    // 7 teams in all 3 rooms: each team needs 3 starts 10 minutes apart,
    // and every room (18 slots) is full.
    const shared = ids("s", 7);
    const requests = [
      { sponsorId: "a", room: "A", teamIds: [...shared, ...ids("a", 11)] },
      { sponsorId: "b", room: "B", teamIds: [...shared, ...ids("b", 11)] },
      { sponsorId: "c", room: "C", teamIds: [...shared, ...ids("c", 11)] },
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

  it("runs past the end instead of hiding teams; flags them only with no overflow", () => {
    const requests = [
      { sponsorId: "scotia", room: "Rm 2110", teamIds: ids("t", 21) },
    ];
    // Cap lifted so the window itself runs out: 18 in it, 3 run past.
    const shown = schedulePresentations(requests, undefined, {
      maxPerSponsor: 21,
    });
    expect(shown.unplaced).toEqual([]);
    expect(shown.slots.filter((s) => runsPastEnd(s.start))).toHaveLength(3);
    expect(shown.slots.at(-1)!.start).toBe(PRESENTATION_WINDOW_END + 2 * 6);
    expectValid(requests, shown);
    // With no overflow, the room runs out and the rest are flagged.
    const result = schedulePresentations(requests, undefined, {
      maxPerSponsor: 21,
      overflowSlots: 0,
    });
    expect(result.slots).toHaveLength(18);
    expect(result.unplaced).toHaveLength(3);
    expect(result.unplaced.every((u) => u.sponsorId === "scotia")).toBe(true);
    expectValid(requests, result);
  });

  it("never schedules more than SHORTLIST_MAX per sponsor: the first ones in shortlist order", () => {
    // An old send of 21, in an order that isn't sorted.
    const teamIds = ids("t", 21).reverse();
    const requests = [{ sponsorId: "scotia", room: "Rm 2110", teamIds }];
    const result = schedulePresentations(requests);
    expect(SHORTLIST_MAX).toBe(18);
    expect(result.slots).toHaveLength(SHORTLIST_MAX);
    expect(new Set(result.slots.map((s) => s.teamId))).toEqual(
      new Set(teamIds.slice(0, SHORTLIST_MAX)),
    );
    expect(result.overCap).toEqual([
      { sponsorId: "scotia", teamIds: teamIds.slice(SHORTLIST_MAX) },
    ]);
    expect(result.unplaced).toEqual([]);
    expectValid(requests, result);
  });

  it("gives a sponsor with no room its times anyway (room null), with the usual gaps", () => {
    const requests = [
      { sponsorId: "qnx", room: "Rm 2235", teamIds: ["a"] },
      { sponsorId: "roomless", room: null, teamIds: ["b", "a"] },
      { sponsorId: "blank", room: "  ", teamIds: ["c"] },
    ];
    const result = schedulePresentations(requests);
    expect(result.unplaced).toEqual([]);
    expect(
      result.slots.map((s) => [s.sponsorId, s.teamId, s.room]).sort(),
    ).toEqual([
      ["blank", "c", null],
      ["qnx", "a", "Rm 2235"],
      ["roomless", "a", null],
      ["roomless", "b", null],
    ]);
    expectValid(requests, result);
  });

  it("typing a room later keeps every time and just labels the slots", () => {
    const before = schedulePresentations([
      { sponsorId: "qnx", room: null, teamIds: ["a", "b"] },
    ]);
    const after = schedulePresentations(
      [{ sponsorId: "qnx", room: "Rm 2235", teamIds: ["a", "b"] }],
      undefined,
      { keep: before.slots },
    );
    expect(after.slots).toEqual(
      before.slots.map((s) => ({ ...s, room: "Rm 2235" })),
    );
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

  it("keeps times already given when a late shortlist arrives", () => {
    const early = [
      { sponsorId: "qnx", room: "Rm 2235", teamIds: ["t17", "t30", "t42"] },
      { sponsorId: "scotia", room: "Rm 2110", teamIds: ["t30", "t42", "t9"] },
    ];
    const first = schedulePresentations(early);
    // Sun Life sends late, sharing t17 with QNX.
    const late = [
      ...early,
      { sponsorId: "sun", room: "Rm 2230", teamIds: ["t17", "t47"] },
    ];
    const second = schedulePresentations(late, undefined, {
      keep: first.slots,
    });
    for (const s of first.slots) {
      expect(second.slots).toContainEqual(s);
    }
    expect(second.unplaced).toEqual([]);
    expectValid(late, second);
  });

  it("keeps a sponsor's times when its room changes", () => {
    const before = [
      { sponsorId: "qnx", room: "Rm 2235", teamIds: ["a", "b", "c"] },
    ];
    const first = schedulePresentations(before);
    const after = [{ ...before[0]!, room: "Rm 3100" }];
    const second = schedulePresentations(after, undefined, {
      keep: first.slots,
    });
    expect(second.slots.map((s) => [s.teamId, s.start, s.room])).toEqual(
      first.slots.map((s) => [s.teamId, s.start, "Rm 3100"]),
    );
  });

  it("never moves a kept time to fit a new team", () => {
    // Two 6-minute slots: x has 600 in room A. A new team y on both A and
    // B can only fit by taking x's slot, which it may not.
    const window = { start: 600, end: 612, slotMinutes: 6, minGapMinutes: 10 };
    const requests = [
      { sponsorId: "A", room: "A", teamIds: ["x", "y"] },
      { sponsorId: "B", room: "B", teamIds: ["y"] },
    ];
    const keep = [{ sponsorId: "A", teamId: "x", start: 600 }];
    const result = schedulePresentations(requests, window, { keep });
    expect(result.slots).toContainEqual({
      sponsorId: "A",
      teamId: "x",
      room: "A",
      start: 600,
    });
    expect(gapViolations(result.slots)).toEqual([]);
  });

  it("never gives a new team a slot that already passed", () => {
    const requests = [{ sponsorId: "qnx", room: "R", teamIds: ["a", "b"] }];
    const keep = [{ sponsorId: "qnx", teamId: "a", start: 600 }];
    const result = schedulePresentations(requests, undefined, {
      keep,
      notBefore: 640,
    });
    expect(result.slots.map((s) => [s.teamId, s.start])).toEqual([
      ["a", 600],
      ["b", 642],
    ]);
    // After the window: nowhere left, flagged instead.
    const late = schedulePresentations(requests, undefined, {
      keep,
      notBefore: 24 * 60,
    });
    expect(late.unplaced).toEqual([{ sponsorId: "qnx", teamId: "b" }]);
  });

  it("drops kept slots for teams no longer on the shortlist", () => {
    const requests = [{ sponsorId: "qnx", room: "R", teamIds: ["b"] }];
    const keep = [
      { sponsorId: "qnx", teamId: "a", start: 600 },
      { sponsorId: "qnx", teamId: "b", start: 612 },
    ];
    const result = schedulePresentations(requests, undefined, { keep });
    expect(result.slots.map((s) => [s.teamId, s.start])).toEqual([
      ["b", 612],
    ]);
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
        overflowSlots: 0,
      });
      expectValid(requests, result);
      expect(result.unplaced.length).toBeGreaterThan(0);
    }
  });

  it("finishes a hopeless team at the default limit", async () => {
    const { SEARCH_LIMIT } = await import("./sponsor-presentations");
    expect(SEARCH_LIMIT).toBe(50_000);
    // One team on 12 shortlists needs 12 slots 10 minutes apart: with
    // 6-minute slots that's every other slot, so 9 of the 18 fit.
    const requests = ids("s", 12).map((sponsorId, i) => ({
      sponsorId,
      room: `Rm ${i}`,
      teamIds: ["star"],
    }));
    const started = Date.now();
    const result = schedulePresentations(requests, undefined, {
      overflowSlots: 0,
    });
    expect(Date.now() - started).toBeLessThan(2000);
    expectValid(requests, result);
    expect(result.slots).toHaveLength(9);
    expect(result.unplaced).toHaveLength(3);
    // With the overflow (the default), all 12 get a time.
    const all = schedulePresentations(requests);
    expect(all.unplaced).toEqual([]);
    expect(all.slots).toHaveLength(12);
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
