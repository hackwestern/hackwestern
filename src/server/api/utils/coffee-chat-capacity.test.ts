import { describe, expect, test } from "vitest";

import type { CoffeeChatSetup } from "~/lib/run-of-show";
import {
  freeStartTimes,
  offerProblem,
  roomTakenByOtherSponsor,
  seatsLeft,
  seatsUsed,
} from "~/server/api/utils/coffee-chat-capacity";

const oneOnOne: CoffeeChatSetup = {
  sponsor: "A",
  windowStart: "10:00",
  windowEnd: "11:00",
  durationMinutes: 15,
  groupSize: 1,
  slots: null,
  hackers: null,
  format: "Individual (15 mins)",
  room: "Rm 2241",
};
const groups: CoffeeChatSetup = {
  ...oneOnOne,
  durationMinutes: 30,
  groupSize: 3,
  format: "Groups (30 mins with 3 people)",
};
const early = new Date("2026-11-21T08:00:00-05:00");
// The sponsor's room block, 10:00-11:00 in Rm 2241.
const holds = [
  { sponsorId: "a", room: "Rm 2241", startTime: "10:00", endTime: "11:00" },
];
const chat = (slotTime: string, durationMinutes = 15) => ({
  slotTime,
  durationMinutes,
});

describe("seats", () => {
  test("counts chats overlapping any quarter hour of the slot", () => {
    const chats = [chat("10:00", 30), chat("10:30", 30)];
    expect(seatsUsed(chats, chat("10:15", 30))).toBe(1);
    expect(seatsUsed(chats, chat("10:00", 30))).toBe(1);
    expect(seatsUsed([...chats, chat("10:15")], chat("10:15"))).toBe(2);
  });

  test("seats = hackersPerSlot (chat type x reps) minus used", () => {
    // 1-on-1: one hacker per rep, not capped by the room's 6 people.
    expect(seatsLeft([], chat("10:00"), 2, 1)).toBe(2);
    expect(seatsLeft([], chat("10:00"), 10, 1)).toBe(10);
    expect(seatsLeft([chat("10:00")], chat("10:00"), 2, 1)).toBe(1);
    // Group of 3: one group per sponsor, three hacker seats.
    expect(seatsLeft([], chat("10:00", 30), 4, 3)).toBe(3);
  });
});

describe("roomTakenByOtherSponsor", () => {
  const roomChats = [
    { ...chat("10:00", 30), sponsorId: "b", room: " rm  2241" },
  ];
  test("another sponsor in the same room at an overlapping time", () => {
    expect(
      roomTakenByOtherSponsor(roomChats, "a", "Rm 2241", chat("10:15")),
    ).toBe(true);
    expect(
      roomTakenByOtherSponsor(roomChats, "a", "Rm 2241", chat("10:30")),
    ).toBe(false);
    expect(
      roomTakenByOtherSponsor(roomChats, "b", "Rm 2241", chat("10:15")),
    ).toBe(false);
    expect(roomTakenByOtherSponsor(roomChats, "a", null, chat("10:15"))).toBe(
      false,
    );
  });
});

describe("offerProblem", () => {
  const base = {
    setup: oneOnOne,
    slotTime: "10:00",
    reps: 1,
    sponsorId: "a",
    sponsorChats: [],
    hackerChats: [],
    roomChats: [],
    holds,
    now: early,
  };

  test("ok at a block slot with a free seat", () => {
    expect(offerProblem(base)).toBeNull();
  });

  test("block, slot start, cutoff, seats, hacker and room", () => {
    expect(offerProblem({ ...base, holds: [] })).toBe("noBlock");
    expect(offerProblem({ ...base, slotTime: "09:45" })).toBe("noBlock");
    expect(offerProblem({ ...base, slotTime: "11:00" })).toBe("noBlock");
    expect(
      offerProblem({
        ...base,
        setup: { ...oneOnOne, durationMinutes: 30 },
        slotTime: "10:15",
      }),
    ).toBe("notInWindow");
    expect(
      offerProblem({ ...base, now: new Date("2026-11-21T09:40:00-05:00") }),
    ).toBe("tooLate");
    expect(offerProblem({ ...base, sponsorChats: [chat("10:00")] })).toBe(
      "full",
    );
    expect(offerProblem({ ...base, hackerChats: [chat("09:45", 30)] })).toBe(
      "hackerBusy",
    );
    expect(
      offerProblem({
        ...base,
        roomChats: [{ ...chat("10:00"), sponsorId: "b", room: "Rm 2241" }],
      }),
    ).toBe("roomTaken");
  });
});

describe("freeStartTimes", () => {
  test("earliest first, skipping full and clashing times", () => {
    expect(
      freeStartTimes({
        setup: oneOnOne,
        reps: 1,
        sponsorId: "a",
        sponsorChats: [chat("10:00")],
        hackerChats: [chat("10:30")],
        roomChats: [],
        holds,
        now: early,
      }),
    ).toEqual([
      { slotTime: "10:15", seatsLeft: 1, room: "Rm 2241" },
      { slotTime: "10:45", seatsLeft: 1, room: "Rm 2241" },
    ]);
  });

  test("drops times past the reply cutoff", () => {
    expect(
      freeStartTimes({
        setup: oneOnOne,
        reps: 2,
        sponsorId: "a",
        sponsorChats: [],
        roomChats: [],
        holds,
        now: new Date("2026-11-21T09:56:00-05:00"),
      }).map((t) => t.slotTime),
    ).toEqual(["10:30", "10:45"]);
  });
});
