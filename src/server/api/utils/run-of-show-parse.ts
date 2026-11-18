/**
 * Pure parsing for the run-of-show Google Sheet (no googleapis, no env).
 * src/server/api/utils/run-of-show-sheet.ts fetches the cells and merges and
 * hands them here; the contract lives in src/lib/run-of-show.ts.
 */
import {
  parseCoffeeChatDuration,
  parseCoffeeChatGroupSize,
  parseSheetTime,
} from "~/lib/coffee-chat-requests";
import {
  RUN_OF_SHOW_COLUMNS,
  RUN_OF_SHOW_DAYS,
  compareRunOfShow,
  locationFor,
  type CeremonyKind,
  type CeremonySegment,
  type CoffeeChatSetup,
  type RunOfShowColumn,
  type RunOfShowDay,
  type RunOfShowItem,
  type RunOfShowTask,
  type WorkshopInfo,
} from "~/lib/run-of-show";

/** Formatted cell text, row-major, 0-based from A1. Missing cells = "". */
export type SheetGrid = string[][];

/** A merged range, 0-based, end exclusive (same as the Sheets API). */
export type SheetMerge = {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
};

/** Everything read from the sheet, before sponsor names are matched. */
export type ParsedRunOfShow = {
  items: RunOfShowItem[];
  tasks: RunOfShowTask[];
  coffeeChats: CoffeeChatSetup[];
  ceremonies: CeremonySegment[];
  workshops: WorkshopInfo[];
};

const SLOT_MINUTES = 30;
const COLUMN_ORDER = RUN_OF_SHOW_COLUMNS.map((c) => c.key);

function cell(grid: SheetGrid, row: number, col: number): string {
  return String(grid[row]?.[col] ?? "").trim();
}

function norm(text: string): string {
  return text.toLowerCase().replace(/\s+/g, "");
}

function minutesOf(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

function timeOf(minutes: number): string {
  if (minutes >= 24 * 60) return "24:00";
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function asDay(text: string): RunOfShowDay | null {
  const t = text.trim().toLowerCase();
  return RUN_OF_SHOW_DAYS.find((d) => d.toLowerCase() === t) ?? null;
}

/**
 * "Dinner \n\nLocation: Rm 1230" -> { title: "Dinner", location: "Rm 1230" }.
 * Title whitespace collapses to single spaces; location lines join with ", ".
 * A blank or placeholder location ("____") is null.
 */
export function splitLocation(text: string): {
  title: string;
  location: string | null;
} {
  const match = /location\s*:/i.exec(text);
  const rawTitle = match ? text.slice(0, match.index) : text;
  const title = rawTitle.replace(/\s+/g, " ").trim();
  if (!match) return { title, location: null };
  const location = text
    .slice(match.index + match[0].length)
    .split(/\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(", ");
  return { title, location: /^[_\s-]*$/.test(location) ? null : location };
}

/**
 * Registered sponsor names mentioned in `text`, case-insensitive and ignoring
 * spaces ("Sunlife Workshop" matches "Sun Life"). Sorted by name.
 */
export function matchSponsors(text: string, sponsorNames: string[]): string[] {
  const haystack = norm(text);
  return sponsorNames
    .filter((name) => {
      const needle = norm(name);
      return needle.length > 0 && haystack.includes(needle);
    })
    .sort((a, b) => a.localeCompare(b));
}

function findMerge(
  merges: SheetMerge[],
  row: number,
  col: number,
): SheetMerge | undefined {
  return merges.find(
    (m) =>
      row >= m.startRow && row < m.endRow && col >= m.startCol && col < m.endCol,
  );
}

/** Text of a cell, or of the top-left of the merge containing it. */
function mergedCell(
  grid: SheetGrid,
  merges: SheetMerge[],
  row: number,
  col: number,
): string {
  const m = findMerge(merges, row, col);
  return m ? cell(grid, m.startRow, m.startCol) : cell(grid, row, col);
}

/**
 * Parse the "RUN OF SHOW" tab. Columns are found by header name (the row whose
 * first cell is "Time (EST)"); each "Task" column pairs with the "Owner"
 * column right after it. Throws when the header row is missing.
 */
export function parseRunOfShowTab(
  grid: SheetGrid,
  merges: SheetMerge[],
): { items: RunOfShowItem[]; tasks: RunOfShowTask[] } {
  const headerRow = grid.findIndex((row) =>
    /^time\b/i.test(String(row?.[0] ?? "").trim()),
  );
  if (headerRow < 0) throw new Error("RUN OF SHOW: no header row found");
  const headers = (grid[headerRow] ?? []).map((h) => norm(String(h ?? "")));

  const columns: { col: number; key: RunOfShowColumn }[] = [];
  for (const c of RUN_OF_SHOW_COLUMNS) {
    const col = headers.indexOf(norm(c.header));
    if (col >= 0) columns.push({ col, key: c.key });
  }
  const taskPairs: { task: number; owner: number | null }[] = [];
  headers.forEach((h, col) => {
    if (h === "task") {
      taskPairs.push({ task: col, owner: headers[col + 1] === "owner" ? col + 1 : null });
    }
  });

  // Day and time of every row (null for markers, blanks, title rows).
  const rowDay: (RunOfShowDay | null)[] = [];
  const rowTime: (string | null)[] = [];
  let day: RunOfShowDay | null = null;
  for (let r = 0; r < grid.length; r++) {
    const time = r > headerRow ? parseSheetTime(cell(grid, r, 0)) : null;
    if (r > headerRow && !time && !cell(grid, r, 0)) {
      const marker = asDay(cell(grid, r, 1));
      if (marker) day = marker;
    }
    rowDay.push(time ? day : null);
    rowTime.push(time && day ? time : null);
  }

  const endOf = (start: number, lastRow: number): string => {
    let last = lastRow;
    while (last > start && !rowTime[last]) last--;
    const lastTime = rowTime[last]!;
    // The block ends where the next timed row starts, unless the merge ran
    // into a blank row or a day marker: then it's the last slot + 30 min.
    const next = last === lastRow ? rowTime[lastRow + 1] : null;
    if (next && rowDay[lastRow + 1] === rowDay[last]) {
      const nextMin = minutesOf(next);
      return nextMin > minutesOf(lastTime) ? next : "24:00";
    }
    return timeOf(minutesOf(lastTime) + SLOT_MINUTES);
  };

  const items: RunOfShowItem[] = [];
  const tasks: RunOfShowTask[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const start = rowTime[r];
    const rDay = rowDay[r];
    if (!start || !rDay) continue;

    for (const { col, key } of columns) {
      const text = cell(grid, r, col);
      if (!text) continue;
      const merge = findMerge(merges, r, col);
      if (merge && (merge.startRow !== r || merge.startCol !== col)) continue;
      const { title, location } = splitLocation(text);
      items.push({
        id: `${rDay}-${start}-${key}`,
        day: rDay,
        start,
        end: merge
          ? endOf(r, merge.endRow - 1)
          : timeOf(minutesOf(start) + SLOT_MINUTES),
        column: key,
        title: title !== "" ? title : (location ?? ""),
        location,
        sponsors: [],
      });
    }

    for (const pair of taskPairs) {
      const task = cell(grid, r, pair.task);
      if (!task) continue;
      const owner =
        pair.owner === null ? "" : mergedCell(grid, merges, r, pair.owner);
      tasks.push({ day: rDay, start, task, owner: owner || null });
    }
  }

  items.sort(
    (a, b) =>
      compareRunOfShow(a, b) ||
      COLUMN_ORDER.indexOf(a.column) - COLUMN_ORDER.indexOf(b.column),
  );
  return { items, tasks };
}

function toCount(text: string): number | null {
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

/** "2", "2.5" -> hours; null when blank or not a number. */
function toHours(text: string): number | null {
  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  return Number(text);
}

/**
 * Parse the "Coffee Chats" tab (header in row 1, matched by name). Skips
 * blank names and the "Total" row. A row with only a name is a sponsor not
 * set up yet: windowStart/windowEnd null.
 */
export function parseCoffeeChatsTab(grid: SheetGrid): CoffeeChatSetup[] {
  const headers = (grid[0] ?? []).map((h) => norm(String(h ?? "")));
  const col = (name: string) => headers.indexOf(norm(name));
  const sponsorCol = col("Sponsor");
  if (sponsorCol < 0) throw new Error("Coffee Chats: no Sponsor column");
  const at = (row: number, c: number) => (c < 0 ? "" : cell(grid, row, c));
  const cols = {
    start: col("AVAILABILITY START"),
    end: col("AVAILABILITY END"),
    hours: col("CHATTING HOURS"),
    slots: col("SLOTS"),
    hackers: col("HACKERS CHATTING"),
    format: col("FORMAT"),
    notes: col("NOTES"),
    room: col("ROOM"),
  };

  const setups: CoffeeChatSetup[] = [];
  for (let r = 1; r < grid.length; r++) {
    const sponsor = at(r, sponsorCol);
    if (!sponsor || norm(sponsor) === "total") continue;
    const format = at(r, cols.format) || null;
    setups.push({
      sponsor,
      windowStart: parseSheetTime(at(r, cols.start)),
      windowEnd: parseSheetTime(at(r, cols.end)),
      durationMinutes: parseCoffeeChatDuration(format),
      groupSize: parseCoffeeChatGroupSize(format),
      chattingHours: toHours(at(r, cols.hours)),
      slots: toCount(at(r, cols.slots)),
      hackers: toCount(at(r, cols.hackers)),
      format,
      notes: at(r, cols.notes) || null,
      room: at(r, cols.room) || null,
    });
  }
  return setups;
}

/** Header text reduced to letters only: "Runner(s)" -> "runners", "#" -> "no". */
function headerKey(text: string): string {
  if (text.trim() === "#") return "no";
  return text.toLowerCase().replace(/[^a-z]/g, "");
}

/** Index of the first header matching any alias; -1 when none does. */
function findColumn(headers: string[], aliases: readonly string[]): number {
  return headers.findIndex((h) => h !== "" && aliases.includes(h));
}

/** "7:42 PM", "7:42pm" or "19:42" -> "19:42" (any minute). Null otherwise. */
export function parseClockTime(text: string): string | null {
  const m = /^\s*(\d{1,2}):(\d{2})\s*(am|pm)?\s*$/i.exec(text);
  if (!m) return null;
  let hour = Number(m[1]);
  const minute = Number(m[2]);
  const suffix = m[3]?.toLowerCase();
  if (minute > 59) return null;
  if (suffix) {
    if (hour < 1 || hour > 12) return null;
    hour = (hour % 12) + (suffix === "pm" ? 12 : 0);
  } else if (hour > 23) {
    return null;
  }
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** "3 mins", "(1 min)", "5" -> minutes. Null when there's no number. */
function parseMinutes(text: string): number | null {
  const m = /(\d+)\s*(?:min|$)/i.exec(text.trim());
  return m ? Number(m[1]) : null;
}

/** One name per line or per ";". Commas stay: "Rob Craig, Manager ...". */
function splitPeople(text: string): string[] {
  return text
    .split(/[\n;]/)
    .map((p) => p.replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function asDayLoose(text: string): RunOfShowDay | null {
  const t = text.trim().toLowerCase().slice(0, 3);
  if (t.length < 3) return null;
  return RUN_OF_SHOW_DAYS.find((d) => d.toLowerCase().startsWith(t)) ?? null;
}

/*
 * "Opening + Closing Ceremonies" tab. Layout seen in the sheet export
 * (2026-11-14):
 *
 *   Task | Who | Notes                        <- team checklist, ignored
 *   Opening Speakers                          <- section title
 *   Company | Speaker                         <- header
 *   Canada Life (1 min) | Rob Craig, Manager Emerging Talent and Programs
 *   Manulife (1 min) |                        <- speaker not confirmed yet
 *   Closing Speakers
 *   Company | Speaker
 *   Scotiabank (1 mins) |
 *
 * Columns are found by header name, so organizers can add any of these
 * (case and punctuation ignored):
 *   Company / Sponsor          the company; "(N min)" in it is the duration
 *   Speaker(s) / Presenter(s)  one person per line or per ";"
 *   Order / # / Slot           running order (default: row order)
 *   Time / Start / Start time  e.g. "7:42 PM"
 *   Duration / Length / Mins   e.g. "3 mins"
 *   Topic / Segment / Title    what the slot is (default: the company)
 *   Ceremony                   "Opening"/"Closing", for one combined table
 * A section title is a row whose only text mentions "opening" or "closing".
 */
const CEREMONY_HEADERS = {
  sponsor: ["company", "sponsor", "companies", "sponsors"],
  speakers: ["speaker", "speakers", "presenter", "presenters"],
  order: ["order", "no", "slot", "runningorder"],
  start: ["time", "start", "starttime", "timeest"],
  duration: ["duration", "length", "mins", "minutes"],
  title: ["topic", "segment", "title", "item"],
  ceremony: ["ceremony"],
} as const;

const CEREMONY_ORDER: CeremonyKind[] = ["opening", "closing"];

function ceremonyOf(text: string): CeremonyKind | null {
  if (/opening/i.test(text)) return "opening";
  if (/closing/i.test(text)) return "closing";
  return null;
}

/** Parse the ceremonies tab. Never throws: an unknown layout is []. */
export function parseCeremoniesTab(grid: SheetGrid): CeremonySegment[] {
  const segments: CeremonySegment[] = [];
  let section: CeremonyKind | null = null;
  let cols: Record<keyof typeof CEREMONY_HEADERS, number> | null = null;
  const count: Record<CeremonyKind, number> = { opening: 0, closing: 0 };

  for (const gridRow of grid) {
    const row = (gridRow ?? []).map((c) => String(c ?? "").trim());
    const filled = row.filter(Boolean);
    if (filled.length === 0) continue;

    const keys = row.map(headerKey);
    const sponsorCol = findColumn(keys, CEREMONY_HEADERS.sponsor);
    const speakersCol = findColumn(keys, CEREMONY_HEADERS.speakers);
    if (sponsorCol >= 0 && (speakersCol >= 0 || findColumn(keys, CEREMONY_HEADERS.title) >= 0)) {
      cols = {
        sponsor: sponsorCol,
        speakers: speakersCol,
        order: findColumn(keys, CEREMONY_HEADERS.order),
        start: findColumn(keys, CEREMONY_HEADERS.start),
        duration: findColumn(keys, CEREMONY_HEADERS.duration),
        title: findColumn(keys, CEREMONY_HEADERS.title),
        ceremony: findColumn(keys, CEREMONY_HEADERS.ceremony),
      };
      continue;
    }
    if (filled.length === 1 && ceremonyOf(filled[0]!)) {
      section = ceremonyOf(filled[0]!);
      continue;
    }
    if (!cols) continue;

    const at = (c: number) => (c < 0 ? "" : (row[c] ?? ""));
    const ceremony = ceremonyOf(at(cols.ceremony)) ?? section;
    const company = at(cols.sponsor);
    const topic = at(cols.title);
    if (!ceremony || (!company && !topic)) continue;

    const durationText = /\(([^)]*\d[^)]*)\)/.exec(company)?.[1] ?? "";
    const sponsor = company.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
    const order = Number.parseInt(at(cols.order), 10);
    count[ceremony] += 1;
    segments.push({
      ceremony,
      order: Number.isFinite(order) ? order : count[ceremony],
      start: parseClockTime(at(cols.start)),
      durationMinutes:
        parseMinutes(at(cols.duration)) ?? parseMinutes(durationText),
      title: topic || sponsor,
      sponsor: sponsor || null,
      speakers: splitPeople(at(cols.speakers)),
    });
  }
  return segments.sort(
    (a, b) =>
      CEREMONY_ORDER.indexOf(a.ceremony) - CEREMONY_ORDER.indexOf(b.ceremony) ||
      a.order - b.order,
  );
}

/*
 * "Workshops" tab. Layout seen in the sheet export (2026-11-14):
 *
 *   Workshop | Description | Notes            <- header, row 1
 *   Canada Life: Women in Technology Panel | Join a panel of ...
 *   Scotiabank Workshop 1 |                   <- no description yet
 *   (blank)
 *   Notes | Noah will make sure hosts are there!   <- end of the list
 *
 * The tab has no runner, time or room columns yet. Columns are found by
 * header name, so organizers can add any of these:
 *   Workshop / Title / Session     the workshop (required)
 *   Description / Abstract         shown to the sponsor
 *   Sponsor / Company              default: matched from the title
 *   Runner(s) / Host(s) / Speaker(s) / Presenter(s) / Facilitator(s) / Run by
 *   Day                            "Saturday" / "Sat"
 *   Time / Start                   e.g. "10:00 AM"
 *   Room / Location
 * Time and room missing here come from the workshop's block on RUN OF SHOW
 * (attachWorkshopTimes).
 */
const WORKSHOP_HEADERS = {
  title: ["workshop", "title", "session", "workshops", "name"],
  description: ["description", "abstract", "blurb", "details"],
  sponsor: ["sponsor", "company"],
  runners: [
    "runner", "runners", "runby", "host", "hosts", "hostedby", "speaker",
    "speakers", "presenter", "presenters", "facilitator", "facilitators",
    "lead", "leads",
  ],
  day: ["day"],
  start: ["time", "start", "starttime", "timeest"],
  room: ["room", "location"],
} as const;

/** Parse the Workshops tab. Never throws: an unknown layout is []. */
export function parseWorkshopsTab(grid: SheetGrid): WorkshopInfo[] {
  const headerRow = grid.findIndex(
    (row) => findColumn((row ?? []).map((c) => headerKey(String(c ?? ""))), WORKSHOP_HEADERS.title) >= 0,
  );
  if (headerRow < 0) return [];
  const keys = (grid[headerRow] ?? []).map((c) => headerKey(String(c ?? "")));
  const col = (k: keyof typeof WORKSHOP_HEADERS) => findColumn(keys, WORKSHOP_HEADERS[k]);
  const cols = {
    title: col("title"),
    description: col("description"),
    sponsor: col("sponsor"),
    runners: col("runners"),
    day: col("day"),
    start: col("start"),
    room: col("room"),
  };

  const workshops: WorkshopInfo[] = [];
  for (let r = headerRow + 1; r < grid.length; r++) {
    const at = (c: number) => (c < 0 ? "" : cell(grid, r, c));
    const title = at(cols.title).replace(/\s+/g, " ");
    if (!title) continue;
    if (headerKey(title) === "notes") break;
    workshops.push({
      title,
      sponsor: at(cols.sponsor) || null,
      runners: splitPeople(at(cols.runners)),
      day: asDayLoose(at(cols.day)),
      start: parseClockTime(at(cols.start)),
      room: at(cols.room) || null,
      description: at(cols.description) || null,
    });
  }
  return workshops;
}

/** Longest registered name in `text`, or null. */
function bestSponsor(text: string, sponsorNames: string[]): string | null {
  const [match] = matchSponsors(text, sponsorNames).sort(
    (a, b) => b.length - a.length,
  );
  return match ?? null;
}

function firstWord(text: string): string {
  return norm(text.split(/[\s:]/)[0] ?? "");
}

/**
 * Fill each workshop's missing day/start/room from its block in the RUN OF
 * SHOW "Sponsor Workshop" column: a sponsor's Nth workshop row takes their
 * Nth block in time order ("Scotiabank Workshop 2" -> the second). Blocks
 * shared by several sponsors (judging) are skipped. A workshop without a
 * sponsor matches blocks with none whose title starts with the same word
 * ("MLH" -> "MLH Workshop").
 */
export function attachWorkshopTimes(
  workshops: WorkshopInfo[],
  items: RunOfShowItem[],
): WorkshopInfo[] {
  const blocks = items
    .filter((i) => i.column === "sponsor-workshop" && i.sponsors.length <= 1)
    .sort(compareRunOfShow);
  const keyOfBlock = (i: RunOfShowItem) => i.sponsors[0] ?? firstWord(i.title);
  const used = new Map<string, number>();
  return workshops.map((w) => {
    const key = w.sponsor ?? firstWord(w.title);
    const nth = used.get(key) ?? 0;
    used.set(key, nth + 1);
    const block = blocks.filter((b) => keyOfBlock(b) === key)[nth];
    if (!block) return w;
    return {
      ...w,
      day: w.day ?? block.day,
      start: w.start ?? block.start,
      room:
        w.room ??
        (block.location && w.sponsor
          ? locationFor(block.location, w.sponsor)
          : block.location),
    };
  });
}

/**
 * Fill in `sponsors` on every item (from its title) and rename each Coffee
 * Chats row, ceremony slot and workshop to its registered sponsor name when
 * one matches. Workshops also get their time and room from RUN OF SHOW.
 */
export function applySponsorNames(
  // Ceremonies and workshops are optional for callers that only need
  // items and coffee chats (they come back empty).
  parsed: Omit<ParsedRunOfShow, "ceremonies" | "workshops"> &
    Partial<Pick<ParsedRunOfShow, "ceremonies" | "workshops">>,
  sponsorNames: string[],
): ParsedRunOfShow {
  const items = parsed.items.map((item) => ({
    ...item,
    // Title and location: Sunday judging names each sponsor's room only in
    // the location ("Scotiabank: Rm 2110, Canada Life: Rm 2230").
    sponsors: matchSponsors(
      `${item.title} ${item.location ?? ""}`,
      sponsorNames,
    ),
  }));
  const workshops = (parsed.workshops ?? []).map((w) => ({
    ...w,
    sponsor: w.sponsor
      ? (bestSponsor(w.sponsor, sponsorNames) ?? w.sponsor)
      : bestSponsor(w.title, sponsorNames),
  }));
  return {
    items,
    tasks: parsed.tasks,
    coffeeChats: parsed.coffeeChats.map((setup) => {
      const match = bestSponsor(setup.sponsor, sponsorNames);
      return match ? { ...setup, sponsor: match } : setup;
    }),
    ceremonies: (parsed.ceremonies ?? []).map((s) => ({
      ...s,
      sponsor: s.sponsor
        ? (bestSponsor(s.sponsor, sponsorNames) ?? s.sponsor)
        : null,
    })),
    workshops: attachWorkshopTimes(workshops, items),
  };
}
