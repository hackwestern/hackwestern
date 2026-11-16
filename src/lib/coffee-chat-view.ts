/**
 * How the hacker's Coffee chats view on /live sorts and labels chats (T36).
 * Pure, so it is unit tested without React or the server.
 */

import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";

export type ViewChat = {
  chatId: string;
  status: CoffeeChatStatus;
  durationMinutes: number;
  /** ISO start time. */
  startsAt: string;
  /** ISO time a pending request stops being answerable. */
  expiresAt: string;
};

/** What the view shows for a chat: its status, or "finished" once over. */
export type ViewStatus = CoffeeChatStatus | "finished";

/**
 * The status as of `now`. The server already marks unanswered requests
 * past their cutoff as expired; this also does it between refetches, and
 * marks accepted chats whose end has passed as finished.
 */
export function viewStatus(chat: ViewChat, now: Date): ViewStatus {
  const t = now.getTime();
  if (chat.status === "pending" && t >= Date.parse(chat.expiresAt)) {
    return "expired";
  }
  if (
    chat.status === "accepted" &&
    t >= Date.parse(chat.startsAt) + chat.durationMinutes * 60_000
  ) {
    return "finished";
  }
  return chat.status;
}

export type GroupedChats<T> = {
  /** Waiting for the hacker's answer, the soonest reply-by first. */
  pending: T[];
  /** Accepted and not over yet, earliest first. */
  upcoming: T[];
  /** Declined, expired, cancelled or finished, most recent first. */
  past: T[];
};

export function groupChats<T extends ViewChat>(
  chats: readonly T[],
  now: Date,
): GroupedChats<T> {
  const groups: GroupedChats<T> = { pending: [], upcoming: [], past: [] };
  for (const chat of chats) {
    const status = viewStatus(chat, now);
    if (status === "pending") groups.pending.push(chat);
    else if (status === "accepted") groups.upcoming.push(chat);
    else groups.past.push(chat);
  }
  const by = (key: "startsAt" | "expiresAt", dir: 1 | -1) => (a: T, b: T) =>
    dir * (Date.parse(a[key]) - Date.parse(b[key]));
  groups.pending.sort(by("expiresAt", 1));
  groups.upcoming.sort(by("startsAt", 1));
  groups.past.sort(by("startsAt", -1));
  return groups;
}

/**
 * Whether /live shows the Coffee chats nav item: only once the hacker has
 * at least one chat, in any status. No chats, no tab.
 */
export function showCoffeeChatsTab(
  chats: readonly unknown[] | undefined,
): boolean {
  return (chats?.length ?? 0) > 0;
}

/** Pending requests still answerable at `now` (the nav badge count). */
export function pendingCount(chats: readonly ViewChat[], now: Date): number {
  return chats.filter((c) => viewStatus(c, now) === "pending").length;
}

const EVENT_TIME_ZONE = "America/Toronto";

/** "Sat" from an ISO time, in Eastern (where the event is). */
export function weekdayOf(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    weekday: "short",
    timeZone: EVENT_TIME_ZONE,
  });
}

/** "10:40 AM" from an ISO time, in Eastern. */
export function clockOf(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: EVENT_TIME_ZONE,
  });
}

export type TimeLeft =
  | { days: number }
  | { hours: number; minutes: number }
  | { underAMinute: true };

/**
 * Time left until `deadline`, rounded down to the minute: whole days from
 * 48 hours out, hours and minutes below that, or null once it has passed.
 * The words live in src/content/coffee-chat.ts (page.timeLeft).
 */
export function timeLeft(deadline: string, now: Date): TimeLeft | null {
  const ms = Date.parse(deadline) - now.getTime();
  if (!(ms > 0)) return null;
  const total = Math.floor(ms / 60_000);
  if (total < 1) return { underAMinute: true };
  const hours = Math.floor(total / 60);
  if (hours >= 48) return { days: Math.floor(hours / 24) };
  return { hours, minutes: total % 60 };
}
