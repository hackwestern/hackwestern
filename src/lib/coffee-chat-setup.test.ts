import { describe, expect, test } from "vitest";

import { windowAt, workshopWindows } from "~/lib/coffee-chat-schedule";
import { availChats, repChatCap, setupTotals, setupWindows } from "~/lib/coffee-chat-setup";
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
