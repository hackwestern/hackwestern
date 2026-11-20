/**
 * One sponsor's line of hackers for coffee chat seats (coffee board v12):
 * who gets their next free seat. Pure, so the server and tests share it.
 *
 * Order: organizer picks ("Put someone first in line", newest first), then
 * hackers met at the booth, the shortlist, then interested hackers, the
 * same tiers the invite planner walks (INVITE_SOURCES). Someone who holds a
 * seat with the sponsor now, said no, let an invite expire, or was removed
 * by an organizer isn't in the line (docs/decisions.md, 2026-11-19, "Coffee
 * board v12 build: answers and defaults").
 */
import {
  MAX_LIVE_CHATS_PER_HACKER,
  type BusyChat,
  type InviteSource,
} from "~/lib/coffee-chat-invites";

export type LineEntry = { userId: string; source: InviteSource };

/**
 * The line: candidates in the order given (tier order, organizer picks
 * first), each hacker once (their earliest tier), without `skip` (seated
 * with this sponsor, or blocked from it).
 */
export function sponsorLine(
  candidates: readonly LineEntry[],
  skip: ReadonlySet<string>,
): LineEntry[] {
  const seen = new Set<string>();
  const out: LineEntry[] = [];
  for (const c of candidates) {
    if (seen.has(c.userId) || skip.has(c.userId)) continue;
    seen.add(c.userId);
    out.push(c);
  }
  return out;
}

export type SeatFit = "ok" | "busy" | "full";

/**
 * Can this hacker take a seat in `chat`, given their live chats (any
 * sponsor, either flow)? "full": already at the live-chat cap. "busy": a
 * chat that overlaps it, or another seat with the same sponsor.
 */
export function seatFit(
  chat: { sponsorId: string; start: number; minutes: number },
  theirs: readonly BusyChat[],
  cap = MAX_LIVE_CHATS_PER_HACKER,
): SeatFit {
  if (theirs.length >= cap) return "full";
  const clash = theirs.some(
    (b) =>
      b.sponsorId === chat.sponsorId ||
      (b.start < chat.start + chat.minutes && chat.start < b.start + b.minutes),
  );
  return clash ? "busy" : "ok";
}

/**
 * The first person in the line who can take that seat (free then, under the
 * cap), or null. "Next in line" skips to them (Jazz's default, 2026-11-19).
 */
export function firstForSeat(
  line: readonly LineEntry[],
  chat: { sponsorId: string; start: number; minutes: number },
  busy: readonly BusyChat[],
  cap = MAX_LIVE_CHATS_PER_HACKER,
): LineEntry | null {
  return (
    line.find(
      (c) =>
        seatFit(
          chat,
          busy.filter((b) => b.userId === c.userId),
          cap,
        ) === "ok",
    ) ?? null
  );
}
