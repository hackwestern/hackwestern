import { describe, expect, it } from "vitest";
import { coffeeChatExpiresAt } from "./coffee-chat-requests";
import {
  buildSponsorSummaries,
  legacyScheduleDestination,
  organizerHomeHref,
  parseOrganizerLocation,
  sponsorNameForParam,
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
    expect(parseOrganizerLocation({ tab: "help" }).tab).toBe("help");
    expect(parseOrganizerLocation({ tab: "schedule" }).tab).toBe("schedule");
    expect(parseOrganizerLocation({ tab: "nope" }).tab).toBe("sponsors");
    expect(parseOrganizerLocation({ tab: ["help", "coffee"] }).tab).toBe(
      "help",
    );
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
  });

  it("links back to a sponsor's row on the Sponsors tab", () => {
    expect(organizerHomeHref({ tab: "sponsors", sponsor: A })).toBe(
      `/internal/sponsors#sponsor-${A}`,
    );
  });

  it("round-trips through parseOrganizerLocation", () => {
    const href = organizerHomeHref({ tab: "help", sponsor: B });
    const url = new URL(href, "https://x.test");
    const loc = parseOrganizerLocation(
      Object.fromEntries(url.searchParams),
      url.hash,
    );
    expect(loc).toEqual({ tab: "help", jumpToRooms: false, sponsor: B });
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
      "/internal/sponsors?tab=help",
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
    { id: B, name: "Beta", coffeeChatRoom: null },
    { id: A, name: "Acme", coffeeChatRoom: "Rm 2241" },
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

  it("picks the room: assignment, then the sheet, then the first chat's", () => {
    const withSheet = buildSponsorSummaries({
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
      now: early,
    });
    expect(withSheet.sponsors.map((s) => s.room)).toEqual([
      "Rm 2241",
      "Rm 2243",
    ]);
    const fromChats = buildSponsorSummaries({
      sponsors,
      setups: [],
      chats: [
        {
          sponsorId: B,
          room: "Rm 2242",
          slotTime: "14:00",
          status: "accepted",
        },
        {
          sponsorId: B,
          room: "Rm 2243",
          slotTime: "13:00",
          status: "accepted",
        },
      ],
      help: [],
      now: early,
    });
    expect(fromChats.sponsors[1]?.room).toBe("Rm 2243");
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
