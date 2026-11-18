// The organizer sponsor home (/internal/sponsors): which tab a URL opens,
// the links between tabs and sponsor rows, the old /internal/sponsor-schedule
// redirect, and the per-sponsor chat and help summary. Pure, so it's tested
// without a router or a database.

import {
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";

export const ORGANIZER_HOME_PATH = "/internal/sponsors";

export const ORGANIZER_TABS = [
  "sponsors",
  "schedule",
  "coffee",
  "help",
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
 * Anything unknown opens Sponsors.
 */
export function parseOrganizerLocation(
  query: OrganizerQuery,
  hash = "",
): OrganizerLocation {
  const asked = first(query.tab) ?? first(query.view);
  const rooms = asked === "where" || hash === "#rooms";
  const tab: OrganizerTab = rooms
    ? "schedule"
    : ORGANIZER_TABS.includes(asked as OrganizerTab)
      ? (asked as OrganizerTab)
      : "sponsors";
  const sponsor = first(query.sponsor)?.trim();
  return { tab, jumpToRooms: rooms, sponsor: sponsor ? sponsor : null };
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
 * across the redirect, and ?tab=where becomes #rooms explicitly.
 */
export function legacyScheduleDestination(query: OrganizerQuery): string {
  const asked = first(query.tab) ?? first(query.view);
  const tab: OrganizerTab =
    asked === "coffee" || asked === "help" ? asked : "schedule";
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

export type SponsorSummary = {
  sponsorId: string;
  name: string;
  /** Coffee chat room: assignment, else the sheet's ROOM, else a chat's. */
  room: string | null;
  accepted: number;
  /** Requests the hacker can still answer (past the cutoff they expire). */
  pending: number;
  help: {
    id: string;
    status: SponsorHelpState;
    claimedByName: string | null;
    createdAt: string;
  } | null;
};

export type SponsorSummaries = {
  sponsors: SponsorSummary[];
  /** Live help requests across every sponsor (open + claimed). */
  liveHelp: number;
  /** Of those, the ones nobody has claimed yet. */
  openHelp: number;
};

/**
 * One row per registered sponsor with its coffee chat room, accepted and
 * pending chat counts, and its live help request (oldest if somehow more
 * than one). Rows from unknown sponsors are ignored.
 */
export function buildSponsorSummaries({
  sponsors,
  setups,
  chats,
  help,
  now,
}: {
  sponsors: readonly {
    id: string;
    name: string;
    coffeeChatRoom: string | null;
  }[];
  /** Coffee Chats sheet rows by sponsor name ([] when the sheet failed). */
  setups: readonly { sponsor: string; room: string | null }[];
  chats: readonly {
    sponsorId: string;
    room: string | null;
    slotTime: string;
    status: CoffeeChatStatus;
  }[];
  help: readonly {
    id: string;
    sponsorId: string;
    status: string;
    claimedByName: string | null;
    createdAt: Date;
  }[];
  now: Date;
}): SponsorSummaries {
  const byId = new Map<string, SponsorSummary>();
  for (const s of sponsors) {
    const sheetRoom = setups.find((c) => c.sponsor === s.name)?.room ?? null;
    byId.set(s.id, {
      sponsorId: s.id,
      name: s.name,
      room: s.coffeeChatRoom ?? sheetRoom,
      accepted: 0,
      pending: 0,
      help: null,
    });
  }
  // Earliest chats first, so the fallback room is the first one booked.
  const ordered = [...chats].sort((a, b) =>
    a.slotTime.localeCompare(b.slotTime),
  );
  for (const chat of ordered) {
    const row = byId.get(chat.sponsorId);
    if (!row) continue;
    const status = effectiveCoffeeChatStatus(chat, now);
    if (status === "accepted") row.accepted += 1;
    else if (status === "pending") row.pending += 1;
    else continue;
    row.room ??= chat.room;
  }
  let liveHelp = 0;
  let openHelp = 0;
  const live = help
    .filter(
      (h): h is typeof h & { status: SponsorHelpState } =>
        h.status === "open" || h.status === "claimed",
    )
    .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  for (const h of live) {
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
  return {
    sponsors: [...byId.values()].sort((a, b) => a.name.localeCompare(b.name)),
    liveHelp,
    openHelp,
  };
}
