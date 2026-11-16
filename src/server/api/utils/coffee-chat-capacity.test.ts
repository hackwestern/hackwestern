import { describe, expect, test } from "vitest";

import type { CoffeeChatSetup } from "~/lib/run-of-show";
import {
  coffeeChatStartTimes,
  freeStartTimes,
  offerProblem,
  roomTakenByOtherSponsor,
  seatsLeft,
  seatsUsed,
  sponsorRoomAt,
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
const chat = (slotTime: string, durationMinutes = 15) => ({
  slotTime,
  durationMinutes,
});

describe("coffeeChatStartTimes", () => {
  test("1-on-1s every quarter hour, ending by the window end", () => {
    expect(coffeeChatStartTimes(oneOnOne)).toEqual([
      "10:00",
      "10:15",
      "10:30",
      "10:45",
    ]);
  });

  test("30-min groups every half hour from the start", () => {
    expect(coffeeChatStartTimes(groups)).toEqual(["10:00", "10:30"]);
  });

  test("no window, no times", () => {
    expect(coffeeChatStartTimes({ ...oneOnOne, windowStart: null })).toEqual(
      [],
    );
  });
});

describe("seats", () => {
  test("counts chats overlapping any quarter hour of the slot", () => {
    const chats = [chat("10:00", 30), chat("10:30", 30)];
    expect(seatsUsed(chats, chat("10:15", 30))).toBe(1);
    expect(seatsUsed(chats, chat("10:00", 30))).toBe(1);
    expect(seatsUsed([...chats, chat("10:15")], chat("10:15"))).toBe(2);
  });

  test("seats = coffeeChatSeats(reps, group size) minus used", () => {
    // 1-on-1: one chat per rep, at most 3 (room fits 6).
    expect(seatsLeft([], chat("10:00"), 2, 1)).toBe(2);
    expect(seatsLeft([], chat("10:00"), 10, 1)).toBe(3);
    expect(seatsLeft([chat("10:00")], chat("10:00"), 2, 1)).toBe(1);
    // Groups of 3: one group at once, three hacker seats.
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
    now: early,
  };

  test("ok inside the window with a free seat", () => {
    expect(offerProblem(base)).toBeNull();
  });

  test("window, cutoff, seats, hacker and room", () => {
    expect(offerProblem({ ...base, setup: null })).toBe("notSetUp");
    expect(offerProblem({ ...base, slotTime: "09:45" })).toBe("notInWindow");
    expect(offerProblem({ ...base, slotTime: "11:00" })).toBe("notInWindow");
    expect(offerProblem({ ...base, slotTime: "10:10" })).toBe("notInWindow");
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
        now: new Date("2026-11-21T09:56:00-05:00"),
      }).map((t) => t.slotTime),
    ).toEqual(["10:30", "10:45"]);
  });
});

describe("sponsorRoomAt", () => {
  test("a moved slot keeps its room; otherwise the sheet room", () => {
    const chats = [{ ...chat("10:00"), room: "Rm 2243" }, chat("10:30")];
    expect(sponsorRoomAt(chats, "Rm 2241", chat("10:00"))).toBe("Rm 2243");
    expect(sponsorRoomAt(chats, "Rm 2241", chat("10:15"))).toBe("Rm 2241");
    expect(sponsorRoomAt(chats, "Rm 2241", chat("10:30"))).toBe("Rm 2241");
    expect(sponsorRoomAt([], null, chat("10:00"))).toBeNull();
  });
});
