/**
 * The hacker's notification center on /live: their coffee chats and their
 * team's sponsor presentations, as one list. Derived from the coffee_chat
 * and sponsor_presentation tables, not stored (docs/decisions.md,
 * 2026-11-18); only the keys the hacker has seen are kept
 * (user.notifications_seen). Pure, so it is unit tested.
 */

import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";

export type NoticeChannel = "slack" | "email";

export type CoffeeChatNoticeItem = {
  kind: "coffeeChat";
  key: string;
  /** ISO time the notice is from, for ordering. */
  at: string;
  unread: boolean;
  chatId: string;
  sponsorName: string;
  /** Effective status: an unanswered request past its cutoff is "expired". */
  status: CoffeeChatStatus;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
};

export type PresentationNoticeItem = {
  kind: "presentation";
  key: string;
  at: string;
  unread: boolean;
  sponsorName: string;
  room: string;
  /** Minutes after midnight on judging day. */
  start: number;
  /** How they were told; null when they weren't (a teammate was). */
  channel: NoticeChannel | null;
};

export type HackerNotice = CoffeeChatNoticeItem | PresentationNoticeItem;

export type NoticeSources = {
  chats: readonly {
    chatId: string;
    sponsorName: string;
    status: CoffeeChatStatus;
    slotTime: string;
    durationMinutes: number;
    room: string | null;
    createdAt: Date;
    respondedAt: Date | null;
  }[];
  presentations: {
    slots: readonly {
      sponsorId: string;
      sponsorName: string;
      room: string;
      start: number;
    }[];
    sentAt: Date | null;
    channel: NoticeChannel | null;
  };
};

/**
 * A chat's key changes with its status, time or room, so a confirmed,
 * cancelled, expired or moved chat shows as unread again.
 */
export const coffeeChatNoticeKey = (c: {
  chatId: string;
  status: CoffeeChatStatus;
  slotTime: string;
  room: string | null;
}) => `chat:${c.chatId}:${c.status}:${c.slotTime}:${c.room ?? ""}`;

export const presentationNoticeKey = (s: {
  sponsorId: string;
  start: number;
  room: string;
}) => `presentation:${s.sponsorId}:${s.start}:${s.room}`;

/** Every notice, newest first, each marked unread unless its key is seen. */
export function buildHackerNotices(
  sources: NoticeSources,
  seen: readonly string[],
): HackerNotice[] {
  const seenKeys = new Set(seen);
  const chats: HackerNotice[] = sources.chats.map((c) => {
    const key = coffeeChatNoticeKey(c);
    return {
      kind: "coffeeChat",
      key,
      at: (c.respondedAt ?? c.createdAt).toISOString(),
      unread: !seenKeys.has(key),
      chatId: c.chatId,
      sponsorName: c.sponsorName,
      status: c.status,
      slotTime: c.slotTime,
      durationMinutes: c.durationMinutes,
      room: c.room,
    };
  });
  const { sentAt, channel } = sources.presentations;
  const presentations: HackerNotice[] = sentAt
    ? sources.presentations.slots.map((s) => {
        const key = presentationNoticeKey(s);
        return {
          kind: "presentation",
          key,
          at: sentAt.toISOString(),
          unread: !seenKeys.has(key),
          sponsorName: s.sponsorName,
          room: s.room,
          start: s.start,
          channel,
        };
      })
    : [];
  // Newest first; presentations sent together stay in time order.
  return [...chats, ...presentations].sort((a, b) => {
    const byAt = b.at.localeCompare(a.at);
    if (byAt !== 0) return byAt;
    if (a.kind === "presentation" && b.kind === "presentation") {
      return a.start - b.start;
    }
    return 0;
  });
}

export const unreadCount = (notices: readonly HackerNotice[]) =>
  notices.filter((n) => n.unread).length;

/**
 * The seen keys to store after the hacker was shown `shown`: what they had
 * already seen plus what they were shown, limited to notices that still
 * exist (`current`). A notice they were never shown stays unread.
 */
export function nextSeenKeys(
  current: readonly string[],
  seen: readonly string[],
  shown: readonly string[],
): string[] {
  const read = new Set([...seen, ...shown]);
  return current.filter((key) => read.has(key));
}
