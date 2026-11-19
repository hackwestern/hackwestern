import { describe, expect, it } from "vitest";
import {
  boardCount,
  doneColumns,
  flagsFor,
  repBlocks,
  sponsorFlags,
  sponsorsOnDay,
  upNext,
  type HomeSponsor,
} from "~/lib/organizer-home";
import { runOfShowInstant } from "~/lib/run-of-show-time";

const at = runOfShowInstant;

const chats = {
  prefsSubmittedAt: "2026-11-20T22:00:00Z",
  shortlistSubmittedAt: null,
  repsChatting: 2,
  repsPlaced: 2,
  scheduleSent: true,
  changedAfterSend: false,
  invites: 4,
  accepted: 3,
};

function sponsor(over: Partial<HomeSponsor> = {}): HomeSponsor {
  return {
    name: "Canada Life",
    sponsorId: "id-1",
    status: "Booth set up",
    atCcWorkshop: true,
    chats,
    blocks: [],
    sunday: {
      shortlistSentAt: null,
      shortlistSentCount: 0,
      scored: 0,
      shortlisted: 0,
      finalSubmittedAt: null,
    },
    missingRoom: false,
    workshops: [],
    prizeTrack: true,
    digital: false,
    ...over,
  };
}

describe("flagsFor", () => {
  it("flags a sponsor not here only from 5:05 PM Friday", () => {
    const s = sponsor({ status: "Not arrived" });
    expect(flagsFor("arrived", s, "Friday", at("Friday", "17:04"))).toEqual([]);
    expect(flagsFor("arrived", s, "Friday", at("Friday", "17:05"))).toEqual([
      { kind: "notHere" },
    ]);
  });

  it("shows no flags on a day that hasn't started", () => {
    const s = sponsor({ status: "Not arrived", chats: { ...chats, prefsSubmittedAt: null } });
    expect(sponsorFlags(s, "Saturday", at("Friday", "23:00"))).toEqual([]);
  });

  it("keeps an open problem on a past day", () => {
    const s = sponsor({ chats: { ...chats, prefsSubmittedAt: null } });
    expect(flagsFor("availability", s, "Friday", at("Saturday", "12:00"))).toEqual([
      { kind: "noAvailability" },
    ]);
  });

  it("flags changed reps and an empty chat that hasn't started on Saturday", () => {
    const s = sponsor({
      chats: { ...chats, changedAfterSend: true },
      blocks: [
        { repName: "Ken", sessionId: "15", room: "2241", start: 900, end: 960, accepted: 0, waiting: 0 },
        { repName: "Tom", sessionId: "10", room: "2241", start: 600, end: 660, accepted: 0, waiting: 0 },
      ],
    });
    expect(flagsFor("chats", s, "Saturday", at("Saturday", "12:05"))).toEqual([
      { kind: "changedAfterSend" },
      { kind: "emptyBlock", rep: "Ken", start: 900 },
    ]);
  });

  it("flags the top 5 from 11:30 Sunday, and never for a sponsor without a track", () => {
    expect(flagsFor("top5", sponsor(), "Sunday", at("Sunday", "11:29"))).toEqual([]);
    expect(flagsFor("top5", sponsor(), "Sunday", at("Sunday", "11:30"))).toEqual([
      { kind: "topLate" },
    ]);
    expect(
      flagsFor("top5", sponsor({ prizeTrack: false }), "Sunday", at("Sunday", "12:00")),
    ).toEqual([]);
  });
});

describe("doneColumns", () => {
  it("collapses a column only when every sponsor it applies to is done", () => {
    const now = at("Friday", "23:00");
    const a = sponsor();
    const b = sponsor({ name: "CSE", sponsorId: "id-2", status: "Not arrived" });
    expect(doneColumns("Friday", [a], now).has("arrived")).toBe(true);
    expect(doneColumns("Friday", [a, b], now).has("arrived")).toBe(false);
    // Info columns never collapse.
    expect(doneColumns("Friday", [a], now).has("shortlist")).toBe(false);
  });
});

describe("sponsorsOnDay", () => {
  it("shows digital sponsors only on Sunday", () => {
    const pcb = sponsor({ name: "PCBWay", digital: true });
    expect(sponsorsOnDay("Saturday", [pcb])).toEqual([]);
    expect(sponsorsOnDay("Sunday", [pcb])).toEqual([pcb]);
  });
});

describe("boardCount", () => {
  it("counts sponsors without availability or invites on Friday", () => {
    const now = at("Friday", "22:30");
    const ok = sponsor();
    const noPrefs = sponsor({ chats: { ...chats, prefsSubmittedAt: null } });
    const noInvites = sponsor({ chats: { ...chats, invites: 0, accepted: 0 } });
    expect(boardCount("Friday", [ok, noPrefs, noInvites], now, false)).toBe(2);
  });

  it("counts shortlists not in on Sunday, then top 5 once round 2 opens", () => {
    const now = at("Sunday", "11:00");
    const sent = sponsor({
      sunday: { shortlistSentAt: "x", shortlistSentCount: 8, scored: 8, shortlisted: 8, finalSubmittedAt: null },
    });
    expect(boardCount("Sunday", [sent, sponsor()], now, false)).toBe(1);
    expect(boardCount("Sunday", [sent, sponsor()], now, true)).toBe(2);
  });
});

describe("repBlocks", () => {
  it("lists sent sessions by time with their accepted and waiting seats", () => {
    const blocks = repBlocks({
      reps: [
        { id: "r1", name: "Dana", position: 0 },
        { id: "r2", name: "Ken", position: 1 },
      ],
      placements: [
        { id: "p1", repId: "r2", sessionId: "10", room: "2241", status: "sent" },
        { id: "p2", repId: "r1", sessionId: "13", room: "2242", status: "sent" },
        { id: "p3", repId: "r1", sessionId: "14", room: "2242", status: "draft" },
      ],
      invites: [
        { placementId: "p1", status: "accepted" },
        { placementId: "p1", status: "pending" },
        { placementId: "p1", status: "declined" },
        { placementId: "p2", status: "accepted" },
      ],
    });
    expect(blocks).toEqual([
      { repName: "Ken", sessionId: "10", room: "2241", start: 600, end: 660, accepted: 1, waiting: 1 },
      { repName: "Dana", sessionId: "13", room: "2242", start: 780, end: 840, accepted: 1, waiting: 0 },
    ]);
  });
});

describe("upNext", () => {
  const tasks = [
    { day: "Saturday" as const, start: "12:30", task: "Support setup", owner: "Noah" },
    { day: "Saturday" as const, start: "14:00", task: "Other", owner: "Daniel" },
    { day: "Sunday" as const, start: "08:00", task: "Judging", owner: "Noah" },
  ];
  const isNoah = (o: string | null) => o === "Noah";

  it("gives today's next own task with minutes to go", () => {
    expect(upNext("Saturday", tasks, at("Saturday", "12:05"), isNoah)).toEqual({
      kind: "next",
      task: tasks[0],
      minutes: 25,
    });
  });

  it("gives a later day's first task, and says a past day is over", () => {
    expect(upNext("Sunday", tasks, at("Saturday", "12:05"), isNoah)).toEqual({
      kind: "first",
      task: tasks[2],
    });
    expect(upNext("Friday", tasks, at("Saturday", "12:05"), isNoah)).toEqual({
      kind: "over",
    });
  });
});
