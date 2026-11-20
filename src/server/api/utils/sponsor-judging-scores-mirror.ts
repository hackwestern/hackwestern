import { waitUntil } from "@vercel/functions";
import { and, inArray, isNotNull } from "drizzle-orm";
import { google } from "googleapis";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import {
  formatPresentationTime,
  PRESENTATION_SLOTS_PER_ROOM,
} from "~/lib/sponsor-presentations";
import {
  isDigitalJudging,
  prizeTrackOf,
  remoteJudgingRoom,
} from "~/lib/sponsor-prize-tracks";
import { cleanJudgeName, halvesToScore, judgeKey } from "~/lib/sponsor-scoring";
import {
  SHEET_WRITES_DISABLED,
  type MirrorResult,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import {
  runOfShowCredentials,
  runOfShowSpreadsheetId,
  sheetWritesEnabled,
} from "~/server/api/utils/run-of-show-sheet";
import { prizeTrackSponsors } from "~/server/api/utils/sponsor-prize-track-sheet";
import { db } from "~/server/db";
import {
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorTeamScores,
  teams,
} from "~/server/db/schema";

/**
 * The live "Judging Scores" tab of the run-of-show sheet (Jazz,
 * 2026-11-19): the reps' round 1 presentation scores, and the backup if the
 * app is down. One block per in-person prize track sponsor:
 *
 *   <Sponsor> | <Room>
 *   Time | Team ID | Devpost | <rep> ... (SCORES_REP_COLUMNS) | Average
 *   one row per presenting team, in presentation order
 *
 * The app is the source of truth; the sheet is the outage backup. Where
 * the app has a value (a score, a team's time or Devpost link) the app's
 * value wins and overwrites the cell. A hand-typed cell survives only where
 * the app has no value: a score for a team and rep the app has no score
 * for, or a cell outside the app's blocks. So unlike the Sponsor Judging
 * mirror this one never rewrites the tab: it reads the tab, then writes
 * only cells it has a value for (plus a rep's name over an empty or "Rep N"
 * header, and the Average formula into an empty cell). It never writes an
 * empty value, so it never blanks a cell (a score cleared in the app stays
 * in the sheet), and it never touches columns right of Average. Blocks are
 * found by the sponsor name in column A, so blocks made by hand are reused;
 * a team keeps the row that has its team ID, and a rep the column with
 * their name.
 *
 * Production only (sheetWritesEnabled). Runs in the background after a
 * score is saved and after Schedule presentations, at most once every
 * SCORES_MIN_INTERVAL_MS (Sheets allows 60 reads a minute per user, shared
 * with the other mirrors); a failure is logged once and never blocks the
 * save.
 */

const copy = sponsorJudgingCopy.scoresSheet;
export const SCORES_TAB = copy.tab;
/**
 * Rep columns per block (D to I): Time, Team ID, Devpost, six reps and
 * Average fill A to J. More reps than this aren't written (logged once per
 * sponsor).
 */
export const SCORES_REP_COLUMNS = 6;
const TIME_COL = 0;
const TEAM_COL = 1;
const LINK_COL = 2;
const REP_COL = 3;
const AVG_COL = REP_COL + SCORES_REP_COLUMNS;
/** The app's columns: A to Average. Nothing to the right is touched. */
export const SCORES_WIDTH = AVG_COL + 1;
/** 0-based: row 1 is the note, row 2 blank, blocks from row 3. */
export const SCORES_FIRST_BLOCK_ROW = 2;
/** Title row, header row, then one row per presentation slot. */
export const SCORES_BLOCK_ROWS = 2 + PRESENTATION_SLOTS_PER_ROOM;
/** Blank rows between blocks. */
const BLOCK_GAP = 1;

export type ScoresTeam = {
  /** Minutes after midnight. */
  start: number;
  teamId: string;
  devpostUrl: string | null;
  /** One per rep, by rep name. */
  scores: { judge: string; score: number }[];
};

export type ScoresBlock = {
  /** The prize track name from Sponsor Day-Of (the block title). */
  sponsor: string;
  room: string | null;
  /** Reps who scored a presenting team, by name. */
  judges: string[];
  /** Presenting teams in presentation order. */
  teams: ScoresTeam[];
};

export type ScoresInput = {
  /** In-person prize track sponsors in list order (`track` = sheet name). */
  sponsors: readonly { id: string; track: string; name: string }[];
  /** Placed presentation slots. */
  slots: readonly {
    sponsorId: string;
    teamId: string;
    room: string | null;
    start: number;
  }[];
  scores: readonly {
    sponsorId: string;
    teamId: string;
    judge: string;
    halves: number;
  }[];
  /** Devpost link by team id. */
  links: ReadonlyMap<string, string | null>;
};

const byName = (a: string, b: string) => a.localeCompare(b);

/**
 * What the app knows for each block, in presentation order. Pure: the
 * placement in the sheet is planScoreWrites's job.
 */
export function scoreBlocks(input: ScoresInput): ScoresBlock[] {
  return input.sponsors.map((sponsor) => {
    const slots = input.slots
      .filter((s) => s.sponsorId === sponsor.id)
      .sort((a, b) => a.start - b.start || byName(a.teamId, b.teamId));
    const presenting = new Set(slots.map((s) => s.teamId));
    // teamId -> judgeKey -> score (a rep counts once; the last row wins).
    const byTeam = new Map<
      string,
      Map<string, { judge: string; score: number }>
    >();
    for (const s of input.scores) {
      if (s.sponsorId !== sponsor.id || !presenting.has(s.teamId)) continue;
      const judge = cleanJudgeName(s.judge);
      if (!judge) continue;
      const judges =
        byTeam.get(s.teamId) ??
        new Map<string, { judge: string; score: number }>();
      judges.set(judgeKey(judge), { judge, score: halvesToScore(s.halves) });
      byTeam.set(s.teamId, judges);
    }
    const judges = new Map<string, string>();
    for (const team of byTeam.values()) {
      for (const [key, s] of team)
        if (!judges.has(key)) judges.set(key, s.judge);
    }
    const room =
      remoteJudgingRoom(sponsor.name) ??
      slots.find((s) => s.room?.trim())?.room?.trim() ??
      null;
    return {
      sponsor: sponsor.track,
      room,
      judges: [...judges.values()].sort(byName),
      teams: slots.map((s) => ({
        start: s.start,
        teamId: s.teamId,
        devpostUrl: input.links.get(s.teamId)?.trim() ?? null,
        scores: [...(byTeam.get(s.teamId)?.values() ?? [])].sort((a, b) =>
          byName(a.judge, b.judge),
        ),
      })),
    };
  });
}

/** One cell the app writes: 0-based row and column. */
export type CellWrite = {
  row: number;
  col: number;
  value: string | number;
  /** A formula: written as USER_ENTERED, everything else RAW. */
  formula?: boolean;
};

/** "A", "B" ... "Z" (the app never goes past J). */
export const colLetter = (col: number) => String.fromCharCode(65 + col);

const text = (value: unknown) =>
  value === undefined || value === null ? "" : String(value).trim();

/** A rep header nobody has claimed yet: blank, or "Rep N". */
function isFreeHeader(header: string) {
  if (!header) return true;
  return Array.from({ length: SCORES_REP_COLUMNS }, (_, i) =>
    copy.rep(i + 1).toLowerCase(),
  ).includes(header.toLowerCase());
}

/** Whether a column A cell is this sponsor's block title. */
function isTitleOf(cell: string, sponsor: string) {
  if (!cell) return false;
  return (
    prizeTrackOf(sponsor, [cell]) !== null ||
    prizeTrackOf(cell, [sponsor]) !== null
  );
}

/** "=IFERROR(ROUND(AVERAGE(D5:I5),1),"")" for 0-based row `row`. */
export function averageFormula(row: number) {
  const r = row + 1;
  const from = colLetter(REP_COL);
  const to = colLetter(AVG_COL - 1);
  return `=IFERROR(ROUND(AVERAGE(${from}${r}:${to}${r}),1),"")`;
}

/**
 * The cells to write, given what the tab holds now (`grid`, rows from row
 * 1, columns from A, formulas as typed). Never an empty value, never a
 * column right of Average. A score, time or Devpost link that differs is
 * overwritten (the app has that value); titles, headers, team IDs and the
 * Average formula are only written into empty cells. `skipped` lists teams
 * with no free row and reps with no free column.
 */
export function planScoreWrites(
  grid: readonly (readonly unknown[])[],
  blocks: readonly ScoresBlock[],
): {
  writes: CellWrite[];
  skipped: { sponsor: string; teamId?: string; judge?: string }[];
} {
  const writes: CellWrite[] = [];
  const skipped: { sponsor: string; teamId?: string; judge?: string }[] = [];
  // What each cell will hold after this plan, so later steps see earlier ones.
  const planned = new Map<string, string>();
  const cell = (row: number, col: number) =>
    planned.get(`${row}:${col}`) ?? text(grid[row]?.[col]);
  const put = (
    row: number,
    col: number,
    value: string | number | null,
    mode: "empty" | "differs",
    formula = false,
  ) => {
    if (value === null || text(value) === "" || col >= SCORES_WIDTH) return;
    const current = cell(row, col);
    if (mode === "empty" && current !== "") return;
    if (current === text(value)) return;
    writes.push({ row, col, value, ...(formula ? { formula } : {}) });
    planned.set(`${row}:${col}`, text(value));
  };

  // The app's note: kept current, so a reworded note reaches the sheet.
  put(0, 0, copy.note, "differs");

  // A new block goes below everything already in the app's columns.
  let lastUsed = -1;
  grid.forEach((row, r) => {
    if (row.slice(0, SCORES_WIDTH).some((v) => text(v) !== "")) lastUsed = r;
  });
  let nextFree = Math.max(SCORES_FIRST_BLOCK_ROW, lastUsed + 1 + BLOCK_GAP);

  for (const block of blocks) {
    let top = -1;
    for (let r = SCORES_FIRST_BLOCK_ROW; r < grid.length; r++) {
      if (isTitleOf(text(grid[r]?.[0]), block.sponsor)) {
        top = r;
        break;
      }
    }
    if (top === -1) {
      top = nextFree;
      nextFree = top + SCORES_BLOCK_ROWS + BLOCK_GAP;
    }

    put(top, 0, block.sponsor, "empty");
    put(top, 1, block.room, "empty");

    const head = top + 1;
    put(head, TIME_COL, copy.headers.time, "empty");
    put(head, TEAM_COL, copy.headers.teamId, "empty");
    put(head, LINK_COL, copy.headers.devpost, "empty");
    put(head, AVG_COL, copy.headers.average, "empty");

    // Rep columns: a rep keeps the column headed with their name; a new
    // rep takes the first blank or "Rep N" header.
    const colOf = new Map<string, number>();
    for (let c = REP_COL; c < AVG_COL; c++) {
      const header = cell(head, c);
      if (!isFreeHeader(header) && !colOf.has(judgeKey(header))) {
        colOf.set(judgeKey(header), c);
      }
    }
    const taken = new Set(colOf.values());
    for (const judge of block.judges) {
      if (colOf.has(judgeKey(judge))) continue;
      let free = -1;
      for (let c = REP_COL; c < AVG_COL; c++) {
        if (!taken.has(c) && isFreeHeader(cell(head, c))) {
          free = c;
          break;
        }
      }
      if (free === -1) {
        skipped.push({ sponsor: block.sponsor, judge });
        continue;
      }
      put(head, free, judge, "differs");
      colOf.set(judgeKey(judge), free);
      taken.add(free);
    }
    for (let c = REP_COL; c < AVG_COL; c++) {
      put(head, c, copy.rep(c - REP_COL + 1), "empty");
    }

    // Team rows: a team keeps the row with its ID; a new team takes the
    // first row with no team ID and no link.
    const first = top + 2;
    const last = top + 1 + PRESENTATION_SLOTS_PER_ROOM;
    const rowOf = new Map<string, number>();
    for (let r = first; r <= last; r++) {
      const id = cell(r, TEAM_COL).toLowerCase();
      if (id && !rowOf.has(id)) rowOf.set(id, r);
    }
    const claimed = new Set(rowOf.values());
    for (const team of block.teams) {
      let row = rowOf.get(team.teamId.toLowerCase());
      if (row === undefined) {
        for (let r = first; r <= last; r++) {
          if (!claimed.has(r) && !cell(r, TEAM_COL) && !cell(r, LINK_COL)) {
            row = r;
            break;
          }
        }
      }
      if (row === undefined) {
        skipped.push({ sponsor: block.sponsor, teamId: team.teamId });
        continue;
      }
      claimed.add(row);
      put(row, TIME_COL, formatPresentationTime(team.start), "differs");
      put(row, TEAM_COL, team.teamId, "empty");
      put(row, LINK_COL, team.devpostUrl, "differs");
      for (const s of team.scores) {
        const col = colOf.get(judgeKey(s.judge));
        if (col !== undefined) put(row, col, s.score, "differs");
      }
      put(row, AVG_COL, averageFormula(row), "empty", true);
    }
  }

  return { writes, skipped };
}

/** The Sheets calls this mirror makes; tests pass a fake. */
export type ScoresSheet = {
  addTab(title: string): Promise<void>;
  /** Values with formulas as typed (valueRenderOption FORMULA). */
  read(range: string): Promise<unknown[][]>;
  /** One batch of single cells, RAW or USER_ENTERED (formulas). */
  writeCells(
    cells: { range: string; value: string | number }[],
    input: "RAW" | "USER_ENTERED",
  ): Promise<void>;
};

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";

/** The Google client, with the write scope. */
export async function googleScoresSheet(): Promise<ScoresSheet> {
  // Second line of defence: the mirror checks this before calling here.
  if (!sheetWritesEnabled()) throw new Error(SHEET_WRITES_DISABLED);
  const { email, key } = runOfShowCredentials();
  const spreadsheetId = runOfShowSpreadsheetId();
  const auth = new google.auth.JWT({ email, key, scopes: [WRITE_SCOPE] });
  await auth.authorize();
  // A request timeout, so a hung call always settles and frees the queue.
  const sheets = google.sheets({
    version: "v4",
    auth,
    timeout: SCORES_REQUEST_TIMEOUT_MS,
  });
  return {
    async addTab(title) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
    },
    async read(range) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: "FORMULA",
      });
      return (res.data.values ?? []) as unknown[][];
    },
    async writeCells(cells, input) {
      await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
          valueInputOption: input,
          data: cells.map((c) => ({ range: c.range, values: [[c.value]] })),
        },
      });
    },
  };
}

/** Sheets' error for a range on a tab that doesn't exist. */
const isMissingTab = (error: unknown) =>
  /unable to parse range/i.test(
    error instanceof Error ? error.message : String(error),
  );

/** Sponsor -> the skipped teams and reps last logged, so each logs once. */
const loggedSkips = new Map<string, string>();

/** Warn once per sponsor (until it changes) about what didn't fit. */
function logSkipped(
  skipped: readonly { sponsor: string; teamId?: string; judge?: string }[],
) {
  const bySponsor = new Map<string, { teams: string[]; reps: string[] }>();
  for (const s of skipped) {
    const entry = bySponsor.get(s.sponsor) ?? { teams: [], reps: [] };
    if (s.judge) entry.reps.push(s.judge);
    if (s.teamId) entry.teams.push(s.teamId);
    bySponsor.set(s.sponsor, entry);
  }
  for (const [sponsor, { teams, reps }] of bySponsor) {
    const key = JSON.stringify([teams, reps]);
    if (loggedSkips.get(sponsor) === key) continue;
    loggedSkips.set(sponsor, key);
    const parts = [
      reps.length > 0
        ? `rep(s) ${reps.join(", ")} (only ${SCORES_REP_COLUMNS} rep columns)`
        : "",
      teams.length > 0 ? `team(s) ${teams.join(", ")} (no free row)` : "",
    ].filter(Boolean);
    console.warn(
      `judging scores mirror: ${sponsor}: skipped ${parts.join("; ")} in the Judging Scores tab`,
    );
  }
}

/**
 * Read the tab and write the planned cells. The read doubles as the "tab
 * exists" check (no extra call): only when it fails because the tab is
 * missing is the tab added and the read retried once. Throws on any other
 * Sheets error. Returns how many cells were written.
 */
export async function writeJudgingScores(
  sheet: ScoresSheet,
  blocks: readonly ScoresBlock[],
): Promise<number> {
  const tab = `'${SCORES_TAB}'`;
  const all = `${tab}!A:${colLetter(AVG_COL)}`;
  let grid: unknown[][];
  try {
    grid = await sheet.read(all);
  } catch (error) {
    if (!isMissingTab(error)) throw error;
    await sheet.addTab(SCORES_TAB);
    grid = await sheet.read(all);
  }
  const { writes, skipped } = planScoreWrites(grid, blocks);
  logSkipped(skipped);
  const range = (w: CellWrite) => `${tab}!${colLetter(w.col)}${w.row + 1}`;
  const raw = writes.filter((w) => !w.formula);
  const formulas = writes.filter((w) => w.formula);
  if (raw.length > 0) {
    await sheet.writeCells(
      raw.map((w) => ({ range: range(w), value: w.value })),
      "RAW",
    );
  }
  if (formulas.length > 0) {
    await sheet.writeCells(
      formulas.map((w) => ({ range: range(w), value: w.value })),
      "USER_ENTERED",
    );
  }
  return writes.length;
}

/** Load the in-person sponsors' slots and scores from the DB. */
export async function loadScoresInput(): Promise<ScoresInput> {
  const [registered, trackList] = await Promise.all([
    db
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors)
      .orderBy(sponsorJudgingSponsors.name),
    prizeTrackSponsors(),
  ]);
  const sponsors = trackList.flatMap((track) =>
    isDigitalJudging(track)
      ? []
      : registered
          .filter((s) => prizeTrackOf(s.name, trackList) === track)
          .map((s) => ({ id: s.id, track, name: s.name })),
  );
  const ids = sponsors.map((s) => s.id);
  if (ids.length === 0) {
    return { sponsors, slots: [], scores: [], links: new Map() };
  }
  const [slots, scores] = await Promise.all([
    db
      .select({
        sponsorId: sponsorPresentations.sponsorId,
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        start: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations)
      .where(
        and(
          inArray(sponsorPresentations.sponsorId, ids),
          isNotNull(sponsorPresentations.startMinute),
        ),
      ),
    db
      .select({
        sponsorId: sponsorTeamScores.sponsorId,
        teamId: sponsorTeamScores.teamId,
        judge: sponsorTeamScores.judgeName,
        halves: sponsorTeamScores.scoreHalves,
      })
      .from(sponsorTeamScores)
      .where(inArray(sponsorTeamScores.sponsorId, ids)),
  ]);
  const teamIds = [...new Set(slots.map((s) => s.teamId))];
  const links =
    teamIds.length > 0
      ? await db
          .select({ id: teams.id, devpostUrl: teams.devpostUrl })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [];
  return {
    sponsors,
    slots: slots.map((s) => ({ ...s, start: s.start! })),
    scores,
    links: new Map(links.map((t) => [t.id, t.devpostUrl])),
  };
}

/** Longest one run's result waits on the sheet before reporting a timeout. */
export const SCORES_TIMEOUT_MS = 5000;
/** Per Sheets request, so a hung call always settles and frees the queue. */
export const SCORES_REQUEST_TIMEOUT_MS = 15_000;
/** Least time between the starts of two runs (Sheets read quota). */
export const SCORES_MIN_INTERVAL_MS = 5000;

let lastLoggedError: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
/** A run queued but not started yet; later calls share it. */
let pending: Promise<MirrorResult> | null = null;
/** When the last run started (ms since epoch); 0 = never. */
let lastRunAt = 0;

/**
 * Mirror scores to the tab. Runs one at a time, each starting at least
 * SCORES_MIN_INTERVAL_MS after the last. While one is waiting, more calls
 * share it (it reads the DB when it starts, so it has every save), so at
 * most one run is ever pending. A run whose result timed out still holds
 * the queue until its write settles, so two runs never plan against the
 * same sheet state (and pick the same "first free row"). Never rejects: a
 * failure is logged once until it changes or a run succeeds. With sheet
 * writes off nothing is written and it returns
 * `{ ok: false, error: "disabled" }`.
 */
export function mirrorJudgingScores(
  deps: {
    sheet?: () => Promise<ScoresSheet>;
    load?: () => Promise<ScoresInput>;
    /** Tests: 0 skips the wait between runs. */
    minIntervalMs?: number;
  } = {},
): Promise<MirrorResult> {
  if (pending) return pending;
  // This run's sheet write, settled or not; the queue waits on it.
  let settled: Promise<unknown> = Promise.resolve();
  const run = async (): Promise<MirrorResult> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    // Everything inside the try: a score save must never fail on this.
    try {
      // Wait out the interval while still pending, so calls made in the
      // meantime share this run instead of queueing another.
      const wait =
        lastRunAt + (deps.minIntervalMs ?? SCORES_MIN_INTERVAL_MS) - Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      pending = null;
      if (!sheetWritesEnabled()) {
        if (lastLoggedError !== SHEET_WRITES_DISABLED) {
          lastLoggedError = SHEET_WRITES_DISABLED;
          console.warn(
            "judging scores mirror: sheet writes are off outside production (set SHEET_WRITES=1 to write)",
          );
        }
        return { ok: false, error: SHEET_WRITES_DISABLED };
      }
      lastRunAt = Date.now();
      const write = (async () => {
        const blocks = scoreBlocks(await (deps.load ?? loadScoresInput)());
        const sheet = await (deps.sheet ?? googleScoresSheet)();
        return writeJudgingScores(sheet, blocks);
      })();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${SCORES_TIMEOUT_MS} ms`)),
          SCORES_TIMEOUT_MS,
        );
      });
      // Also swallows a late failure after the timeout.
      settled = write.catch(() => undefined);
      const rows = await Promise.race([write, timeout]);
      lastLoggedError = null;
      return { ok: true, rows };
    } catch (error) {
      // The message only: never the request, headers, or credentials.
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastLoggedError) {
        lastLoggedError = message;
        console.error(`judging scores mirror failed: ${message}`);
      }
      return { ok: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  };
  const next = queue.then(run);
  pending = next;
  queue = next.then(() => settled);
  return next;
}

/**
 * After a score save or scheduling commits: start the mirror without
 * making the request wait on the sheet (waitUntil keeps a Vercel function
 * alive until it finishes). Each run writes every score, so one that is
 * coalesced or cut short is caught up by the next. Never throws.
 */
export function mirrorJudgingScoresLater(): void {
  waitUntil(mirrorJudgingScores());
}
