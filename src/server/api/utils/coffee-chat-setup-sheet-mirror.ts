import { waitUntil } from "@vercel/functions";
import { asc, count } from "drizzle-orm";
import { google } from "googleapis";

import { coffeeChatSetupSheetCopy as copy } from "~/content/coffee-chat-setup-sheet";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { COFFEE_SESSIONS, chatMinutes } from "~/lib/coffee-chat-sessions";
import {
  SHEET_WRITES_DISABLED,
  type MirrorResult,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import {
  runOfShowCredentials,
  runOfShowSpreadsheetId,
  sheetWritesEnabled,
} from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  sponsorJudgingSponsors,
  sponsorShortlists,
} from "~/server/db/schema";

/**
 * One-way mirror of each sponsor's coffee chat setup (session model) to the
 * "Coffee Chat Setup" tab of the Spon Team sheet, so organizers can watch
 * what sponsors enter during the Friday workshop. The DB is the source of
 * truth. Column A "Sponsor" is the one column organizers edit (it is also
 * what the run-of-show parser reads to list sponsors doing coffee chats):
 * the app never changes a name there. Each run fills columns B to K of each
 * listed sponsor's own row, appends rows for sponsors with saved preferences
 * or reps who aren't listed, and leaves every other cell alone (organizer
 * notes in column L and later, and anything below the data). Same rules as the other mirrors: one run at a time, a newer run
 * stops an older one, 5 s timeout, a failure is logged once and never
 * reaches the sponsor, and nothing is written unless sheetWritesEnabled().
 */

export const SETUP_TAB = copy.tab;
export const SETUP_HEADERS: readonly string[] = copy.headers;

export type SetupRep = {
  name: string;
  phone: string;
  isPrimary: boolean;
  chatsWanted: number;
  /** Session ids the rep ticked as free ("10", "11", "13"…). */
  sessions: readonly string[];
};

export type SetupSponsor = {
  name: string;
  pref: {
    hackersPerChat: number;
    longerOneOnOne: boolean;
    submittedAt: Date | null;
    shortlistSubmittedAt: Date | null;
    updatedAt: Date;
  } | null;
  /** In the order the sponsor listed them. */
  reps: readonly SetupRep[];
  shortlistCount: number;
};

/** "Fri 8:12 PM" in Toronto time. */
export function setupTimestamp(date: Date): string {
  return date.toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

const key = (name: string) => name.trim().toLowerCase();

function sessionLabels(ids: readonly string[]): string {
  const labels = COFFEE_SESSIONS.filter((s) => ids.includes(s.id)).map(
    (s) => coffeeSessionsCopy.sessions[s.id] ?? s.id,
  );
  return labels.length > 0 ? labels.join(", ") : copy.rep.noSessions;
}

/** One sponsor's row (every column after A is derived). */
export function setupRow(
  name: string,
  sponsor: SetupSponsor | undefined,
): string[] {
  const pref = sponsor?.pref ?? null;
  const reps = sponsor?.reps ?? [];
  const primary = reps.find((r) => r.isPrimary);
  const chats = reps.reduce((sum, r) => sum + Math.max(0, r.chatsWanted), 0);
  const shortlistCount = sponsor?.shortlistCount ?? 0;
  const lastSaved = pref?.updatedAt ?? null;

  const preferences = pref?.submittedAt
    ? copy.preferences.submitted(setupTimestamp(pref.submittedAt))
    : pref !== null || reps.length > 0
      ? copy.preferences.draft
      : copy.preferences.notStarted;
  const shortlist = pref?.shortlistSubmittedAt
    ? copy.shortlist.submitted(shortlistCount)
    : shortlistCount > 0
      ? copy.shortlist.draft(shortlistCount)
      : copy.shortlist.none;

  return [
    name,
    preferences,
    pref ? String(pref.hackersPerChat) : "",
    pref ? copy.chatLength(chatMinutes(pref)) : "",
    primary?.name ?? "",
    primary?.phone ?? "",
    reps
      .map((r) =>
        copy.rep.line([
          r.name + (r.isPrimary ? copy.rep.primary : ""),
          r.phone,
          copy.rep.chats(r.chatsWanted),
          sessionLabels(r.sessions),
        ]),
      )
      .join("\n"),
    reps.length > 0 ? String(chats) : "",
    pref && reps.length > 0 ? String(chats * pref.hackersPerChat) : "",
    shortlist,
    lastSaved ? setupTimestamp(lastSaved) : "",
  ];
}

/**
 * The whole tab: header, then the sponsors listed in column A (in order,
 * duplicates, blanks and a "Total" row dropped), then any sponsor with
 * preferences or reps saved who isn't listed, by name.
 */
export function setupSheetRows(
  listed: readonly string[],
  sponsors: readonly SetupSponsor[],
): string[][] {
  const byKey = new Map(sponsors.map((s) => [key(s.name), s]));
  const seen = new Set<string>();
  const names: string[] = [];
  for (const raw of listed) {
    const name = raw.trim();
    const k = key(name);
    if (!k || k === "total" || seen.has(k)) continue;
    seen.add(k);
    names.push(name);
  }
  const extra = sponsors
    .filter(
      (s) => !seen.has(key(s.name)) && (s.pref !== null || s.reps.length > 0),
    )
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b));
  return [
    [...SETUP_HEADERS],
    ...[...names, ...extra].map((name) => setupRow(name, byKey.get(key(name)))),
  ];
}

/** Every registered sponsor's setup from the DB. */
export async function loadSetupSponsors(): Promise<SetupSponsor[]> {
  const [sponsors, prefs, reps, repSessions, shortlists] = await Promise.all([
    db
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors),
    db.select().from(coffeeChatPrefs),
    db
      .select()
      .from(coffeeChatReps)
      .orderBy(
        asc(coffeeChatReps.position),
        asc(coffeeChatReps.createdAt),
        asc(coffeeChatReps.id),
      ),
    db.select().from(coffeeChatRepSessions),
    db
      .select({ sponsorId: sponsorShortlists.sponsorId, n: count() })
      .from(sponsorShortlists)
      .groupBy(sponsorShortlists.sponsorId),
  ]);
  const prefOf = new Map(prefs.map((p) => [p.sponsorId, p]));
  const shortlistOf = new Map(
    shortlists.map((s) => [s.sponsorId, Number(s.n)]),
  );
  const sessionsOf = new Map<string, string[]>();
  for (const rs of repSessions) {
    sessionsOf.set(rs.repId, [
      ...(sessionsOf.get(rs.repId) ?? []),
      rs.sessionId,
    ]);
  }
  return sponsors.map((s) => {
    const pref = prefOf.get(s.id);
    return {
      name: s.name,
      pref: pref
        ? {
            hackersPerChat: pref.hackersPerChat,
            longerOneOnOne: pref.longerOneOnOne,
            submittedAt: pref.submittedAt,
            shortlistSubmittedAt: pref.shortlistSubmittedAt,
            updatedAt: pref.updatedAt,
          }
        : null,
      reps: reps
        .filter((r) => r.sponsorId === s.id)
        .map((r) => ({
          name: r.name,
          phone: r.phone,
          isPrimary: r.isPrimary,
          chatsWanted: r.chatsWanted,
          sessions: sessionsOf.get(r.id) ?? [],
        })),
      shortlistCount: shortlistOf.get(s.id) ?? 0,
    };
  });
}

/** The few Sheets calls the writer makes; tests pass a fake. */
export type SetupSheet = {
  read(range: string): Promise<string[][]>;
  /** A null cell is left as it is (the Sheets API skips nulls). */
  write(range: string, values: (string | null)[][]): Promise<void>;
  clear(range: string): Promise<void>;
};

async function googleSetupSheet(): Promise<SetupSheet> {
  // Second line of defence: mirrorCoffeeChatSetup checks this first.
  if (!sheetWritesEnabled()) throw new Error(SHEET_WRITES_DISABLED);
  const { email, key: privateKey } = runOfShowCredentials();
  const spreadsheetId = runOfShowSpreadsheetId();
  const auth = new google.auth.JWT({
    email,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  return {
    async read(range) {
      const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range,
      });
      return (res.data.values ?? []).map((row) =>
        row.map((c) => String(c ?? "")),
      );
    },
    async write(range, values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    },
    async clear(range) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    },
  };
}

/** Columns B to K: the ones the app owns. */
const APP_COLUMNS = SETUP_HEADERS.length - 1;
const LAST_APP_COLUMN = String.fromCharCode(64 + SETUP_HEADERS.length); // "K"

/** Whether a column B value is one the app writes (Preferences). */
function isAppPreferences(value: string): boolean {
  const v = value.trim();
  if (!v) return false;
  return (
    v === copy.preferences.draft ||
    v === copy.preferences.notStarted ||
    v.startsWith(copy.preferences.submitted(""))
  );
}

export type SetupSheetWrites = {
  /**
   * Columns B to K from row 1 (the header) down: a listed sponsor's row is
   * filled, a row the app wrote whose name was deleted from column A is
   * blanked, and every other row is null (left as it is).
   */
  block: (string | null)[][];
  /** 1-based sheet row of the first appended row. */
  appendAt: number;
  /** Full A to K rows for sponsors not listed yet. */
  appends: string[][];
  /** Sponsor rows written (filled plus appended). */
  sponsorRows: number;
};

/**
 * What one run writes, from a read of A2:Z (`grid[i]` is sheet row i + 2).
 * Column A is never written for an existing row. A name listed twice, a
 * "Total" row and blank rows are left alone, except that a row with a blank
 * name whose column B holds the app's own Preferences text is blanked: the
 * app wrote it and an organizer has since deleted the sponsor's name.
 * New sponsors go under the last row that has anything in it, so they never
 * land next to a note typed beside or below the list.
 */
export function setupSheetWrites(
  grid: readonly (readonly string[])[],
  sponsors: readonly SetupSponsor[],
): SetupSheetWrites {
  const byKey = new Map(sponsors.map((s) => [key(s.name), s]));
  const seen = new Set<string>();
  const leave = (): null[] => Array<null>(APP_COLUMNS).fill(null);
  const body: (string | null)[][] = [];
  let lastTouched = -1;
  let sponsorRows = 0;
  grid.forEach((row, i) => {
    const name = (row[0] ?? "").trim();
    const k = key(name);
    if (!k) {
      if (isAppPreferences(row[1] ?? "")) {
        body.push(Array<string>(APP_COLUMNS).fill(""));
        lastTouched = i;
      } else {
        body.push(leave());
      }
      return;
    }
    if (k === "total" || seen.has(k)) {
      body.push(leave());
      return;
    }
    seen.add(k);
    body.push(setupRow(name, byKey.get(k)).slice(1));
    lastTouched = i;
    sponsorRows++;
  });
  const appends = sponsors
    .filter(
      (s) => !seen.has(key(s.name)) && (s.pref !== null || s.reps.length > 0),
    )
    .map((s) => s.name)
    .sort((a, b) => a.localeCompare(b))
    .map((name) => setupRow(name, byKey.get(key(name))));
  return {
    block: [SETUP_HEADERS.slice(1), ...body.slice(0, lastTouched + 1)],
    appendAt: grid.length + 2,
    appends,
    sponsorRows: sponsorRows + appends.length,
  };
}

/**
 * Update the tab in place: read A2:Z, write columns B to K of the listed
 * sponsors' rows (and the header) in one call, then append unlisted
 * sponsors under the data. Never clears a range and never rewrites column A
 * of an existing row. Throws on any Sheets error; stops between steps once
 * a newer run has started. Returns the number of sponsor rows.
 */
export async function writeCoffeeChatSetup(
  sheet: SetupSheet,
  load: () => Promise<SetupSponsor[]> = loadSetupSponsors,
  isCurrent: () => boolean = () => true,
): Promise<number> {
  const tab = `'${SETUP_TAB}'`;
  const [grid, sponsors] = await Promise.all([
    sheet.read(`${tab}!A2:Z`),
    load(),
  ]);
  const plan = setupSheetWrites(grid, sponsors);
  if (!isCurrent()) return plan.sponsorRows;
  await sheet.write(
    `${tab}!B1:${LAST_APP_COLUMN}${plan.block.length}`,
    plan.block,
  );
  if (plan.appends.length === 0 || !isCurrent()) return plan.sponsorRows;
  await sheet.write(`${tab}!A${plan.appendAt}`, plan.appends);
  return plan.sponsorRows;
}

export const SETUP_MIRROR_TIMEOUT_MS = 5000;

let lastLoggedError: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
let generation = 0;

/**
 * Mirror every sponsor's coffee chat setup to the sheet. Call it after a
 * sponsor saves (draft or submit) their preferences, reps or shortlist; it
 * never rejects and never blocks the save (don't await it in a request
 * unless you want the result). With sheet writes off it writes nothing and
 * returns `{ ok: false, error: "disabled" }`.
 */
export function mirrorCoffeeChatSetup(
  deps: {
    sheet?: () => Promise<SetupSheet>;
    load?: () => Promise<SetupSponsor[]>;
  } = {},
): Promise<MirrorResult> {
  const run = async (): Promise<MirrorResult> => {
    if (!sheetWritesEnabled()) {
      if (lastLoggedError !== SHEET_WRITES_DISABLED) {
        lastLoggedError = SHEET_WRITES_DISABLED;
        console.warn(
          "coffee chat setup sheet mirror: sheet writes are off outside production (set SHEET_WRITES=1 to write)",
        );
      }
      return { ok: false, error: SHEET_WRITES_DISABLED };
    }
    const gen = ++generation;
    const isCurrent = () => gen === generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const write = (async () => {
        const sheet = await (deps.sheet ?? googleSetupSheet)();
        if (!isCurrent()) return 0;
        return writeCoffeeChatSetup(sheet, deps.load, isCurrent);
      })();
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(new Error(`timed out after ${SETUP_MIRROR_TIMEOUT_MS} ms`)),
          SETUP_MIRROR_TIMEOUT_MS,
        );
      });
      void write.catch(() => undefined);
      const rows = await Promise.race([write, timeout]);
      lastLoggedError = null;
      return { ok: true, rows };
    } catch (error) {
      // The message only: never the request, headers, or credentials.
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastLoggedError) {
        lastLoggedError = message;
        console.error(`coffee chat setup sheet mirror failed: ${message}`);
      }
      return { ok: false, error: message };
    } finally {
      clearTimeout(timer);
    }
  };
  const next = queue.then(run);
  queue = next;
  return next;
}

/**
 * After a sponsor's save commits: start the mirror without making the
 * request wait for it (waitUntil keeps a Vercel function alive until it
 * finishes). Gated like mirrorCoffeeChatSetup; never throws.
 */
export function mirrorCoffeeChatSetupLater(): void {
  waitUntil(mirrorCoffeeChatSetup());
}
