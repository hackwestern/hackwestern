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
export function availChats(
  free: readonly string[],
  windows: SetupWindows,
): number {
  return availableFree(free, windows.blocked).reduce(
    (n, id) => n + (windows.chats[id] ?? 0),
    0,
  );
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
  const chats = reps.reduce(
    (n, r) => n + repChatCap(r.chatsWanted, r.availChats),
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
    const countsBefore = chatsBySession(
      placed,
      was?.chatsWanted ?? 0,
      fitsBefore,
    );
    const countsAfter = chatsBySession(
      placed,
      now?.chatsWanted ?? 0,
      fitsAfter,
    );
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

/**
 * The setup the sent chats imply, as a "before" for invitesAffected: each
 * rep free exactly where they were placed, wanting at least the chats those
 * placements hold (Send places only the sessions a rep's chats need, so
 * every placed session was full but the last). Hackers per chat isn't kept
 * from Send, so today's value is used.
 */
export function sentSnapshot(
  chats: readonly { repId: string; sessionId: string }[],
  workshops: readonly { start: string; end: string }[],
  current: SetupSnapshot,
): SetupSnapshot {
  const fits = setupWindows(workshops, chatMinutes(current)).chats;
  const reps = [...new Set(chats.map((c) => c.repId))].map((id) => {
    const placed = COFFEE_SESSIONS.map((s) => s.id as string).filter((s) =>
      chats.some((c) => c.repId === id && c.sessionId === s),
    );
    const least =
      placed.slice(0, -1).reduce((n, s) => n + (fits[s] ?? 0), 0) + 1;
    const now = current.reps.find((r) => r.id === id);
    return {
      id,
      free: placed,
      chatsWanted: Math.max(now?.chatsWanted ?? 0, least),
    };
  });
  return { hackersPerChat: current.hackersPerChat, reps };
}

/**
 * Invited hackers in sent chats the current setup changes (the status
 * card's "This affects N invited hackers"): invitesAffected from what the
 * sent chats imply to the setup now, so the card and the dialog count the
 * same way.
 */
export function invitesOutOfLine(
  chats: readonly {
    repId: string;
    sessionId: string;
    hackers: readonly unknown[];
  }[],
  workshops: readonly { start: string; end: string }[],
  current: SetupSnapshot,
): number {
  return invitesAffected(
    chats,
    workshops,
    sentSnapshot(chats, workshops, current),
    current,
  );
}

/** A sent chat as this device last saw it (for "Organizers moved …"). */
export type SeenChat = {
  repId: string;
  sessionId: string;
  room: string;
  start: string;
};

/** What organizers changed in the sent chats since this device last looked. */
export type ChatChange =
  | {
      kind: "moved";
      repId: string;
      from: string;
      to: string | null;
      room: string | null;
    }
  | { kind: "removed"; repId: string; from: string };

/**
 * Compares the sent chats this device saw last time with today's, by
 * placement id: a new session or room is a move, a missing chat a removal.
 * There's no move history in the database (no schema change), so the
 * sponsor's "Last change" is worked out per device, like "Since you were
 * last here". `from` / `to` are start times ("HH:MM"). A missing chat of a
 * rep no longer on the team (`repIds`) isn't a removal: only the sponsor
 * removes reps, so it's their own change.
 */
export function chatChanges(
  before: Readonly<Record<string, SeenChat>>,
  now: readonly ({ placementId: string } & SeenChat)[],
  repIds: ReadonlySet<string>,
): ChatChange[] {
  const out: ChatChange[] = [];
  const byId = new Map(now.map((c) => [c.placementId, c]));
  for (const [id, was] of Object.entries(before)) {
    const c = byId.get(id);
    if (!c) {
      if (repIds.has(was.repId))
        out.push({ kind: "removed", repId: was.repId, from: was.start });
    } else if (c.sessionId !== was.sessionId || c.room !== was.room) {
      out.push({
        kind: "moved",
        repId: c.repId,
        from: was.start,
        to: c.sessionId !== was.sessionId ? c.start : null,
        room: c.room !== was.room ? c.room : null,
      });
    }
  }
  return out;
}

/** A "Last change" note this device remembers. */
export type MoveNote = { text: string; at: string };

/** What this device keeps about a sponsor's sent chats (localStorage). */
export type SeenChats = { chats: Record<string, SeenChat>; notes: MoveNote[] };

const isStr = (v: unknown): v is string => typeof v === "string";

/**
 * Reads the stored sent chats back, dropping anything malformed (old
 * versions, hand edits, another app's key): bad JSON or a non-object is
 * empty, and only well-formed chats and notes are kept.
 */
export function parseSeenChats(raw: string | null): SeenChats {
  let parsed: unknown = null;
  try {
    parsed = raw ? JSON.parse(raw) : null;
  } catch {
    parsed = null;
  }
  const stored = (parsed && typeof parsed === "object" ? parsed : {}) as {
    chats?: unknown;
    notes?: unknown;
  };
  const chats: Record<string, SeenChat> = {};
  if (
    stored.chats &&
    typeof stored.chats === "object" &&
    !Array.isArray(stored.chats)
  ) {
    for (const [id, c] of Object.entries(
      stored.chats as Record<string, unknown>,
    )) {
      const v = c as Partial<SeenChat> | null;
      if (
        v &&
        typeof v === "object" &&
        isStr(v.repId) &&
        isStr(v.sessionId) &&
        isStr(v.room) &&
        isStr(v.start)
      ) {
        chats[id] = {
          repId: v.repId,
          sessionId: v.sessionId,
          room: v.room,
          start: v.start,
        };
      }
    }
  }
  const notes = Array.isArray(stored.notes)
    ? (stored.notes as unknown[]).flatMap((n) => {
        const v = n as Partial<MoveNote> | null;
        return v && typeof v === "object" && isStr(v.text) && isStr(v.at)
          ? [{ text: v.text, at: v.at }]
          : [];
      })
    : [];
  return { chats, notes };
}
