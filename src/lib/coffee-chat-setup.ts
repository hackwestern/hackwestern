/**
 * Sponsor-side coffee chat setup math (Your team, chatting preferences,
 * shortlist seats), shared by the coffeeChatSetup router and the portal
 * pages. Dependency-free so client components can import it. Session and
 * chat-length rules come from src/lib/coffee-chat-sessions.ts; see
 * docs/decisions.md 2026-11-19 ("Chats per rep instead of hours", Q1–Q11).
 */
import { chatsPerSession } from "~/lib/coffee-chat-sessions";

/** Reps a sponsor can list in Your team. */
export const MAX_SETUP_REPS = 12;
/** New reps start here (the v6 mock's default). */
export const DEFAULT_CHATS_WANTED = 4;
/** The stepper's top: 4 open sessions x 4 fifteen-minute chats. */
export const MAX_SETUP_CHATS = 16;

/** A phone needs at least this many digits. */
export const MIN_PHONE_DIGITS = 7;

export function phoneDigits(phone: string): number {
  return phone.replace(/\D/g, "").length;
}

export type SetupFormat = { hackersPerChat: number; longerOneOnOne: boolean };

/**
 * The most chats a rep can get: what they asked for, capped by the sessions
 * they're free (outside their workshop) times chats per session.
 */
export function repChatCap(
  format: SetupFormat,
  chatsWanted: number,
  availSessions: number,
): number {
  return Math.max(
    0,
    Math.min(chatsWanted, availSessions * chatsPerSession(format)),
  );
}

/**
 * "Up to N chats · up to N hackers": every rep's capped chats, and those
 * times hackers per chat. The hacker count is the sponsor's seats, which
 * caps their shortlist.
 */
export function setupTotals(
  format: SetupFormat,
  reps: readonly { chatsWanted: number; availSessions: number }[],
): { chats: number; hackers: number } {
  const chats = reps.reduce(
    (n, r) => n + repChatCap(format, r.chatsWanted, r.availSessions),
    0,
  );
  return { chats, hackers: chats * format.hackersPerChat };
}

/** Sessions ticked free and not blocked by their workshop. */
export function availableFree(
  free: readonly string[],
  blocked: readonly string[],
): string[] {
  return free.filter((id) => !blocked.includes(id));
}

/**
 * Where a sponsor's coffee chats stand right now (the status card at the
 * top of every coffee chat screen). Sponsors and organizers are never in
 * the app at the same time, so a sponsor coming back cold needs this.
 */
export type SetupState =
  | { kind: "notStarted" }
  | { kind: "draft" }
  | { kind: "waiting" }
  | { kind: "invitesGoingOut" }
  | { kind: "accepted"; accepted: number; seats: number };

export function setupState(s: {
  repCount: number;
  updatedAt: Date | null;
  submittedAt: Date | null;
  confirmed: boolean;
  seats: { total: number; accepted: number };
}): SetupState {
  if (s.confirmed) {
    return s.seats.accepted > 0
      ? { kind: "accepted", accepted: s.seats.accepted, seats: s.seats.total }
      : { kind: "invitesGoingOut" };
  }
  if (s.submittedAt) return { kind: "waiting" };
  if (s.repCount === 0 && !s.updatedAt) return { kind: "notStarted" };
  return { kind: "draft" };
}

export type SetupEvent = {
  kind: "scheduled" | "submittedPrefs" | "submittedShortlist" | "saved";
  at: Date;
};

/**
 * What changed, newest first, from timestamps we already store: organizers'
 * Send (placement sent_at), the sponsor's submits, and their last save
 * (pref updated_at, shown only when it isn't just the submit itself).
 */
export function setupEvents(s: {
  sentAt: Date | null;
  submittedAt: Date | null;
  shortlistSubmittedAt: Date | null;
  updatedAt: Date | null;
}): SetupEvent[] {
  const events: SetupEvent[] = [];
  if (s.sentAt) events.push({ kind: "scheduled", at: s.sentAt });
  if (s.submittedAt) events.push({ kind: "submittedPrefs", at: s.submittedAt });
  if (s.shortlistSubmittedAt) {
    events.push({ kind: "submittedShortlist", at: s.shortlistSubmittedAt });
  }
  const near = (a: Date | null, b: Date) =>
    !!a && Math.abs(a.getTime() - b.getTime()) < 5_000;
  if (
    s.updatedAt &&
    !near(s.submittedAt, s.updatedAt) &&
    !near(s.shortlistSubmittedAt, s.updatedAt)
  ) {
    events.push({ kind: "saved", at: s.updatedAt });
  }
  return events.sort((a, b) => b.at.getTime() - a.at.getTime());
}
