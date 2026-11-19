import { describe, expect, it } from "vitest";
import { buildJudgingBoard } from "~/lib/sponsor-judging-rooms";
import { coffeeChatExpiresAt } from "./coffee-chat-requests";
import {
  buildSponsorSummaries,
  leadsSponsor,
  legacyScheduleDestination,
  mySponsorChats,
  needsAttention,
  ORGANIZER_TABS,
  orderReps,
  organizerHomeHref,
  organizerNameForEmail,
  parseOrganizerLocation,
  pillDone,
  statusAfterPill,
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
      sponsor: null,
    });
    expect(parseOrganizerLocation({ tab: "coffee" }).tab).toBe("coffee");
    expect(parseOrganizerLocation({ tab: "schedule" }).tab).toBe("schedule");
    expect(parseOrganizerLocation({ tab: "judging" }).tab).toBe("judging");
    expect(parseOrganizerLocation({ tab: "nope" }).tab).toBe("sponsors");
    expect(parseOrganizerLocation({ tab: ["coffee", "judging"] }).tab).toBe(
      "coffee",
    );
  });

  it("sends the old Task pings and Help links to Sponsors (pings are off)", () => {
    for (const loc of [
      parseOrganizerLocation({ tab: "pings" }),
      parseOrganizerLocation({ tab: "help" }),
      parseOrganizerLocation({ view: "help" }),
      parseOrganizerLocation({ tab: "pings" }, "#help"),
      parseOrganizerLocation({ tab: ["help", "coffee"] }),
    ]) {
      expect(loc.tab).toBe("sponsors");
    }
    expect(parseOrganizerLocation({ tab: "help" }, "#rooms").tab).toBe(
      "schedule",
    );
  });

  it("has no Task pings tab", () => {
    expect(ORGANIZER_TABS as readonly string[]).not.toContain("pings");
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
    expect(parseOrganizerLocation({ tab: "coffee", sponsor: A }).sponsor).toBe(
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
    expect(organizerHomeHref({ tab: "judging" })).toBe(
      "/internal/sponsors?tab=judging",
    );
  });

  it("links back to a sponsor's row on the Sponsors tab", () => {
    expect(organizerHomeHref({ tab: "sponsors", sponsor: A })).toBe(
      `/internal/sponsors#sponsor-${A}`,
    );
  });

  it("round-trips through parseOrganizerLocation", () => {
    const href = organizerHomeHref({ tab: "coffee", sponsor: B });
    const url = new URL(href, "https://x.test");
    const loc = parseOrganizerLocation(
      Object.fromEntries(url.searchParams),
      url.hash,
    );
    expect(loc).toEqual({ tab: "coffee", jumpToRooms: false, sponsor: B });
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
      "/internal/sponsors",
    );
    expect(legacyScheduleDestination({ tab: "pings" })).toBe(
      "/internal/sponsors",
    );
    expect(legacyScheduleDestination({ tab: "where" })).toBe(
      "/internal/sponsors?tab=schedule#rooms",
    );
    expect(legacyScheduleDestination({ tab: "coffee", sponsor: A })).toBe(
      `/internal/sponsors?tab=coffee&sponsor=${A}`,
    );
  });
});

describe("My sponsors matching", () => {
  const contacts = [
    { name: "Noah Medland", loginEmail: "Noah@Example.test " },
    { name: "Caroline Ge", loginEmail: "" },
  ];
  it("matches the login email case-insensitively", () => {
    expect(organizerNameForEmail("noah@example.test", contacts)).toBe(
      "Noah Medland",
    );
    expect(organizerNameForEmail("other@example.test", contacts)).toBeNull();
    expect(organizerNameForEmail("", contacts)).toBeNull();
    expect(organizerNameForEmail(null, contacts)).toBeNull();
  });
  it("matches the HW lead cell by full name, first name or one of several", () => {
    expect(leadsSponsor("Noah Medland", "Noah Medland")).toBe(true);
    expect(leadsSponsor("noah  medland", "Noah Medland")).toBe(true);
    expect(leadsSponsor("Noah", "Noah Medland")).toBe(true);
    expect(leadsSponsor("Daniel Wang / Noah Medland", "Noah Medland")).toBe(
      true,
    );
    expect(leadsSponsor("Noah Smith", "Noah Medland")).toBe(false);
    expect(leadsSponsor("—", "Noah Medland")).toBe(false);
    expect(leadsSponsor("Caroline Ge", "Noah Medland")).toBe(false);
  });
});

describe("status pills", () => {
  it("reads Arrival and Booth from the one sheet status", () => {
    expect(pillDone("arrival", "Not arrived")).toBe(false);
    expect(pillDone("arrival", "Checked in")).toBe(true);
    expect(pillDone("booth", "Checked in")).toBe(false);
    expect(pillDone("booth", "Booth set up")).toBe(true);
    expect(pillDone("arrival", "Booth set up")).toBe(true);
  });
  it("advances and undoes", () => {
    expect(statusAfterPill("arrival", "advance")).toBe("Checked in");
    expect(statusAfterPill("arrival", "undo")).toBe("Not arrived");
    expect(statusAfterPill("booth", "advance")).toBe("Booth set up");
    expect(statusAfterPill("booth", "undo")).toBe("Checked in");
  });
});

describe("mySponsorChats", () => {
  const reps = [
    { id: "r1", chatsWanted: 4 },
    { id: "r2", chatsWanted: 2 },
    { id: "r3", chatsWanted: 0 },
  ];
  it("counts reps placed, invites and changes after Send", () => {
    const c = mySponsorChats({
      pref: {
        submittedAt: new Date("2026-11-20T22:00:00Z"),
        shortlistSubmittedAt: null,
        updatedAt: new Date("2026-11-21T03:00:00Z"),
      },
      reps,
      placements: [
        {
          repId: "r1",
          status: "sent",
          sentAt: new Date("2026-11-21T02:00:00Z"),
        },
      ],
      invites: [
        { status: "accepted" },
        { status: "pending" },
        { status: "declined" },
      ],
    });
    expect(c).toMatchObject({
      repsChatting: 2,
      repsPlaced: 1,
      scheduleSent: true,
      changedAfterSend: true,
      invites: 2,
      accepted: 1,
    });
  });
  it("is not changed after Send without a Send", () => {
    const c = mySponsorChats({
      pref: {
        submittedAt: null,
        shortlistSubmittedAt: null,
        updatedAt: new Date(),
      },
      reps,
      placements: [{ repId: "r1", status: "draft" }],
      invites: [],
    });
    expect(c.changedAfterSend).toBe(false);
    expect(c.prefsSubmittedAt).toBeNull();
  });
  it("orders the primary rep first", () => {
    const ordered = orderReps([
      { id: "a", name: "B", phone: "1", isPrimary: false, position: 0 },
      { id: "b", name: "A", phone: "2", isPrimary: true, position: 1 },
    ]);
    expect(ordered.map((r) => r.id)).toEqual(["b", "a"]);
  });
});

describe("needsAttention", () => {
  const base = {
    prefsSubmittedAt: "x",
    repsChatting: 2,
    repsPlaced: 2,
    changedAfterSend: false,
  };
  const start = (t: { start: string }) =>
    new Date(`2026-11-20T${t.start}:00-05:00`);
  const now = new Date("2026-11-20T19:00:00-05:00");
  it("lists changed, unscheduled, no preferences, then recent overdue tasks", () => {
    const items = needsAttention({
      sponsors: [
        {
          sponsorId: "1",
          name: "Zed",
          chats: { ...base, prefsSubmittedAt: null },
        },
        { sponsorId: "2", name: "Ace", chats: { ...base, repsPlaced: 1 } },
        {
          sponsorId: "3",
          name: "Bee",
          chats: { ...base, changedAfterSend: true },
        },
        { sponsorId: "4", name: "Done", chats: base },
      ],
      tasks: [
        {
          day: "Friday",
          start: "18:00",
          task: "Sponsor Bay coverage",
          owner: "Daniel",
        },
        { day: "Friday", start: "16:00", task: "Too old", owner: null },
        { day: "Friday", start: "18:45", task: "Still on", owner: null },
      ],
      now,
      taskStart: start,
      taskMinutes: 30,
    });
    expect(items.map((i) => i.kind)).toEqual([
      "changed",
      "not-scheduled",
      "no-prefs",
      "overdue-task",
    ]);
    expect(items[3]).toMatchObject({ task: "Sponsor Bay coverage" });
  });
  it("is empty when all is well", () => {
    expect(
      needsAttention({
        sponsors: [{ sponsorId: "4", name: "Done", chats: base }],
        tasks: [],
        now,
        taskStart: start,
        taskMinutes: 30,
      }),
    ).toEqual([]);
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
    // Beta: block 13:00-13:30, no request yet: 3 hackers per slot (the
    // default), 15 min: 2 starts x 3.
    expect(beta!.seatsLeft).toBe(6);
  });

  it("totals row sums the given rows", () => {
    expect(r.totals).toEqual({
      accepted: 1,
      pending: 1,
      seatsLeft: 8,
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
