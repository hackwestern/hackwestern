/**
 * The organizer Judging board's rules (mock organizer-judging-board-v2,
 * approved with changes by Jazz on 2026-11-19): what each sponsor row
 * says, which to-dos show, in what order, and each team's status. Pure, so
 * it's unit tested; the copy lives in src/content/sponsor-judging-board.ts.
 *
 * Times are minutes after midnight Eastern on judging day (Sunday), like
 * src/lib/sponsor-presentations.ts.
 */
import { runOfShowInstant } from "~/lib/run-of-show-time";
import {
  PRESENTATION_SLOT_MINUTES,
  PRESENTATION_WINDOW_END,
} from "~/lib/sponsor-presentations";

/** Round 1 shortlists are due 9:45 AM Sunday (Jazz, 2026-11-20). */
export const SHORTLIST_DUE = 9 * 60 + 45;
/** After this a missing shortlist (or room) is past fixing: round 1 ran. */
export const ROUND1_OVER = PRESENTATION_WINDOW_END;
/** Top 5 due 12:00 PM Sunday. */
export const TOP_DUE = 12 * 60;
/**
 * "No scores yet" waits two slots past the sponsor's first presentation,
 * so a rep scoring the first team isn't flagged mid-pitch.
 */
export const NO_SCORES_AFTER = 2 * PRESENTATION_SLOT_MINUTES;

/**
 * Minutes into judging day (Sunday, Eastern) at `now`: -1 before Sunday,
 * 24 * 60 after it.
 */
export function judgingDayMinutes(now: Date): number {
  const start = runOfShowInstant("Sunday", "00:00");
  const end = runOfShowInstant("Sunday", "24:00");
  if (now < start) return -1;
  if (now >= end) return 24 * 60;
  return Math.floor((now.getTime() - start.getTime()) / 60_000);
}

/** A team's presentation status: only these three (Jazz, 2026-11-19). */
export type TeamStatus = "not-sent" | "waiting" | "accepted";

/**
 * Accepted once any member confirmed the current times; Waiting once any
 * member was sent them; otherwise the invite isn't sent.
 */
export function teamStatus(t: { told: boolean; confirmed: boolean }) {
  if (t.confirmed) return "accepted" as const;
  if (t.told) return "waiting" as const;
  return "not-sent" as const;
}

export type BoardSponsor = {
  sponsorId: string;
  name: string;
  /** "room": presents in a room; "remote": judges online, no slots. */
  mode: "room" | "remote";
  room: string | null;
  /** The shortlist was sent (round 1). */
  shortlistSent: boolean;
  /** Teams on the sent shortlist. */
  teams: number;
  /** Distinct rep names that scored. */
  repsJudging: number;
  /** Shortlisted teams with at least one score. */
  scored: number;
  /** The top 5 is in. */
  topIn: boolean;
  /** First placed presentation start; null = none. */
  firstStart: number | null;
};

/** What a sponsor row says: one thing, ok or a problem. */
export type SponsorLine =
  | { tone: "ok"; kind: "teams"; teams: number; reps: number }
  | { tone: "ok"; kind: "scored"; scored: number; teams: number }
  | { tone: "ok"; kind: "topIn" }
  | {
      tone: "warn";
      kind: "shortlistMissing" | "missedRound1" | "noScores" | "topLate";
    };

/** Has `s` gone too long without a score (two slots past its first)? */
const noScoresYet = (s: BoardSponsor, minutes: number) =>
  s.shortlistSent &&
  s.scored === 0 &&
  !s.topIn &&
  s.mode === "room" &&
  s.firstStart !== null &&
  minutes >= s.firstStart + NO_SCORES_AFTER;

const topLate = (s: BoardSponsor, minutes: number) =>
  s.shortlistSent && !s.topIn && minutes >= TOP_DUE;

export function sponsorLine(s: BoardSponsor, minutes: number): SponsorLine {
  if (!s.shortlistSent) {
    return {
      tone: "warn",
      kind: minutes >= ROUND1_OVER ? "missedRound1" : "shortlistMissing",
    };
  }
  if (s.topIn) return { tone: "ok", kind: "topIn" };
  if (topLate(s, minutes)) return { tone: "warn", kind: "topLate" };
  if (noScoresYet(s, minutes)) return { tone: "warn", kind: "noScores" };
  if (s.scored > 0) {
    return { tone: "ok", kind: "scored", scored: s.scored, teams: s.teams };
  }
  return { tone: "ok", kind: "teams", teams: s.teams, reps: s.repsJudging };
}

export type BoardTodo =
  | {
      kind: "textLead";
      sponsorId: string;
      problem: "shortlist" | "noScores" | "top5";
    }
  | { kind: "room"; sponsorId: string }
  | { kind: "notify"; teams: number }
  | { kind: "digitalTop"; name: string };

/**
 * The to-dos in the order to do them: missing shortlists (text the lead),
 * sponsors without a room, then telling teams their times; later in the
 * day, sponsors with no scores, late top 5s and digital top 5s not entered.
 * Shortlist and room to-dos go away once round 1 is over (11:30).
 */
export function boardTodos(input: {
  sponsors: readonly BoardSponsor[];
  /** Scheduled teams whose members haven't been sent their times. */
  teamsNotTold: number;
  /** Digital sponsors (PCBWay) and whether their top 5 is entered. */
  digital: readonly { name: string; topIn: boolean }[];
  minutes: number;
}): BoardTodo[] {
  const { sponsors, minutes } = input;
  const todos: BoardTodo[] = [];
  const round1 = minutes < ROUND1_OVER;
  if (round1) {
    for (const s of sponsors) {
      if (!s.shortlistSent) {
        todos.push({
          kind: "textLead",
          sponsorId: s.sponsorId,
          problem: "shortlist",
        });
      }
    }
    for (const s of sponsors) {
      if (s.mode === "room" && !s.room) {
        todos.push({ kind: "room", sponsorId: s.sponsorId });
      }
    }
  }
  if (input.teamsNotTold > 0) {
    todos.push({ kind: "notify", teams: input.teamsNotTold });
  }
  for (const s of sponsors) {
    if (noScoresYet(s, minutes)) {
      todos.push({
        kind: "textLead",
        sponsorId: s.sponsorId,
        problem: "noScores",
      });
    }
  }
  for (const s of sponsors) {
    if (topLate(s, minutes)) {
      todos.push({ kind: "textLead", sponsorId: s.sponsorId, problem: "top5" });
    }
  }
  if (minutes >= TOP_DUE) {
    for (const d of input.digital) {
      if (!d.topIn) todos.push({ kind: "digitalTop", name: d.name });
    }
  }
  return todos;
}

/**
 * The sponsor's lead to text: the head rep (crown), else the first rep
 * listed. Null when no rep has a phone.
 */
export function leadOf<T extends { phone: string; isPrimary: boolean }>(
  reps: readonly T[],
): T | null {
  const withPhone = reps.filter((r) => r.phone.trim());
  return withPhone.find((r) => r.isPrimary) ?? withPhone[0] ?? null;
}

/** An `sms:` link with a drafted message. */
export function smsHref(phone: string, body: string) {
  const digits = phone.replace(/[^\d+]/g, "");
  return `sms:${digits}?&body=${encodeURIComponent(body)}`;
}

/** Teams on two or more sponsors' lists, by team id: how many. */
export function sponsorCountByTeam(
  slots: readonly { teamId: string; sponsorId: string }[],
) {
  const bySponsor = new Map<string, Set<string>>();
  for (const s of slots) {
    const set = bySponsor.get(s.teamId) ?? new Set<string>();
    set.add(s.sponsorId);
    bySponsor.set(s.teamId, set);
  }
  return new Map([...bySponsor].map(([teamId, set]) => [teamId, set.size]));
}
