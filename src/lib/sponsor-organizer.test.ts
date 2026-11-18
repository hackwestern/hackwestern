import { describe, expect, it } from "vitest";
import { buildJudgingBoard } from "~/lib/sponsor-judging-rooms";
import { coffeeChatExpiresAt } from "./coffee-chat-requests";
import {
  buildSponsorSummaries,
  legacyScheduleDestination,
  organizerHomeHref,
  parseOrganizerLocation,
  sponsorNameForParam,
  summaryTotals,
} from "./sponsor-organizer";

const A = "aaaaaaaa-0000-4000-8000-000000000001";
const B = "bbbbbbbb-0000-4000-8000-000000000002";

describe("parseOrganizerLocation", () => {
  it("defaults to Sponsors and reads known tabs", () => {
    expect(parseOrganizerLocation({})).toEqual({
      tab: "sponsors",
      jumpToRooms: false,
      jumpToHelp: false,
      sponsor: null,
    });
    expect(parseOrganizerLocation({ tab: "coffee" }).tab).toBe("coffee");
    expect(parseOrganizerLocation({ tab: "pings" })).toMatchObject({
      tab: "pings",
      jumpToHelp: false,
    });
    expect(parseOrganizerLocation({ tab: "schedule" }).tab).toBe("schedule");
    expect(parseOrganizerLocation({ tab: "nope" }).tab).toBe("sponsors");
    expect(parseOrganizerLocation({ tab: ["pings", "coffee"] }).tab).toBe(
      "pings",
    );
  });

  it("sends the old Help tab links to Task pings, scrolled to help", () => {
    for (const loc of [
      parseOrganizerLocation({ tab: "help" }),
      parseOrganizerLocation({ view: "help" }),
      parseOrganizerLocation({ tab: "pings" }, "#help"),
      parseOrganizerLocation({ tab: ["help", "coffee"] }),
    ]) {
      expect(loc.tab).toBe("pings");
      expect(loc.jumpToHelp).toBe(true);
    }
    // #help only means something on Task pings.
    expect(parseOrganizerLocation({ tab: "help" }, "#rooms")).toMatchObject({
      tab: "schedule",
      jumpToHelp: false,
    });
  });

  it("sends the old Where is everyone links to the rooms", () => {
    for (const loc of [
      parseOrganizerLocation({ tab: "where" }),
      parseOrganizerLocation({ view: "where" }),
      parseOrganizerLocation({ tab: "coffee" }, "#rooms"),
    ]) {
      expect(loc.tab).toBe("schedule");
      expect(loc.jumpToRooms).toBe(true);
    }
    expect(parseOrganizerLocation({ view: "coffee" }).tab).toBe("coffee");
  });

  it("reads the sponsor focus, ignoring blanks", () => {
    expect(parseOrganizerLocation({ tab: "help", sponsor: A }).sponsor).toBe(A);
    expect(parseOrganizerLocation({ tab: "pings", sponsor: A }).sponsor).toBe(
      A,
    );
    expect(parseOrganizerLocation({ sponsor: "  " }).sponsor).toBeNull();
  });
});

describe("organizerHomeHref", () => {
  it("builds tab links with the sponsor focus", () => {
    expect(organizerHomeHref({ tab: "sponsors" })).toBe("/internal/sponsors");
    expect(organizerHomeHref({ tab: "coffee", sponsor: A })).toBe(
      `/internal/sponsors?tab=coffee&sponsor=${A}`,
    );
    expect(organizerHomeHref({ tab: "schedule", rooms: true })).toBe(
      "/internal/sponsors?tab=schedule#rooms",
    );
    expect(organizerHomeHref({ tab: "pings" })).toBe(
      "/internal/sponsors?tab=pings",
    );
    expect(organizerHomeHref({ tab: "pings", sponsor: A, help: true })).toBe(
      `/internal/sponsors?tab=pings&sponsor=${A}#help`,
    );
  });

  it("links back to a sponsor's row on the Sponsors tab", () => {
    expect(organizerHomeHref({ tab: "sponsors", sponsor: A })).toBe(
      `/internal/sponsors#sponsor-${A}`,
    );
  });

  it("round-trips through parseOrganizerLocation", () => {
    const href = organizerHomeHref({ tab: "pings", sponsor: B, help: true });
    const url = new URL(href, "https://x.test");
    const loc = parseOrganizerLocation(
      Object.fromEntries(url.searchParams),
      url.hash,
    );
    expect(loc).toEqual({
      tab: "pings",
      jumpToRooms: false,
      jumpToHelp: true,
      sponsor: B,
    });
  });
});

describe("legacyScheduleDestination", () => {
  it("maps /internal/sponsor-schedule onto the matching tab", () => {
    expect(legacyScheduleDestination({})).toBe(
      "/internal/sponsors?tab=schedule",
    );
    expect(legacyScheduleDestination({ tab: "schedule" })).toBe(
      "/internal/sponsors?tab=schedule",
    );
    expect(legacyScheduleDestination({ tab: "coffee" })).toBe(
      "/internal/sponsors?tab=coffee",
    );
    expect(legacyScheduleDestination({ view: "help" })).toBe(
      "/internal/sponsors?tab=pings#help",
    );
    expect(legacyScheduleDestination({ tab: "pings" })).toBe(
      "/internal/sponsors?tab=pings",
    );
    expect(legacyScheduleDestination({ tab: "where" })).toBe(
      "/internal/sponsors?tab=schedule#rooms",
    );
    expect(legacyScheduleDestination({ tab: "coffee", sponsor: A })).toBe(
      `/internal/sponsors?tab=coffee&sponsor=${A}`,
    );
  });
});

describe("sponsorNameForParam", () => {
  const sponsors = [
    { sponsorId: A, sponsor: "Acme" },
    { sponsorId: null, sponsor: "Sheet Only" },
  ];
  it("matches by id (any case), then by name", () => {
    expect(sponsorNameForParam(A.toUpperCase(), sponsors)).toBe("Acme");
    expect(sponsorNameForParam("sheet only", sponsors)).toBe("Sheet Only");
    expect(sponsorNameForParam(B, sponsors)).toBeNull();
    expect(sponsorNameForParam(null, sponsors)).toBeNull();
  });
});

describe("buildSponsorSummaries", () => {
  const sponsors = [
    { id: B, name: "Beta" },
    { id: A, name: "Acme" },
  ];
  // Well before Saturday's chats, so nothing pending has expired yet.
  const early = new Date("2026-11-20T12:00:00-05:00");

  it("counts accepted and pending chats per sponsor, sorted by name", () => {
    const r = buildSponsorSummaries({
      sponsors,
      setups: [],
      chats: [
        {
          sponsorId: A,
          room: "Rm 2241",
          slotTime: "13:00",
          status: "accepted",
        },
        {
          sponsorId: A,
          room: "Rm 2241",
          slotTime: "13:15",
          status: "accepted",
        },
        { sponsorId: A, room: "Rm 2241", slotTime: "13:30", status: "pending" },
        { sponsorId: B, room: null, slotTime: "14:00", status: "pending" },
        {
          sponsorId: "unknown",
          room: null,
          slotTime: "14:00",
          status: "accepted",
        },
      ],
      help: [],
      now: early,
    });
    expect(r.sponsors.map((s) => s.name)).toEqual(["Acme", "Beta"]);
    expect(r.sponsors[0]).toMatchObject({ accepted: 2, pending: 1 });
    expect(r.sponsors[1]).toMatchObject({ accepted: 0, pending: 1 });
  });

  it("drops pending chats past their answer cutoff", () => {
    const r = buildSponsorSummaries({
      sponsors,
      setups: [],
      chats: [
        { sponsorId: B, room: null, slotTime: "13:00", status: "pending" },
      ],
      help: [],
      now: coffeeChatExpiresAt("13:00"),
    });
    expect(r.sponsors.find((s) => s.sponsorId === B)?.pending).toBe(0);
  });

  it("rooms come from blocks and live chats, not a per-sponsor room", () => {
    const r = buildSponsorSummaries({
      sponsors,
      setups: [{ sponsor: "Beta", room: "Rm 2243" }],
      chats: [
        {
          sponsorId: B,
          room: "Rm 2242",
          slotTime: "13:00",
          status: "accepted",
        },
      ],
      help: [],
      holds: [
        { sponsorId: A, room: "Rm 2241", startTime: "10:00", endTime: "10:30" },
      ],
      now: early,
    });
    expect(r.sponsors.map((s) => s.rooms)).toEqual([["Rm 2241"], ["Rm 2242"]]);
  });

  it("attaches the oldest live help request and counts open ones", () => {
    const r = buildSponsorSummaries({
      sponsors,
      setups: [],
      chats: [],
      help: [
        {
          id: "h2",
          sponsorId: A,
          status: "claimed",
          claimedByName: "Sam",
          createdAt: new Date("2026-11-21T10:05:00Z"),
        },
        {
          id: "h1",
          sponsorId: A,
          status: "open",
          claimedByName: null,
          createdAt: new Date("2026-11-21T10:00:00Z"),
        },
        {
          id: "h3",
          sponsorId: B,
          status: "resolved",
          claimedByName: null,
          createdAt: new Date("2026-11-21T09:00:00Z"),
        },
      ],
      now: early,
    });
    expect(r.sponsors[0]?.help).toEqual({
      id: "h1",
      status: "open",
      claimedByName: null,
      createdAt: "2026-11-21T10:00:00.000Z",
    });
    expect(r.sponsors[1]?.help).toBeNull();
    expect(r.liveHelp).toBe(2);
    expect(r.openHelp).toBe(1);
  });
});

describe("buildSponsorSummaries, combined sponsor table", () => {
  const early = new Date("2026-11-20T12:00:00-05:00");
  const r = buildSponsorSummaries({
    sponsors: [
      {
        id: "a",
        name: "Acme",
        coffeeChatStyle: "oneOnOne",
        coffeeChatPerSlot: 2,
        coffeeChatWatcher: "Sam",
      },
      { id: "b", name: "Beta" },
    ],
    setups: [
      {
        sponsor: "Acme",
        room: null,
        windowStart: "10:00",
        windowEnd: "10:30",
        durationMinutes: 15,
        groupSize: 1,
      },
    ],
    chats: [
      {
        chatId: "c1",
        sponsorId: "a",
        room: "Rm 2241",
        slotTime: "10:00",
        durationMinutes: 15,
        status: "accepted",
        firstName: "Ada",
        lastName: "Lovelace",
        share: true,
        github: "https://github.com/ada",
      },
      {
        chatId: "c2",
        sponsorId: "a",
        room: "Rm 2241",
        slotTime: "10:15",
        durationMinutes: 15,
        status: "pending",
        firstName: "Grace",
        lastName: "Hopper",
        share: false,
        github: "https://github.com/grace",
      },
      {
        chatId: "c3",
        sponsorId: "a",
        room: "Rm 2241",
        slotTime: "10:15",
        durationMinutes: 15,
        status: "declined",
        firstName: "Old",
      },
    ],
    help: [
      {
        id: "h1",
        sponsorId: "b",
        status: "open",
        claimedByName: null,
        createdAt: new Date("2026-11-21T10:00:00Z"),
      },
    ],
    holds: [
      {
        holdId: "acme",
        sponsorId: "a",
        room: "Rm 2241",
        startTime: "10:00",
        endTime: "10:30",
      },
      {
        holdId: "x",
        sponsorId: "b",
        room: "Rm 2243",
        startTime: "13:00",
        endTime: "13:30",
      },
    ],
    now: early,
  });
  const [acme, beta] = r.sponsors;

  it("adds the chat request, watcher, rooms and live chats", () => {
    expect(acme).toMatchObject({
      request: { style: "oneOnOne", perSlot: 2, durationMinutes: 15 },
      watcher: "Sam",
      rooms: ["Rm 2241"],
      needsHacker: 1,
    });
    // Declined chats aren't listed; names follow the share consent.
    expect(acme!.chats.map((c) => [c.name, c.github, c.status])).toEqual([
      ["Ada Lovelace", "https://github.com/ada", "accepted"],
      ["Grace", null, "pending"],
    ]);
    expect(beta).toMatchObject({
      request: { source: "none" },
      rooms: ["Rm 2243"],
      needsHacker: 1,
    });
  });

  it("seats left: block slot starts, minus live chats", () => {
    // Acme: block 10:00-10:30, 2 reps x 1-on-1 = 2 seats at 10:00 and
    // 10:15; 1 used each. The sheet window alone adds nothing.
    expect(acme!.seatsLeft).toBe(2);
    // Beta: block 13:00-13:30, default 1-on-1 15 min, 1 rep: 2 starts.
    expect(beta!.seatsLeft).toBe(2);
  });

  it("totals row sums the given rows", () => {
    expect(r.totals).toEqual({
      accepted: 1,
      pending: 1,
      seatsLeft: 4,
      needsHacker: 2,
      openHelp: 1,
      missingRooms: 0,
    });
    expect(summaryTotals([acme!])).toEqual({
      accepted: 1,
      pending: 1,
      seatsLeft: 2,
      needsHacker: 1,
      openHelp: 0,
      missingRooms: 0,
    });
    expect(summaryTotals([])).toEqual({
      accepted: 0,
      pending: 0,
      seatsLeft: 0,
      needsHacker: 0,
      openHelp: 0,
      missingRooms: 0,
    });
  });

  it("carries each sponsor's judging row and counts missing rooms", () => {
    const judged = buildSponsorSummaries({
      sponsors: [
        { id: "a", name: "Acme" },
        { id: "b", name: "Bolt" },
      ],
      setups: [],
      chats: [],
      help: [],
      judging: buildJudgingBoard({
        sponsors: [
          { id: "a", name: "Acme" },
          { id: "b", name: "Bolt" },
        ],
        items: [
          {
            id: "j",
            day: "Sunday",
            start: "10:00",
            end: "11:30",
            column: "big-event",
            title: "Sponsor Track Judging",
            location: "Acme: Rm 2110, QNX: Rm 2235",
            sponsors: ["Acme"],
          },
        ],
        // Read, but names no rooms: Bolt's room is missing, not unknown.
        sheet: { rooms: new Map(), pickCount: () => null },
      }),
      now: new Date("2026-11-22T14:00:00Z"),
    });
    expect(judged.sponsors.map((s) => [s.name, s.judging?.room])).toEqual([
      ["Acme", "Rm 2110"],
      ["Bolt", null],
    ]);
    expect(judged.totals.missingRooms).toBe(1);
    // QNX isn't registered: on the board, not a sponsor row.
    expect(judged.judging?.rows.at(-1)?.status).toBe("not-registered");
  });
});
