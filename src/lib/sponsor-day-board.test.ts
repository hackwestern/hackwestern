import { describe, expect, it } from "vitest";

import type { RunOfShowItem } from "~/lib/run-of-show";
import {
  hasArrived,
  parseDayParam,
  round1State,
  round2State,
  slotFill,
  slotTone,
  slotTotals,
  slotsByRoom,
  sponsorBoardDefaultDay,
  sponsorItems,
  sundayWhere,
  type SundayJudging,
} from "~/lib/sponsor-day-board";
import { buildSponsorSummaries } from "~/lib/sponsor-organizer";

const et = (iso: string) => new Date(`${iso}-05:00`);

const item = (
  over: Partial<RunOfShowItem> &
    Pick<RunOfShowItem, "start" | "end" | "column" | "title">,
): RunOfShowItem => ({
  id: `${over.day ?? "Sunday"}-${over.start}-${over.column}`,
  day: "Sunday",
  location: null,
  sponsors: [],
  ...over,
});

describe("parseDayParam", () => {
  it("reads a day in any case", () => {
    expect(parseDayParam("saturday")).toBe("Saturday");
    expect(parseDayParam("SUNDAY")).toBe("Sunday");
    expect(parseDayParam(["friday", "sunday"])).toBe("Friday");
  });
  it("ignores anything else", () => {
    expect(parseDayParam(undefined)).toBeNull();
    expect(parseDayParam("")).toBeNull();
    expect(parseDayParam("monday")).toBeNull();
  });
});

describe("sponsorBoardDefaultDay", () => {
  it("is today during the event (Eastern)", () => {
    expect(sponsorBoardDefaultDay(et("2026-11-20T18:00:00"))).toBe("Friday");
    expect(sponsorBoardDefaultDay(et("2026-11-21T00:30:00"))).toBe("Saturday");
    expect(sponsorBoardDefaultDay(et("2026-11-22T23:59:00"))).toBe("Sunday");
  });
  it("is Friday before and after the event", () => {
    expect(sponsorBoardDefaultDay(et("2026-11-18T12:00:00"))).toBe("Friday");
    expect(sponsorBoardDefaultDay(et("2026-11-23T09:00:00"))).toBe("Friday");
  });
});

describe("Friday", () => {
  it("counts any status after Not arrived as arrived", () => {
    expect(hasArrived("Not arrived")).toBe(false);
    expect(hasArrived("Checked in")).toBe(true);
    expect(hasArrived("Left")).toBe(true);
  });
});

describe("Saturday slots", () => {
  const slots = [
    { room: "Rm 2242", slotTime: "10:15", booked: 3, needed: 3 },
    { room: "Rm 2241", slotTime: "10:00", booked: 1, needed: 3 },
    { room: "Rm 2242", slotTime: "10:00", booked: 0, needed: 0 },
    { room: "Rm 2241", slotTime: "10:15", booked: 4, needed: 2 },
  ];
  it("tones a slot full, open or off", () => {
    expect(slotTone({ booked: 3, needed: 3 })).toBe("full");
    expect(slotTone({ booked: 1, needed: 3 })).toBe("open");
    expect(slotTone({ booked: 0, needed: 0 })).toBe("off");
  });
  it("groups by room in time order", () => {
    expect(
      slotsByRoom(slots).map((g) => [g.room, g.slots.map((s) => s.slotTime)]),
    ).toEqual([
      ["Rm 2241", ["10:00", "10:15"]],
      ["Rm 2242", ["10:00", "10:15"]],
    ]);
  });
  it("caps a cell at the ask and keeps the extras apart", () => {
    // Ask lowered to 2 after 4 were booked: "2/2 +2 over", never "4/2".
    expect(slotFill({ booked: 4, needed: 2 })).toEqual({ shown: 2, over: 2 });
    // Asked for none but one is booked: "0/0 +1 over", never "1/0".
    expect(slotFill({ booked: 1, needed: 0 })).toEqual({ shown: 0, over: 1 });
    expect(slotFill({ booked: 1, needed: 3 })).toEqual({ shown: 1, over: 0 });
    // The cells add up to the totals.
    const cells = slots.reduce((n, s) => n + slotFill(s).shown, 0);
    expect(cells).toBe(slotTotals(slots).booked);
  });
  it("totals booked against asked, never over a slot's ask", () => {
    expect(slotTotals(slots)).toEqual({ booked: 6, needed: 8, open: 1 });
  });
});

describe("Sunday rounds", () => {
  const none: SundayJudging = {
    shortlistSentAt: null,
    shortlistSentCount: 0,
    scored: 0,
    shortlisted: 0,
    finalSubmittedAt: null,
  };
  it("round 1: not started, working, sent", () => {
    expect(round1State(none)).toEqual({ kind: "not-started" });
    expect(round1State({ ...none, scored: 4, shortlisted: 2 })).toEqual({
      kind: "working",
      scored: 4,
      shortlisted: 2,
    });
    const at = new Date("2026-11-22T14:58:00Z");
    expect(
      round1State({
        ...none,
        scored: 9,
        shortlistSentAt: at,
        shortlistSentCount: 7,
      }),
    ).toEqual({ kind: "sent", teams: 7, at });
  });
  it("round 2: not open, ranking, sent (sent wins even if closed again)", () => {
    expect(round2State(none, false)).toEqual({ kind: "not-open" });
    expect(round2State(none, true)).toEqual({ kind: "ranking" });
    const at = new Date("2026-11-22T17:00:00Z");
    expect(round2State({ ...none, finalSubmittedAt: at }, false)).toEqual({
      kind: "sent",
      at,
    });
  });
});

describe("sundayWhere", () => {
  const items: RunOfShowItem[] = [
    item({
      start: "08:30",
      end: "09:00",
      column: "big-event",
      title: "Sponsor judging workshop",
      location: "Rm 2110",
    }),
    item({
      start: "09:00",
      end: "10:00",
      column: "big-event",
      title: "Sponsor judging round 1",
      location: "Acme: Rm 2230, Beta: Rm 2235",
    }),
    item({
      start: "08:00",
      end: "17:00",
      column: "spon-booth",
      title: "Sponsor Bay open",
    }),
    item({
      start: "13:00",
      end: "14:00",
      column: "sponsor-workshop",
      title: "Beta workshop",
      sponsors: ["Beta"],
    }),
    item({
      start: "12:00",
      end: "13:00",
      column: "food",
      title: "Lunch",
    }),
    item({
      day: "Saturday",
      start: "09:00",
      end: "10:00",
      column: "big-event",
      title: "Saturday thing",
    }),
  ];
  const slots = [
    { room: "Rm 2230", start: 10 * 60, teamName: "Team One" },
    { room: "Rm 2230", start: 10 * 60 + 10, teamName: "Team Two" },
  ];
  const at = (time: string) => et(`2026-11-22T${time}:00`);

  it("only another sponsor's blocks are left out", () => {
    expect(sponsorItems(items, "Acme", "Sunday").map((i) => i.title)).toEqual([
      "Sponsor judging workshop",
      "Sponsor judging round 1",
      "Sponsor Bay open",
      "Lunch",
    ]);
  });

  it("before Sunday, their first block (not the all-day Sponsor Bay)", () => {
    expect(
      sundayWhere({
        sponsorName: "Acme",
        items,
        slots,
        now: et("2026-11-20T10:00:00"),
      }),
    ).toMatchObject({
      kind: "item",
      title: "Sponsor judging workshop",
      location: "Rm 2110",
      now: false,
    });
  });

  it("a main event beats the all-day Sponsor Bay, with their own room", () => {
    expect(
      sundayWhere({ sponsorName: "Acme", items, slots, now: at("09:15") }),
    ).toEqual({
      kind: "item",
      title: "Sponsor judging round 1",
      location: "Rm 2230",
      start: "09:00",
      end: "10:00",
      now: true,
    });
  });

  it("in their room while presentations run, with the team on now", () => {
    expect(
      sundayWhere({ sponsorName: "Acme", items, slots, now: at("10:12") }),
    ).toEqual({
      kind: "presenting",
      room: "Rm 2230",
      team: "Team Two",
      until: "10:15",
    });
    // Between two slots: still in the room, nobody presenting.
    expect(
      sundayWhere({ sponsorName: "Acme", items, slots, now: at("10:07") }),
    ).toMatchObject({ kind: "presenting", team: null });
  });

  it("presentations are next when nothing else comes first", () => {
    const quiet = items.filter((i) => i.column !== "spon-booth");
    expect(
      sundayWhere({
        sponsorName: "Acme",
        items: quiet.filter((i) => i.start !== "09:00"),
        slots,
        now: at("09:30"),
      }),
    ).toEqual({ kind: "presenting-next", room: "Rm 2230", start: "10:00" });
  });

  it("next block when nothing is on", () => {
    const quiet = items.filter((i) => i.column !== "spon-booth");
    expect(
      sundayWhere({
        sponsorName: "Acme",
        items: quiet,
        slots,
        now: at("11:00"),
      }),
    ).toMatchObject({
      kind: "item",
      title: "Lunch",
      now: false,
      start: "12:00",
    });
  });

  it("done after their last block, none without any", () => {
    const quiet = items.filter((i) => i.column !== "spon-booth");
    expect(
      sundayWhere({
        sponsorName: "Acme",
        items: quiet,
        slots,
        now: at("15:00"),
      }),
    ).toEqual({ kind: "done" });
    expect(
      sundayWhere({
        sponsorName: "Acme",
        items: [],
        slots: [],
        now: at("09:00"),
      }),
    ).toEqual({ kind: "none" });
    expect(
      sundayWhere({
        sponsorName: "Acme",
        items,
        slots,
        now: et("2026-11-23T09:00:00"),
      }),
    ).toEqual({ kind: "done" });
  });
});

describe("buildSponsorSummaries day fields", () => {
  const A = "aaaaaaaa-0000-4000-8000-000000000001";
  const early = et("2026-11-20T12:00:00");
  it("adds slots booked/asked, link given and Sunday progress", () => {
    const given = new Date("2026-11-20T23:00:00Z");
    const r = buildSponsorSummaries({
      sponsors: [
        {
          id: A,
          name: "Acme",
          coffeeChatStyle: "oneOnOne",
          coffeeChatPerSlot: 3,
          portalLinkGivenAt: given,
        },
      ],
      setups: [{ sponsor: "Acme", room: null, format: "15 min" }],
      chats: [
        {
          sponsorId: A,
          room: "Rm 2241",
          slotTime: "10:00",
          status: "accepted",
        },
        { sponsorId: A, room: "Rm 2241", slotTime: "10:00", status: "pending" },
      ],
      help: [],
      holds: [
        { sponsorId: A, room: "Rm 2241", startTime: "10:00", endTime: "10:30" },
      ],
      limits: [
        { sponsorId: A, startTime: "10:15", endTime: "10:30", hackers: 1 },
      ],
      sunday: new Map([
        [
          A,
          {
            shortlistSentAt: null,
            shortlistSentCount: 0,
            scored: 3,
            shortlisted: 1,
            finalSubmittedAt: null,
          },
        ],
      ]),
      presentations: [
        { sponsorId: A, room: "Rm 2230", start: 610, teamName: "Two" },
        { sponsorId: A, room: "Rm 2230", start: 600, teamName: "One" },
        { sponsorId: "other", room: "Rm 2235", start: 600, teamName: "X" },
      ],
      round2Open: true,
      now: early,
    });
    const acme = r.sponsors[0]!;
    expect(acme.linkGivenAt).toBe(given.toISOString());
    expect(acme.chatSlots).toEqual([
      { room: "Rm 2241", slotTime: "10:00", booked: 2, needed: 3 },
      { room: "Rm 2241", slotTime: "10:15", booked: 0, needed: 1 },
    ]);
    expect(acme.sunday.scored).toBe(3);
    expect(acme.sunday.slots.map((s) => s.teamName)).toEqual(["One", "Two"]);
    expect(r.round2Open).toBe(true);
  });

  it("defaults: no link, no slots, nothing judged", () => {
    const r = buildSponsorSummaries({
      sponsors: [{ id: A, name: "Acme" }],
      setups: [],
      chats: [],
      help: [],
      now: early,
    });
    expect(r.sponsors[0]).toMatchObject({
      linkGivenAt: null,
      chatSlots: [],
      sunday: { shortlistSentAt: null, finalSubmittedAt: null, slots: [] },
    });
    expect(r.round2Open).toBe(false);
  });
});
