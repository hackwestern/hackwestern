import { describe, expect, test } from "vitest";

import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  clockOf,
  groupChats,
  pendingCount,
  showCoffeeChatsTab,
  timeLeft,
  viewStatus,
  weekdayOf,
  type ViewChat,
} from "~/lib/coffee-chat-view";

const page = coffeeChatCopy.page;

function chat(
  id: string,
  status: ViewChat["status"],
  start: string,
  minutes = 15,
): ViewChat {
  const startsAt = new Date(`2026-11-21T${start}:00-05:00`);
  return {
    chatId: id,
    status,
    durationMinutes: minutes,
    startsAt: startsAt.toISOString(),
    expiresAt: new Date(startsAt.getTime() - 20 * 60_000).toISOString(),
  };
}

const at = (time: string) => new Date(`2026-11-21T${time}:00-05:00`);

describe("viewStatus", () => {
  test("a pending request past its reply-by reads as expired", () => {
    const c = chat("a", "pending", "10:30");
    expect(viewStatus(c, at("10:09"))).toBe("pending");
    expect(viewStatus(c, at("10:10"))).toBe("expired");
  });

  test("an accepted chat is finished once its end passes", () => {
    const c = chat("a", "accepted", "10:30", 30);
    expect(viewStatus(c, at("10:45"))).toBe("accepted");
    expect(viewStatus(c, at("11:00"))).toBe("finished");
  });
});

describe("groupChats", () => {
  const chats = [
    chat("late-pending", "pending", "11:30"),
    chat("soon-pending", "pending", "10:30"),
    chat("expired-now", "pending", "09:15"),
    chat("upcoming-2", "accepted", "13:00"),
    chat("upcoming-1", "accepted", "10:00"),
    chat("done", "accepted", "08:00"),
    chat("declined", "declined", "12:00"),
    chat("cancelled", "cancelled", "14:00"),
  ];

  test("splits into waiting, upcoming and past, in order", () => {
    const g = groupChats(chats, at("09:00"));
    expect(g.pending.map((c) => c.chatId)).toEqual([
      "soon-pending",
      "late-pending",
    ]);
    expect(g.upcoming.map((c) => c.chatId)).toEqual([
      "upcoming-1",
      "upcoming-2",
    ]);
    // Most recent first.
    expect(g.past.map((c) => c.chatId)).toEqual([
      "cancelled",
      "declined",
      "expired-now",
      "done",
    ]);
  });

  test("pendingCount only counts requests still answerable", () => {
    expect(pendingCount(chats, at("09:00"))).toBe(2);
    expect(pendingCount(chats, at("10:15"))).toBe(1);
    expect(pendingCount([], at("09:00"))).toBe(0);
  });
});

describe("showCoffeeChatsTab", () => {
  test("hidden until the hacker has a chat, in any status", () => {
    expect(showCoffeeChatsTab(undefined)).toBe(false);
    expect(showCoffeeChatsTab([])).toBe(false);
    for (const status of [
      "pending",
      "accepted",
      "declined",
      "expired",
      "cancelled",
    ] as const) {
      expect(showCoffeeChatsTab([chat("a", status, "10:30")])).toBe(true);
    }
  });
});

describe("time labels", () => {
  test("day and time are in Eastern, whatever the machine's zone", () => {
    const c = chat("a", "pending", "10:30", 30);
    expect(page.when(weekdayOf(c.startsAt), clockOf(c.startsAt), 30)).toBe(
      "Sat 10:30 AM, 30 min",
    );
  });

  test("timeLeft rounds down and stops at the deadline", () => {
    const deadline = at("10:10").toISOString();
    const left = (now: Date) => {
      const t = timeLeft(deadline, now);
      return t ? page.timeLeft(t) : null;
    };
    expect(left(new Date("2026-11-15T12:00:00-05:00"))).toBe("5 days left");
    expect(left(at("08:05"))).toBe("2 h 5 min left");
    expect(left(at("09:10"))).toBe("1 h left");
    expect(left(at("09:58"))).toBe("12 min left");
    expect(left(new Date(at("10:10").getTime() - 30_000))).toBe(
      "Less than a minute left",
    );
    expect(left(at("10:10"))).toBeNull();
  });
});
