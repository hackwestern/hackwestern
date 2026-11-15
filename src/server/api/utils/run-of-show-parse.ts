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
  type CoffeeChatSetup,
  type RunOfShowColumn,
  type RunOfShowDay,
  type RunOfShowItem,
  type RunOfShowTask,
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
    slots: col("SLOTS"),
    hackers: col("HACKERS CHATTING"),
    format: col("FORMAT"),
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
      slots: toCount(at(r, cols.slots)),
      hackers: toCount(at(r, cols.hackers)),
      format,
      room: at(r, cols.room) || null,
    });
  }
  return setups;
}

/**
 * Fill in `sponsors` on every item (from its title) and rename each Coffee
 * Chats row to its registered sponsor name when one matches.
 */
export function applySponsorNames(
  parsed: ParsedRunOfShow,
  sponsorNames: string[],
): ParsedRunOfShow {
  return {
    items: parsed.items.map((item) => ({
      ...item,
      // Title and location: Sunday judging names each sponsor's room only in
      // the location ("Scotiabank: Rm 2110, Canada Life: Rm 2230").
      sponsors: matchSponsors(
        `${item.title} ${item.location ?? ""}`,
        sponsorNames,
      ),
    })),
    tasks: parsed.tasks,
    coffeeChats: parsed.coffeeChats.map((setup) => {
      const [match] = matchSponsors(setup.sponsor, sponsorNames).sort(
        (a, b) => b.length - a.length,
      );
      return match ? { ...setup, sponsor: match } : setup;
    }),
  };
}
