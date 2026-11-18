import { describe, expect, test } from "vitest";

import type { ChatRequest } from "~/lib/coffee-chat-request";
import {
  freeStartTimes,
  offerProblem,
  roomTakenByOtherSponsor,
  seatsLeft,
  seatsUsed,
} from "~/server/api/utils/coffee-chat-capacity";

const oneOnOne = (perSlot = 1): ChatRequest => ({
  style: "oneOnOne",
  perSlot,
  durationMinutes: 15,
  source: "sponsor",
});
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

  test("seats = hackers asked for minus booked; no room capacity", () => {
    expect(seatsLeft([], chat("10:00"), 2)).toBe(2);
    expect(seatsLeft([], chat("10:00"), 10)).toBe(10);
    expect(seatsLeft([chat("10:00")], chat("10:00"), 2)).toBe(1);
    expect(seatsLeft([chat("10:00")], chat("10:00"), 0)).toBe(0);
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
    request: oneOnOne(),
    slotTime: "10:00",
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
        request: { ...oneOnOne(), durationMinutes: 30 },
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

  test("an ask for fewer lowers the seats; 0 = no chat then", () => {
    const asks = (hackers: number) => [
      { sponsorId: "a", startTime: "10:00", endTime: "10:15", hackers },
    ];
    const three = { ...base, request: oneOnOne(3) };
    expect(offerProblem({ ...three, sponsorChats: [chat("10:00")] })).toBe(
      null,
    );
    expect(
      offerProblem({
        ...three,
        limits: asks(1),
        sponsorChats: [chat("10:00")],
      }),
    ).toBe("full");
    expect(offerProblem({ ...three, limits: asks(0) })).toBe("full");
    // Another sponsor's ask doesn't count.
    expect(
      offerProblem({
        ...three,
        limits: [{ ...asks(0)[0]!, sponsorId: "b" }],
      }),
    ).toBeNull();
  });
});

describe("freeStartTimes", () => {
  test("earliest first, skipping full and clashing times", () => {
    expect(
      freeStartTimes({
        request: oneOnOne(),
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

  test("drops times past the reply cutoff and asked down to 0", () => {
    expect(
      freeStartTimes({
        request: oneOnOne(2),
        limits: [
          { sponsorId: "a", startTime: "10:45", endTime: "11:00", hackers: 0 },
        ],
        sponsorId: "a",
        sponsorChats: [],
        roomChats: [],
        holds,
        now: new Date("2026-11-21T09:56:00-05:00"),
      }).map((t) => t.slotTime),
    ).toEqual(["10:30"]);
  });
});
