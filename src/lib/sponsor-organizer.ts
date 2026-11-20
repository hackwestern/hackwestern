// The organizer sponsor home (/internal/sponsors): which tab a URL opens,
// the links between tabs and sponsor rows, the old /internal/sponsor-schedule
// redirect, and the per-sponsor chat and help summary. Pure, so it's tested
// without a router or a database.

import {
  blockFill,
  blockSlots,
  holdStartTimes,
  type HoldSpan,
} from "~/lib/coffee-chat-holds";
import {
  askedAt,
  chatRequestOf,
  type ChatRequest,
  type SavedChatRequest,
  type SetupLike,
  type SlotLimit,
} from "~/lib/coffee-chat-request";
import {
  chatExpiresAt,
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import type {
  ChatSlotFill,
  PresentationSlot,
  SundayJudging,
} from "~/lib/sponsor-day-board";
import type { JudgingBoard, JudgingRow } from "~/lib/sponsor-judging-rooms";
import { isDigitalJudging } from "~/lib/sponsor-prize-tracks";
import { seatsLeft } from "~/server/api/utils/coffee-chat-capacity";

export const ORGANIZER_HOME_PATH = "/internal/sponsors";

/**
 * The dashboard's visible tabs. Task pings is switched off for the event
 * (decisions 2026-11-19, "Turn off task pings for now"): its code stays in
 * the repo (task-pings-tab.tsx, task-reminders.ts) but no tab opens it.
 */
export const ORGANIZER_TABS = [
  "sponsors",
  "schedule",
  "coffee",
  "judging",
] as const;
export type OrganizerTab = (typeof ORGANIZER_TABS)[number];

type QueryValue = string | string[] | undefined;
export type OrganizerQuery = {
  tab?: QueryValue;
  view?: QueryValue;
  sponsor?: QueryValue;
};

function first(value: QueryValue): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export type OrganizerLocation = {
  tab: OrganizerTab;
  /** Scroll the Run of show tab to the coffee chat rooms table. */
  jumpToRooms: boolean;
  /** Sponsor id (or name) to focus the filters on, from ?sponsor=. */
  sponsor: string | null;
};

/**
 * Read the tab from ?tab= (or the old ?view=). "where" and #rooms were the
 * old "Where is everyone" tab: the Run of show tab, scrolled to the rooms.
 * The old Task pings and Help tabs (?tab=pings, ?tab=help, #help) open
 * Sponsors, where Now and next sits. Anything unknown opens Sponsors.
 */
export function parseOrganizerLocation(
  query: OrganizerQuery,
  hash = "",
): OrganizerLocation {
  const asked = first(query.tab) ?? first(query.view);
  const rooms = asked === "where" || hash === "#rooms";
  // The Full run of show tool is gone (Jazz, 2026-11-19): its links,
  // ?tab=where and #rooms open Home, which now carries its extra sections.
  const tab: OrganizerTab =
    rooms || asked === "schedule"
      ? "sponsors"
      : ORGANIZER_TABS.includes(asked as OrganizerTab)
        ? (asked as OrganizerTab)
        : "sponsors";
  const sponsor = first(query.sponsor)?.trim();
  return {
    tab,
    jumpToRooms: rooms,
    sponsor: sponsor ? sponsor : null,
  };
}

/** Anchor id of a sponsor's row on the Sponsors tab. */
export function sponsorRowId(sponsorId: string): string {
  return `sponsor-${sponsorId}`;
}

/** Link to a tab of the organizer home, optionally focused on a sponsor. */
export function organizerHomeHref({
  tab,
  sponsor,
  rooms,
}: {
  tab: OrganizerTab;
  sponsor?: string | null;
  rooms?: boolean;
}): string {
  const params = new URLSearchParams();
  if (tab !== "sponsors") params.set("tab", tab);
  if (sponsor && tab !== "sponsors") params.set("sponsor", sponsor);
  const search = params.toString();
  const hash =
    tab === "sponsors" && sponsor
      ? `#${sponsorRowId(sponsor)}`
      : rooms && tab === "schedule"
        ? "#rooms"
        : "";
  return `${ORGANIZER_HOME_PATH}${search ? `?${search}` : ""}${hash}`;
}

/**
 * Where an old /internal/sponsor-schedule link goes. Its default tab was the
 * schedule, so no ?tab= means Run of show. The browser keeps a #rooms hash
 * across the redirect, and ?tab=where becomes #rooms explicitly. The old
 * help and pings tabs go to Sponsors (Task pings is switched off).
 */
export function legacyScheduleDestination(query: OrganizerQuery): string {
  const asked = first(query.tab) ?? first(query.view);
  const tab: OrganizerTab =
    asked === "coffee"
      ? "coffee"
      : "sponsors";
  return organizerHomeHref({
    tab,
    sponsor: first(query.sponsor) ?? null,
    rooms: asked === "where",
  });
}

/** The sponsor a ?sponsor= value names: matched by id, else by name. */
export function sponsorNameForParam(
  param: string | null,
  sponsors: readonly { sponsorId: string | null; sponsor: string }[],
): string | null {
  if (!param) return null;
  const key = param.toLowerCase();
  const match =
    sponsors.find((s) => s.sponsorId?.toLowerCase() === key) ??
    sponsors.find((s) => s.sponsor.toLowerCase() === key);
  return match?.sponsor ?? null;
}

// ---------------------------------------------------------------------------
// Per-sponsor summary for the Sponsors tab
// ---------------------------------------------------------------------------

export type SponsorHelpState = "open" | "claimed";

/** One live chat (pending or accepted) in a sponsor's expanded row. */
export type SummaryChat = {
  chatId: string;
  slotTime: string;
  durationMinutes: number;
  room: string | null;
  status: "pending" | "accepted";
  /** Full name when the hacker agreed to share with sponsors, else first. */
  name: string;
  /** GitHub link only for hackers who agreed to share (avatar photo). */
  github: string | null;
};

/** One room block in a sponsor's row. */
export type SummaryHold = HoldSpan & {
  holdId: string;
  needsHacker: boolean;
};

export type SponsorSummary = {
  sponsorId: string;
  name: string;
  /** Every room this sponsor uses: block rooms plus live chats', sorted. */
  rooms: string[];
  /** Chat type from the Coffee Chats sheet row; null without one. */
  /** The chat request in force (source "none" = no request yet). */
  request: ChatRequest;
  watcher: string | null;
  accepted: number;
  /** Requests the hacker can still answer (past the cutoff they expire). */
  pending: number;
  /** Open seats at start times (window and holds) still offerable now. */
  seatsLeft: number;
  /** Room blocks with a slot still needing a hacker. */
  needsHacker: number;
  /** Live chats, earliest first. */
  chats: SummaryChat[];
  holds: SummaryHold[];
  help: {
    id: string;
    status: SponsorHelpState;
    claimedByName: string | null;
    createdAt: string;
  } | null;
  /** Sunday judging room, picks and status; null without a judging read. */
  judging: JudgingRow | null;
  /** When an organizer marked the portal link handed over; null = not. */
  linkGivenAt: string | null;
  /** Saturday: every slot of the sponsor's room blocks, booked/asked. */
  chatSlots: ChatSlotFill[];
  /** Sunday: rounds 1 and 2 and the sponsor's presentation slots. */
  sunday: SundayJudging & { slots: PresentationSlot[] };
};

export type SummaryTotals = {
  accepted: number;
  pending: number;
  seatsLeft: number;
  needsHacker: number;
  /** Help requests nobody has claimed yet. */
  openHelp: number;
  /** Registered sponsors with no judging room yet. */
  missingRooms: number;
};

export type SponsorSummaries = {
  sponsors: SponsorSummary[];
  /** Live help requests across every sponsor (open + claimed). */
  liveHelp: number;
  /** Of those, the ones nobody has claimed yet. */
  openHelp: number;
  /** Room holds across every sponsor with no live chat yet. */
  needsHacker: number;
  /** The totals row, over every sponsor. */
  totals: SummaryTotals;
  /** Sunday judging: rooms, picks and status, incl. unregistered companies. */
  judging: JudgingBoard | null;
  /** Organizers have opened round 2 (top 5). */
  round2Open: boolean;
};

/**
 * The totals row for some sponsors (e.g. the ones a filter shows): chats
 * accepted and waiting, seats left today, holds needing a hacker, and open
 * help requests.
 */
export function summaryTotals(
  rows: readonly (Pick<
    SponsorSummary,
    "accepted" | "pending" | "seatsLeft" | "needsHacker" | "help"
  > &
    Partial<Pick<SponsorSummary, "judging">>)[],
): SummaryTotals {
  return rows.reduce<SummaryTotals>(
    (t, r) => ({
      accepted: t.accepted + r.accepted,
      pending: t.pending + r.pending,
      seatsLeft: t.seatsLeft + r.seatsLeft,
      needsHacker: t.needsHacker + r.needsHacker,
      openHelp: t.openHelp + (r.help?.status === "open" ? 1 : 0),
      missingRooms: t.missingRooms + (r.judging?.missingRoom ? 1 : 0),
    }),
    {
      accepted: 0,
      pending: 0,
      seatsLeft: 0,
      needsHacker: 0,
      openHelp: 0,
      missingRooms: 0,
    },
  );
}

const NO_JUDGING: SundayJudging = {
  shortlistSentAt: null,
  shortlistSentCount: 0,
  scored: 0,
  shortlisted: 0,
  finalSubmittedAt: null,
};

type SetupRow = SetupLike & {
  sponsor: string;
  room: string | null;
};

function savedOf(s: {
  coffeeChatStyle?: string | null;
  coffeeChatPerSlot?: number | null;
}): SavedChatRequest {
  return {
    style: s.coffeeChatStyle ?? null,
    perSlot: s.coffeeChatPerSlot ?? null,
  };
}

/** Seats still offerable today: same rules as offering a chat. */
function seatsLeftToday(
  sponsorId: string,
  request: ChatRequest,
  limits: readonly SlotLimit[],
  holds: readonly HoldSpan[],
  live: { slotTime: string; durationMinutes: number }[],
  now: Date,
): number {
  const { durationMinutes } = request;
  const times = new Set(
    holds.flatMap((h) => holdStartTimes(h, durationMinutes)),
  );
  return [...times]
    .filter((t) => now < chatExpiresAt({ slotTime: t }))
    .reduce(
      (sum, slotTime) =>
        sum +
        seatsLeft(
          live,
          { slotTime, durationMinutes },
          askedAt(request, limits, sponsorId, slotTime).asked,
        ),
      0,
    );
}

/**
 * One row per registered sponsor with its coffee chat room(s), chat type,
 * reps and watcher, accepted and pending chats (with hackers), seats left,
 * room holds (and how many still need a hacker) and its live help request
 * (oldest if somehow more than one). Rows from unknown sponsors are
 * ignored. Organizer-only data: hacker names follow the share consent.
 */
export function buildSponsorSummaries({
  sponsors,
  setups,
  chats,
  help,
  holds = [],
  limits = [],
  judging = null,
  sunday = new Map(),
  presentations = [],
  round2Open = false,
  now,
}: {
  sponsors: readonly {
    id: string;
    name: string;
    coffeeChatStyle?: string | null;
    coffeeChatPerSlot?: number | null;
    coffeeChatWatcher?: string | null;
    portalLinkGivenAt?: Date | null;
  }[];
  /** Coffee Chats sheet rows by sponsor name ([] when the sheet failed). */
  setups: readonly SetupRow[];
  chats: readonly {
    chatId?: string;
    sponsorId: string;
    room: string | null;
    slotTime: string;
    /** Defaults to 15 (older callers). */
    durationMinutes?: number;
    status: CoffeeChatStatus;
    firstName?: string | null;
    lastName?: string | null;
    share?: boolean | null;
    github?: string | null;
  }[];
  help: readonly {
    id: string;
    sponsorId: string;
    status: string;
    claimedByName: string | null;
    createdAt: Date;
  }[];
  /** Organizer room holds (every sponsor). */
  holds?: readonly (HoldSpan & { holdId?: string })[];
  /** Sponsors' asks for fewer hackers (every sponsor). */
  limits?: readonly SlotLimit[];
  /** Sunday judging board (buildJudgingBoard); null when not read. */
  judging?: JudgingBoard | null;
  /** Sunday portal progress per sponsor id (reviews, sends, top 5). */
  sunday?: ReadonlyMap<string, SundayJudging>;
  /** Placed presentation slots (every sponsor). */
  presentations?: readonly (PresentationSlot & { sponsorId: string })[];
  round2Open?: boolean;
  now: Date;
}): SponsorSummaries {
  const byId = new Map<string, SponsorSummary>();
  for (const s of sponsors) {
    const setup = setups.find((c) => c.sponsor === s.name);
    byId.set(s.id, {
      sponsorId: s.id,
      name: s.name,
      rooms: [],
      request: chatRequestOf(setup, savedOf(s)),
      watcher: s.coffeeChatWatcher ?? null,
      accepted: 0,
      pending: 0,
      seatsLeft: 0,
      needsHacker: 0,
      chats: [],
      holds: [],
      help: null,
      judging: judging?.rows.find((r) => r.sponsorId === s.id) ?? null,
      linkGivenAt: s.portalLinkGivenAt?.toISOString() ?? null,
      chatSlots: [],
      sunday: {
        ...(sunday.get(s.id) ?? NO_JUDGING),
        slots: presentations
          .filter((p) => p.sponsorId === s.id)
          .map(({ room, start, teamName }) => ({ room, start, teamName }))
          .sort((a, b) => a.start - b.start),
      },
    });
  }
  // Earliest chats first.
  const ordered = [...chats].sort((a, b) =>
    a.slotTime.localeCompare(b.slotTime),
  );
  const live: {
    sponsorId: string;
    slotTime: string;
    durationMinutes: number;
  }[] = [];
  for (const chat of ordered) {
    const row = byId.get(chat.sponsorId);
    if (!row) continue;
    const status = effectiveCoffeeChatStatus(chat, now);
    if (status === "accepted") row.accepted += 1;
    else if (status === "pending") row.pending += 1;
    else continue;
    const durationMinutes = chat.durationMinutes ?? 15;
    live.push({
      sponsorId: chat.sponsorId,
      slotTime: chat.slotTime,
      durationMinutes,
    });
    const first = chat.firstName?.trim() ?? "";
    const full = [first, chat.lastName?.trim() ?? ""].filter(Boolean).join(" ");
    row.chats.push({
      chatId: chat.chatId ?? `${chat.sponsorId}-${chat.slotTime}`,
      slotTime: chat.slotTime,
      durationMinutes,
      room: chat.room,
      status,
      name: chat.share ? full || first : first,
      github: chat.share ? (chat.github ?? null) : null,
    });
  }
  // A block needs a hacker while a slot (before its cutoff) is short of
  // the hackers its chat type needs.
  let needsHacker = 0;
  const sortedHolds = [...holds].sort((a, b) =>
    a.startTime.localeCompare(b.startTime),
  );
  for (const hold of sortedHolds) {
    const row = byId.get(hold.sponsorId);
    if (!row) continue;
    const needs =
      blockFill(hold, row.request, live, limits, now).firstOpen !== null;
    row.holds.push({
      holdId: hold.holdId ?? `${hold.sponsorId}-${hold.startTime}`,
      sponsorId: hold.sponsorId,
      room: hold.room,
      startTime: hold.startTime,
      endTime: hold.endTime,
      needsHacker: needs,
    });
    for (const slot of blockSlots(hold, row.request, live, limits)) {
      row.chatSlots.push({
        room: hold.room,
        slotTime: slot.slotTime,
        booked: slot.booked,
        needed: slot.needed,
      });
    }
    if (!needs) continue;
    row.needsHacker += 1;
    needsHacker += 1;
  }
  for (const row of byId.values()) {
    row.rooms = [
      ...new Set([
        ...row.holds.map((h) => h.room),
        ...row.chats.flatMap((c) => (c.room ? [c.room] : [])),
      ]),
    ].sort();
    row.seatsLeft = seatsLeftToday(
      row.sponsorId,
      row.request,
      limits,
      row.holds,
      live.filter((c) => c.sponsorId === row.sponsorId),
      now,
    );
  }
  let liveHelp = 0;
  let openHelp = 0;
  const liveRequests = help
    .filter(
      (h): h is typeof h & { status: SponsorHelpState } =>
        h.status === "open" || h.status === "claimed",
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const h of liveRequests) {
    const row = byId.get(h.sponsorId);
    if (!row) continue;
    liveHelp += 1;
    if (h.status === "open") openHelp += 1;
    row.help ??= {
      id: h.id,
      status: h.status,
      claimedByName: h.claimedByName,
      createdAt: h.createdAt.toISOString(),
    };
  }
  const rows = [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  return {
    sponsors: rows,
    liveHelp,
    openHelp,
    needsHacker,
    totals: summaryTotals(rows),
    judging,
    round2Open,
  };
}

// ---------------------------------------------------------------------------
// My sponsors: the sponsors the signed-in organizer leads
// ---------------------------------------------------------------------------

/** Lowercased, invisible characters and extra spaces removed. */
function normalName(value: string): string {
  return value
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * The signed-in organizer as one HW Contacts row: `row` is the row's index
 * in the HW Contacts list (its identity, so two people with the same name
 * stay apart), `name` is what the page shows.
 */
export type OrganizerContact = { row: number; name: string; ownName?: string };

/**
 * The row whose view this HW Contacts row gets: the one person its "Same
 * view as" cell names (decisions 2026-11-19, "Jazz sees Noah's view"), or
 * the row itself. One level only: the named person's own "Same view as" is
 * ignored, so there are no chains. A blank cell, an unknown name, or a cell
 * that fits several rows keeps the row's own view.
 */
export function viewRowOf(
  row: number,
  contacts: readonly { name: string; sameViewAs?: string }[],
): number {
  const cell = contacts[row]?.sameViewAs?.trim();
  if (!cell) return row;
  const hits = contactRowsNamed(
    cell,
    contacts.map((c) => c.name),
  );
  return hits.size === 1 ? [...hits][0]! : row;
}

/**
 * The HW Contacts row whose "Login email" is the signed-in organizer's
 * email (case-insensitive, spaces ignored), after "Same view as"
 * (viewRowOf): someone with Noah's view gets Noah's row and name, so the
 * page is the one Noah sees. Null when nobody matches, so the page shows
 * All sponsors only (decisions 2026-11-19).
 */
export function organizerForEmail(
  email: string | null | undefined,
  contacts: readonly { name: string; loginEmail: string; sameViewAs?: string }[],
): OrganizerContact | null {
  const want = (email ?? "").trim().toLowerCase();
  if (!want) return null;
  const own = contacts.findIndex(
    (c) => c.loginEmail.trim().toLowerCase() === want && c.name.trim(),
  );
  if (own === -1) return null;
  const row = viewRowOf(own, contacts);
  const name = contacts[row]!.name.trim();
  const ownName = contacts[own]!.name.trim();
  // ownName differs only when "Same view as" borrowed someone else's view.
  return row === own ? { row, name } : { row, name, ownName };
}

/**
 * The HW Contacts rows a person cell names (Sponsor Day-Of's "HW lead", or
 * a run-of-show task's Owner). The cell can hold several people ("Noah /
 * Daniel"), team tags ("[SPON] Noah") and sometimes only a first name.
 * - A full name names the one row with that full name.
 * - A single word names the one row with that first name. When several rows
 *   share it, it falls back to a row whose whole name is that word.
 * Anything that fits more than one row names nobody, so an organizer never
 * sees a sponsor or task that may be someone else's.
 */
export function contactRowsNamed(
  cell: string | null | undefined,
  contactNames: readonly string[],
): Set<number> {
  const names = contactNames.map(normalName);
  const rows = new Set<number>();
  const only = (hits: number[]) => {
    if (hits.length !== 1) return false;
    rows.add(hits[0]!);
    return true;
  };
  const people = normalName((cell ?? "").replace(/\[[^\]]*\]/g, " "))
    .split(/\s*(?:,|\/|&|\+|;|and)\s*/)
    .map((p) => p.trim())
    .filter((p) => p && p !== "—" && p !== "-");
  for (const p of people) {
    const full = names.flatMap((n, i) => (n === p ? [i] : []));
    if (p.includes(" ")) {
      only(full);
      continue;
    }
    const byFirst = names.flatMap((n, i) => (n.split(" ")[0] === p ? [i] : []));
    if (!only(byFirst)) only(full);
  }
  return rows;
}

/** Whether Sponsor Day-Of's "HW lead" cell names this organizer's row. */
export function leadsSponsor(
  hwLead: string,
  me: OrganizerContact,
  contactNames: readonly string[],
): boolean {
  return contactRowsNamed(hwLead, contactNames).has(me.row);
}

/**
 * The two statuses an organizer sets by hand on My sponsors, as tap-to-
 * advance pills. Both are read from and written to the one sheet status
 * (SPONSOR_STATUS_VALUES): Arrival is anything past "Not arrived"; Booth is
 * "Booth set up" or later. Setting the booth up also marks them arrived;
 * undoing arrival also undoes the booth.
 */
export type StatusPill = "arrival" | "booth";

const BOOTH_DONE = new Set(["Booth set up", "Workshop live", "Left"]);

export function pillDone(pill: StatusPill, status: string): boolean {
  return pill === "arrival" ? status !== "Not arrived" : BOOTH_DONE.has(status);
}

/** The sheet status a tap (advance) or undo on a pill writes. */
export function statusAfterPill(
  pill: StatusPill,
  action: "advance" | "undo",
): "Not arrived" | "Checked in" | "Booth set up" {
  if (pill === "arrival") {
    return action === "advance" ? "Checked in" : "Not arrived";
  }
  return action === "advance" ? "Booth set up" : "Checked in";
}

/** A coffee chat rep, as My sponsors' People table needs it. */
export type SponsorRep = {
  id: string;
  name: string;
  phone: string;
  isPrimary: boolean;
  position: number;
};

/** Primary contact first (the crown), then the order the sponsor gave. */
export function orderReps<T extends SponsorRep>(reps: readonly T[]): T[] {
  return [...reps].sort(
    (a, b) =>
      Number(b.isPrimary) - Number(a.isPrimary) ||
      a.position - b.position ||
      a.name.localeCompare(b.name),
  );
}

/** One sponsor's coffee chat progress on My sponsors. */
export type MySponsorChats = {
  /** When the sponsor submitted chatting preferences; null = not yet. */
  prefsSubmittedAt: string | null;
  shortlistSubmittedAt: string | null;
  /** Reps who want at least one chat. */
  repsChatting: number;
  /** Of those, reps with at least one session on the board. */
  repsPlaced: number;
  /** Some placement was sent (Save & confirm schedule). */
  scheduleSent: boolean;
  /** Preferences saved again after the last Send. */
  changedAfterSend: boolean;
  /** Session invites out (placement-linked coffee chats), and accepted. */
  invites: number;
  accepted: number;
};

/** Counts for the Coffee chats block, from the session tables. */
export function mySponsorChats({
  pref,
  reps,
  placements,
  invites,
}: {
  pref: {
    submittedAt: Date | null;
    shortlistSubmittedAt: Date | null;
    updatedAt?: Date | null;
  } | null;
  reps: readonly { id: string; chatsWanted: number }[];
  placements: readonly {
    repId: string;
    status: "draft" | "sent";
    sentAt?: Date | null;
  }[];
  invites: readonly { status: string }[];
}): MySponsorChats {
  const chatting = reps.filter((r) => r.chatsWanted > 0);
  const placed = new Set(placements.map((p) => p.repId));
  const lastSent = placements.reduce<number | null>((m, p) => {
    const t = p.status === "sent" ? (p.sentAt?.getTime() ?? null) : null;
    return t === null ? m : Math.max(m ?? t, t);
  }, null);
  const updated = pref?.updatedAt?.getTime() ?? null;
  // "Changed after Send" relies on coffee_chat_pref.updated_at being bumped
  // explicitly by the sponsor-side writers on preference and rep edits.
  // There's deliberately no $onUpdate on the column: a shortlist submit
  // writes the row too and must NOT count as a change after Send.
  return {
    prefsSubmittedAt: pref?.submittedAt?.toISOString() ?? null,
    shortlistSubmittedAt: pref?.shortlistSubmittedAt?.toISOString() ?? null,
    repsChatting: chatting.length,
    repsPlaced: chatting.filter((r) => placed.has(r.id)).length,
    scheduleSent: placements.some((p) => p.status === "sent"),
    changedAfterSend:
      lastSent !== null && updated !== null && updated > lastSent,
    invites: invites.filter((i) => ["pending", "accepted"].includes(i.status))
      .length,
    accepted: invites.filter((i) => i.status === "accepted").length,
  };
}

// ---------------------------------------------------------------------------
// Needs attention now: what an organizer arriving cold should act on first
// ---------------------------------------------------------------------------

/** `mine`: the signed-in organizer's own sponsor or task. */
export type AttentionItem = { mine: boolean } & (
  | { kind: "no-prefs"; sponsorId: string; sponsor: string }
  | {
      kind: "not-scheduled";
      sponsorId: string;
      sponsor: string;
      placed: number;
      reps: number;
    }
  | { kind: "changed"; sponsorId: string; sponsor: string }
  | {
      kind: "overdue-task";
      key: string;
      day: RunOfShowTaskLike["day"];
      start: string;
      task: string;
      owner: string | null;
    }
);

type RunOfShowTaskLike = {
  day: "Friday" | "Saturday" | "Sunday";
  start: string;
  task: string;
  owner: string | null;
};

/** How long after its window a task still shows as overdue. */
export const OVERDUE_TASK_WINDOW_MINUTES = 60;
/** At most this many overdue tasks in the list (own first, newest first). */
export const OVERDUE_TASK_CAP = 3;

/**
 * "Needs attention now", from data the dashboard already has: sponsors who
 * haven't submitted coffee chat preferences, who submitted but aren't fully
 * scheduled, who changed preferences after Send, and run-of-show tasks whose
 * time just passed (shown only: nothing pings and nothing is marked done, so
 * a task counts as overdue for an hour after its 30-minute window).
 *
 * Every sponsor's items show, the organizer's own sponsors first (decisions
 * 2026-11-19, "Needs attention scope"). Within each group: changed after
 * Send, then not scheduled, then no preferences. Then tasks: the organizer's
 * own first, then others, newest first, at most OVERDUE_TASK_CAP in all.
 * Empty = "All clear".
 */
export function needsAttention({
  sponsors,
  tasks,
  now,
  taskStart,
  taskMinutes,
  isMine = () => false,
  isMyTask = () => false,
}: {
  sponsors: readonly {
    sponsorId: string;
    name: string;
    chats: Pick<
      MySponsorChats,
      "prefsSubmittedAt" | "repsChatting" | "repsPlaced" | "changedAfterSend"
    >;
  }[];
  tasks: readonly RunOfShowTaskLike[];
  now: Date;
  /** The task's start as an instant (runOfShowInstant). */
  taskStart: (t: RunOfShowTaskLike) => Date;
  /** How long a task counts as "on" (TASK_MINUTES). */
  taskMinutes: number;
  /** Whether the signed-in organizer leads this sponsor. */
  isMine?: (sponsorId: string) => boolean;
  /** Whether a task's Owner cell names the signed-in organizer. */
  isMyTask?: (owner: string | null) => boolean;
}): AttentionItem[] {
  const byName = [...sponsors].sort((a, b) => a.name.localeCompare(b.name));
  const sponsorItems = (mine: boolean): AttentionItem[] => {
    const changed: AttentionItem[] = [];
    const unscheduled: AttentionItem[] = [];
    const noPrefs: AttentionItem[] = [];
    for (const s of byName) {
      if (isMine(s.sponsorId) !== mine) continue;
      // Digital sponsors (PCBWay) don't do coffee chats: only judging.
      if (isDigitalJudging(s.name)) continue;
      const c = s.chats;
      const base = { mine, sponsorId: s.sponsorId, sponsor: s.name };
      if (!c.prefsSubmittedAt) {
        noPrefs.push({ kind: "no-prefs", ...base });
        continue;
      }
      if (c.changedAfterSend) changed.push({ kind: "changed", ...base });
      else if (c.repsChatting > 0 && c.repsPlaced < c.repsChatting) {
        unscheduled.push({
          kind: "not-scheduled",
          ...base,
          placed: c.repsPlaced,
          reps: c.repsChatting,
        });
      }
    }
    return [...changed, ...unscheduled, ...noPrefs];
  };
  const t = now.getTime();
  const overdue = tasks
    .map((k) => ({
      k,
      mine: isMyTask(k.owner),
      end: taskStart(k).getTime() + taskMinutes * 60_000,
    }))
    .filter(
      ({ end }) => end <= t && t - end < OVERDUE_TASK_WINDOW_MINUTES * 60_000,
    )
    .sort(
      (a, b) =>
        Number(b.mine) - Number(a.mine) ||
        b.end - a.end ||
        a.k.task.localeCompare(b.k.task),
    )
    .slice(0, OVERDUE_TASK_CAP)
    .map(
      ({ k, mine }): AttentionItem => ({
        kind: "overdue-task",
        mine,
        key: `${k.day}-${k.start}-${k.task}`,
        day: k.day,
        start: k.start,
        task: k.task,
        owner: k.owner,
      }),
    );
  return [...sponsorItems(true), ...sponsorItems(false), ...overdue];
}
