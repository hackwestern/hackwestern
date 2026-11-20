import { describe, expect, test } from "vitest";

import { windowAt, workshopWindows } from "~/lib/coffee-chat-schedule";
import {
  availChats,
  chatChanges,
  invitesAffected,
  invitesOutOfLine,
  parseSeenChats,
  repChatCap,
  setupTotals,
  setupWindows,
} from "~/lib/coffee-chat-setup";
import { COFFEE_SESSIONS } from "~/lib/coffee-chat-sessions";

// Sun Life sets up at 2:00: the travel buffer blocks from 1:45 to 3:15.
const sunLife = [{ start: "14:00", end: "15:00" }];

describe("setupWindows: partial sessions on the sponsor side", () => {
  test("a session the buffer only cuts is open, with the part left; one with no whole chat is blocked", () => {
    const groups = setupWindows(sunLife, 30);
    expect(groups.blocked).toEqual(["14"]);
    // 1:00-1:30 before the cut, 3:30-4:00 after it.
    expect(groups.partial).toEqual({ "13": { start: 780, end: 810 }, "15": { start: 930, end: 960 } });
    expect(groups.chats).toMatchObject({ "10": 2, "13": 1, "14": 0, "15": 1 });

    const oneOnOnes = setupWindows(sunLife, 15);
    expect(oneOnOnes.blocked).toEqual(["14"]);
    expect(oneOnOnes.partial).toEqual({ "13": { start: 780, end: 825 }, "15": { start: 915, end: 960 } });
    expect(oneOnOnes.chats).toMatchObject({ "13": 3, "15": 3, "16": 4 });
  });

  test("no workshop (or an unreadable run of show): every session whole", () => {
    expect(setupWindows([], 30)).toEqual({
      blocked: [],
      partial: {},
      chats: Object.fromEntries(COFFEE_SESSIONS.map((s) => [s.id, 2])),
    });
  });

  test("the same windows as the organizer board, for every session and chat length", () => {
    const items = sunLife.map((w) => ({ day: "Saturday", column: "sponsor-workshop", ...w, sponsors: ["Sun Life"] }));
    for (const minutes of [15, 30]) {
      const sponsor = { workshops: workshopWindows(items, "Sun Life"), chatMinutes: minutes };
      const windows = setupWindows(sunLife, minutes);
      for (const s of COFFEE_SESSIONS) {
        const board = windowAt(sponsor, s);
        expect(windows.blocked.includes(s.id), `${s.id} @ ${minutes}`).toBe(board === null);
        if (board && (board.start !== s.start || board.end !== s.end)) {
          expect(windows.partial[s.id]).toEqual(board);
        }
      }
    }
  });

  test("a rep's chat cap counts only the chats their free sessions hold", () => {
    const windows = setupWindows(sunLife, 30);
    // 1-2 (cut: 1 chat) + 4-5 (2 chats); 2-3 is blocked and doesn't count.
    expect(availChats(["13", "14", "16"], windows)).toBe(3);
    expect(repChatCap(5, 3)).toBe(3);
    expect(repChatCap(2, 3)).toBe(2);
    expect(
      setupTotals({ hackersPerChat: 3, longerOneOnOne: false }, [
        { chatsWanted: 5, availChats: 3 },
        { chatsWanted: 0, availChats: 4 },
      ]),
    ).toEqual({ chats: 3, hackers: 9 });
  });
});

describe("invitesAffected: the change-after-invites count (B4)", () => {
  // Dana: 4 chats wanted in groups of 3 (2 per session), free 1-2 and 2-3,
  // both placed with 3 invited hackers each. Kevin: one chat at 10-11.
  const h = (n: number) => Array.from({ length: n }, () => ({}));
  const chats = [
    { repId: "dana", sessionId: "13", hackers: h(3) },
    { repId: "dana", sessionId: "14", hackers: h(3) },
    { repId: "kevin", sessionId: "10", hackers: h(2) },
  ];
  const saved = {
    hackersPerChat: 3,
    reps: [
      { id: "dana", chatsWanted: 4, free: ["13", "14", "15"] },
      { id: "kevin", chatsWanted: 2, free: ["10"] },
    ],
  };
  const withRep = (id: string, patch: object) => ({
    ...saved,
    reps: saved.reps.map((r) => (r.id === id ? { ...r, ...patch } : r)),
  });

  test("unticking one session counts only that chat's hackers", () => {
    expect(invitesAffected(chats, [], saved, withRep("dana", { free: ["14", "15"] }))).toBe(3);
  });
  test("ticking a free session no chat sits in changes nothing", () => {
    expect(invitesAffected(chats, [], saved, withRep("kevin", { free: ["10", "11"] }))).toBe(0);
  });
  test("fewer chats counts only the chats that shrink", () => {
    expect(invitesAffected(chats, [], saved, withRep("dana", { chatsWanted: 3 }))).toBe(3);
  });
  test("a new group size touches every chat", () => {
    expect(invitesAffected(chats, [], saved, { ...saved, hackersPerChat: 2 })).toBe(8);
  });
  test("a removed rep's chats all count", () => {
    expect(invitesAffected(chats, [], saved, { ...saved, reps: saved.reps.slice(1) })).toBe(6);
  });
});

describe("invitesOutOfLine: the status card's count, by the dialog's rule", () => {
  // Dana wants 3 thirty-minute chats: 2 at 10, the last 1 at 11 (as sent).
  const sent = [
    { repId: "dana", sessionId: "10", hackers: [1, 2] },
    { repId: "dana", sessionId: "11", hackers: [3] },
  ];
  const setup = (free: string[], chatsWanted: number) => ({
    hackersPerChat: 2,
    reps: [{ id: "dana", chatsWanted, free }],
  });
  test("the setup as sent changes nothing, even with a partial last chat", () => {
    expect(invitesOutOfLine(sent, [], setup(["10", "11"], 3))).toBe(0);
    // More chats wanted adds chats; the sent ones stay.
    expect(invitesOutOfLine(sent, [], setup(["10", "11", "13"], 6))).toBe(0);
  });
  test("an unticked session or a chat that's gone counts, like the dialog", () => {
    expect(invitesOutOfLine(sent, [], setup(["11"], 3))).toBe(2);
    expect(invitesOutOfLine(sent, [], setup(["10", "11"], 2))).toBe(1);
    expect(invitesOutOfLine(sent, [], setup(["10", "11"], 2))).toBe(
      invitesAffected(sent, [], setup(["10", "11"], 3), setup(["10", "11"], 2)),
    );
  });
});

describe("chatChanges: organizer moves for the sponsor's Last change", () => {
  const seen = {
    p1: { repId: "dana", sessionId: "13", room: "2242", start: "13:00" },
    p2: { repId: "dana", sessionId: "14", room: "1348", start: "14:00" },
    p3: { repId: "kevin", sessionId: "10", room: "1352", start: "10:00" },
  };
  const team = new Set(["dana", "kevin"]);
  test("a new session, a new room and a removed chat", () => {
    expect(
      chatChanges(seen, [
        { placementId: "p1", repId: "dana", sessionId: "15", room: "1348", start: "15:00" },
        { placementId: "p2", repId: "dana", sessionId: "14", room: "2241", start: "14:00" },
      ], team),
    ).toEqual([
      { kind: "moved", repId: "dana", from: "13:00", to: "15:00", room: "1348" },
      { kind: "moved", repId: "dana", from: "14:00", to: null, room: "2241" },
      { kind: "removed", repId: "kevin", from: "10:00" },
    ]);
  });
  test("nothing changed, or a first look, is no change", () => {
    const now = Object.entries(seen).map(([placementId, c]) => ({ placementId, ...c }));
    expect(chatChanges(seen, now, team)).toEqual([]);
    expect(chatChanges({}, now, team)).toEqual([]);
  });
  test("the sponsor removing a rep isn't an organizer removal", () => {
    const now = [
      { placementId: "p1", repId: "dana", sessionId: "13", room: "2242", start: "13:00" },
      { placementId: "p2", repId: "dana", sessionId: "14", room: "1348", start: "14:00" },
    ];
    // Kevin is gone from the team: his missing chat is the sponsor's own change.
    expect(chatChanges(seen, now, new Set(["dana"]))).toEqual([]);
  });
});

describe("parseSeenChats: stored sent chats, malformed or not", () => {
  const chat = { repId: "dana", sessionId: "13", room: "2242", start: "13:00" };
  test("reads back what was stored", () => {
    const stored = { chats: { p1: chat }, notes: [{ text: "Moved", at: "2026-11-21T14:00:00.000Z" }] };
    expect(parseSeenChats(JSON.stringify(stored))).toEqual(stored);
  });
  test.each([null, "", "not json", "null", "42", '"text"', "[]", "true"])("%j is empty", (raw) => {
    expect(parseSeenChats(raw)).toEqual({ chats: {}, notes: [] });
  });
  test("drops bad chats and notes, keeps good ones", () => {
    const raw = JSON.stringify({
      chats: { p1: chat, p2: null, p3: { repId: "kevin" }, p4: "x", p5: { ...chat, room: 2241 } },
      notes: [{ text: "Moved", at: "2026-11-21T14:00:00.000Z" }, null, { text: 1, at: "x" }, "x"],
    });
    expect(parseSeenChats(raw)).toEqual({
      chats: { p1: chat },
      notes: [{ text: "Moved", at: "2026-11-21T14:00:00.000Z" }],
    });
    expect(parseSeenChats(JSON.stringify({ chats: [chat], notes: { text: "x" } }))).toEqual({ chats: {}, notes: [] });
  });
});
