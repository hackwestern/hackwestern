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
  /** "yours": the sponsor's own item. "hackathon": everyone's event. */
  kind: "yours" | "hackathon";
  category: RunOfShowColumn | LiveCategory;
  title: string;
  location: string | null;
  /** Minutes after the day's midnight (Eastern). Past 1440 = after midnight. */
  start: number;
  end: number;
  /** The run-of-show item behind a "yours" entry. */
  item?: RunOfShowItem;
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

  let hackathon: TimelineEntry[] = [];
  if (showHackathon) {
    const liveEntries = liveDayEntries(live?.find((d) => d.day === day));
    const allHands = today
      .filter((i) => !isOwnItem(i, sponsorName))
      .map((i) => fromRunOfShow(i, "hackathon"));
    hackathon = [
      ...liveEntries.filter((e) => !yours.some((y) => isSameEvent(y, e))),
      ...allHands.filter((a) => !liveEntries.some((e) => isSameEvent(a, e))),
    ];
  }

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
 * The day grid's columns: the run-of-show sheet's categories in its order,
 * plus "other" for hackathon-only activities (/live's activities, scavenger
 * hunt and other columns) that have no run-of-show column.
 */
export const GRID_COLUMNS = [
  "big-event",
  "sponsor-workshop",
  "food",
  "spon-booth",
  "coffee-chats",
  "other",
] as const;
export type GridColumn = (typeof GRID_COLUMNS)[number];

const LIVE_TO_GRID: Record<LiveCategory, GridColumn> = {
  main: "big-event",
  sponsor: "sponsor-workshop",
  workshop: "sponsor-workshop",
  food: "food",
  booth: "spon-booth",
  activity: "other",
  scavenger: "other",
  other: "other",
};

export function gridColumnOf(
  entry: Pick<TimelineEntry, "category">,
): GridColumn {
  return (GRID_COLUMNS as readonly string[]).includes(entry.category)
    ? (entry.category as GridColumn)
    : LIVE_TO_GRID[entry.category as LiveCategory];
}

/**
 * Entries per grid column, each column laid out in its own lanes. The
 * "other" column is left out when it has nothing in it.
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
  })).filter((c) => c.column !== "other" || c.entries.length > 0);
}
