import { describe, expect, test } from "vitest";

import {
  currentRound,
  inviteExpiresAt,
  nextRoundAt,
  planInviteRound,
  reconfirmExpiresAt,
  repChatStarts,
  roundClosesAt,
  roundOpensAt,
  saturdayAt,
  seatStillOfferable,
  sessionChatStarts,
  type InviteSource,
  type PlanChat,
  type PlanInput,
} from "~/lib/coffee-chat-invites";
import { COFFEE_SESSIONS, chatsInWindow, usableWindow } from "~/lib/coffee-chat-sessions";

const FRI_10PM = new Date("2026-11-20T22:00:00-05:00");
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-05:00`);
const min = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
};

function chat(
  p: Partial<PlanChat> & { placementId: string; start: number },
): PlanChat {
  return {
    sponsorId: "A",
    minutes: 15,
    building: "near",
    seats: 1,
    live: 0,
    ...p,
  };
}

const cands = (entries: Record<string, [string, InviteSource][]>) =>
  new Map(
    Object.entries(entries).map(([sponsor, list]) => [
      sponsor,
      list.map(([userId, source]) => ({ userId, source })),
    ]),
  );

function plan(p: Partial<PlanInput> & Pick<PlanInput, "chats">) {
  return planInviteRound({
    round: 1,
    now: FRI_10PM,
    candidates: new Map(),
    busy: [],
    blocked: new Set(),
    ...p,
  });
}

describe("seat times", () => {
  test("a full session: 4 x 15 min or 2 x 30 min", () => {
    expect(sessionChatStarts({ start: 600, end: 660 }, 15)).toEqual([
      600, 615, 630, 645,
    ]);
    expect(sessionChatStarts({ start: 600, end: 660 }, 30)).toEqual([600, 630]);
  });

  test("a partial session keeps only the chats outside the workshop window", () => {
    // Sun Life: setup 1:45 -> window from 1:30; the 1-2 session is 1:00-1:30.
    const ws = [
      { setup: min("13:45"), start: min("14:00"), end: min("15:30") },
    ];
    expect(sessionChatStarts({ start: 780, end: 840 }, 15, ws)).toEqual([
      780, 795,
    ]);
    expect(sessionChatStarts({ start: 780, end: 840 }, 30, ws)).toEqual([780]);
    // Setup at 2:00 -> window from 1:45: three 15-min chats fit.
    const ws2 = [
      { setup: min("14:00"), start: min("14:00"), end: min("15:00") },
    ];
    expect(sessionChatStarts({ start: 780, end: 840 }, 15, ws2)).toEqual([
      780, 795, 810,
    ]);
    // A window ending 15 min before a session's end leaves its tail.
    const ws3 = [{ start: min("9:30"), end: min("10:15") }];
    expect(sessionChatStarts({ start: 600, end: 660 }, 15, ws3)).toEqual([
      630, 645,
    ]);
  });

  test("seat times are usableWindow's, chat by chat, for full and partial sessions", () => {
    // Sun Life sets up at 2:00 (blocked 1:45-3:15); another sponsor at 10:00.
    const cases = [
      [{ setup: min("14:00"), start: min("14:00"), end: min("15:00") }],
      [{ start: min("10:00"), end: min("10:20") }],
      [],
    ];
    for (const ws of cases) {
      for (const minutes of [15, 30]) {
        for (const s of COFFEE_SESSIONS) {
          const w = usableWindow(s.id, ws, minutes);
          const fromWindow = w
            ? Array.from({ length: chatsInWindow(w, minutes) }, (_, k) => w.start + k * minutes)
            : [];
          expect(sessionChatStarts(s, minutes, ws), `${s.id} @ ${minutes}`).toEqual(fromWindow);
        }
      }
    }
  });

  test("a session fully inside the window has no chats", () => {
    const ws = [{ start: min("13:00"), end: min("14:00") }];
    expect(sessionChatStarts({ start: 780, end: 840 }, 15, ws)).toEqual([]);
  });

  test("a rep's chats fill sessions in time order up to chats wanted", () => {
    const p = [
      { id: "b", session: { start: 660, end: 720 } },
      { id: "a", session: { start: 600, end: 660 } },
    ];
    const got = repChatStarts(p, 6, 15);
    expect(got.get("a")).toEqual([600, 615, 630, 645]);
    expect(got.get("b")).toEqual([660, 675]);
    expect(repChatStarts(p, 0, 15).get("a")).toEqual([]);
    expect(repChatStarts(p, 99, 30).get("b")).toEqual([660, 690]);
  });

  test("a partial session carries the rest of the chats to the next one", () => {
    const ws = [
      { setup: min("13:45"), start: min("14:00"), end: min("14:30") },
    ];
    const p = [
      { id: "s13", session: { start: 780, end: 840 } },
      { id: "s15", session: { start: 900, end: 960 } },
    ];
    const got = repChatStarts(p, 4, 15, ws);
    expect(got.get("s13")).toEqual([780, 795]);
    expect(got.get("s15")).toEqual([900, 915]);
  });
});

describe("round timing", () => {
  test("round 1 until 10:00 Saturday, then a round every 30 minutes from 10:00", () => {
    expect(currentRound(FRI_10PM)).toBe(1);
    expect(currentRound(at("09:59"))).toBe(1);
    expect(currentRound(at("10:00"))).toBe(2);
    expect(currentRound(at("10:15"))).toBe(2);
    expect(currentRound(at("10:30"))).toBe(3);
    expect(currentRound(at("10:59"))).toBe(3);
    expect(currentRound(at("11:00"))).toBe(4);
    expect(currentRound(at("13:45"))).toBe(9);
    // Round 1 closes as round 2 opens: no gap.
    expect(roundClosesAt(1)).toEqual(at("10:00"));
    expect(roundOpensAt(2)).toEqual(at("10:00"));
    expect(roundClosesAt(2)).toEqual(at("10:30"));
    expect(roundOpensAt(3)).toEqual(at("10:30"));
    expect(roundClosesAt(3)).toEqual(at("11:00"));
  });

  test("next round", () => {
    expect(nextRoundAt(FRI_10PM)).toEqual(at("10:00"));
    expect(nextRoundAt(at("10:10"))).toEqual(at("10:30"));
    expect(nextRoundAt(at("10:40"))).toEqual(at("11:00"));
    expect(nextRoundAt(at("16:50"))).toBeNull();
  });

  test("round 1 answers close Sat 10 AM or at the chat's last call", () => {
    expect(inviteExpiresAt(1, min("14:00"), "near", FRI_10PM)).toEqual(
      at("10:00"),
    );
    expect(inviteExpiresAt(1, min("10:00"), "near", FRI_10PM)).toEqual(
      at("09:40"),
    );
    expect(inviteExpiresAt(1, min("10:15"), "ivey", FRI_10PM)).toEqual(
      at("09:40"),
    );
    // Sent too late for that chat.
    expect(inviteExpiresAt(1, min("10:00"), "near", at("09:45"))).toBeNull();
  });

  test("later rounds: the round's close, capped at the chat's last call, at least 10 minutes", () => {
    // Round 2 (10:00-10:30), opening as round 1 closes.
    expect(inviteExpiresAt(2, min("14:00"), "near", at("10:00"))).toEqual(
      at("10:30"),
    );
    expect(inviteExpiresAt(2, min("11:00"), "near", at("10:00"))).toEqual(
      at("10:30"),
    );
    // Last call before the close: answer by the last call.
    expect(inviteExpiresAt(2, min("10:45"), "near", at("10:00"))).toEqual(
      at("10:25"),
    );
    expect(inviteExpiresAt(2, min("11:00"), "ivey", at("10:00"))).toEqual(
      at("10:25"),
    );
    // Exactly 10 minutes is enough; under that the seat waits.
    expect(inviteExpiresAt(2, min("10:30"), "near", at("10:00"))).toEqual(
      at("10:10"),
    );
    expect(inviteExpiresAt(2, min("10:30"), "near", at("10:01"))).toBeNull();
    expect(inviteExpiresAt(2, min("10:15"), "near", at("10:00"))).toBeNull();
    // Round 3 (10:30-11:00).
    expect(inviteExpiresAt(3, min("14:00"), "near", at("10:30"))).toEqual(
      at("11:00"),
    );
    // Before the round opens.
    expect(inviteExpiresAt(2, min("14:00"), "near", at("09:50"))).toBeNull();
    expect(inviteExpiresAt(3, min("14:00"), "near", at("10:20"))).toBeNull();
  });

  test("a round triggered late still gives 30 minutes, capped at the last call", () => {
    // Round 4 is 11:00-11:30, but only ran at 11:25.
    expect(currentRound(at("11:25"))).toBe(4);
    expect(inviteExpiresAt(4, min("14:00"), "near", at("11:25"))).toEqual(
      at("11:55"),
    );
    expect(inviteExpiresAt(4, min("12:00"), "near", at("11:25"))).toEqual(
      at("11:40"),
    );
    expect(inviteExpiresAt(4, min("12:15"), "ivey", at("11:25"))).toEqual(
      at("11:40"),
    );
    // 5 minutes or less to answer: skipped this round.
    expect(inviteExpiresAt(4, min("11:45"), "near", at("11:25"))).toBeNull();
    expect(inviteExpiresAt(4, min("12:00"), "ivey", at("11:25"))).toBeNull();
    // Run on time it's the round's close.
    expect(inviteExpiresAt(4, min("14:00"), "near", at("11:00"))).toEqual(
      at("11:30"),
    );
  });

  test("a missed round doesn't skip seats: the next one catches up", () => {
    // Round 3 never ran. 11:45's last call (11:25) is before round 4's
    // close, but round 4 at 11:05 still offers it with 20 minutes.
    expect(inviteExpiresAt(4, min("11:45"), "near", at("11:05"))).toEqual(
      at("11:25"),
    );
    const { invites, unfilled } = plan({
      round: 4,
      now: at("11:05"),
      chats: [
        chat({ placementId: "p", start: min("11:15") }),
        chat({ placementId: "p", start: min("11:45") }),
        chat({ placementId: "q", start: min("14:00") }),
      ],
      candidates: cands({
        A: [
          ["u1", "interested"],
          ["u2", "interested"],
          ["u3", "interested"],
        ],
      }),
    });
    expect(invites.map((i) => [i.start, i.expiresAt])).toEqual([
      [min("11:45"), at("11:25")],
      [min("14:00"), at("11:35")],
    ]);
    // 11:15's last call (10:55) is gone.
    expect(unfilled).toEqual([{ placementId: "p", start: min("11:15"), open: 1 }]);
  });

  test("10:00 and 10:15 chats (10:30 in Ivey) are only ever filled by round 1", () => {
    for (let round = 2; round <= 16; round++) {
      const now = roundOpensAt(round)!;
      for (const [start, b] of [
        [600, "near"],
        [615, "near"],
        [600, "ivey"],
        [615, "ivey"],
        [630, "ivey"],
      ] as const) {
        expect(inviteExpiresAt(round, start, b, now)).toBeNull();
      }
    }
    // Round 2 at 10:00 can still offer 10:30 (near) and 10:45.
    expect(inviteExpiresAt(2, 630, "near", at("10:00"))).toEqual(at("10:10"));
    expect(inviteExpiresAt(2, 645, "ivey", at("10:00"))).toEqual(at("10:10"));
  });

  test("a changed invite gets a new answer-by time", () => {
    expect(reconfirmExpiresAt(FRI_10PM, min("14:00"), "near")).toEqual(
      at("10:00"),
    );
    // Round 2 closes 10:30, but a change gets at least 30 minutes.
    expect(reconfirmExpiresAt(at("10:10"), min("14:00"), "near")).toEqual(
      at("10:40"),
    );
    expect(reconfirmExpiresAt(at("10:00"), min("14:00"), "near")).toEqual(
      at("10:30"),
    );
    expect(reconfirmExpiresAt(at("11:10"), min("11:45"), "near")).toEqual(
      at("11:25"),
    );
    expect(reconfirmExpiresAt(at("11:30"), min("11:45"), "near")).toBeNull();
    // Changed late in a round: 30 minutes, not what's left of the round.
    expect(reconfirmExpiresAt(at("11:25"), min("14:00"), "near")).toEqual(
      at("11:55"),
    );
    // Under 10 minutes before the last call: too late to ask again.
    expect(reconfirmExpiresAt(at("11:20"), min("11:45"), "near")).toBeNull();
  });

  test("saturdayAt is Eastern time", () => {
    expect(saturdayAt(600).toISOString()).toBe("2026-11-21T15:00:00.000Z");
  });
});

describe("seatStillOfferable", () => {
  test("a seat can be offered until 10 minutes before its last call (20 min before; 35 for Ivey)", () => {
    // 11:00 near: last call 10:40, so offerable until 10:30.
    expect(seatStillOfferable(min("11:00"), "near", FRI_10PM)).toBe(true);
    expect(seatStillOfferable(min("11:00"), "near", at("10:30"))).toBe(true);
    expect(seatStillOfferable(min("11:00"), "near", at("10:31"))).toBe(false);
    // Within 10 minutes of starting: never.
    expect(seatStillOfferable(min("11:00"), "near", at("10:55"))).toBe(false);
    // Ivey: last call 10:25, so offerable until 10:15.
    expect(seatStillOfferable(min("11:00"), "ivey", at("10:15"))).toBe(true);
    expect(seatStillOfferable(min("11:00"), "ivey", at("10:16"))).toBe(false);
  });
});

describe("planner", () => {
  test("exactly one invite per seat, no overbooking", () => {
    const chats = [
      chat({ placementId: "p", start: 600, seats: 3, minutes: 30 }),
      chat({ placementId: "p", start: 630, seats: 3, minutes: 30, live: 2 }),
    ];
    const users = Array.from(
      { length: 20 },
      (_, i) => [`u${i}`, "interested"] as [string, InviteSource],
    );
    const { invites, unfilled } = plan({
      chats,
      candidates: cands({ A: users }),
    });
    expect(invites.filter((i) => i.start === 600)).toHaveLength(3);
    expect(invites.filter((i) => i.start === 630)).toHaveLength(1);
    expect(invites).toHaveLength(4);
    expect(unfilled).toEqual([]);
  });

  test("unfilled seats are reported when candidates run out", () => {
    const chats = [
      chat({ placementId: "p", start: 600, seats: 2 }),
      chat({ placementId: "p", start: 615 }),
    ];
    const { invites, unfilled } = plan({
      chats,
      candidates: cands({ A: [["u1", "interested"]] }),
    });
    expect(invites).toHaveLength(1);
    expect(unfilled).toEqual([
      { placementId: "p", start: 600, open: 1 },
      { placementId: "p", start: 615, open: 1 },
    ]);
  });

  test("order: scanned, then shortlist, then interested", () => {
    const chats = [600, 615, 630].map((start) =>
      chat({ placementId: "p", start }),
    );
    const { invites } = plan({
      chats,
      candidates: cands({
        A: [
          ["i1", "interested"],
          ["s1", "shortlist"],
          ["c1", "scanned"],
          ["i2", "interested"],
          ["c2", "scanned"],
        ],
      }),
    });
    expect(invites.map((i) => [i.userId, i.source, i.start])).toEqual([
      ["c1", "scanned", 600],
      ["c2", "scanned", 615],
      ["s1", "shortlist", 630],
    ]);
  });

  test("a hacker in several lists is invited once, under the first source", () => {
    const chats = [600, 615].map((start) => chat({ placementId: "p", start }));
    const { invites } = plan({
      chats,
      candidates: cands({
        A: [
          ["u1", "interested"],
          ["u1", "shortlist"],
          ["u1", "scanned"],
          ["u2", "interested"],
        ],
      }),
    });
    expect(invites.map((i) => [i.userId, i.source])).toEqual([
      ["u1", "scanned"],
      ["u2", "interested"],
    ]);
  });

  test("never two seats with the same sponsor", () => {
    const chats = [
      chat({ placementId: "p1", start: 600 }),
      chat({ placementId: "p2", start: 660 }),
    ];
    const { invites } = plan({
      chats,
      candidates: cands({ A: [["u1", "scanned"]] }),
    });
    expect(invites).toHaveLength(1);
  });

  test("a hacker already holding a seat with the sponsor isn't invited again", () => {
    const chats = [chat({ placementId: "p", start: 660 })];
    const { invites } = plan({
      chats,
      candidates: cands({ A: [["u1", "scanned"]] }),
      busy: [{ userId: "u1", sponsorId: "A", start: 600, minutes: 15 }],
    });
    expect(invites).toEqual([]);
  });

  test("no overlapping live invites across sponsors", () => {
    const chats = [
      chat({ placementId: "a", sponsorId: "A", start: 600, minutes: 30 }),
      chat({ placementId: "b", sponsorId: "B", start: 615 }),
      chat({ placementId: "b", sponsorId: "B", start: 630 }),
    ];
    const { invites } = plan({
      chats,
      candidates: cands({ A: [["u1", "scanned"]], B: [["u1", "scanned"]] }),
      sponsorOrder: ["A", "B"],
    });
    expect(invites.map((i) => [i.sponsorId, i.start])).toEqual([
      ["A", 600],
      ["B", 630],
    ]);
  });

  test("existing chats (either flow) block overlapping times", () => {
    const chats = [
      chat({ placementId: "p", start: 600 }),
      chat({ placementId: "p", start: 615 }),
    ];
    const { invites } = plan({
      chats,
      candidates: cands({ A: [["u1", "scanned"]] }),
      busy: [{ userId: "u1", sponsorId: "Z", start: 595, minutes: 15 }],
    });
    expect(invites.map((i) => i.start)).toEqual([615]);
  });

  test("tiers run across sponsors: B's scanned hacker beats A's shortlist", () => {
    const chats = [
      chat({ placementId: "a", sponsorId: "A", start: 600 }),
      chat({ placementId: "b", sponsorId: "B", start: 600 }),
    ];
    const { invites } = plan({
      chats,
      candidates: cands({
        A: [
          ["u1", "shortlist"],
          ["u2", "interested"],
        ],
        B: [["u1", "scanned"]],
      }),
      sponsorOrder: ["A", "B"],
    });
    expect(invites.map((i) => [i.sponsorId, i.userId])).toEqual([
      ["B", "u1"],
      ["A", "u2"],
    ]);
  });

  test("sponsors take turns inside a tier", () => {
    const chats = [
      chat({ placementId: "a", sponsorId: "A", start: 600, seats: 2 }),
      chat({ placementId: "b", sponsorId: "B", start: 600, seats: 2 }),
    ];
    const pool: [string, InviteSource][] = [
      ["u1", "interested"],
      ["u2", "interested"],
      ["u3", "interested"],
      ["u4", "interested"],
    ];
    const { invites } = plan({
      chats,
      candidates: cands({ A: pool, B: pool }),
      sponsorOrder: ["A", "B"],
    });
    expect(invites.map((i) => [i.sponsorId, i.userId])).toEqual([
      ["A", "u1"],
      ["B", "u2"],
      ["A", "u3"],
      ["B", "u4"],
    ]);
  });

  test("blocked pairs (declined or let expire) are skipped", () => {
    const chats = [chat({ placementId: "p", start: 660 })];
    const { invites } = plan({
      chats,
      candidates: cands({
        A: [
          ["u1", "scanned"],
          ["u2", "interested"],
        ],
      }),
      blocked: new Set(["A|u1"]),
    });
    expect(invites.map((i) => i.userId)).toEqual(["u2"]);
  });

  test("a declined seat goes to the next candidate at once, with the round's answer-by", () => {
    const chats = [chat({ placementId: "p", start: min("14:00"), seats: 2 })];
    const c = cands({
      A: [
        ["u1", "scanned"],
        ["u2", "shortlist"],
        ["u3", "interested"],
      ],
    });
    // Round 1: u1 and u2.
    const r1 = plan({ chats, candidates: c });
    expect(r1.invites.map((i) => i.userId)).toEqual(["u1", "u2"]);
    // u1 declines Friday night: still round 1, so u3 answers by Sat 10 AM.
    const after = {
      chats: [{ ...chats[0]!, live: 1 }],
      candidates: c,
      blocked: new Set(["A|u1", "A|u2"]),
      busy: [
        { userId: "u2", sponsorId: "A", start: min("14:00"), minutes: 15 },
      ],
    };
    const fri = plan({ ...after, now: new Date("2026-11-20T23:30:00-05:00") });
    expect(fri.invites.map((i) => [i.userId, i.round, i.expiresAt])).toEqual([
      ["u3", 1, at("10:00")],
    ]);
    expect(fri.unfilled).toEqual([]);
    // Declined Saturday at 10:40 (round 3): 30 minutes, until 11:10.
    const sat = plan({ ...after, round: 3, now: at("10:40") });
    expect(sat.invites.map((i) => [i.userId, i.round, i.expiresAt])).toEqual([
      ["u3", 3, at("11:10")],
    ]);
    // Close to the chat: capped at its last call (13:40 for 14:00).
    const late = plan({ ...after, round: 8, now: at("13:20") });
    expect(late.invites.map((i) => i.expiresAt)).toEqual([at("13:40")]);
    // Nobody left: the seat is reported empty, never invented.
    const none = plan({
      ...after,
      blocked: new Set(["A|u1", "A|u2", "A|u3"]),
    });
    expect(none.invites).toEqual([]);
    expect(none.unfilled).toEqual([
      { placementId: "p", start: min("14:00"), open: 1 },
    ]);
  });

  test("every seat fills while an eligible hacker is left (interested hackers too)", () => {
    // Nothing scanned or shortlisted: interested hackers fill every seat,
    // and each hacker tries every seat (u1 is busy at 2:00, so takes 2:15).
    const chats = [
      chat({ placementId: "p", start: min("14:00") }),
      chat({ placementId: "p", start: min("14:15") }),
      chat({ placementId: "p", start: min("14:30"), seats: 2 }),
    ];
    const { invites, unfilled } = plan({
      chats,
      candidates: cands({
        A: [
          ["u1", "interested"],
          ["u2", "interested"],
          ["u3", "interested"],
          ["u4", "interested"],
        ],
      }),
      busy: [{ userId: "u1", sponsorId: "X", start: min("14:00"), minutes: 15 }],
    });
    expect(invites.map((i) => [i.start, i.userId])).toEqual([
      [min("14:15"), "u1"],
      [min("14:00"), "u2"],
      [min("14:30"), "u3"],
      [min("14:30"), "u4"],
    ]);
    expect(unfilled).toEqual([]);
  });

  test("round 3 (10:30) leaves 10:00-10:45 seats unfilled; 11:00 gets its last 10 minutes", () => {
    const chats = [600, 615, 630, 645, 660].map((start) =>
      chat({ placementId: `p${start}`, start }),
    );
    const users = ["a", "b", "c", "d", "e"].map(
      (u) => [u, "interested"] as [string, InviteSource],
    );
    const { invites, unfilled } = plan({
      round: 3,
      now: at("10:30"),
      chats,
      candidates: cands({ A: users }),
    });
    expect(invites.map((i) => [i.start, i.expiresAt])).toEqual([
      [660, at("10:40")],
    ]);
    expect(unfilled).toHaveLength(4);
  });

  test("a hacker holds at most 2 live chats", () => {
    const chats = ["A", "B", "C"].map((sponsorId, i) =>
      chat({ placementId: sponsorId, sponsorId, start: 780 + i * 60 }),
    );
    const both = (u: string): [string, InviteSource][] => [[u, "interested"]];
    // u1 is everyone's first pick: gets A and B, then C goes to u2.
    const r = plan({
      chats,
      candidates: cands({
        A: both("u1"),
        B: both("u1"),
        C: [...both("u1"), ...both("u2")],
      }),
      sponsorOrder: ["A", "B", "C"],
    });
    expect(r.invites.map((i) => [i.sponsorId, i.userId])).toEqual([
      ["A", "u1"],
      ["B", "u1"],
      ["C", "u2"],
    ]);
    // Live chats from before (either flow) count toward the 2.
    const busy = plan({
      chats,
      candidates: cands({ A: both("u1") }),
      busy: [
        { userId: "u1", sponsorId: "X", start: 600, minutes: 15 },
        { userId: "u1", sponsorId: "Y", start: 660, minutes: 15 },
      ],
    });
    expect(busy.invites).toEqual([]);
  });

  test("round 1 expiry per seat", () => {
    const chats = [
      chat({ placementId: "p", start: 600 }),
      chat({ placementId: "q", start: 840, building: "ivey" }),
    ];
    const { invites } = plan({
      chats,
      candidates: cands({
        A: [
          ["u1", "scanned"],
          ["u2", "scanned"],
        ],
      }),
    });
    expect(invites.map((i) => i.expiresAt)).toEqual([at("09:40"), at("10:00")]);
  });

  test("random boards: never overbook, never double-book, never repeat a sponsor", () => {
    let seed = 7;
    const rand = () => (seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31;
    for (let trial = 0; trial < 200; trial++) {
      const sponsors = ["A", "B", "C", "D"];
      const chats: PlanChat[] = [];
      for (const s of sponsors) {
        const minutes = rand() < 0.5 ? 15 : 30;
        const seats = minutes === 15 ? 1 : 1 + Math.floor(rand() * 5);
        for (const session of [600, 660, 780, 840, 900, 960]) {
          if (rand() < 0.5) continue;
          for (let t = session; t < session + 60; t += minutes) {
            chats.push(
              chat({
                placementId: `${s}${session}`,
                sponsorId: s,
                start: t,
                minutes,
                seats,
                building: rand() < 0.4 ? "ivey" : "near",
              }),
            );
          }
        }
      }
      const users = Array.from({ length: 25 }, (_, i) => `u${i}`);
      const sources: InviteSource[] = ["scanned", "shortlist", "interested"];
      const candidates = new Map(
        sponsors.map((s) => [
          s,
          users
            .filter(() => rand() < 0.6)
            .map((userId) => ({
              userId,
              source: sources[Math.floor(rand() * 3)]!,
            })),
        ]),
      );
      const { invites } = plan({ chats, candidates, sponsorOrder: sponsors });
      const perChat = new Map<string, number>();
      for (const i of invites) {
        const k = `${i.placementId}|${i.start}`;
        perChat.set(k, (perChat.get(k) ?? 0) + 1);
      }
      for (const c of chats) {
        expect(
          perChat.get(`${c.placementId}|${c.start}`) ?? 0,
        ).toBeLessThanOrEqual(c.seats);
      }
      for (const u of users) {
        const mine = invites.filter((i) => i.userId === u);
        expect(mine.length).toBeLessThanOrEqual(2);
        expect(new Set(mine.map((i) => i.sponsorId)).size).toBe(mine.length);
        for (const a of mine) {
          for (const b of mine) {
            if (a === b) continue;
            expect(
              a.start < b.start + b.minutes && b.start < a.start + a.minutes,
            ).toBe(false);
          }
        }
        // Each invite's hacker is one of that sponsor's candidates.
        for (const i of mine) {
          expect(candidates.get(i.sponsorId)!.some((c) => c.userId === u)).toBe(
            true,
          );
        }
      }
    }
  });
});
