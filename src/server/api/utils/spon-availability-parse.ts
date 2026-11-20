/**
 * Pure parsing for the sponsor team's availability on the RUN OF SHOW tab
 * (no googleapis, no env). Layout seen 2026-11-18, found by header text so
 * the blocks can move:
 *
 *   SPON TEAM AVAILABILITY | FRIDAY       | SATURDAY               | SUNDAY
 *   Noah                   | All day      | All day                | All day
 *   Alice                  | After 3PM    | Before 2:30, After 3:30 | All day   | (note)
 *
 *   SPON TEAM NECESSARY SHIFTS | SHIFT | ON-CALL (remote)
 *   Noah                       |       | Saturday 1AM-4AM | everyone: | friday 4PM-7PM, ...
 *   Daniel                     |       | --               | daniel: stepping out 11PM-12AM friday
 *
 * Cells right of a block are notes: "everyone: ..." windows everyone must be
 * there, "<name>: stepping out ..." times that person is away, anything else
 * kept as written. Times we can't read are kept as notes, never guessed.
 */
import { RUN_OF_SHOW_DAYS, type RunOfShowDay } from "~/lib/run-of-show";
import {
  DAY_MINUTES,
  emptyAvailability,
  emptyDayRanges,
  unionRanges,
  type AvailabilityNote,
  type DayRanges,
  type MinuteRange,
  type SponAvailability,
  type SponOrganizer,
} from "~/lib/spon-availability";
import type {
  SheetGrid,
  SheetMerge,
} from "~/server/api/utils/run-of-show-parse";

const AVAILABILITY_HEADER = /^spon(sor)?\s*team\s+availability$/i;
const SHIFTS_HEADER = /^spon(sor)?\s*team\s+(necessary\s+)?shifts$/i;
const EVERYONE = /^(everyone|everybody|all|whole team|team)$/i;
/** "stepping out", "away", "sleeping", ... : the person isn't around. */
const AWAY =
  /\b(stepping\s+out|step\s+out|stepped\s+out|out|away|off|break|sleep(ing)?|nap(ping)?)\b/gi;
const NONE = /^(-+|–|—|n\/?a|none|no|nil|x)$/i;

function cell(grid: SheetGrid, row: number, col: number): string {
  return String(grid[row]?.[col] ?? "").trim();
}

const DAY_WORD = /\b(fri(?:day)?|sat(?:urday)?|sun(?:day)?)\b\.?/i;

function dayOf(word: string): RunOfShowDay | null {
  const t = word.toLowerCase().slice(0, 3);
  return RUN_OF_SHOW_DAYS.find((d) => d.toLowerCase().startsWith(t)) ?? null;
}

const TIME = String.raw`(\d{1,2})(?::(\d{2}))?\s*(?:([ap])\.?\s*m\.?)?`;
const TIME_ONLY = new RegExp(`^${TIME}$`, "i");
const RANGE = new RegExp(
  `^${TIME}\\s*(?:-|–|—|to|until|till)\\s*${TIME}$`,
  "i",
);

type Clock = { hour: number; minute: number; meridiem: "a" | "p" | null };

function clockOf(
  h: string,
  m: string | undefined,
  ap: string | undefined,
): Clock | null {
  const hour = Number(h);
  const minute = m ? Number(m) : 0;
  if (minute > 59) return null;
  const meridiem = ap ? (ap.toLowerCase() as "a" | "p") : null;
  if (meridiem ? hour < 1 || hour > 12 : hour > 24) return null;
  return { hour, minute, meridiem };
}

function withMeridiem({ hour, minute }: Clock, meridiem: "a" | "p"): number {
  return ((hour % 12) + (meridiem === "p" ? 12 : 0)) * 60 + minute;
}

/**
 * A time with no AM/PM: 13-24 and 0 read as 24-hour; otherwise the waking
 * hours of the event, 8-11 morning and 12-7 afternoon/evening ("Before
 * 2:30, After 3:30" = 2:30 PM, 3:30 PM).
 */
function bareMinutes(clock: Clock): number {
  const { hour, minute } = clock;
  if (hour === 0 || hour > 12) return (hour % 24) * 60 + minute;
  return withMeridiem(clock, hour >= 8 && hour <= 11 ? "a" : "p");
}

function minutesOf(clock: Clock): number {
  return clock.meridiem
    ? withMeridiem(clock, clock.meridiem)
    : bareMinutes(clock);
}

/**
 * One time phrase -> minutes from the day's midnight; `end` past 1440 runs
 * into the next day. Null when it isn't one we know.
 */
export function parseTimePhrase(text: string): MinuteRange | null {
  const t = text.replace(/\s+/g, " ").trim().toLowerCase();
  if (/^all ?day$|^all$|^whole day$|^any ?time$/.test(t)) {
    return { start: 0, end: DAY_MINUTES };
  }
  const after = /^(?:after|from|since)\s+(.+)$/.exec(t);
  const before = /^(?:before|until|till|til|up to)\s+(.+)$/.exec(t);
  const single = after ?? before;
  if (single) {
    const m = TIME_ONLY.exec(single[1]!.trim());
    const clock = m && clockOf(m[1]!, m[2], m[3]);
    if (!clock) return null;
    const at = minutesOf(clock);
    if (after)
      return at >= DAY_MINUTES ? null : { start: at, end: DAY_MINUTES };
    // "Before 12AM" = the whole day.
    return { start: 0, end: at === 0 ? DAY_MINUTES : at };
  }
  const m = RANGE.exec(t);
  if (!m) return null;
  const a = clockOf(m[1]!, m[2], m[3]);
  const b = clockOf(m[4]!, m[5], m[6]);
  if (!a || !b) return null;
  let start: number;
  let end: number;
  if (!a.meridiem && b.meridiem) {
    // "11-11:30AM": the start shares the end's AM/PM, unless that puts it
    // after the end ("11-1PM" = 11 AM to 1 PM).
    end = withMeridiem(b, b.meridiem);
    start = withMeridiem(a, b.meridiem);
    if (start > end) start = withMeridiem(a, b.meridiem === "a" ? "p" : "a");
  } else if (a.meridiem && !b.meridiem) {
    start = withMeridiem(a, a.meridiem);
    end = withMeridiem(b, a.meridiem);
    if (end <= start && end !== 0)
      end = withMeridiem(b, a.meridiem === "a" ? "p" : "a");
  } else {
    start = minutesOf(a);
    end = minutesOf(b);
  }
  if (start >= DAY_MINUTES) return null;
  // Ends at or before the start: runs past midnight ("11PM-12AM", "1AM" end).
  if (end <= start) end += DAY_MINUTES;
  if (end - start > DAY_MINUTES) return null;
  return { start, end };
}

/** Add a window to `out`, splitting it at midnight. Past Sunday is dropped. */
function addWindow(
  out: DayRanges,
  day: RunOfShowDay,
  range: MinuteRange,
): void {
  const index = RUN_OF_SHOW_DAYS.indexOf(day);
  out[day].push({ start: range.start, end: Math.min(range.end, DAY_MINUTES) });
  const next = RUN_OF_SHOW_DAYS[index + 1];
  if (range.end > DAY_MINUTES && next) {
    out[next].push({ start: 0, end: range.end - DAY_MINUTES });
  }
}

function unionAll(ranges: DayRanges): DayRanges {
  return {
    Friday: unionRanges(ranges.Friday),
    Saturday: unionRanges(ranges.Saturday),
    Sunday: unionRanges(ranges.Sunday),
  };
}

/** Comma, ";", "&", " and " or a line break between windows. */
function splitParts(text: string): string[] {
  return text
    .split(/[,;\n&]|\band\b/i)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

export type ParsedTimes = {
  ranges: DayRanges;
  /** Parts we couldn't read, as written (with their day when known). */
  unread: AvailabilityNote[];
};

/**
 * Comma-separated windows, each naming its day before or after the time
 * ("Saturday 1AM-4AM", "11PM-12AM friday"). A part without a day takes the
 * previous part's day, or `defaultDay`. `strip` removes words like
 * "stepping out" first. "--" / "none" is no windows.
 */
export function parseDayTimes(
  text: string,
  defaultDay: RunOfShowDay | null = null,
  strip?: RegExp,
): ParsedTimes {
  const ranges = emptyDayRanges();
  const unread: AvailabilityNote[] = [];
  let day = defaultDay;
  for (const raw of splitParts(text)) {
    if (NONE.test(raw)) continue;
    const dayMatch = DAY_WORD.exec(raw);
    const partDay = dayMatch ? dayOf(dayMatch[1]!) : null;
    if (partDay) day = partDay;
    let rest = dayMatch ? raw.replace(dayMatch[0], " ") : raw;
    if (strip) rest = rest.replace(strip, " ");
    rest = rest
      .replace(/^\s*(on|at)\s+/i, "")
      .replace(/\s+/g, " ")
      .trim();
    const range = rest ? parseTimePhrase(rest) : null;
    if (!range || !day) {
      unread.push({ day, text: raw });
      continue;
    }
    addWindow(ranges, day, range);
  }
  return { ranges: unionAll(ranges), unread };
}

function findHeader(
  grid: SheetGrid,
  pattern: RegExp,
): { row: number; col: number } | null {
  for (let row = 0; row < grid.length; row++) {
    const cells = grid[row] ?? [];
    for (let col = 0; col < cells.length; col++) {
      if (
        pattern.test(
          String(cells[col] ?? "")
            .replace(/\s+/g, " ")
            .trim(),
        )
      ) {
        return { row, col };
      }
    }
  }
  return null;
}

/** Name rows under a block's header, until the first blank name. */
function blockRows(
  grid: SheetGrid,
  header: { row: number; col: number },
): number[] {
  const rows: number[] = [];
  for (
    let r = header.row + 1;
    r < grid.length && cell(grid, r, header.col);
    r++
  ) {
    rows.push(r);
  }
  return rows;
}

/** Last filled header cell of a block (its notes start after it). */
function lastHeaderCol(
  grid: SheetGrid,
  header: { row: number; col: number },
): number {
  let last = header.col;
  const cells = grid[header.row] ?? [];
  for (let c = header.col + 1; c < cells.length; c++) {
    if (!cell(grid, header.row, c)) break;
    last = c;
  }
  return last;
}

type LabeledNote = { label: string | null; text: string };

/** Note cells right of a block: "label:" + next cell, or "label: text". */
function notesRightOf(
  grid: SheetGrid,
  row: number,
  fromCol: number,
): LabeledNote[] {
  const cells = (grid[row] ?? [])
    .slice(fromCol)
    .map((c) => String(c ?? "").trim());
  const notes: LabeledNote[] = [];
  for (let i = 0; i < cells.length; i++) {
    const text = cells[i]!;
    if (!text) continue;
    const labelOnly = /^([^:]{1,40}):$/.exec(text);
    if (labelOnly) {
      const next = cells.slice(i + 1).findIndex(Boolean);
      if (next >= 0) {
        notes.push({ label: labelOnly[1]!.trim(), text: cells[i + 1 + next]! });
        i += 1 + next;
        continue;
      }
    }
    const labeled = /^([^:\d]{1,40}):\s*(.+)$/s.exec(text);
    notes.push(
      labeled
        ? { label: labeled[1]!.trim(), text: labeled[2]!.trim() }
        : { label: null, text },
    );
  }
  return notes;
}

function newOrganizer(name: string): SponOrganizer {
  return {
    name,
    available: emptyDayRanges(),
    shifts: emptyDayRanges(),
    onCall: emptyDayRanges(),
    away: emptyDayRanges(),
    notes: [],
  };
}

function mergeInto(target: DayRanges, add: DayRanges): void {
  for (const day of RUN_OF_SHOW_DAYS)
    target[day] = unionRanges([...target[day], ...add[day]]);
}

/**
 * Parse both blocks from the RUN OF SHOW grid. Never throws: missing blocks
 * mean no one listed.
 */
export function parseSponAvailability(grid: SheetGrid): SponAvailability {
  const result = emptyAvailability();
  const byName = new Map<string, SponOrganizer>();
  const organizer = (name: string) => {
    const key = name.toLowerCase();
    let o = byName.get(key);
    if (!o) {
      o = newOrganizer(name);
      byName.set(key, o);
      result.organizers.push(o);
    }
    return o;
  };
  const findPerson = (label: string) =>
    byName.get(label.toLowerCase()) ??
    [...byName.values()].find(
      (o) => o.name.split(/\s+/)[0]!.toLowerCase() === label.toLowerCase(),
    ) ??
    null;
  const pendingNotes: { row: number; from: number }[] = [];

  const avail = findHeader(grid, AVAILABILITY_HEADER);
  if (avail) {
    const dayCols: { col: number; day: RunOfShowDay }[] = [];
    const last = lastHeaderCol(grid, avail);
    for (let c = avail.col + 1; c <= last; c++) {
      const text = cell(grid, avail.row, c);
      const day = DAY_WORD.test(text) ? dayOf(text) : null;
      if (day) dayCols.push({ col: c, day });
    }
    for (const r of blockRows(grid, avail)) {
      const o = organizer(cell(grid, r, avail.col));
      for (const { col, day } of dayCols) {
        const text = cell(grid, r, col);
        if (!text) continue;
        // The column names the day; only times on that day count here.
        const { ranges, unread } = parseDayTimes(text, day);
        o.available[day] = unionRanges([...o.available[day], ...ranges[day]]);
        o.notes.push(...unread.map((n) => ({ day, text: n.text })));
      }
      for (const note of notesRightOf(grid, r, last + 1)) {
        o.notes.push({
          day: null,
          text: note.label ? `${note.label}: ${note.text}` : note.text,
        });
      }
    }
  }

  const shifts = findHeader(grid, SHIFTS_HEADER);
  if (shifts) {
    const last = lastHeaderCol(grid, shifts);
    let shiftCol = -1;
    let onCallCol = -1;
    for (let c = shifts.col + 1; c <= last; c++) {
      const text = cell(grid, shifts.row, c).toLowerCase();
      if (/on\s*-?\s*call/.test(text)) onCallCol = c;
      else if (/shift/.test(text)) shiftCol = c;
    }
    for (const r of blockRows(grid, shifts)) {
      const o = organizer(cell(grid, r, shifts.col));
      for (const [col, into] of [
        [shiftCol, o.shifts],
        [onCallCol, o.onCall],
      ] as const) {
        if (col < 0 || !cell(grid, r, col)) continue;
        const { ranges, unread } = parseDayTimes(cell(grid, r, col));
        mergeInto(into, ranges);
        o.notes.push(...unread);
      }
      pendingNotes.push({ row: r, from: last + 1 });
    }
  }

  // Notes by the shifts block: everyone's required windows and people's
  // time away (people are all known by now).
  for (const { row, from } of pendingNotes) {
    for (const note of notesRightOf(grid, row, from)) {
      if (note.label && EVERYONE.test(note.label)) {
        const { ranges, unread } = parseDayTimes(note.text);
        mergeInto(result.required, ranges);
        result.notes.push(
          ...unread.map((n) => ({ ...n, text: `${note.label}: ${n.text}` })),
        );
        continue;
      }
      const person = note.label ? findPerson(note.label) : null;
      if (!person) {
        result.notes.push({
          day: null,
          text: note.label ? `${note.label}: ${note.text}` : note.text,
        });
        continue;
      }
      // Only time away is drawn; any other note stays as written.
      if (new RegExp(AWAY.source, "i").test(note.text)) {
        const { ranges, unread } = parseDayTimes(note.text, null, AWAY);
        mergeInto(person.away, ranges);
        person.notes.push(...unread);
      } else {
        person.notes.push({ day: null, text: note.text });
      }
    }
  }
  return result;
}

/**
 * The run of show itself lives in A:J; the sponsor team's availability
 * blocks sit to the right of it (K onwards). The run-of-show parser only
 * ever sees A:J, so nothing out there can turn into a column or task.
 */
const RUN_OF_SHOW_COLUMN_COUNT = 10;

/** The A:J part of the RUN OF SHOW grid and its merges. */
export function runOfShowColumns(
  grid: SheetGrid,
  merges: SheetMerge[],
): { grid: SheetGrid; merges: SheetMerge[] } {
  return {
    grid: grid.map((row) => row.slice(0, RUN_OF_SHOW_COLUMN_COUNT)),
    merges: merges
      .filter((m) => m.startCol < RUN_OF_SHOW_COLUMN_COUNT)
      .map((m) => ({
        ...m,
        endCol: Math.min(m.endCol, RUN_OF_SHOW_COLUMN_COUNT),
      })),
  };
}
