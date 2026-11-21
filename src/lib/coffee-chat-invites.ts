/**
 * Coffee chat session invites: the pure planner (track B of the 8-hour
 * build). Reads only its arguments, so the server and the tests share it.
 *
 * Rules (docs/decisions.md 2026-11-19, "One coffee chat deadline…",
 * "Coffee chat deadline 10:00 PM Friday…", "Jazz's answers… (Q1–Q11)"):
 * - Each sent placement (one rep in one room for one session) runs a number
 *   of chats at fixed start times inside the session (4 x 15 min for
 *   1-on-1s, 2 x 30 min for groups), up to the rep's wanted chats. A session
 *   cut by the sponsor's workshop window (setup or start minus 15 min, to
 *   end plus 15 min) keeps only the chats that fit.
 * - Each chat has hackersPerChat seats. Exactly one invite per open seat.
 * - Per sponsor: hackers an organizer put first in line (newest first),
 *   then scanned hackers, then the shortlist, then hackers
 *   interested in that sponsor (by their rank). Tiers run across all
 *   sponsors in turn (every sponsor's scanned hackers before anyone's
 *   shortlist), one hacker per sponsor at a time, so no sponsor takes the
 *   whole pool first.
 * - A hacker never holds more than 2 live chats (either flow), two at
 *   overlapping times, or two
 *   seats with the same sponsor, and isn't asked again by a sponsor they
 *   declined or let expire.
 * - Round 1 (the Friday 10:00 PM Send): answer by Sat 10:00 AM. Round 2 opens
 *   Sat 10:00 AM, as round 1 closes, then a round every 30 minutes. A round's invite is
 *   answered by the round's close or 30 minutes from when it actually ran,
 *   whichever is later, capped at the chat's last call (the old flow's lead:
 *   20 min; 35 for Ivey, a 15-min walk). Under 10 minutes to answer: that
 *   seat waits. Rounds run when triggered, so a late or missed round just
 *   catches up as the current one.
 * - A seat answered "no" (declined, expired) is offered again at once, to
 *   the next candidate, with the current round's answer-by time (decision
 *   2026-11-19, "Declines re-send at once…"). Every seat is filled while an
 *   eligible candidate is left; a seat stays empty only when none is.
 * - Final call (decision 2026-11-20, "One final hacker…"): from 30 minutes
 *   before a chat (45 for Ivey), when the rounds above can no longer offer
 *   it, each seat still waiting gets exactly one last invite, to the next
 *   hacker in line, answered by 10 minutes before the chat (25 for Ivey).
 *   If that hacker declines or doesn't answer, the seat stays empty.
 */
import {
  COFFEE_CHAT_DATE,
  COFFEE_CHAT_EXPIRY_MINUTES_BEFORE,
  COFFEE_CHAT_UTC_OFFSET,
} from "~/lib/coffee-chat-requests";
import {
  COFFEE_SESSIONS,
  WORKSHOP_BUFFER_MIN,
  sessionWindow,
  type Building,
} from "~/lib/coffee-chat-sessions";

/**
 * Minutes after Saturday midnight -> absolute time. Counts on past
 * midnight (1470 = Sun 12:30 AM): invite rounds keep numbering into Sunday,
 * and a "24:30" time string would be an Invalid Date that broke the coffee
 * chat board all of Sunday.
 */
export function saturdayAt(minutes: number): Date {
  const midnight = new Date(
    `${COFFEE_CHAT_DATE}T00:00:00${COFFEE_CHAT_UTC_OFFSET}`,
  );
  return new Date(midnight.getTime() + minutes * 60_000);
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
/** Round 2 opens Sat 10:00 AM, as round 1 closes. */
export const ROUND_TWO_OPENS_MIN = 10 * 60;
/** Every round from 2 on gives this long to answer. */
export const ROUND_MINUTES = 30;
/** Walking time to Ivey, added to the last-call lead there. */
export const IVEY_WALK_MIN = WORKSHOP_BUFFER_MIN;
/** An invite leaving less than this to answer isn't sent; the seat waits. */
export const MIN_ANSWER_MINUTES = 10;
/** A final-call invite is answered by this long before its chat (+ walk). */
export const FINAL_ANSWER_LEAD_MIN = 10;
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
 * The round running at `now`: 1 until Sat 10:00 AM, then 2, 3, ... every 30
 * minutes (round 2 is 10:00 to 10:30).
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
 * Whether a seat at this chat can still be offered by a round (this one or
 * a later one): its last call leaves at least MIN_ANSWER_MINUTES to answer.
 * After that only the final call offers it (finalCallExpiresAt).
 */
export function seatStillOfferable(
  startMin: number,
  building: Building,
  now: Date,
): boolean {
  return (
    lastCallAt(startMin, building).getTime() - now.getTime() >=
    MIN_ANSWER_MINUTES * 60_000
  );
}

/**
 * A chat's final call: when the rounds can no longer offer it (its last call
 * minus MIN_ANSWER_MINUTES: 30 minutes before; 45 for Ivey). From then on
 * each waiting seat gets one last invite (finalCallExpiresAt).
 */
export function finalCallAt(startMin: number, building: Building): Date {
  return new Date(
    lastCallAt(startMin, building).getTime() - MIN_ANSWER_MINUTES * 60_000,
  );
}

/**
 * The answer-by time of a final-call invite sent at `now` (10 minutes before
 * the chat; 25 for Ivey), or null before the final call or once that leaves
 * under MIN_ANSWER_MINUTES to answer.
 */
export function finalCallExpiresAt(
  startMin: number,
  building: Building,
  now: Date,
): Date | null {
  if (now < finalCallAt(startMin, building)) return null;
  const walk = building === "ivey" ? IVEY_WALK_MIN : 0;
  const at = saturdayAt(startMin - FINAL_ANSWER_LEAD_MIN - walk);
  return at.getTime() - now.getTime() >= MIN_ANSWER_MINUTES * 60_000
    ? at
    : null;
}

/**
 * Whether an invite was this chat's final-call one: the only invites
 * answered after the chat's last call (every round caps there).
 */
export function isFinalCallInvite(
  expiresAt: Date | null,
  startMin: number,
  building: Building,
): boolean {
  return !!expiresAt && expiresAt > lastCallAt(startMin, building);
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
 * Chat start times inside a session: back to back through its usable
 * window (sessionWindow, the same window the organizer board and the
 * sponsor's "Your chats" use), each a full chat long. A session cut by a
 * workshop window (setup or start minus 15 min, to end plus 15 min) keeps
 * only the whole chats in the part left, e.g. 1:00-2:00 with setup at 1:45
 * -> 1:00 and 1:15.
 */
export function sessionChatStarts(
  session: { start: number; end: number },
  chatMinutes: number,
  workshops: readonly InviteWorkshop[] = [],
): number[] {
  const w = sessionWindow(session, workshops, chatMinutes);
  const out: number[] = [];
  for (let t = w?.start ?? 0; w && t + chatMinutes <= w.end; t += chatMinutes)
    out.push(t);
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

/**
 * Candidate tiers in order. "organizer": put first in line by an organizer
 * on the coffee board (newest first), ahead of everyone else.
 */
export const INVITE_SOURCES = [
  "organizer",
  "scanned",
  "shortlist",
  "interested",
  // Anyone else who filled out the interest list (any sponsor), so seats
  // keep filling after a sponsor's own line runs out (Jazz, 2026-11-20).
  "anyone",
] as const;
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
  /**
   * Final-call invites at this chat that were declined or expired (or
   * otherwise ended): each used up one waiting seat's last offer.
   */
  finalSpent?: number;
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
  /**
   * Seats left empty, per chat (only chats with any): no eligible candidate
   * is left, or the chat is too close to offer now. Not a normal state:
   * the board shows it as a problem.
   */
  unfilled: { placementId: string; start: number; open: number }[];
};

const overlaps = (
  a: { start: number; minutes: number },
  b: { start: number; minutes: number },
) => a.start < b.start + b.minutes && b.start < a.start + a.minutes;

/**
 * Plan one round: one invite per empty seat this round can offer, in the
 * order above. Pure: returns what to write. Greedy but maximal: a seat is
 * left empty only when no remaining candidate can take it (each hacker is
 * tried against every seat of the sponsor, and seats only fill up).
 */
export function planInviteRound(input: PlanInput): PlanResult {
  const { round, now } = input;

  // Seats this round can offer, per chat, with their answer-by time.
  type Open = PlanChat & { open: number; expiresAt: Date };
  const open: Open[] = [];
  const unfillable: Open[] = [];
  for (const c of input.chats) {
    const free = c.seats - c.live;
    if (free <= 0) continue;
    // Past the final call, a seat whose last offer was refused stays empty
    // (and isn't reported as unfilled: that's the rule, not a problem).
    const final = now >= finalCallAt(c.start, c.building);
    const offerable = final ? free - (c.finalSpent ?? 0) : free;
    if (offerable <= 0) continue;
    const expiresAt = final
      ? finalCallExpiresAt(c.start, c.building, now)
      : inviteExpiresAt(round, c.start, c.building, now);
    if (expiresAt) open.push({ ...c, open: offerable, expiresAt });
    else unfillable.push({ ...c, open: offerable, expiresAt: now });
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
