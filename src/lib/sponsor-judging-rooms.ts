/**
 * Sponsor track judging (Sunday) for organizers: each sponsor's judging
 * room, where it came from, and whether the sponsor is ready to judge.
 * Pure and dependency-light, so it's unit tested and client-safe.
 *
 * Rooms come from two places, never invented (docs/decisions.md,
 * 2026-11-18): Lucas's sponsor info sheet ("Room" column, the room the
 * sponsor page shows) wins over the run-of-show judging item's
 * "Name: Rm" list. Companies named in that list that aren't registered
 * sponsors (e.g. QNX) are kept and marked. Organizer-only: this lists
 * every company's room.
 */
import {
  compareRunOfShow,
  labelledLocations,
  type RunOfShowDay,
  type RunOfShowItem,
} from "~/lib/run-of-show";
import { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS } from "~/lib/sponsor-picks";
import { isJudgingTitle } from "~/lib/sponsor-timeline";

export { MAX_SPONSOR_PICKS, MIN_SPONSOR_PICKS };

/** Where a room came from; "judging-board" = set by an organizer there. */
export type JudgingRoomSource = "judging-board" | "sponsor-sheet" | "run-of-show";

export type JudgingStatus =
  | "ready"
  | "missing-room"
  /** No room found, but a sheet that could name one couldn't be read. */
  | "room-unknown"
  | "too-few-picks"
  /** The judging sheet couldn't be read, so picks are unknown. */
  | "picks-unknown"
  | "not-registered";

export type JudgingRow = {
  name: string;
  /** Registered sponsor id; null for companies only named in the sheet. */
  sponsorId: string | null;
  registered: boolean;
  room: string | null;
  source: JudgingRoomSource | null;
  /**
   * The run-of-show room when the sponsor sheet names a different one, so
   * organizers can fix the sheet that's out of step. Null otherwise.
   */
  otherRoom: string | null;
  /** Chosen teams; null when unknown (sheet down, or not registered). */
  picks: number | null;
  missingRoom: boolean;
  tooFewPicks: boolean;
  status: JudgingStatus;
};

export type JudgingSlot = {
  day: RunOfShowDay;
  start: string;
  end: string;
  title: string;
};

export type JudgingBoard = {
  /** The run-of-show judging item; null when the sheet has none. */
  slot: JudgingSlot | null;
  /** The day judging falls on: the item's day, else Sunday. */
  day: RunOfShowDay;
  /** Registered sponsors by name, then companies not registered. */
  rows: JudgingRow[];
  /** False when Lucas's judging sheet couldn't be read. */
  sheetRead: boolean;
  /** False when the run-of-show sheet couldn't be read. */
  runOfShowRead: boolean;
  counts: JudgingCounts;
};

export type JudgingCounts = {
  /** Registered sponsors. */
  sponsors: number;
  withRoom: number;
  enoughPicks: number;
  missingRooms: number;
};

/**
 * How many teams a sponsor has picked, or null when unknown. The one place
 * picks are read for the judging view, so another source (e.g. a ranked
 * shortlist) can replace the judging sheet's chosen teams later.
 */
export type PickCount = (sponsorName: string) => number | null;

/**
 * Picks from the judging sheet's chosen team ids (name -> ids). A sponsor
 * with no row in the sheet is unknown (null), not 0.
 */
export function pickCountFromChosenTeams(
  chosen: ReadonlyMap<string, readonly string[]>,
): PickCount {
  const byName = new Map(
    [...chosen].map(([name, ids]) => [norm(name), ids.length]),
  );
  return (name) => byName.get(norm(name)) ?? null;
}

/** When the sheet has no judging item to date it. */
export const JUDGING_DEFAULT_DAY: RunOfShowDay = "Sunday";

const norm = (v: string) => v.toLowerCase().replace(/\s+/g, "");

/**
 * The sponsor track judging block: a judging item whose title names
 * sponsors ("Sponsor Track Judging") first, else any judging item;
 * earliest wins.
 */
export function judgingItem(
  items: readonly RunOfShowItem[],
): RunOfShowItem | null {
  const judging = items
    .filter((i) => isJudgingTitle(i.title))
    .sort(compareRunOfShow);
  return judging.find((i) => /sponsor/i.test(i.title)) ?? judging[0] ?? null;
}

/** Lucas's sheet uses "TBD" (and blanks) for no room. */
function sheetRoomOrNull(room: string | null | undefined): string | null {
  const trimmed = room?.trim() ?? "";
  return trimmed && trimmed.toUpperCase() !== "TBD" ? trimmed : null;
}

/** A registered sponsor's judging status; problems before readiness. */
export function judgingStatus({
  registered,
  room,
  picks,
  roomKnown = true,
}: {
  registered: boolean;
  room: string | null;
  picks: number | null;
  /** False when a room source couldn't be read (no room = unknown). */
  roomKnown?: boolean;
}): JudgingStatus {
  if (!registered) return "not-registered";
  if (!room) return roomKnown ? "missing-room" : "room-unknown";
  if (picks === null) return "picks-unknown";
  if (picks < MIN_SPONSOR_PICKS) return "too-few-picks";
  return "ready";
}

export function judgingCounts(rows: readonly JudgingRow[]): JudgingCounts {
  const registered = rows.filter((r) => r.registered);
  return {
    sponsors: registered.length,
    withRoom: registered.filter((r) => r.room).length,
    enoughPicks: registered.filter(
      (r) => r.picks !== null && r.picks >= MIN_SPONSOR_PICKS,
    ).length,
    missingRooms: registered.filter((r) => r.missingRoom).length,
  };
}

/**
 * One row per registered sponsor (room, source, picks, status), plus one
 * per company the run-of-show list names that isn't registered. `sheet` is
 * Lucas's judging spreadsheet read: rooms by sponsor name (case-insensitive,
 * "TBD" = none) and the pick count; null when it couldn't be read.
 * `runOfShowRead` false = `items` is empty because the run-of-show sheet
 * failed. A sponsor with no room is "missing" only when both sources were
 * read; otherwise its room is unknown. `boardRooms` (by sponsor id) are
 * rooms organizers set on the Judging board; they win over both sheets.
 */
export function buildJudgingBoard({
  sponsors,
  items,
  runOfShowRead = true,
  sheet,
  boardRooms,
}: {
  boardRooms?: ReadonlyMap<string, string>;
  sponsors: readonly { id: string; name: string }[];
  items: readonly RunOfShowItem[];
  runOfShowRead?: boolean;
  sheet: {
    rooms: ReadonlyMap<string, string>;
    pickCount: PickCount;
  } | null;
}): JudgingBoard {
  const item = judgingItem(items);
  const listed = item?.location ? labelledLocations(item.location) : [];
  const listedRoom = (name: string) =>
    listed.find((l) => norm(l.name) === norm(name))?.room ?? null;
  const sheetRooms = sheet
    ? new Map([...sheet.rooms].map(([k, v]) => [norm(k), v]))
    : null;
  const roomKnown = sheet !== null && runOfShowRead;

  const registered: JudgingRow[] = [...sponsors]
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((s) => {
      const fromSheet = sheetRoomOrNull(sheetRooms?.get(norm(s.name)));
      const fromList = listedRoom(s.name);
      const fromBoard = boardRooms?.get(s.id) ?? null;
      const room = fromBoard ?? fromSheet ?? fromList;
      const picks = sheet ? sheet.pickCount(s.name) : null;
      return {
        name: s.name,
        sponsorId: s.id,
        registered: true,
        room,
        source: fromBoard
          ? "judging-board"
          : fromSheet
            ? "sponsor-sheet"
            : fromList
              ? "run-of-show"
              : null,
        otherRoom:
          !fromBoard &&
          fromSheet &&
          fromList &&
          norm(fromSheet) !== norm(fromList)
            ? fromList
            : null,
        picks,
        missingRoom: !room && roomKnown,
        tooFewPicks: picks !== null && picks < MIN_SPONSOR_PICKS,
        status: judgingStatus({ registered: true, room, picks, roomKnown }),
      };
    });

  const known = new Set(sponsors.map((s) => norm(s.name)));
  const seen = new Set<string>();
  const unregistered: JudgingRow[] = [];
  for (const l of listed) {
    const key = norm(l.name);
    if (known.has(key) || seen.has(key)) continue;
    seen.add(key);
    unregistered.push({
      name: l.name,
      sponsorId: null,
      registered: false,
      room: l.room,
      source: "run-of-show",
      otherRoom: null,
      picks: null,
      missingRoom: false,
      tooFewPicks: false,
      status: "not-registered",
    });
  }
  unregistered.sort((a, b) => a.name.localeCompare(b.name));

  const rows = [...registered, ...unregistered];
  return {
    slot: item
      ? { day: item.day, start: item.start, end: item.end, title: item.title }
      : null,
    day: item?.day ?? JUDGING_DEFAULT_DAY,
    rows,
    sheetRead: sheet !== null,
    runOfShowRead,
    counts: judgingCounts(rows),
  };
}
