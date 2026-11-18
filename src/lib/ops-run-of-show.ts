import type { RunOfShowDay } from "~/lib/run-of-show";

/**
 * Parser for the organizer team's run of show ("Schedule View" tab of the
 * OPS_RUN_OF_SHOW_SHEET spreadsheet). Column A holds day markers ("FRIDAY")
 * and times ("1:00 PM"); every other cell is one task written as lines:
 *
 *   Costco Run
 *   Owner: Emily Liu, Sarah Lieng
 *   Starts:1:00 PM
 *   Location: Costco
 *   Notes: last minute water run
 *
 * Lines are read by their label, never by position, and spacing varies.
 * Start: the time line ("Starts:", "Start:", "Time:", "Judging starts:"),
 * else the row's time. End: a range in the time line ("12:00 PM - 2:00 PM"),
 * else the bottom of the cell when it spans 2+ rows of the time grid, else
 * none. A cell that can't be read (no owner, no time) is an issue for
 * organizers, never a guess. docs/decisions.md 2026-11-18 (ops pings).
 */

export type SheetGrid = string[][];
/** A merged range, 0-based, end exclusive (same as the Sheets API). */
export type SheetMerge = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

export type OwnerGroup = "everyone" | "spon";

export type OwnerToken = {
  /** As written, role included: "Aleeza (Photos)". */
  raw: string;
  /** Name without the role: "Aleeza". */
  name: string;
  /** Text in parentheses: "Photos", "lead"; null when none. */
  role: string | null;
  /** A whole group rather than one person. */
  group: OwnerGroup | null;
};

export type OpsTask = {
  /** Cell reference, "G7". */
  cell: string;
  /** The column's header, "Food". */
  column: string;
  day: RunOfShowDay;
  /** "HH:MM", 24-hour. */
  start: string;
  /** "HH:MM", later than start; null when the sheet gives no clear end. */
  end: string | null;
  endSource: "text" | "cell" | null;
  title: string;
  /** The Owner line as written. */
  ownerText: string;
  owners: OwnerToken[];
  location: string | null;
  /** Notes, To-Do, Setup and any other lines, one per line. */
  blurb: string | null;
};

export type OpsIssueReason = "no-owner" | "no-time" | "no-day" | "note";

export type OpsIssue = {
  cell: string;
  day: RunOfShowDay | null;
  /** The row's time, "HH:MM", when it has one. */
  time: string | null;
  /** First line of the cell. */
  title: string;
  reason: OpsIssueReason;
};

export type ParsedOpsSchedule = {
  tasks: OpsTask[];
  issues: OpsIssue[];
  /** False when no "Time" header row was found: nothing could be read. */
  foundHeader: boolean;
};

// ---------------------------------------------------------------------------
// Times
// ---------------------------------------------------------------------------

const pad = (n: number) => String(n).padStart(2, "0");
const minutesOf = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number) as [number, number];
  return h * 60 + m;
};

type Clock = { hour: number; minute: number; meridiem: "am" | "pm" | null };

const CLOCK = String.raw`(\d{1,2})(?::(\d{2}))?\s*([ap])?\.?\s*(?:m\b\.?)?`;
const CLOCK_RE = new RegExp(CLOCK, "i");
const RANGE_RE = new RegExp(
  String.raw`(?<![\d:])${CLOCK}\s*(?:-|–|—|\bto\b)\s*${CLOCK}`,
  "i",
);
const SINGLE_RE = new RegExp(String.raw`(?<![\d:])${CLOCK}`, "gi");

function clockOf(m: RegExpMatchArray | string[], offset = 1): Clock | null {
  const hour = Number(m[offset]);
  const minute = m[offset + 1] ? Number(m[offset + 1]) : 0;
  const mer = m[offset + 2]?.toLowerCase();
  if (!Number.isFinite(hour) || hour > 23 || minute > 59) return null;
  return {
    hour,
    minute,
    meridiem: mer === "a" ? "am" : mer === "p" ? "pm" : null,
  };
}

function to24(c: Clock, meridiem: "am" | "pm"): string {
  let h = c.hour % 12;
  if (meridiem === "pm") h += 12;
  return `${pad(h)}:${pad(c.minute)}`;
}

/** A clock with no am/pm: the reading closest to `near` ("HH:MM"). */
function resolve(c: Clock, near: string | null): string | null {
  if (c.meridiem) return to24(c, c.meridiem);
  if (c.hour > 12) return `${pad(c.hour)}:${pad(c.minute)}`;
  if (!near) return null;
  const am = to24(c, "am");
  const pm = to24(c, "pm");
  const d = (t: string) => Math.abs(minutesOf(t) - minutesOf(near));
  return d(am) <= d(pm) ? am : pm;
}

/** "1:00 PM" alone (a column A label) -> "13:00"; null for anything else. */
export function parseClockLabel(text: string): string | null {
  const t = text.trim();
  const m = new RegExp(String.raw`^${CLOCK}$`, "i").exec(t);
  if (!m) return null;
  const c = clockOf(m);
  if (!c?.meridiem) return null;
  return to24(c, c.meridiem);
}

/**
 * Times in a time line's value: "1:00 PM", "12:00 PM - 2:00 PM", "1PM - 4PM",
 * "7:00pm", "When busses arrive, 6pm-7pm". A side with no am/pm takes the
 * other side's, else the reading closest to the row's time. Null when the
 * value holds no time ("TBD").
 */
export function parseTimeValue(
  value: string,
  rowTime: string | null,
): { start: string; end: string | null } | null {
  const range = RANGE_RE.exec(value);
  if (range) {
    const a = clockOf(range, 1);
    const b = clockOf(range, 4);
    if (a && b) {
      const bMer = b.meridiem ?? a.meridiem;
      const aMer = a.meridiem ?? b.meridiem;
      let start: string | null;
      let end: string | null;
      if (aMer && bMer) {
        end = to24(b, bMer);
        start = to24(a, aMer);
        // "11-1pm": the start takes the other half of the day.
        if (!a.meridiem && minutesOf(start) > minutesOf(end)) {
          start = to24(a, aMer === "am" ? "pm" : "am");
        }
      } else {
        start = resolve(a, rowTime);
        end = start ? resolve(b, start) : null;
      }
      if (start) {
        return {
          start,
          end: end && minutesOf(end) > minutesOf(start) ? end : null,
        };
      }
    }
  }
  // A lone time needs am/pm or minutes, so "Rm 2230" or "#1" never count.
  for (const m of value.matchAll(SINGLE_RE)) {
    const c = clockOf(m);
    if (!c || (!c.meridiem && !m[2])) continue;
    const start = resolve(c, rowTime);
    if (start) return { start, end: null };
  }
  return null;
}

/** An unlabeled line that is only a time or a range: "2pm-3pm". */
function isBareTimeLine(line: string): boolean {
  const t = line.trim();
  return (
    new RegExp(String.raw`^${CLOCK}\s*(?:(?:-|–|—|\bto\b)\s*${CLOCK})?$`, "i").test(t) &&
    CLOCK_RE.test(t) &&
    /[ap]\.?m|:/i.test(t)
  );
}

// ---------------------------------------------------------------------------
// Owners
// ---------------------------------------------------------------------------

const fold = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

const EVERYONE = new Set([
  "everyone",
  "everybody",
  "all",
  "all hands",
  "all organizers",
  "all organisers",
  "the team",
]);
const SPON = new Set([
  "all of spon",
  "all spon",
  "spon",
  "spon team",
  "sponsorship",
  "sponsorship team",
  "all of sponsorship",
]);

export function ownerGroup(name: string): OwnerGroup | null {
  const key = fold(name);
  if (EVERYONE.has(key)) return "everyone";
  if (SPON.has(key)) return "spon";
  return null;
}

/**
 * "ALL OF SPON, Jasmine, Aleeza (Photos), William/Daniel" -> one token per
 * name. Separators inside parentheses ("Slack + Comms") don't split.
 */
export function parseOwners(text: string): OwnerToken[] {
  const out: OwnerToken[] = [];
  let depth = 0;
  let current = "";
  const flush = () => {
    const raw = current.trim().replace(/[.,;]+$/, "").trim();
    current = "";
    if (!raw) return;
    const roles = [...raw.matchAll(/\(([^)]*)\)/g)].map((m) => m[1]!.trim());
    const name = raw
      .replace(/\([^)]*\)/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!name) return;
    out.push({
      raw,
      name,
      role: roles.filter(Boolean).join(", ") || null,
      group: ownerGroup(name),
    });
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "(") depth++;
    if (ch === ")") depth = Math.max(0, depth - 1);
    if (depth === 0 && /[,;/&+\n]/.test(ch)) {
      flush();
      continue;
    }
    if (depth === 0 && /\s/.test(ch) && /^and\s/i.test(text.slice(i + 1))) {
      // " and " between names.
      flush();
      i += 3;
      continue;
    }
    current += ch;
  }
  flush();
  return out;
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

type Label = "owner" | "time" | "time2" | "location" | "notes" | "setup";

function labelOf(raw: string): Label | null {
  const key = raw.trim().replace(/\s+/g, " ").toLowerCase();
  if (key === "owner" || key === "owners") return "owner";
  if (
    ["start", "starts", "start time", "starts at", "time", "when"].includes(key)
  ) {
    return "time";
  }
  if (/\bstarts?$/.test(key)) return "time2"; // "Judging starts"
  if (["location", "where", "room", "loc"].includes(key)) return "location";
  if (["notes", "note", "to-do", "todo", "to do"].includes(key)) return "notes";
  if (["setup", "set up", "set-up", "prep"].includes(key)) return "setup";
  return null;
}

const LABEL_LINE = /^([A-Za-z][A-Za-z /-]{0,24}?)\s*:\s*(.*)$/;

type CellParts = {
  title: string;
  owner: string | null;
  timeValue: string | null;
  location: string | null;
  blurb: string[];
};

function splitCell(text: string): CellParts {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const parts: CellParts = {
    title: "",
    owner: null,
    timeValue: null,
    location: null,
    blurb: [],
  };
  let time2: string | null = null;
  lines.forEach((line, i) => {
    const m = LABEL_LINE.exec(line);
    const label = m ? labelOf(m[1]!) : null;
    const value = m?.[2]?.trim() ?? "";
    if (i === 0 && !label) {
      parts.title = line;
      return;
    }
    switch (label) {
      case "owner":
        parts.owner = parts.owner ? `${parts.owner}, ${value}` : value;
        return;
      case "time":
        if (parts.timeValue === null) parts.timeValue = value;
        else parts.blurb.push(line);
        return;
      case "time2":
        time2 ??= value;
        parts.blurb.push(line);
        return;
      case "location":
        if (value) parts.location = value;
        return;
      case "notes":
        if (value) parts.blurb.push(value);
        return;
      case "setup":
        if (value) parts.blurb.push(line);
        return;
      default:
        if (parts.timeValue === null && isBareTimeLine(line)) {
          parts.timeValue = line;
          return;
        }
        parts.blurb.push(line);
    }
  });
  if (parts.timeValue === null && time2 !== null) parts.timeValue = time2;
  if (!parts.title) parts.title = lines[0] ?? "";
  return parts;
}

// ---------------------------------------------------------------------------
// Grid
// ---------------------------------------------------------------------------

const DAY_RE = /^(fri|sat|sun)[a-z]*\b/i;
const DAYS: Record<string, RunOfShowDay> = {
  fri: "Friday",
  sat: "Saturday",
  sun: "Sunday",
};

type RowKind =
  | { kind: "day"; day: RunOfShowDay | null }
  | { kind: "time"; time: string }
  /** Inside a column A time cell merged over several rows. */
  | { kind: "continued"; time: string }
  | { kind: "blank" }
  | { kind: "note"; text: string };

export function cellRef(row: number, col: number): string {
  let letters = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) {
    letters = String.fromCharCode(65 + ((n - 1) % 26)) + letters;
  }
  return `${letters}${row + 1}`;
}

export function parseOpsSchedule(
  grid: SheetGrid,
  merges: SheetMerge[],
): ParsedOpsSchedule {
  const cell = (r: number, c: number) => (grid[r]?.[c] ?? "").trim();
  const header = grid.findIndex((row) => /^time$/i.test((row?.[0] ?? "").trim()));
  if (header < 0) return { tasks: [], issues: [], foundHeader: false };

  const mergeAt = new Map<string, SheetMerge>();
  const covered = new Set<string>();
  for (const m of merges) {
    mergeAt.set(`${m.startRow}:${m.startCol}`, m);
    for (let r = m.startRow; r < m.endRow; r++) {
      for (let c = m.startCol; c < m.endCol; c++) {
        if (r !== m.startRow || c !== m.startCol) covered.add(`${r}:${c}`);
      }
    }
  }

  // Column A, row by row.
  const rows: RowKind[] = [];
  const dayOf: (RunOfShowDay | null)[] = [];
  let day: RunOfShowDay | null = null;
  for (let r = 0; r < grid.length; r++) {
    let kind: RowKind;
    if (r <= header) kind = { kind: "blank" };
    else if (covered.has(`${r}:0`)) {
      const prev = rows[r - 1];
      kind =
        prev?.kind === "time" || prev?.kind === "continued"
          ? { kind: "continued", time: prev.time }
          : { kind: "blank" };
    } else {
      const text = cell(r, 0);
      const time = parseClockLabel(text);
      const dm = DAY_RE.exec(text);
      if (!text) kind = { kind: "blank" };
      else if (time) kind = { kind: "time", time };
      else if (dm && text.length <= 24) {
        kind = { kind: "day", day: DAYS[dm[1]!.toLowerCase()]! };
      } else if (/^all days?$/i.test(text)) kind = { kind: "day", day: null };
      else kind = { kind: "note", text };
    }
    if (kind.kind === "day") day = kind.day;
    rows.push(kind);
    dayOf.push(day);
  }

  /** The time a row sits in: its own, or the nearest above in its day. */
  const rowTime = (r: number): string | null => {
    for (let i = r; i > header; i--) {
      const k = rows[i]!;
      if (k.kind === "time" || k.kind === "continued") return k.time;
      if (k.kind === "day") return null;
    }
    return null;
  };
  /** The time at the top of row `r` (a cell ending there ends then). */
  const boundaryTime = (r: number): string | null => {
    for (let i = r; i < rows.length; i++) {
      const k = rows[i]!;
      if (k.kind === "time") return k.time;
      if (k.kind === "day" || k.kind === "note") return null;
    }
    return null;
  };

  const tasks: OpsTask[] = [];
  const issues: OpsIssue[] = [];
  const headers = grid[header] ?? [];

  for (let r = header + 1; r < grid.length; r++) {
    const kind = rows[r]!;
    if (kind.kind === "note") {
      issues.push({
        cell: cellRef(r, 0),
        day: dayOf[r] ?? null,
        time: null,
        title: kind.text.split(/\r?\n/)[0]!.trim(),
        reason: "note",
      });
    }
    const width = grid[r]?.length ?? 0;
    for (let c = 1; c < width; c++) {
      const text = cell(r, c);
      if (!text || covered.has(`${r}:${c}`)) continue;
      const parts = splitCell(text);
      const ref = cellRef(r, c);
      const d = dayOf[r] ?? null;
      const t = rowTime(r);
      const issue = (reason: OpsIssueReason) =>
        issues.push({ cell: ref, day: d, time: t, title: parts.title, reason });

      if (!parts.owner?.trim()) {
        issue("no-owner");
        continue;
      }
      if (!d) {
        issue("no-day");
        continue;
      }
      const fromText = parts.timeValue
        ? parseTimeValue(parts.timeValue, t)
        : null;
      if (parts.timeValue && !fromText) {
        // "Starts: TBD": keep what it says, use the row's time.
        parts.blurb.unshift(`Time: ${parts.timeValue}`);
      }
      const start = fromText?.start ?? t;
      if (!start) {
        issue("no-time");
        continue;
      }
      let end: string | null = null;
      let endSource: OpsTask["endSource"] = null;
      if (fromText?.end) {
        end = fromText.end;
        endSource = "text";
      } else {
        const m = mergeAt.get(`${r}:${c}`);
        if (m && m.endRow - m.startRow >= 2) {
          const bottom = boundaryTime(m.endRow);
          if (bottom && minutesOf(bottom) > minutesOf(start)) {
            end = bottom;
            endSource = "cell";
          }
        }
      }
      tasks.push({
        cell: ref,
        column: (headers[c] ?? "").trim(),
        day: d,
        start,
        end,
        endSource,
        title: parts.title,
        ownerText: parts.owner.trim(),
        owners: parseOwners(parts.owner),
        location: parts.location,
        blurb: parts.blurb.length > 0 ? parts.blurb.join("\n") : null,
      });
    }
  }
  return { tasks, issues, foundHeader: true };
}
