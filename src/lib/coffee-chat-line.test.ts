import { describe, expect, test } from "vitest";
import { planInviteRound, type BusyChat } from "~/lib/coffee-chat-invites";
import {
  firstForSeat,
  seatFit,
  sponsorLine,
  type LineEntry,
} from "~/lib/coffee-chat-line";

const seat = { sponsorId: "A", start: 600, minutes: 15 };
const busy = (
  userId: string,
  start: number,
  sponsorId = "B",
  minutes = 15,
): BusyChat => ({
  userId,
  sponsorId,
  start,
  minutes,
});

describe("sponsorLine", () => {
  test("keeps tier order, each hacker once (their first tier), without skipped hackers", () => {
    const candidates: LineEntry[] = [
      { userId: "lou", source: "organizer" },
      { userId: "ari", source: "scanned" },
      { userId: "lou", source: "scanned" },
      { userId: "ada", source: "scanned" },
      { userId: "bo", source: "shortlist" },
      { userId: "ari", source: "interested" },
      { userId: "cy", source: "interested" },
    ];
    expect(sponsorLine(candidates, new Set(["ada"]))).toEqual([
      { userId: "lou", source: "organizer" },
      { userId: "ari", source: "scanned" },
      { userId: "bo", source: "shortlist" },
      { userId: "cy", source: "interested" },
    ]);
  });
});

describe("seatFit and firstForSeat", () => {
  test("a hacker at the cap, with an overlapping chat, or already with this sponsor can't take the seat", () => {
    expect(seatFit(seat, [])).toBe("ok");
    expect(seatFit(seat, [busy("x", 780), busy("x", 840)])).toBe("full");
    expect(seatFit(seat, [busy("x", 600)])).toBe("busy");
    expect(seatFit(seat, [busy("x", 585, "B", 30)])).toBe("busy");
    expect(seatFit(seat, [busy("x", 615)])).toBe("ok"); // back to back
    expect(seatFit(seat, [busy("x", 900, "A")])).toBe("busy"); // one seat per sponsor
  });

  test("next in line skips to the first person who can take that seat", () => {
    const line: LineEntry[] = [
      { userId: "ari", source: "scanned" },
      { userId: "gabe", source: "scanned" },
      { userId: "bo", source: "shortlist" },
    ];
    expect(firstForSeat(line, seat, [])).toEqual(line[0]);
    expect(firstForSeat(line, seat, [busy("ari", 600)])).toEqual(line[1]);
    expect(
      firstForSeat(line, seat, [
        busy("ari", 600),
        busy("gabe", 780),
        busy("gabe", 840),
      ]),
    ).toEqual(line[2]);
    expect(
      firstForSeat(line, seat, [
        busy("ari", 600),
        busy("gabe", 600),
        busy("bo", 600),
      ]),
    ).toBeNull();
    expect(firstForSeat([], seat, [])).toBeNull();
  });
});

describe("the planner puts organizer picks first", () => {
  test("an organizer pick gets the only seat ahead of a booth scan", () => {
    const { invites } = planInviteRound({
      round: 1,
      now: new Date("2026-11-20T22:00:00-05:00"),
      chats: [
        {
          placementId: "p",
          sponsorId: "A",
          start: 600,
          minutes: 15,
          building: "near",
          seats: 1,
          live: 0,
        },
      ],
      candidates: new Map([
        [
          "A",
          [
            { userId: "ari", source: "scanned" as const },
            { userId: "lou", source: "organizer" as const },
          ],
        ],
      ]),
      busy: [],
      blocked: new Set(),
    });
    expect(invites.map((i) => [i.userId, i.source])).toEqual([
      ["lou", "organizer"],
    ]);
  });
});
