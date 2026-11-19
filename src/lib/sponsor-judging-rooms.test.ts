import { describe, expect, it } from "vitest";

import { labelledLocations, type RunOfShowItem } from "~/lib/run-of-show";
import {
  buildJudgingBoard,
  judgingItem,
  judgingStatus,
  MIN_SPONSOR_PICKS,
  pickCountFromChosenTeams,
} from "~/lib/sponsor-judging-rooms";

function item(over: Partial<RunOfShowItem>): RunOfShowItem {
  return {
    id: "x",
    day: "Sunday",
    start: "10:00",
    end: "11:30",
    column: "big-event",
    title: "Sponsor Track Judging",
    location: "Scotiabank: Rm 2110, Canada Life: Rm 2230, QNX: Rm 2235",
    sponsors: ["Canada Life", "Scotiabank"],
    ...over,
  };
}

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i}`);

const SPONSORS = [
  { id: "s-scotia", name: "Scotiabank" },
  { id: "s-cl", name: "Canada Life" },
  { id: "s-rbc", name: "RBC" },
];

describe("labelledLocations", () => {
  it("lists each name: room part", () => {
    expect(labelledLocations("Scotiabank: Rm 2110, QNX: Rm 2235")).toEqual([
      { name: "Scotiabank", room: "Rm 2110" },
      { name: "QNX", room: "Rm 2235" },
    ]);
  });
  it("skips unlabelled parts and empty rooms", () => {
    expect(labelledLocations("Rm 2110, RBC:, SEB: 2nd floor")).toEqual([
      { name: "SEB", room: "2nd floor" },
    ]);
  });
});

describe("judgingItem", () => {
  it("prefers the sponsor judging block over other judging items", () => {
    const general = item({ id: "g", title: "Judging", start: "09:00" });
    const sponsor = item({ id: "s" });
    expect(judgingItem([general, sponsor])?.id).toBe("s");
    expect(judgingItem([general])?.id).toBe("g");
  });
  it("ignores judging workshops", () => {
    expect(
      judgingItem([item({ title: "Sponsor Judging Workshop" })]),
    ).toBeNull();
  });
});

describe("buildJudgingBoard", () => {
  const items = [item({})];

  it("takes rooms from the run-of-show list and marks the source", () => {
    const board = buildJudgingBoard({
      sponsors: SPONSORS,
      items,
      sheet: {
        rooms: new Map(),
        pickCount: pickCountFromChosenTeams(new Map()),
      },
    });
    const scotia = board.rows.find((r) => r.name === "Scotiabank");
    expect(scotia).toMatchObject({
      room: "Rm 2110",
      source: "run-of-show",
      registered: true,
    });
  });

  it("lets Lucas's sheet win over the run-of-show list", () => {
    const board = buildJudgingBoard({
      sponsors: SPONSORS,
      items,
      sheet: {
        rooms: new Map([["scotiabank", "Rm 3100"]]),
        pickCount: pickCountFromChosenTeams(new Map()),
      },
    });
    expect(board.rows.find((r) => r.name === "Scotiabank")).toMatchObject({
      room: "Rm 3100",
      source: "sponsor-sheet",
      otherRoom: "Rm 2110",
    });
  });

  it("treats the sheet's TBD as no room", () => {
    const board = buildJudgingBoard({
      sponsors: SPONSORS,
      items,
      sheet: {
        rooms: new Map([["scotiabank", "TBD"]]),
        pickCount: pickCountFromChosenTeams(new Map()),
      },
    });
    expect(board.rows.find((r) => r.name === "Scotiabank")?.source).toBe(
      "run-of-show",
    );
  });

  it("marks registered sponsors without a room as missing, never invents one", () => {
    const board = buildJudgingBoard({
      sponsors: SPONSORS,
      items,
      sheet: {
        rooms: new Map(),
        pickCount: pickCountFromChosenTeams(new Map([["RBC", teams(8)]])),
      },
    });
    expect(board.rows.find((r) => r.name === "RBC")).toMatchObject({
      room: null,
      source: null,
      missingRoom: true,
      status: "missing-room",
      picks: 8,
    });
    expect(board.counts.missingRooms).toBe(1);
  });

  it("keeps listed companies that aren't registered, after the sponsors", () => {
    const board = buildJudgingBoard({ sponsors: SPONSORS, items, sheet: null });
    expect(board.rows.map((r) => r.name)).toEqual([
      "Canada Life",
      "RBC",
      "Scotiabank",
      "QNX",
    ]);
    expect(board.rows.at(-1)).toMatchObject({
      registered: false,
      sponsorId: null,
      room: "Rm 2235",
      status: "not-registered",
      missingRoom: false,
    });
    // Not-registered companies don't count as sponsors.
    expect(board.counts.sponsors).toBe(3);
  });

  it("matches names ignoring case and spaces", () => {
    const board = buildJudgingBoard({
      sponsors: [{ id: "a", name: "Canada Life" }],
      items: [item({ location: "canadalife: Rm 2230" })],
      sheet: null,
    });
    expect(board.rows).toHaveLength(1);
    expect(board.rows[0]?.room).toBe("Rm 2230");
  });

  it("says room unknown (not missing) when a room source can't be read", () => {
    const read = { rooms: new Map<string, string>(), pickCount: () => 6 };
    const noRunOfShow = buildJudgingBoard({
      sponsors: SPONSORS,
      items: [],
      runOfShowRead: false,
      sheet: read,
    });
    expect(noRunOfShow.runOfShowRead).toBe(false);
    expect(noRunOfShow.rows.every((r) => r.status === "room-unknown")).toBe(
      true,
    );
    expect(noRunOfShow.rows.some((r) => r.missingRoom)).toBe(false);
    expect(noRunOfShow.counts.missingRooms).toBe(0);

    const noSheet = buildJudgingBoard({
      sponsors: SPONSORS,
      items,
      sheet: null,
    });
    const unlisted = noSheet.rows.filter((r) => r.registered && !r.room);
    expect(unlisted.length).toBeGreaterThan(0);
    expect(unlisted.every((r) => r.status === "room-unknown")).toBe(true);
  });

  it("matches sheet rooms and picks ignoring case and spaces; no sheet row = unknown picks", () => {
    const board = buildJudgingBoard({
      sponsors: [
        { id: "1", name: "Canada Life" },
        { id: "2", name: "Absent Co" },
      ],
      items: [],
      sheet: {
        rooms: new Map([["canada  life ", "Rm 3000"]]),
        pickCount: pickCountFromChosenTeams(
          new Map([[" CANADA LIFE", teams(MIN_SPONSOR_PICKS)]]),
        ),
      },
    });
    const by = (n: string) => board.rows.find((r) => r.name === n);
    expect(by("Canada Life")).toMatchObject({
      room: "Rm 3000",
      picks: MIN_SPONSOR_PICKS,
      status: "ready",
    });
    expect(by("Absent Co")?.picks).toBeNull();
  });

  it("counts picks and flags too few", () => {
    const board = buildJudgingBoard({
      sponsors: SPONSORS,
      items,
      sheet: {
        rooms: new Map(),
        pickCount: pickCountFromChosenTeams(
          new Map([
            ["Scotiabank", teams(MIN_SPONSOR_PICKS)],
            ["Canada Life", teams(2)],
          ]),
        ),
      },
    });
    const by = (n: string) => board.rows.find((r) => r.name === n);
    expect(by("Scotiabank")?.status).toBe("ready");
    expect(by("Canada Life")).toMatchObject({
      picks: 2,
      tooFewPicks: true,
      status: "too-few-picks",
    });
    expect(board.counts).toEqual({
      sponsors: 3,
      withRoom: 2,
      enoughPicks: 1,
      missingRooms: 1,
    });
  });

  it("leaves picks unknown when the judging sheet can't be read", () => {
    const board = buildJudgingBoard({ sponsors: SPONSORS, items, sheet: null });
    expect(board.sheetRead).toBe(false);
    expect(board.rows.find((r) => r.name === "Scotiabank")).toMatchObject({
      picks: null,
      tooFewPicks: false,
      status: "picks-unknown",
    });
  });

  it("dates judging from the item, falling back to Sunday", () => {
    const sat = buildJudgingBoard({
      sponsors: [],
      items: [item({ day: "Saturday", start: "14:00", end: "15:00" })],
      sheet: null,
    });
    expect(sat.day).toBe("Saturday");
    expect(sat.slot).toMatchObject({ start: "14:00", end: "15:00" });
    const none = buildJudgingBoard({ sponsors: [], items: [], sheet: null });
    expect(none.day).toBe("Sunday");
    expect(none.slot).toBeNull();
  });
});

describe("judgingStatus", () => {
  it("puts a missing room before too few picks", () => {
    expect(judgingStatus({ registered: true, room: null, picks: 0 })).toBe(
      "missing-room",
    );
    expect(judgingStatus({ registered: false, room: null, picks: 0 })).toBe(
      "not-registered",
    );
    expect(
      judgingStatus({
        registered: true,
        room: "Rm 1",
        picks: MIN_SPONSOR_PICKS - 1,
      }),
    ).toBe("too-few-picks");
  });
});
