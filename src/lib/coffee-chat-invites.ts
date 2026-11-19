/**
 * Coffee chat session invites: the pure planner (track B of the 8-hour
 * build). Reads only its arguments, so the server and the tests share it.
 *
 * Rules (docs/decisions.md 2026-11-19, "One coffee chat deadline…",
 * "Coffee chat deadline 9:30 PM Friday…", "Jazz's answers… (Q1–Q11)"):
 * - Each sent placement (one rep in one room for one session) runs a number
 *   of chats at fixed start times inside the session (4 x 15 min for
 *   1-on-1s, 2 x 30 min for groups), up to the rep's wanted chats. A session
 *   cut by the sponsor's workshop window (setup or start minus 15 min, to
 *   end plus 15 min) keeps only the chats that fit.
 * - Each chat has hackersPerChat seats. Exactly one invite per open seat.
 * - Per sponsor: scanned hackers first, then the shortlist, then hackers
 *   interested in that sponsor (by their rank). Tiers run across all
 *   sponsors in turn (every sponsor's scanned hackers before anyone's
 *   shortlist), one hacker per sponsor at a time, so no sponsor takes the
 *   whole pool first.
 * - A hacker never holds more than 2 live chats (either flow), two at
 *   overlapping times, or two
 *   seats with the same sponsor, and isn't asked again by a sponsor they
 *   declined or let expire.
 * - Round 1 (the Friday ~10 PM Send): answer by Sat 10:00 AM. Round 2 opens
 *   Sat 10:30 AM, then a round every 30 minutes. A round's invite is
 *   answered by the round's close or 30 minutes from when it actually ran,
 *   whichever is later, capped at the chat's last call (the old flow's lead:
 *   20 min; 35 for Ivey, a 15-min walk). Under 10 minutes to answer: that
 *   seat waits. Rounds run when triggered, so a late or missed round just
 *   catches up as the current one.
 * - A seat answered "no" (declined, expired) in a round waits for the next
 *   round; it is never re-offered inside the same round.
 */
import {
  COFFEE_CHAT_DATE,
  COFFEE_CHAT_EXPIRY_MINUTES_BEFORE,
  COFFEE_CHAT_UTC_OFFSET,
} from "~/lib/coffee-chat-requests";
import {
  COFFEE_SESSIONS,
  WORKSHOP_BUFFER_MIN,
  type Building,
} from "~/lib/coffee-chat-sessions";

/** Saturday "HH:MM" -> absolute time. */
export function saturdayAt(minutes: number): Date {
  const h = String(Math.floor(minutes / 60)).padStart(2, "0");
  const m = String(minutes % 60).padStart(2, "0");
  return new Date(`${COFFEE_CHAT_DATE}T${h}:${m}:00${COFFEE_CHAT_UTC_OFFSET}`);
}

/**
 * When the day's last possible chat (15 minutes, ending with the last
 * session) starts: past its last call, so no round can offer anything.
 */
export const LAST_CHAT_STARTS_AT = saturdayAt(
  Math.max(...COFFEE_SESSIONS.map((s) => s.end)) - 15,
);

/** Round 1 must be answered by Sat 10:00 AM. */
export const ROUND_ONE_CLOSES_MIN = 10 * 60;
/** Round 2 opens Sat 10:30 AM. */
export const ROUND_TWO_OPENS_MIN = 10 * 60 + 30;
/** Every round from 2 on gives this long to answer. */
export const ROUND_MINUTES = 30;
/** Walking time to Ivey, added to the last-call lead there. */
export const IVEY_WALK_MIN = WORKSHOP_BUFFER_MIN;
/** An invite leaving less than this to answer isn't sent; the seat waits. */
export const MIN_ANSWER_MINUTES = 10;
/** Live (pending or accepted) chats one hacker may hold at a time. */
export const MAX_LIVE_CHATS_PER_HACKER = 2;

/** Minutes before a chat an invite must be answered by (20; 35 for Ivey). */
export function answerLeadMinutes(building: Building): number {
  return (
    COFFEE_CHAT_EXPIRY_MINUTES_BEFORE +
    (building === "ivey" ? IVEY_WALK_MIN : 0)
  );
}

export type InviteRound = { round: number; opensAt: Date; closesAt: Date };

/** When a round's answers close (round 1: Sat 10 AM). */
export function roundClosesAt(round: number): Date {
  if (round <= 1) return saturdayAt(ROUND_ONE_CLOSES_MIN);
  return saturdayAt(ROUND_TWO_OPENS_MIN + (round - 1) * ROUND_MINUTES);
}

/** When a round opens (round 1: whenever organizers send). */
export function roundOpensAt(round: number): Date | null {
  if (round <= 1) return null;
  return saturdayAt(ROUND_TWO_OPENS_MIN + (round - 2) * ROUND_MINUTES);
}

/**
 * The round running at `now`: 1 until Sat 10:30 AM, then 2, 3, ... every 30
 * minutes. (Between 10:00 and 10:30 round 1 is closed and nothing new is
 * offered.)
 */
export function currentRound(now: Date): number {
  const r2 = saturdayAt(ROUND_TWO_OPENS_MIN).getTime();
  if (now.getTime() < r2) return 1;
  return 2 + Math.floor((now.getTime() - r2) / (ROUND_MINUTES * 60_000));
}

/** When the next automatic round opens after `now`, or null if none is left today. */
export function nextRoundAt(
  now: Date,
  lastChatStartMin = 17 * 60,
): Date | null {
  const at = roundOpensAt(Math.max(2, currentRound(now) + 1))!;
  return at < saturdayAt(lastChatStartMin) ? at : null;
}

/** A chat's last call: the latest an invite to it can be answered. */
export function lastCallAt(startMin: number, building: Building): Date {
  return new Date(
    saturdayAt(startMin).getTime() - answerLeadMinutes(building) * 60_000,
  );
}

/**
 * `close` capped at the chat's last call, or null when that leaves under
 * MIN_ANSWER_MINUTES from `now`.
 */
function answerBy(now: Date, close: Date, lastCall: Date): Date | null {
  const at = lastCall < close ? lastCall : close;
  return at.getTime() - now.getTime() >= MIN_ANSWER_MINUTES * 60_000
    ? at
    : null;
}

/** Rounds 2+: the round's close, or 30 minutes from now if that's later. */
function laterRoundClose(round: number, now: Date): Date {
  const close = roundClosesAt(round);
  const full = new Date(now.getTime() + ROUND_MINUTES * 60_000);
  return full > close ? full : close;
}

/**
 * The time an invite in `round` for a chat starting at `startMin` must be
 * answered by, or null when this round can't offer that chat at `now`.
 * Round 1: Sat 10:00 AM or the chat's last call, whichever is first.
 * Later rounds: the round's close or 30 minutes from `now`, whichever is
 * later (a round triggered late still gives 30 minutes), capped at the
 * chat's last call. Null before the round opens, or when that leaves under
 * MIN_ANSWER_MINUTES to answer.
 */
export function inviteExpiresAt(
  round: number,
  startMin: number,
  building: Building,
  now: Date,
): Date | null {
  const lastCall = lastCallAt(startMin, building);
  if (round <= 1) return answerBy(now, roundClosesAt(1), lastCall);
  if (now < roundOpensAt(round)!) return null;
  return answerBy(now, laterRoundClose(round, now), lastCall);
}

/**
 * A changed invite's new answer-by time (the hacker must accept again): Sat
 * 10 AM on Friday night, later the current round's close (at least 30
 * minutes from now), capped at the chat's last call. Null when that leaves
 * under MIN_ANSWER_MINUTES: too late to ask again, so their answer stands.
 */
export function reconfirmExpiresAt(
  now: Date,
  startMin: number,
  building: Building,
): Date | null {
  const r1 = roundClosesAt(1);
  const close =
    now < r1 ? r1 : laterRoundClose(Math.max(2, currentRound(now)), now);
  return answerBy(now, close, lastCallAt(startMin, building));
}

// ---------------------------------------------------------------------------
// Seats
// ---------------------------------------------------------------------------

/** A workshop window as the scheduler has it (minutes after midnight). */
export type InviteWorkshop = {
  setup?: number | null;
  start: number;
  end: number;
};

/**
 * Chat start times that fit inside a session: back to back from the start,
 * each a full chat long, none overlapping a workshop window (setup or start
 * minus 15 min, to end plus 15 min). A session cut by a window keeps only
 * the chats that fit, e.g. 1:00-2:00 with setup at 1:45 -> 1:00 and 1:15.
 */
export function sessionChatStarts(
  session: { start: number; end: number },
  chatMinutes: number,
  workshops: readonly InviteWorkshop[] = [],
): number[] {
  const out: number[] = [];
  for (
    let t = session.start;
    t + chatMinutes <= session.end;
    t += chatMinutes
  ) {
    const clash = workshops.some((w) => {
      const from = (w.setup ?? w.start) - WORKSHOP_BUFFER_MIN;
      const to = w.end + WORKSHOP_BUFFER_MIN;
      return t < to && from < t + chatMinutes;
    });
    if (!clash) out.push(t);
  }
  return out;
}

/** One rep's placement, as the seat counter needs it. */
export type SeatPlacement = {
  id: string;
  session: { start: number; end: number };
};

/**
 * The chat start times for each of one rep's sent placements: sessions in
 * time order, each holding the chats that fit, until the rep's wanted chats
 * run out (a rep wanting 6 at 15 min gets 4 + 2).
 */
export function repChatStarts(
  placements: readonly SeatPlacement[],
  chatsWanted: number,
  chatMinutes: number,
  workshops: readonly InviteWorkshop[] = [],
): Map<string, number[]> {
  const out = new Map<string, number[]>();
  let left = Math.max(0, chatsWanted);
  const ordered = [...placements].sort(
    (a, b) => a.session.start - b.session.start || a.id.localeCompare(b.id),
  );
  for (const p of ordered) {
    const fits = sessionChatStarts(p.session, chatMinutes, workshops);
    const take = fits.slice(0, left);
    left -= take.length;
    out.set(p.id, take);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The planner
// ---------------------------------------------------------------------------

export const INVITE_SOURCES = ["scanned", "shortlist", "interested"] as const;
export type InviteSource = (typeof INVITE_SOURCES)[number];

/** One chat (a set of seats at one time with one rep). */
export type PlanChat = {
  placementId: string;
  sponsorId: string;
  /** Minutes after midnight, Saturday. */
  start: number;
  minutes: number;
  building: Building;
  /** Seats in this chat (hackersPerChat). */
  seats: number;
  /** Invites holding a seat now (pending and not expired, or accepted). */
  live: number;
  /** Invites in this round that no longer hold a seat (declined, expired). */
  spentThisRound: number;
};

export const chatKey = (c: { placementId: string; start: number }) =>
  `${c.placementId}|${c.start}`;

/** A hacker's chat that holds their time (any sponsor, either flow). */
export type BusyChat = {
  userId: string;
  sponsorId: string;
  start: number;
  minutes: number;
};

export type PlanInput = {
  round: number;
  now: Date;
  chats: readonly PlanChat[];
  /**
   * Each sponsor's candidates, already filtered to admitted hackers who
   * agreed to share, in order inside each source.
   */
  candidates: ReadonlyMap<
    string,
    readonly { userId: string; source: InviteSource }[]
  >;
  /** Live chats per hacker. */
  busy: readonly BusyChat[];
  /** "sponsorId|userId" pairs the sponsor may not ask again. */
  blocked: ReadonlySet<string>;
  /** Sponsor order for the turn-taking (stable, e.g. by name). */
  sponsorOrder?: readonly string[];
  /** Live chats a hacker may hold (default MAX_LIVE_CHATS_PER_HACKER). */
  maxLivePerHacker?: number;
};

export type PlannedInvite = {
  placementId: string;
  sponsorId: string;
  userId: string;
  start: number;
  minutes: number;
  source: InviteSource;
  round: number;
  expiresAt: Date;
};

export type PlanResult = {
  invites: PlannedInvite[];
  /** Seats still open after this round, per chat key (only chats with any). */
  unfilled: { placementId: string; start: number; open: number }[];
};

const overlaps = (
  a: { start: number; minutes: number },
  b: { start: number; minutes: number },
) => a.start < b.start + b.minutes && b.start < a.start + a.minutes;

/**
 * Plan one round: one invite per open seat this round can offer, in the
 * order above. Pure: returns what to write.
 */
export function planInviteRound(input: PlanInput): PlanResult {
  const { round, now } = input;

  // Seats this round can offer, per chat, with their answer-by time.
  type Open = PlanChat & { open: number; expiresAt: Date };
  const open: Open[] = [];
  const unfillable: Open[] = [];
  for (const c of input.chats) {
    const free = c.seats - c.live - c.spentThisRound;
    if (free <= 0) continue;
    const expiresAt = inviteExpiresAt(round, c.start, c.building, now);
    if (expiresAt) open.push({ ...c, open: free, expiresAt });
    else unfillable.push({ ...c, open: free, expiresAt: now });
  }
  open.sort(
    (a, b) => a.start - b.start || a.placementId.localeCompare(b.placementId),
  );

  const bySponsor = new Map<string, Open[]>();
  for (const c of open) {
    bySponsor.set(c.sponsorId, [...(bySponsor.get(c.sponsorId) ?? []), c]);
  }

  const busy = new Map<string, BusyChat[]>();
  for (const b of input.busy)
    busy.set(b.userId, [...(busy.get(b.userId) ?? []), b]);
  const blocked = new Set(input.blocked);
  const pair = (sponsorId: string, userId: string) => `${sponsorId}|${userId}`;
  const cap = input.maxLivePerHacker ?? MAX_LIVE_CHATS_PER_HACKER;

  const order = [
    ...(input.sponsorOrder ?? []).filter((id) => bySponsor.has(id)),
    ...[...bySponsor.keys()]
      .filter((id) => !(input.sponsorOrder ?? []).includes(id))
      .sort(),
  ];

  const invites: PlannedInvite[] = [];

  /** The earliest open seat of this sponsor the hacker can take, or null. */
  const seatFor = (sponsorId: string, userId: string): Open | null => {
    if (blocked.has(pair(sponsorId, userId))) return null;
    const mine = busy.get(userId) ?? [];
    if (mine.length >= cap) return null;
    if (mine.some((b) => b.sponsorId === sponsorId)) return null;
    return (
      (bySponsor.get(sponsorId) ?? []).find(
        (c) => c.open > 0 && !mine.some((b) => overlaps(b, c)),
      ) ?? null
    );
  };

  for (const source of INVITE_SOURCES) {
    // Each sponsor's queue for this tier, deduped against earlier tiers.
    const queues = new Map<string, string[]>();
    for (const sponsorId of order) {
      const seen = new Set<string>();
      const all = input.candidates.get(sponsorId) ?? [];
      const earlier = new Set(
        all
          .filter(
            (c) =>
              INVITE_SOURCES.indexOf(c.source) < INVITE_SOURCES.indexOf(source),
          )
          .map((c) => c.userId),
      );
      queues.set(
        sponsorId,
        all
          .filter((c) => c.source === source && !earlier.has(c.userId))
          .map((c) => c.userId)
          .filter((id) => (seen.has(id) ? false : (seen.add(id), true))),
      );
    }
    let progress = true;
    while (progress) {
      progress = false;
      for (const sponsorId of order) {
        const queue = queues.get(sponsorId)!;
        if (!(bySponsor.get(sponsorId) ?? []).some((c) => c.open > 0)) continue;
        // A hacker who fits no seat now never will this round (seats and
        // their free time only shrink), so they drop out of this tier.
        while (queue.length) {
          const userId = queue.shift()!;
          const seat = seatFor(sponsorId, userId);
          if (!seat) continue;
          seat.open -= 1;
          busy.set(userId, [
            ...(busy.get(userId) ?? []),
            { userId, sponsorId, start: seat.start, minutes: seat.minutes },
          ]);
          blocked.add(pair(sponsorId, userId));
          invites.push({
            placementId: seat.placementId,
            sponsorId,
            userId,
            start: seat.start,
            minutes: seat.minutes,
            source,
            round,
            expiresAt: seat.expiresAt,
          });
          progress = true;
          break;
        }
      }
    }
  }

  const unfilled = [...open, ...unfillable]
    .filter((c) => c.open > 0)
    .sort(
      (a, b) => a.start - b.start || a.placementId.localeCompare(b.placementId),
    )
    .map((c) => ({ placementId: c.placementId, start: c.start, open: c.open }));
  return { invites, unfilled };
}
