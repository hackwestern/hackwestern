import { autoPingCopy as copy } from "~/content/auto-ping";
import { escapeSlackText } from "./client";

/**
 * Auto-Ping: Slack DMs for HW13 mentors, volunteers and judges, from the
 * Auto-Ping sheet (docs/auto-ping.md). Pure parsing and planning only:
 * schedule grids to shifts, schedule names to People rows, People rows to
 * planned messages. scripts/auto-ping.ts reads and writes the sheet, and
 * auto-ping-sync.ts keeps Slack's scheduled messages in step.
 */

export const ROLES = ["Mentor", "Volunteer", "Judge"] as const;
export type Role = (typeof ROLES)[number];
const DAY_DATES = { Fri: "2026-11-20", Sat: "2026-11-21", Sun: "2026-11-22" };
export type Day = keyof typeof DAY_DATES;
const DAYS = Object.keys(DAY_DATES) as Day[];
const DAY_WORDS: Record<string, Day> = {
  fri: "Fri",
  friday: "Fri",
  sat: "Sat",
  saturday: "Sat",
  sun: "Sun",
  sunday: "Sun",
};

/** Minutes before the first shift that the check-in goes. */
export const CHECKIN_LEAD_MIN = 30;
/** Minutes before every later shift that its reminder goes. */
export const REMINDER_LEAD_MIN = 15;
/** Shifts this close together are one stretch: no "wrap" or "starts soon". */
export const BACK_TO_BACK_MIN = 60;
/** "Last day" goes at 8:00 AM Sunday, for shifts that start after it. */
export const LAST_DAY_MIN = 8 * 60;
const MIN = 60_000;

/** Slack ids for POCs, by nameKey(). */
export const KNOWN_POC_IDS: Record<string, string> = {
  "jess xing": "U0CGMK4KX9A",
  "jessica xing": "U0CGMK4KX9A",
  "emily liu": "U0CHE5NL5H7", // users.lookupByEmail on her Contacts email
};
export const DEFAULT_POC = "@Jess Xing";
/** Display names for mentions, for the Planned messages tab. */
export const SLACK_NAMES: Record<string, string> = {
  U0CGMK4KX9A: "Jess Xing",
  U0CHE5NL5H7: "Emily Liu",
};

/** Slack text as a person reads it: mentions as @Name, escapes undone. */
export function displayText(
  text: string,
  names: Record<string, string> = SLACK_NAMES,
): string {
  return text
    .replace(/<@([UW][A-Z0-9]+)>/g, (m, id: string) =>
      names[id] ? `@${names[id]}` : m,
    )
    .replace(/<#(C[A-Z0-9]+)>/g, "#$1")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

export type Shift = {
  role: Role;
  day: Day;
  /** Minutes from midnight of `day`; end may pass 1440 (after midnight). */
  startMin: number;
  endMin: number;
  start: Date;
  end: Date;
  label: string;
};

function instant(day: Day, minutes: number): Date {
  // November is EST (UTC-5) all weekend.
  return new Date(
    Date.parse(`${DAY_DATES[day]}T00:00:00-05:00`) + minutes * MIN,
  );
}

/** 1200 -> "8pm", 510 -> "8:30am". */
export function clockLabel(minutes: number): string {
  const m = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  return `${h % 12 === 0 ? 12 : h % 12}${mm ? `:${String(mm).padStart(2, "0")}` : ""}${h < 12 ? "am" : "pm"}`;
}

export function makeShift(
  role: Role,
  day: Day,
  startMin: number,
  endMin: number,
): Shift {
  let d = DAYS.indexOf(day);
  let start = startMin;
  let end = endMin;
  while (start >= 1440 && d < DAYS.length - 1) {
    d++;
    start -= 1440;
    end -= 1440;
  }
  const at = DAYS[d]!;
  return {
    role,
    day: at,
    startMin: start,
    endMin: end,
    start: instant(at, start),
    end: instant(at, end),
    label: `${at} ${clockLabel(start)}-${clockLabel(end)}`,
  };
}

function toMinutes(h: number, m: number, meridiem: string): number | null {
  if (h < 1 || h > 12 || m > 59) return null;
  return ((h % 12) + (meridiem.toLowerCase() === "pm" ? 12 : 0)) * 60 + m;
}

const RANGE =
  /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)?\s*[-–—]\s*(\d{1,2})(?::(\d{2}))?\s*([ap]m)$/i;
const START_NOTE = /^(\d{1,2})(?::(\d{2}))?\s*([ap]m)\s+start$/i;

/**
 * "8pm - 1am", "3-7pm", "8:30am-1:30pm" to minutes. A start with no am/pm
 * takes the end's ("3-7pm" is 3pm), unless that puts it after the end
 * ("11-1pm" is 11am). An end at or before the start is the next day.
 */
export function parseRange(
  text: string,
): { start: number; end: number } | null {
  const r = RANGE.exec(text.trim());
  if (!r) return null;
  const endMeridiem = r[6]!;
  const end = toMinutes(Number(r[4]), Number(r[5] ?? 0), endMeridiem);
  let start = toMinutes(Number(r[1]), Number(r[2] ?? 0), r[3] ?? endMeridiem);
  if (start === null || end === null) return null;
  if (!r[3] && start > end) {
    start = toMinutes(
      Number(r[1]),
      Number(r[2] ?? 0),
      endMeridiem.toLowerCase() === "pm" ? "am" : "pm",
    )!;
  }
  return { start, end: end <= start ? end + 1440 : end };
}

/** Judges' shifts, typed in People: "Sun 8:30am-1:30pm, Sat 1-3pm". */
export function parseShiftList(
  text: string,
  role: Role,
): { shifts: Shift[]; bad: string[] } {
  const shifts: Shift[] = [];
  const bad: string[] = [];
  for (const part of text
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean)) {
    const m = /^([A-Za-z]+)\s+(.+)$/.exec(part);
    const day = m ? DAY_WORDS[m[1]!.toLowerCase()] : undefined;
    const range = m ? parseRange(m[2]!) : null;
    if (day && range) shifts.push(makeShift(role, day, range.start, range.end));
    else bad.push(part);
  }
  return { shifts, bad };
}

/** One name cell on a schedule grid. */
export type ScheduleEntry = {
  role: Role;
  name: string;
  cell: string;
  /** null when the cell's note isn't one we understand. */
  shift: Shift | null;
  /** For People column D: the shift, or the block plus the raw note. */
  text: string;
  sortAt: number;
};

/**
 * A schedule tab: row 1 days (filled forward), row 2 time blocks, then one
 * name per cell down to the first blank row. "(2am start)" moves the start,
 * "(3-7pm)" replaces the block; any other note leaves the shift unknown.
 * Throws when the tab isn't a schedule (an IMPORTRANGE showing #REF!), so a
 * broken import never reads as "everyone left the schedule".
 */
export function readSchedule(
  grid: string[][],
  role: Role,
  tab: string,
): ScheduleEntry[] {
  const width = Math.max(grid[0]?.length ?? 0, grid[1]?.length ?? 0);
  const columns: { day: Day; start: number; end: number; label: string }[] = [];
  let day: Day | undefined;
  for (let c = 0; c < width; c++) {
    const word = grid[0]?.[c]?.trim().toLowerCase() ?? "";
    if (word) day = DAY_WORDS[word];
    const block = parseRange(grid[1]?.[c] ?? "");
    if (day && block)
      columns[c] = {
        day,
        ...block,
        label: makeShift(role, day, block.start, block.end).label,
      };
  }
  if (!columns.some(Boolean)) {
    throw new Error(
      copy.errors.brokenSchedule(tab, grid[0]?.[0]?.trim() ?? ""),
    );
  }
  const entries: ScheduleEntry[] = [];
  for (const row of grid.slice(2)) {
    // The counts table ("Mentors per shift") follows a blank row.
    if (
      !row.some((cell) => cell.trim()) ||
      row.some((cell) => /per shift/i.test(cell))
    )
      break;
    row.forEach((raw, c) => {
      const cell = raw.trim().replace(/\s+/g, " ");
      const column = columns[c];
      if (!cell || !column || /^\d+$/.test(cell)) return;
      const m = /^(.*?)\s*\(([^()]*)\)$/.exec(cell);
      const name = (m ? m[1]! : cell).trim();
      const note = m?.[2]?.trim();
      const blockStart = instant(column.day, column.start).getTime();
      let shift: Shift | null = makeShift(
        role,
        column.day,
        column.start,
        column.end,
      );
      if (note) {
        const startNote = START_NOTE.exec(note);
        const range = parseRange(note);
        shift = null;
        if (startNote) {
          let s = toMinutes(
            Number(startNote[1]),
            Number(startNote[2] ?? 0),
            startNote[3]!,
          );
          if (s !== null && s < column.start) s += 1440;
          if (s !== null && s < column.end) {
            shift = makeShift(role, column.day, s, column.end);
          }
        } else if (range) {
          const shiftBy =
            column.end > 1440 && range.start < column.start ? 1440 : 0;
          shift = makeShift(
            role,
            column.day,
            range.start + shiftBy,
            range.end + shiftBy,
          );
        }
      }
      entries.push({
        role,
        name,
        cell,
        shift,
        text: shift?.label ?? `${column.label} (${note})`,
        sortAt: shift ? +shift.start : blockStart,
      });
    });
  }
  return entries;
}

/** Lowercase words, without parentheticals: "Aiden (Arman) Alaei" -> "aiden alaei". */
export function nameKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/**
 * How well a schedule name matches a People name: 3 same words in order,
 * 2 same words in any order ("Batra Saksham"), 1 same first and last word
 * (a middle name on one side), 0 no match.
 */
export function matchScore(a: string, b: string): number {
  const ka = nameKey(a);
  const kb = nameKey(b);
  if (!ka || !kb) return 0;
  if (ka === kb) return 3;
  const ta = ka.split(" ");
  const tb = kb.split(" ");
  if ([...ta].sort().join(" ") === [...tb].sort().join(" ")) return 2;
  if (
    ta.length > 1 &&
    tb.length > 1 &&
    ta[0] === tb[0] &&
    ta[ta.length - 1] === tb[tb.length - 1]
  )
    return 1;
  return 0;
}

/** A People tab row (sheet row number `row`; 0 for a row not added yet). */
export type PersonRow = {
  row: number;
  role: Role | null;
  fullName: string;
  /** Column C (formula: override, else the sign-up forms). */
  email: string;
  shift: string;
  poc: string;
  note: string;
  send: boolean;
  check: string;
  override: string;
  /** "Manual row (not on a schedule)": typed Role and Shift used as-is. */
  manual: boolean;
};

/** People columns, found by header so moving or deleting a column is safe. */
const PEOPLE_HEADERS = {
  role: /^role\b/i,
  fullName: /^full name/i,
  email: /^email$/i,
  shift: /^shift/i,
  poc: /^poc\b/i,
  note: /^personal note/i,
  send: /^send\?/i,
  check: /^check before/i,
  override: /^email override/i,
};
export type PeopleColumns = Record<keyof typeof PEOPLE_HEADERS, number>;

export function peopleColumns(header: string[] = []): PeopleColumns {
  const found = {} as PeopleColumns;
  for (const [key, re] of Object.entries(PEOPLE_HEADERS)) {
    const at = header.findIndex((h) => re.test(h.trim()));
    if (at < 0) throw new Error(`People tab has no "${key}" column header`);
    found[key as keyof PeopleColumns] = at;
  }
  return found;
}

/** Column index to letter: 0 -> "A". */
export const columnLetter = (index: number) => String.fromCharCode(65 + index);

export function readPeople(grid: string[][]): PersonRow[] {
  const col = peopleColumns(grid[0]);
  const rows: PersonRow[] = [];
  grid.slice(1).forEach((r, i) => {
    const cell = (c: number) => r[c]?.trim() ?? "";
    const manualAt = (grid[0] ?? []).findIndex((h) =>
      /^manual row/i.test(h.trim()),
    );
    if (!cell(col.role) && !cell(col.fullName)) return;
    rows.push({
      row: i + 2,
      role:
        ROLES.find(
          (role) => role.toLowerCase() === cell(col.role).toLowerCase(),
        ) ?? null,
      fullName: cell(col.fullName).replace(/\s+/g, " "),
      email: cell(col.email),
      shift: cell(col.shift),
      poc: cell(col.poc),
      note: cell(col.note),
      send: cell(col.send).toUpperCase() === "TRUE",
      check: r[col.check] ?? "",
      override: cell(col.override),
      manual: manualAt >= 0 && cell(manualAt).toUpperCase() === "TRUE",
    });
  });
  return rows;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Email override when it's an email, else column C when it is. */
export function emailOf(person: PersonRow): string | null {
  for (const value of [person.override, person.email]) {
    if (EMAIL.test(value)) return value.toLowerCase();
  }
  return null;
}

export type Flag = { text: string; blocking: boolean };
export type RosterRow = PersonRow & {
  shifts: Shift[];
  flags: Flag[];
  /** Recomputed Shift (D) for schedule people; undefined for judges. */
  newShift?: string;
  isNew?: boolean;
};

/** The Slack text for a POC cell: a real mention when we know them. */
export function pocMention(
  poc: string,
  ids: Record<string, string> = KNOWN_POC_IDS,
): { text: string; raw: boolean; known: boolean } {
  const id = ids[nameKey(poc)];
  if (id) return { text: `<@${id}>`, raw: true, known: true };
  return { text: poc.trim(), raw: false, known: !poc.trim() };
}

/** A person on a "... contact info" tab: A name, B email (C phone is never read). */
export type Signup = { role: Role; name: string; email: string };

export function readSignups(grid: string[][], role: Role): Signup[] {
  return grid
    .slice(1)
    .map((r) => ({
      role,
      name: r[0]?.trim().replace(/\s+/g, " ") ?? "",
      email: r[1]?.trim().toLowerCase() ?? "",
    }))
    .filter((s) => s.name && EMAIL.test(s.email));
}

export type EmailMatch =
  | { email: string; loose: string | null }
  | { email: null; reason: "none" | "several" };

/**
 * A schedule name's email: from a People row of that role (Email override,
 * else column C), else that role's contact info tab. The only step that matches
 * names, loosely: the best-scoring names win, People rows before contact info
 * at the same score. Two different emails there is no answer, not a guess.
 */
export function resolveEmail(
  name: string,
  role: Role,
  people: PersonRow[],
  signups: Signup[],
): EmailMatch {
  const candidates = [
    ...people
      .filter((p) => p.role === role && emailOf(p))
      .map((p) => ({ name: p.fullName, email: emailOf(p)!, people: true })),
    ...signups
      .filter((s) => s.role === role)
      .map((s) => ({ ...s, people: false })),
  ]
    .map((c) => ({ ...c, score: matchScore(name, c.name) }))
    .filter((c) => c.score > 0);
  const best = Math.max(0, ...candidates.map((c) => c.score));
  if (!best) return { email: null, reason: "none" };
  const top = candidates.filter((c) => c.score === best);
  const pool = top.some((c) => c.people) ? top.filter((c) => c.people) : top;
  const emails = [...new Set(pool.map((c) => c.email))];
  if (emails.length > 1) return { email: null, reason: "several" };
  return { email: emails[0]!, loose: best < 3 ? pool[0]!.name : null };
}

/**
 * Rebuild People from the schedules. A person is their email: each schedule
 * name is resolved to an email (resolveEmail), then matched to the People
 * row of that role with that email. New emails become new rows with Send?
 * off. A name with no email (or two) is flagged and gets nothing; it's
 * attached to its row by name only so it isn't re-added every sync.
 * Mentor/Volunteer rows no longer on a schedule are flagged and get nothing.
 * Judges keep the shift typed in their row.
 */
export function buildRoster(
  people: PersonRow[],
  entries: ScheduleEntry[],
  signups: Signup[] = [],
  pocIds: Record<string, string> = KNOWN_POC_IDS,
): RosterRow[] {
  const out: RosterRow[] = people.map((p) => ({ ...p, shifts: [], flags: [] }));
  const taken = new Set<RosterRow>();
  // Schedule names -> one group per role and email (or per name, when none).
  const groups = new Map<
    string,
    { role: Role; name: string; match: EmailMatch; entries: ScheduleEntry[] }
  >();
  const resolved = new Map<string, EmailMatch>();
  const scheduled = people.filter((p) => !p.manual); // manual rows never match
  for (const entry of entries) {
    const nk = `${entry.role}|${nameKey(entry.name)}`;
    if (!resolved.has(nk))
      resolved.set(
        nk,
        resolveEmail(entry.name, entry.role, scheduled, signups),
      );
    const match = resolved.get(nk)!;
    const k = match.email ? `${entry.role}|@${match.email}` : nk;
    const group = groups.get(k) ?? {
      role: entry.role,
      name: entry.name,
      match,
      entries: [],
    };
    group.entries.push(entry);
    groups.set(k, group);
  }
  for (const { role, name, match, entries: group } of groups.values()) {
    const free = out.filter(
      (p) => p.role === role && !p.manual && !taken.has(p),
    );
    let row: RosterRow | undefined;
    if (match.email) {
      row = free.find((p) => emailOf(p) === match.email);
      if (!row) {
        // A row for this name with no email yet: it's them. Column C is a
        // formula the bot never writes, so the email is only set in memory.
        row = free.find(
          (p) => !emailOf(p) && matchScore(name, p.fullName) === 3,
        );
        if (row) row.email = match.email;
      }
    } else {
      // No email: attach to the same-name row (if any) only to flag it.
      row = free
        .map((p) => ({ p, score: matchScore(name, p.fullName) }))
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)[0]?.p;
    }
    if (!row) {
      row = {
        row: 0,
        role,
        fullName: name,
        email: "",
        shift: "",
        poc: DEFAULT_POC,
        note: "",
        send: false,
        check: "",
        // A new row's email goes in Email override, so the next sync finds
        // the row by email even when the name match was loose.
        override: match.email ?? "",
        manual: false,
        shifts: [],
        flags: [],
        isNew: true,
      };
      out.push(row);
    }
    taken.add(row);
    if (match.email && match.loose)
      row.flags.push({
        text: copy.flags.guessed(name, match.loose),
        blocking: false,
      });
    if ("reason" in match)
      row.flags.push({
        text: (match.reason === "several"
          ? copy.flags.twoEmails
          : copy.flags.noEmailFor)(name),
        blocking: true,
      });
    const sorted = [...group].sort((a, b) => a.sortAt - b.sortAt);
    const seen = new Set<string>();
    for (const entry of sorted) {
      if (!entry.shift) {
        row.flags.push({
          text: copy.flags.unknownNote(entry.cell),
          blocking: true,
        });
      } else if (!seen.has(entry.shift.label)) {
        seen.add(entry.shift.label);
        row.shifts.push(entry.shift);
      }
    }
    row.newShift = [...new Set(sorted.map((e) => e.text))].join(", ");
  }
  for (const row of out) {
    // Judges (no schedule) and manual rows keep the shift typed in their row.
    if (row.role && (row.role === "Judge" || row.manual)) {
      const { shifts, bad } = parseShiftList(row.shift, row.role);
      row.shifts = shifts;
      for (const text of bad)
        row.flags.push({ text: copy.flags.badShift(text), blocking: true });
      if (!row.shift)
        row.flags.push({ text: copy.flags.noShift, blocking: true });
    } else if (row.role && !taken.has(row)) {
      row.flags.push({ text: copy.flags.removed, blocking: true });
    }
    if (row.role && !emailOf(row) && !row.flags.some((f) => f.blocking))
      row.flags.push({ text: copy.flags.noEmail, blocking: false });
    if (row.role && !pocMention(row.poc, pocIds).known)
      row.flags.push({ text: copy.flags.unknownPoc(row.poc), blocking: false });
  }
  return out;
}

/** Column J: other people's lines kept, the bot's own lines replaced. */
export function checkText(existing: string, flags: Flag[]): string {
  const marker = copy.flags.marker;
  const human = existing
    .split("\n")
    .filter((line) => line.trim() && !line.startsWith(marker));
  return [...human, ...flags.map((f) => `${marker}${f.text}`)].join("\n");
}

export type Messages = {
  /** Templates by lowercased key ("check-in: mentor"). */
  templates: Map<string, string>;
  /** Fill-ins by name ("channel"). */
  fills: Record<string, string>;
};

/** Messages tab: templates by key, and fill-in rows like "{channel}". */
export function readMessages(grid: string[][]): Messages {
  const templates = new Map<string, string>();
  const fills: Record<string, string> = {};
  for (const row of grid.slice(1)) {
    const key = row[0]?.trim() ?? "";
    const value = row[1] ?? "";
    const fill = /^\{(\w+)\}$/.exec(key);
    if (fill) fills[fill[1]!.toLowerCase()] = value.trim();
    else if (key && value.trim()) templates.set(key.toLowerCase(), value);
  }
  return { templates, fills };
}

export type Value = { text: string; raw?: boolean };

/**
 * Fill a template. {note} is optional: blank, its line goes. Every other
 * placeholder is required: blank or unknown, the message is held and the
 * first missing one is returned instead. Template text and values are
 * Slack-escaped; raw values (our own mentions) aren't.
 */
export function renderTemplate(
  template: string,
  values: Record<string, Value | undefined>,
): { text: string } | { missing: string } {
  const lines = template.replace(/\r\n?/g, "\n").split("\n");
  const value = (name: string) => values[name.toLowerCase()];
  for (const line of lines) {
    for (const [, name] of line.matchAll(/\{(\w+)\}/g)) {
      if (name!.toLowerCase() !== "note" && !value(name!)?.text.trim())
        return { missing: `{${name}}` };
    }
  }
  const out: string[] = [];
  for (const line of lines) {
    if (/\{note\}/i.test(line) && !value("note")?.text.trim()) continue;
    out.push(
      line
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = /^\{(\w+)\}$/.exec(part);
          if (!m) return escapeSlackText(part);
          const v = value(m[1]!)!;
          return v.raw ? v.text : escapeSlackText(v.text);
        })
        .join(""),
    );
  }
  return {
    text: out
      .join("\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim(),
  };
}

/** One person to message: every People row with the same email, merged. */
export type Unit = {
  email: string | null;
  name: string;
  firstName: string;
  role: Role;
  rows: RosterRow[];
  shifts: Shift[];
  poc: string;
  note: string;
};

/**
 * People to message. With `gates`, only rows with Send? ticked, an email and
 * no blocking flag count. Rows sharing an email are one person (a mentor who
 * also judges): their shifts merge, and their first shift's row gives the
 * role and POC.
 */
export function groupUnits(rows: RosterRow[], gates = true): Unit[] {
  const groups = new Map<string, RosterRow[]>();
  for (const row of rows) {
    if (!row.role) continue;
    const email = emailOf(row);
    if (gates && (!row.send || !email || row.flags.some((f) => f.blocking)))
      continue;
    const k = email ?? `row:${row.row}:${row.fullName}`;
    groups.set(k, [...(groups.get(k) ?? []), row]);
  }
  return [...groups.values()].map((group) => {
    const shifts: Shift[] = [];
    for (const shift of group
      .flatMap((r) => r.shifts)
      .sort((a, b) => +a.start - +b.start)) {
      if (
        !shifts.some((s) => +s.start === +shift.start && +s.end === +shift.end)
      )
        shifts.push(shift);
    }
    const lead =
      group.find((r) => r.role === shifts[0]?.role && r.shifts.length) ??
      group[0]!;
    const name = lead.fullName;
    return {
      email: emailOf(lead),
      name,
      firstName: nameKey(name)
        ? name
            .replace(/\([^)]*\)/g, " ")
            .trim()
            .split(/\s+/)[0]!
        : name,
      role: lead.role!,
      rows: group,
      shifts,
      poc: lead.poc,
      note: [...new Set(group.map((r) => r.note).filter(Boolean))].join("\n"),
    };
  });
}

type Session = {
  shifts: Shift[];
  start: Date;
  end: Date;
  label: string;
  role: Role;
};

/** Shifts with under an hour between them are one stretch on site. */
export function sessions(shifts: Shift[]): Session[] {
  const out: Session[] = [];
  for (const shift of shifts) {
    const last = out[out.length - 1];
    if (last && +shift.start - +last.end < BACK_TO_BACK_MIN * MIN) {
      last.shifts.push(shift);
      if (+shift.end > +last.end) last.end = shift.end;
    } else {
      out.push({
        shifts: [shift],
        start: shift.start,
        end: shift.end,
        label: shift.label,
        role: shift.role,
      });
    }
  }
  for (const s of out) {
    if (s.shifts.length > 1) {
      const first = s.shifts[0]!;
      const endMin = first.startMin + (+s.end - +s.start) / MIN;
      s.label = `${first.day} ${clockLabel(first.startMin)}-${clockLabel(endMin)}`;
    }
  }
  return out;
}

export type Kind = "checkin" | "reminder" | "after" | "lastDay" | "final";
export type Planned = {
  /** Stable per person and message: "email|checkin", "email|reminder-2". */
  key: string;
  kind: Kind;
  /** The Messages tab key ("Shift reminder: last shift"). */
  template: string;
  email: string | null;
  name: string;
  role: Role;
  rows: number[];
  postAt: Date;
  /** Sent late until then: a Check-in until the first stretch ends; anything else not at all. */
  deadline: Date;
  /** null when held: `missing` names the blank placeholder. */
  text: string | null;
  missing: string | null;
};

const ORDINALS = ["", "second", "third"];

/**
 * Which "Shift reminder" a person's stretch #n (1-based, n >= 2) gets: their
 * last one is "last shift", #2 and #3 are "second" and "third", and a 4th
 * that isn't the last gets none (the "third" text says "Shift #3").
 */
export function reminderOrdinal(n: number, total: number): string | null {
  if (n === total) return "last";
  return ORDINALS[n - 1] ?? null;
}

function message(
  unit: Unit,
  kind: Kind,
  suffix: string,
  template: string,
  postAt: Date,
  deadline: Date,
  values: Record<string, Value | undefined>,
  messages: Messages,
): Planned {
  const body = messages.templates.get(template.toLowerCase());
  const rendered = body
    ? renderTemplate(body, values)
    : { missing: `"${template}"` };
  return {
    key: `${unit.email ?? unit.name}|${suffix}`,
    kind,
    template,
    email: unit.email,
    name: unit.name,
    role: unit.role,
    rows: unit.rows.map((r) => r.row),
    postAt,
    deadline,
    text: "text" in rendered ? rendered.text : null,
    missing: "missing" in rendered ? rendered.missing : null,
  };
}

const CHANNEL_ID = /^C[A-Z0-9]{8,}$/;
/** A fill-in's value: a Slack channel id becomes a #channel link. */
export function fillValue(value: string): Value {
  return CHANNEL_ID.test(value)
    ? { text: `<#${value}>`, raw: true }
    : { text: value };
}

function baseValues(
  unit: Unit,
  messages: Messages,
  pocIds: Record<string, string>,
): Record<string, Value | undefined> {
  const values: Record<string, Value | undefined> = {};
  for (const [k, v] of Object.entries(messages.fills)) values[k] = fillValue(v);
  return {
    ...values,
    first_name: { text: unit.firstName },
    shift: { text: unit.shifts.map((s) => s.label).join(", ") },
    poc: pocMention(unit.poc, pocIds),
    note: { text: unit.note },
  };
}

/** Every timed message for one person, in time order. */
export function planUnit(
  unit: Unit,
  messages: Messages,
  pocIds: Record<string, string> = KNOWN_POC_IDS,
): Planned[] {
  const stretches = sessions(unit.shifts);
  if (!stretches.length) return [];
  const base = baseValues(unit, messages, pocIds);
  const with_ = (thisShift: string, nextShift?: string) => ({
    ...base,
    this_shift: { text: thisShift },
    next_shift: nextShift ? { text: nextShift } : undefined,
  });
  const out: Planned[] = [];
  const first = stretches[0]!;
  out.push(
    message(
      unit,
      "checkin",
      "checkin",
      `Check-in: ${first.role}`,
      new Date(+first.start - CHECKIN_LEAD_MIN * MIN),
      first.end,
      with_(first.label, stretches[1]?.label),
      messages,
    ),
  );
  stretches.forEach((s, i) => {
    const next = stretches[i + 1];
    if (i > 0) {
      const ordinal = reminderOrdinal(i + 1, stretches.length);
      if (ordinal)
        out.push(
          message(
            unit,
            "reminder",
            `reminder-${i + 1}`,
            `Shift reminder: ${ordinal} shift`,
            new Date(+s.start - REMINDER_LEAD_MIN * MIN),
            new Date(+s.start - REMINDER_LEAD_MIN * MIN),
            with_(s.label, next?.label),
            messages,
          ),
        );
    }
    if (next)
      out.push(
        message(
          unit,
          "after",
          `after-${i + 1}`,
          "After a shift",
          s.end,
          s.end,
          with_(s.label, next.label),
          messages,
        ),
      );
  });
  // The template says "It's the last day of Hack Western 13": Sunday only.
  const lastDay = unit.shifts[unit.shifts.length - 1]!.day;
  const today = unit.shifts.filter(
    (s) => s.day === lastDay && s.startMin > LAST_DAY_MIN,
  );
  if (lastDay === "Sun" && unit.shifts[0]!.day !== "Sun" && today.length) {
    const at = instant(lastDay, LAST_DAY_MIN);
    out.push(
      message(
        unit,
        "lastDay",
        "last-day",
        "Last day",
        at,
        at,
        with_(today.map((s) => s.label).join(", ")),
        messages,
      ),
    );
  }
  return out.sort((a, b) => +a.postAt - +b.postAt);
}

/**
 * The final thank you, sent by hand (--send-final). Its role is the
 * person's first shift's, the same as their check-in.
 */
export function planFinal(
  unit: Unit,
  messages: Messages,
  now: Date,
  pocIds: Record<string, string> = KNOWN_POC_IDS,
): Planned {
  const stretches = sessions(unit.shifts);
  return message(
    unit,
    "final",
    "final",
    `Final thank you: ${unit.role}`,
    now,
    now,
    {
      ...baseValues(unit, messages, pocIds),
      this_shift: stretches.length
        ? { text: stretches[stretches.length - 1]!.label }
        : undefined,
    },
    messages,
  );
}

/** Every gated person's timed messages. */
export function planAll(
  rows: RosterRow[],
  messages: Messages,
  pocIds: Record<string, string> = KNOWN_POC_IDS,
): Planned[] {
  return groupUnits(rows)
    .flatMap((unit) => planUnit(unit, messages, pocIds))
    .sort((a, b) => +a.postAt - +b.postAt);
}
