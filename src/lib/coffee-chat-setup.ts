/**
 * Sponsor-side coffee chat setup math (Your team, chatting preferences,
 * shortlist seats), shared by the coffeeChatSetup router and the portal
 * pages. Dependency-free so client components can import it. Session and
 * chat-length rules come from src/lib/coffee-chat-sessions.ts; see
 * docs/decisions.md 2026-11-19 ("Chats per rep instead of hours", Q1–Q11).
 */
import {
  COFFEE_SESSIONS,
  chatMinutes,
  chatsBySession,
  chatsInWindow,
  minutesOfClock,
  usableWindow,
  type UsableWindow,
} from "~/lib/coffee-chat-sessions";

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

/** What a sponsor's workshop leaves of each session, for one chat length. */
export type SetupWindows = {
  /** Sessions where not one whole chat fits outside the workshop window. */
  blocked: string[];
  /**
   * Sessions the workshop's travel buffer only cuts: the part left, in
   * minutes after midnight (Sun Life, setup 2:00, 30-min chats: 1:00-1:30).
   */
  partial: Record<string, UsableWindow>;
  /** Whole chats one rep fits in each session (0 = blocked). */
  chats: Record<string, number>;
};

/**
 * Blocked and partial sessions for these workshops ("HH:MM", Saturday) and
 * chat length. Same rule as the organizer board and the invites
 * (usableWindow), so a session the sponsor can tick is one organizers can
 * place and hackers can be invited to.
 */
export function setupWindows(
  workshops: readonly { start: string; end: string }[],
  chatMinutes: number,
): SetupWindows {
  const times = workshops.flatMap((w) => {
    const start = minutesOfClock(w.start);
    const end = minutesOfClock(w.end);
    return start === null || end === null ? [] : [{ start, end }];
  });
  const out: SetupWindows = { blocked: [], partial: {}, chats: {} };
  for (const s of COFFEE_SESSIONS) {
    const w = usableWindow(s.id, times, chatMinutes);
    out.chats[s.id] = chatsInWindow(w, chatMinutes);
    if (!w) out.blocked.push(s.id);
    else if (w.start !== s.start || w.end !== s.end) out.partial[s.id] = w;
  }
  return out;
}

/** Whole chats a rep fits in the sessions they ticked (partial ones hold fewer). */
export function availChats(free: readonly string[], windows: SetupWindows): number {
  return availableFree(free, windows.blocked).reduce((n, id) => n + (windows.chats[id] ?? 0), 0);
}

/**
 * The most chats a rep can get: what they asked for, capped by the chats
 * their free sessions hold (outside their workshop).
 */
export function repChatCap(chatsWanted: number, availChats: number): number {
  return Math.max(0, Math.min(chatsWanted, availChats));
}

/**
 * "Up to N chats · up to N hackers": every rep's capped chats, and those
 * times hackers per chat. The hacker count is the sponsor's seats, which
 * caps their shortlist.
 */
export function setupTotals(
  format: SetupFormat,
  reps: readonly { chatsWanted: number; availChats: number }[],
): { chats: number; hackers: number } {
  const chats = reps.reduce((n, r) => n + repChatCap(r.chatsWanted, r.availChats), 0);
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

/** What a sponsor's setup says about each rep, before or after an edit. */
export type SetupSnapshot = {
  hackersPerChat: number;
  reps: readonly { id: string; chatsWanted: number; free: readonly string[] }[];
};

/**
 * Invited hackers (pending or accepted) in the sent chats an edit changes:
 * a removed rep's chats, chats in a session the rep is no longer free for,
 * chats that now hold a different number of chats (fewer chats wanted, or
 * a new chat length), or every chat when hackers per chat changes. Used by
 * the "Invites are already out" dialog, so its count covers only the chats
 * being changed (bug B4). Other edits (a phone, the crown) change no chat.
 */
export function invitesAffected(
  chats: readonly {
    repId: string;
    sessionId: string;
    hackers: readonly unknown[];
  }[],
  workshops: readonly { start: string; end: string }[],
  before: SetupSnapshot,
  after: SetupSnapshot,
): number {
  const perSession = (s: SetupSnapshot) => {
    const w = setupWindows(workshops, chatMinutes(s));
    return (id: string) => w.chats[id] ?? 0;
  };
  const fitsBefore = perSession(before);
  const fitsAfter = perSession(after);
  let n = 0;
  for (const rep of new Set(chats.map((c) => c.repId))) {
    const mine = chats.filter((c) => c.repId === rep);
    const was = before.reps.find((r) => r.id === rep);
    const now = after.reps.find((r) => r.id === rep);
    const placed = mine.map((c) => c.sessionId);
    const countsBefore = chatsBySession(placed, was?.chatsWanted ?? 0, fitsBefore);
    const countsAfter = chatsBySession(placed, now?.chatsWanted ?? 0, fitsAfter);
    for (const c of mine) {
      const changed =
        !now ||
        after.hackersPerChat !== before.hackersPerChat ||
        !now.free.includes(c.sessionId) ||
        countsBefore.get(c.sessionId) !== countsAfter.get(c.sessionId);
      if (changed) n += c.hackers.length;
    }
  }
  return n;
}
