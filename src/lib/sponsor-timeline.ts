/**
 * The sponsor schedule timeline: the sponsor's own run-of-show items laid
 * over the hackathon's public schedule (the one /live shows, from
 * /api/schedule). Pure functions only, so they're unit tested.
 */
import {
  formatClock,
  type RunOfShowColumn,
  type RunOfShowDay,
  type RunOfShowItem,
  type RunOfShowTask,
} from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { getTimeInMinutes } from "~/lib/schedule";
import type { DaySchedule, ParsedScheduleEvent } from "~/types/schedule";

/** /live's columns, in its order, with the colour group it uses for each. */
export const LIVE_COLUMNS = [
  { key: "bigEvent", category: "main" },
  { key: "sponsorWorkshop", category: "sponsor" },
  { key: "otherWorkshop", category: "workshop" },
  { key: "activities1", category: "activity" },
  { key: "activities2", category: "activity" },
  { key: "food", category: "food" },
  { key: "sponsorBooth", category: "booth" },
  { key: "scavengerHunt", category: "scavenger" },
  { key: "other", category: "other" },
  { key: "other2", category: "other" },
  { key: "other3", category: "other" },
] as const satisfies readonly {
  key: Exclude<keyof ParsedScheduleEvent, "time">;
  category: string;
}[];
export type LiveCategory = (typeof LIVE_COLUMNS)[number]["category"];

export type TimelineEntry = {
  id: string;
  /**
   * "yours": a run-of-show item shown full strength (the sponsor's own, or
   * every item in the organizer view). "hackathon": everyone's event, muted.
   * "task": a team task (organizer view only).
   */
  kind: "yours" | "hackathon" | "task";
  category: RunOfShowColumn | LiveCategory | "task" | "coffee-chat";
  title: string;
  location: string | null;
  /** Minutes after the day's midnight (Eastern). Past 1440 = after midnight. */
  start: number;
  end: number;
  /** The run-of-show item behind a "yours" entry. */
  item?: RunOfShowItem;
  /** The team task behind a "task" entry (organizer view only). */
  task?: RunOfShowTask;
  /** Booked coffee chats behind a "coffee-chat" entry (from the DB). */
  booking?: CoffeeChatBooking;
};

/** One sponsor's booked coffee chats at one start, in one room. */
export type CoffeeChatBooking = {
  sponsorName: string;
  /** Normalized room, or null while unassigned. */
  room: string | null;
  slotTime: string;
  chats: { chatId: string; hacker: string; status: string }[];
};

/** Run-of-show columns every sponsor gets whoever they are. */
const ALL_HANDS = new Set<RunOfShowColumn>(["big-event", "food"]);

const SLOT = 30;

function hhmmToMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

/** 870 -> "2:30 PM"; 1470 -> "12:30 AM". */
export function formatMinutes(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  return formatClock(
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`,
  );
}

/** Minutes since `day`'s midnight (Eastern) at `now`. */
export function minutesIntoDay(day: RunOfShowDay, now: Date): number {
  return (now.getTime() - runOfShowInstant(day, "00:00").getTime()) / 60_000;
}

/**
 * One /live day as blocks: consecutive rows with the same cell text in a
 * column are one event (the sheet merges them), ending at the next row's
 * time. The same event spread over several columns is kept once.
 */
export function liveDayEntries(day: DaySchedule | undefined): TimelineEntry[] {
  if (!day) return [];
  const rows = day.events.filter((e) => e.time);
  // Times only go forward; a row earlier than the last one is after midnight.
  let offset = 0;
  let last = -1;
  const minutes = rows.map((row) => {
    let m = getTimeInMinutes(row.time) + offset;
    if (m < last) {
      offset += 1440;
      m += 1440;
    }
    last = m;
    return m;
  });
  const endOf = (i: number) => minutes[i + 1] ?? minutes[i]! + SLOT;

  const entries: TimelineEntry[] = [];
  const seen = new Set<string>();
  for (const { key, category } of LIVE_COLUMNS) {
    for (let i = 0; i < rows.length; i++) {
      const cell = rows[i]![key];
      const title = cell?.title.trim();
      if (!title || rows[i - 1]?.[key]?.title.trim() === title) continue;
      let j = i;
      while (rows[j + 1]?.[key]?.title.trim() === title) j++;
      const start = minutes[i]!;
      const dedupeKey = `${start}|${normalizeTitle(title)}`;
      if (seen.has(dedupeKey)) continue;
      seen.add(dedupeKey);
      entries.push({
        id: `live-${day.day}-${start}-${key}`,
        kind: "hackathon",
        category,
        title,
        location: cell?.location.trim() ? cell.location.trim() : null,
        start,
        end: endOf(j),
      });
    }
  }
  return entries;
}

function normalizeTitle(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Same event in both sources: overlapping times and matching titles. */
export function isSameEvent(
  a: Pick<TimelineEntry, "title" | "start" | "end">,
  b: Pick<TimelineEntry, "title" | "start" | "end">,
): boolean {
  if (!(a.start < b.end && b.start < a.end)) return false;
  const x = normalizeTitle(a.title);
  const y = normalizeTitle(b.title);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length < y.length ? [x, y] : [y, x];
  return short.length >= 4 && long.includes(short);
}

/**
 * Hackathon-wide events that show even with "Show hackathon events" off:
 * meals (sponsors eat too) and the opening and closing ceremonies.
 */
export function isAlwaysShown(
  entry: Pick<TimelineEntry, "category" | "title">,
): boolean {
  return entry.category === "food" || /ceremon/i.test(entry.title);
}

/** A run-of-show item is the sponsor's own unless it's an all-hands event. */
export function isOwnItem(item: RunOfShowItem, sponsorName: string): boolean {
  return item.sponsors.includes(sponsorName) || !ALL_HANDS.has(item.column);
}

function fromRunOfShow(
  item: RunOfShowItem,
  kind: TimelineEntry["kind"],
): TimelineEntry {
  return {
    id: item.id,
    kind,
    category: item.column,
    title: item.title,
    location: item.location,
    start: hhmmToMinutes(item.start),
    end: hhmmToMinutes(item.end),
    item,
  };
}

/**
 * One day of the sponsor timeline. The sponsor's items are always shown.
 * Hackathon events come from /live; an event in both sources is shown once:
 * as the sponsor's when it's theirs (their workshop, Sponsor Bay), otherwise
 * as a hackathon event (opening ceremony, meals). All-hands run-of-show items
 * missing from /live (or when /live couldn't load) still show as hackathon
 * events.
 */
export function buildSponsorTimeline({
  day,
  items,
  live,
  sponsorName,
  showHackathon,
}: {
  day: RunOfShowDay;
  items: readonly RunOfShowItem[];
  live: readonly DaySchedule[] | undefined;
  sponsorName: string;
  showHackathon: boolean;
}): TimelineEntry[] {
  const today = items.filter((i) => i.day === day);
  const yours = today
    .filter((i) => isOwnItem(i, sponsorName))
    .map((i) => fromRunOfShow(i, "yours"));

  const liveEntries = liveDayEntries(live?.find((d) => d.day === day));
  const allHands = today
    .filter((i) => !isOwnItem(i, sponsorName))
    .map((i) => fromRunOfShow(i, "hackathon"));
  const hackathon = [
    ...liveEntries.filter((e) => !yours.some((y) => isSameEvent(y, e))),
    ...allHands.filter((a) => !liveEntries.some((e) => isSameEvent(a, e))),
  ].filter((e) => showHackathon || isAlwaysShown(e));

  return [...yours, ...hackathon].sort(
    (a, b) =>
      a.start - b.start ||
      (a.kind === b.kind ? 0 : a.kind === "yours" ? -1 : 1) ||
      a.title.localeCompare(b.title),
  );
}

export type LaidOutEntry = TimelineEntry & { lane: number; lanes: number };

/**
 * Side-by-side lanes for overlapping entries, like a calendar day view.
 * Entries must be sorted by start. Each group of overlapping entries shares
 * one lane count so their widths line up.
 */
export function assignLanes(entries: readonly TimelineEntry[]): LaidOutEntry[] {
  const out: LaidOutEntry[] = [];
  let group: LaidOutEntry[] = [];
  let groupEnd = -Infinity;
  let laneEnds: number[] = [];

  const flush = () => {
    for (const e of group) e.lanes = laneEnds.length;
    out.push(...group);
    group = [];
    laneEnds = [];
  };

  for (const entry of entries) {
    if (entry.start >= groupEnd) {
      flush();
      groupEnd = -Infinity;
    }
    let lane = laneEnds.findIndex((end) => end <= entry.start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(entry.end);
    } else {
      laneEnds[lane] = entry.end;
    }
    group.push({ ...entry, lane, lanes: 0 });
    groupEnd = Math.max(groupEnd, entry.end);
  }
  flush();
  return out;
}

export type AxisRow =
  | { type: "slot"; minute: number }
  | { type: "gap"; from: number; to: number };

/**
 * The time axis: a row every 30 minutes from the first event to the last,
 * with long empty stretches (over 2 hours) folded into one gap row, as /live
 * does.
 */
export function buildAxis(entries: readonly TimelineEntry[]): AxisRow[] {
  if (entries.length === 0) return [];
  const first =
    Math.floor(Math.min(...entries.map((e) => e.start)) / SLOT) * SLOT;
  const last = Math.ceil(Math.max(...entries.map((e) => e.end)) / SLOT) * SLOT;
  const covered = (t: number) =>
    entries.some((e) => e.start < t + SLOT && e.end > t);

  const rows: AxisRow[] = [];
  let t = first;
  while (t < last) {
    if (covered(t)) {
      rows.push({ type: "slot", minute: t });
      t += SLOT;
      continue;
    }
    let u = t;
    while (u < last && !covered(u)) u += SLOT;
    if (u - t > 120) {
      rows.push({ type: "gap", from: t, to: u });
    } else {
      for (let s = t; s < u; s += SLOT) rows.push({ type: "slot", minute: s });
    }
    t = u;
  }
  return rows;
}

/**
 * Pixel offset of `minute` on an axis with `slotHeight` px per 30 minutes
 * and `gapHeight` px per folded gap. Null when the minute is off the axis.
 */
export function axisOffset(
  rows: readonly AxisRow[],
  minute: number,
  slotHeight: number,
  gapHeight: number,
): number | null {
  let y = 0;
  for (const row of rows) {
    if (row.type === "slot") {
      if (minute >= row.minute && minute <= row.minute + SLOT) {
        return y + ((minute - row.minute) / SLOT) * slotHeight;
      }
      y += slotHeight;
    } else {
      if (minute >= row.from && minute < row.to) return y + gapHeight / 2;
      y += gapHeight;
    }
  }
  return null;
}

/**
 * The day grid's columns, in order. "hackathon" holds every hackathon-wide
 * event: the sheet's Main event items plus the /live schedule, muted.
 * "coffee-chats" holds the sheet's coffee chat items and booked chats (one
 * block per booking, room in the block); "judging" holds sponsor judging.
 */
export const GRID_COLUMNS = [
  "hackathon",
  "sponsor-workshop",
  "food",
  "spon-booth",
  "coffee-chats",
  "judging",
  "other",
  "tasks",
] as const;
export type GridColumn = (typeof GRID_COLUMNS)[number];

/** Columns shown even when empty. */
const ALWAYS_SHOWN = new Set<GridColumn>([
  "sponsor-workshop",
  "food",
  "spon-booth",
  "coffee-chats",
]);

const LIVE_TO_GRID: Record<LiveCategory, GridColumn> = {
  main: "hackathon",
  sponsor: "sponsor-workshop",
  workshop: "sponsor-workshop",
  food: "food",
  booth: "spon-booth",
  activity: "other",
  scavenger: "other",
  other: "other",
};

/**
 * Sponsor judging on the run of show ("Sponsor Track Judging"), not the
 * workshop about it ("Sponsor Judging Workshop").
 */
export function isJudgingTitle(title: string): boolean {
  return /\bjudg/i.test(title) && !/workshop|info\s*session/i.test(title);
}

export function gridColumnOf(
  entry: Pick<TimelineEntry, "category" | "kind" | "title"> & {
    item?: unknown;
  },
): GridColumn {
  if (entry.category === "task") return "tasks";
  if (entry.category === "coffee-chat") return "coffee-chats";
  // Meals get their own column, from the sheet or /live.
  if (entry.category === "food") return "food";
  // Hackathon-wide: everything muted, and the sheet's Main event column.
  if (
    entry.kind === "hackathon" ||
    entry.category === "big-event" ||
    entry.category === "main"
  ) {
    return "hackathon";
  }
  if (entry.item && isJudgingTitle(entry.title)) return "judging";
  return (GRID_COLUMNS as readonly string[]).includes(entry.category)
    ? (entry.category as GridColumn)
    : (LIVE_TO_GRID[entry.category as LiveCategory] ?? "other");
}

/**
 * Entries per grid column, each column laid out in its own lanes. Columns
 * other than Workshops, Sponsor Bay and Coffee chats are left out when
 * empty (so hiding hackathon events hides their column).
 */
export function layoutGrid(
  entries: readonly TimelineEntry[],
): { column: GridColumn; entries: LaidOutEntry[] }[] {
  return GRID_COLUMNS.map((column) => ({
    column,
    entries: assignLanes(
      entries
        .filter((e) => gridColumnOf(e) === column)
        .sort((a, b) => a.start - b.start),
    ),
  })).filter((c) => ALWAYS_SHOWN.has(c.column) || c.entries.length > 0);
}

/**
 * One day of the organizer run of show: every run-of-show item at full
 * strength except Main event items, which are hackathon-wide and shown
 * muted with the /live events. When hackathon events are shown, /live
 * events already on the run of show are left out (shown once); when
 * hidden, Main event items go too.
 */
export function buildOrganizerTimeline({
  day,
  items,
  live,
  showHackathon,
}: {
  day: RunOfShowDay;
  items: readonly RunOfShowItem[];
  live: readonly DaySchedule[] | undefined;
  showHackathon: boolean;
}): TimelineEntry[] {
  const today = items.filter((i) => i.day === day);
  const runOfShow = today
    .filter((i) => i.column !== "big-event")
    .map((i) => fromRunOfShow(i, "yours"));
  const mainEvents = today
    .filter((i) => i.column === "big-event")
    .map((i) => fromRunOfShow(i, "hackathon"));
  const sheet = [...runOfShow, ...mainEvents];
  const hackathon = [
    ...mainEvents,
    ...liveDayEntries(live?.find((d) => d.day === day)).filter(
      (e) => !sheet.some((r) => isSameEvent(r, e)),
    ),
  ].filter((e) => showHackathon || isAlwaysShown(e));
  return [...runOfShow, ...hackathon].sort(
    (a, b) =>
      a.start - b.start ||
      (a.kind === b.kind ? 0 : a.kind === "yours" ? -1 : 1) ||
      a.title.localeCompare(b.title),
  );
}

/**
 * Team tasks (sheet Task/Owner) whose start time falls inside the entry,
 * in time order. A task listed before the entry's start but within it
 * once read as after midnight (e.g. "00:30" in a 23:00-01:00 event) counts.
 */
export function tasksInEntry<T extends { day: RunOfShowDay; start: string }>(
  entry: Pick<TimelineEntry, "start" | "end">,
  day: RunOfShowDay,
  tasks: readonly T[],
): T[] {
  const at = (t: T) => {
    const m = hhmmToMinutes(t.start);
    return m < entry.start && m + 1440 < entry.end ? m + 1440 : m;
  };
  return tasks
    .filter((t) => {
      if (t.day !== day) return false;
      const m = at(t);
      return m >= entry.start && m < entry.end;
    })
    .sort((a, b) => at(a) - at(b));
}

/**
 * The Workshops-tab row behind a grid entry: same title (one contains the
 * other), and the same day and start when the workshop lists them.
 */
export function workshopForEntry<
  W extends { title: string; day: RunOfShowDay | null; start: string | null },
>(
  entry: Pick<TimelineEntry, "title" | "start" | "end">,
  day: RunOfShowDay,
  workshops: readonly W[],
): W | null {
  const matches = workshops.filter((w) => {
    if (w.day && w.day !== day) return false;
    const start = w.start ? hhmmToMinutes(w.start) : null;
    if (start !== null && (start < entry.start || start >= entry.end)) {
      return false;
    }
    return isSameEvent(entry, {
      title: w.title,
      start: entry.start,
      end: entry.end,
    });
  });
  return matches[0] ?? null;
}

/** Grid sizes shared by the block layout and the grid itself. */
export const GRID_SIZES = {
  /** Pixels per 30-minute row. */
  slot: 72,
  /** Pixels per folded gap row. */
  gap: 40,
  /** Shortest block, so even a 15-minute item shows a line of title. */
  minBlock: 36,
  /** Block chrome: outer padding (4px each side) + inner (6px each side). */
  chrome: 20,
  /** One line of block text (13px type on a 16px line). */
  line: 16,
  /** Readable width for one lane of a column. */
  lane: 136,
  /** Narrower lanes for compact team-task blocks. */
  taskLane: 120,
  /** No column narrower than this, whatever its lanes. */
  column: 160,
  /**
   * Wide screens (sm and up): columns share the grid's width and only
   * scroll sideways when these floors don't fit. A column is at least
   * `column` (9rem), each lane at least `lane`; an empty column (Food or
   * Team tasks with nothing that day) can go down to `empty`.
   */
  fluid: { column: 144, lane: 88, empty: 112 },
} as const;

/**
 * How much text a block of `height` px fits: title lines (clamped with an
 * ellipsis past that) and whether the location line fits underneath. The
 * title always gets at least one line; the location only shows when the
 * title still gets two.
 */
export function blockTextLayout(
  height: number,
  hasLocation: boolean,
): { titleLines: number; showLocation: boolean } {
  const lines = Math.floor((height - GRID_SIZES.chrome) / GRID_SIZES.line);
  if (hasLocation && lines >= 3) {
    return { titleLines: lines - 1, showLocation: true };
  }
  return { titleLines: Math.max(1, lines), showLocation: false };
}

/** Min width of a grid column: wide enough for each lane to stay readable. */
export function columnMinWidth(
  entries: readonly { lanes: number }[],
  lane: number = GRID_SIZES.lane,
): number {
  const lanes = Math.max(1, ...entries.map((e) => e.lanes));
  return Math.max(GRID_SIZES.column, lanes * lane);
}

/**
 * Min width of a grid column on wide screens, where columns share the
 * width: see GRID_SIZES.fluid.
 */
export function fluidColumnMinWidth(
  entries: readonly { lanes: number }[],
): number {
  if (entries.length === 0) return GRID_SIZES.fluid.empty;
  const lanes = Math.max(1, ...entries.map((e) => e.lanes));
  return Math.max(GRID_SIZES.fluid.column, lanes * GRID_SIZES.fluid.lane);
}

/**
 * Team tasks for the organizer grid's "Team tasks" column. A task has only a
 * start, so it fills its half-hour row (start to start + 30 min); tasks at
 * the same time share the row side by side.
 */
export function taskEntries(
  day: RunOfShowDay,
  tasks: readonly RunOfShowTask[],
): TimelineEntry[] {
  return tasks
    .filter((t) => t.day === day)
    .map((t, i) => {
      const start = hhmmToMinutes(t.start);
      return {
        id: `task-${day}-${t.start}-${i}`,
        kind: "task" as const,
        category: "task" as const,
        title: t.task,
        location: null,
        start,
        end: start + SLOT,
        task: t,
      };
    })
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}

/** Events (not tasks) running at `minute`, in time order. */
export function entriesAt(
  minute: number,
  entries: readonly TimelineEntry[],
): TimelineEntry[] {
  return entries
    .filter((e) => e.kind !== "task" && e.start <= minute && minute < e.end)
    .sort((a, b) => a.start - b.start || a.title.localeCompare(b.title));
}
