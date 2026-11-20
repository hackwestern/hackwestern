/**
 * One-way mirror of the live hacker invites to the locked "Coffee Chat
 * Invites" tab of the run-of-show sheet (docs/decisions.md 2026-11-19,
 * "Coffee Chat Invites tab: read-only mirror, locked"). Organizers see who
 * is invited where; they change invites only on the coffee chat board.
 *
 *   row 1  the note (also the cell's note)
 *   row 2  "Last updated <time> ET"
 *   row 3  header: Sponsor · Rep · Session · Chat time · Room · Hacker ·
 *          Hacker ID · Source · Status · Answer by
 *   row 4+ one row per live invite seat (Accepted / Waiting), by sponsor,
 *          rep, then time
 *
 * No emails or phones: a hacker is first name + last initial and their
 * hacker ID. The tab is app-owned, so every run rewrites it whole: one
 * clear and one write, no read and no tab listing. Only when the clear
 * says the tab is missing is it created, locked (a protected range over
 * the whole tab, warningOnly false, editors = the app's service account;
 * the owner can always edit) and given the note. The live tab was created
 * and locked by hand with the Room Grid's editors, so this path is for a
 * fresh sheet.
 *
 * Production only (sheetWritesEnabled). Runs in the background after Send,
 * each invite round, a decline's refill, an answer and a reconcile, at most
 * once every INVITES_MIN_INTERVAL_MS (Sheets' per-minute quota is shared
 * with the other mirrors); calls made meanwhile share the waiting run. A
 * failure is logged once and never blocks the action.
 */
import { waitUntil } from "@vercel/functions";
import { eq, inArray, isNotNull, and } from "drizzle-orm";
import { google, type sheets_v4 } from "googleapis";

import { coffeeChatInvitesCopy } from "~/content/coffee-chat-invites";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  effectiveCoffeeChatStatus,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import { easternClock } from "~/server/api/utils/coffee-chat-invite-text";
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
  applications,
  coffeeChatPlacements,
  coffeeChatReps,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

const copy = coffeeChatInvitesCopy.sheet;
export const INVITES_TAB = copy.tab;
export const INVITES_WIDTH = copy.headers.length;
/** 0-based: note, updated, header, then the seats. */
export const INVITES_FIRST_SEAT_ROW = 3;

/** One invite row as loaded, before the live-state filter. */
export type InviteSheetRow = {
  sponsor: string;
  rep: string;
  sessionId: string;
  /** "HH:MM" Saturday. */
  slotTime: string;
  room: string | null;
  firstName: string | null;
  lastName: string | null;
  /** users.name, used only when the application has no name. */
  userName: string | null;
  hackerId: string | null;
  source: string | null;
  status: CoffeeChatStatus;
  expiresAt: Date | null;
};

const clean = (s: string | null | undefined) => (s ?? "").trim();

/** "Jane D." from first and last name (or a full name). Never more. */
export function shortName(
  first: string | null,
  last: string | null,
  full: string | null,
): string {
  let f = clean(first);
  let l = clean(last);
  if (!f && !l) {
    const parts = clean(full).split(/\s+/).filter(Boolean);
    f = parts[0] ?? "";
    l = parts.length > 1 ? parts[parts.length - 1]! : "";
  }
  const initial = l ? `${l[0]!.toUpperCase()}.` : "";
  return [f, initial].filter(Boolean).join(" ");
}

/** "Sat 9:40 AM" for one instant, Eastern. */
const stamp = (d: Date) =>
  d.toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "short",
    timeStyle: "short",
  });

/**
 * The whole tab as rows from A1: live invites only (Accepted / Waiting:
 * declined, expired and cancelled seats were replaced), by sponsor, rep,
 * then time. Pure: tests build it from rows.
 */
export function invitesSheetRows(
  rows: readonly InviteSheetRow[],
  now: Date,
): string[][] {
  const seats = rows
    .map((r) => ({ r, status: effectiveCoffeeChatStatus(r, now) }))
    .filter(
      (x): x is { r: InviteSheetRow; status: "pending" | "accepted" } =>
        x.status === "pending" || x.status === "accepted",
    )
    .map(({ r, status }) => ({
      r,
      status,
      hacker: shortName(r.firstName, r.lastName, r.userName),
    }))
    .sort(
      (a, b) =>
        a.r.sponsor.localeCompare(b.r.sponsor) ||
        a.r.rep.localeCompare(b.r.rep) ||
        a.r.slotTime.localeCompare(b.r.slotTime) ||
        a.hacker.localeCompare(b.hacker),
    );
  return [
    [copy.note],
    [copy.updated(stamp(now))],
    [...copy.headers],
    ...seats.map(({ r, status, hacker }) => [
      r.sponsor,
      r.rep,
      coffeeSessionsCopy.sessions[r.sessionId] ?? r.sessionId,
      formatCoffeeChatTime(r.slotTime),
      clean(r.room),
      hacker,
      clean(r.hackerId),
      r.source ? (copy.source[r.source] ?? r.source) : "",
      copy.status[status],
      status === "pending" && r.expiresAt
        ? coffeeChatInvitesCopy.answerBy(easternClock(r.expiresAt))
        : "",
    ]),
  ];
}

/**
 * The batchUpdate that locks a new tab: a protected range over the whole
 * tab (no warning-only: edits are refused), editable by `editor` (the app's
 * service account) and the owner, plus the note on A1. Pure.
 */
export function lockTabRequests(
  sheetId: number,
  editor: string,
): sheets_v4.Schema$Request[] {
  return [
    {
      addProtectedRange: {
        protectedRange: {
          range: { sheetId },
          description: copy.protection,
          warningOnly: false,
          editors: { users: [editor] },
        },
      },
    },
    {
      updateCells: {
        range: {
          sheetId,
          startRowIndex: 0,
          endRowIndex: 1,
          startColumnIndex: 0,
          endColumnIndex: 1,
        },
        rows: [{ values: [{ note: copy.note }] }],
        fields: "note",
      },
    },
  ];
}

/** The Sheets calls this mirror makes; tests pass a fake. */
export type InvitesSheet = {
  /** The service account's email (the lock's only editor). */
  editor: string;
  clear(range: string): Promise<void>;
  write(range: string, values: string[][]): Promise<void>;
  /** Adds the tab and returns its sheetId. */
  addTab(title: string): Promise<number>;
  batchUpdate(requests: sheets_v4.Schema$Request[]): Promise<void>;
};

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
/** Per Sheets request, so a hung call always settles and frees the queue. */
export const INVITES_REQUEST_TIMEOUT_MS = 15_000;

/** A writer client for the run-of-show sheet. Refuses when writes are off. */
export async function googleInvitesSheet(): Promise<InvitesSheet> {
  // Second line of defence: the mirror checks this before calling here.
  if (!sheetWritesEnabled()) throw new Error(SHEET_WRITES_DISABLED);
  const { email, key } = runOfShowCredentials();
  const spreadsheetId = runOfShowSpreadsheetId();
  const auth = new google.auth.JWT({ email, key, scopes: [WRITE_SCOPE] });
  await auth.authorize();
  const sheets = google.sheets({
    version: "v4",
    auth,
    timeout: INVITES_REQUEST_TIMEOUT_MS,
  });
  return {
    editor: email,
    async clear(range) {
      await sheets.spreadsheets.values.clear({ spreadsheetId, range });
    },
    async write(range, values) {
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    },
    async addTab(title) {
      const res = await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
      // Never fall back to 0: that's the first tab, and the lock would
      // land on the live RUN OF SHOW.
      const id = res.data.replies?.[0]?.addSheet?.properties?.sheetId;
      if (typeof id !== "number")
        throw new Error(`addSheet returned no sheetId for "${title}"`);
      return id;
    },
    async batchUpdate(requests) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests },
      });
    },
  };
}

/** Sheets' error for a range on a tab that doesn't exist. */
const isMissingTab = (error: unknown) =>
  /unable to parse range/i.test(
    error instanceof Error ? error.message : String(error),
  );

/**
 * Rewrite the tab: clear everything from A1 down, then write the rows. The
 * clear doubles as the "tab exists" check: only when it fails because the
 * tab is missing is the tab added and locked (once, on create). Throws on
 * any other Sheets error. Returns how many rows were written.
 */
export async function writeInvitesTab(
  sheet: InvitesSheet,
  rows: string[][],
): Promise<number> {
  const tab = `'${INVITES_TAB}'`;
  try {
    await sheet.clear(`${tab}!A:Z`);
  } catch (error) {
    if (!isMissingTab(error)) throw error;
    const id = await sheet.addTab(INVITES_TAB);
    await sheet.batchUpdate(lockTabRequests(id, sheet.editor));
  }
  await sheet.write(`${tab}!A1`, rows);
  return rows.length;
}

/** Every session invite still holding or asking for a seat, from the DB. */
export async function loadInviteSheetRows(): Promise<InviteSheetRow[]> {
  return db
    .select({
      sponsor: sponsorJudgingSponsors.name,
      rep: coffeeChatReps.name,
      sessionId: coffeeChatPlacements.sessionId,
      slotTime: coffeeChats.slotTime,
      room: coffeeChats.room,
      firstName: applications.firstName,
      lastName: applications.lastName,
      userName: users.name,
      hackerId: users.hackerId,
      source: coffeeChats.source,
      status: coffeeChats.status,
      expiresAt: coffeeChats.expiresAt,
    })
    .from(coffeeChats)
    .innerJoin(
      coffeeChatPlacements,
      eq(coffeeChatPlacements.id, coffeeChats.placementId),
    )
    .innerJoin(
      coffeeChatReps,
      eq(coffeeChatReps.id, coffeeChatPlacements.repId),
    )
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
    )
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
    .where(
      and(
        isNotNull(coffeeChats.placementId),
        inArray(coffeeChats.status, ["pending", "accepted"]),
      ),
    );
}

/** Longest one run's result waits on the sheet before reporting a timeout. */
export const INVITES_TIMEOUT_MS = 5000;
/** Least time between the starts of two runs (Sheets quota). */
export const INVITES_MIN_INTERVAL_MS = 10_000;

let lastLoggedError: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
/** A run queued but not started yet; later calls share it. */
let pending: Promise<MirrorResult> | null = null;
/** When the last run started (ms since epoch); 0 = never. */
let lastRunAt = 0;

/** Tests only. */
export function resetInvitesMirror(): void {
  lastLoggedError = null;
  queue = Promise.resolve();
  pending = null;
  lastRunAt = 0;
}

/**
 * Mirror the invites to the tab. One run at a time, each starting at least
 * INVITES_MIN_INTERVAL_MS after the last; calls made while one waits share
 * it (it reads the DB when it starts, so it has every change). A run whose
 * result timed out still holds the queue until its write settles, so two
 * runs never clear and write over each other. Never rejects. With sheet
 * writes off nothing is written and it returns { ok: false, error: "disabled" }.
 */
export function mirrorCoffeeInvites(
  deps: {
    sheet?: () => Promise<InvitesSheet>;
    load?: () => Promise<InviteSheetRow[]>;
    now?: () => Date;
    /** Tests: 0 skips the wait between runs. */
    minIntervalMs?: number;
  } = {},
): Promise<MirrorResult> {
  if (pending) return pending;
  let settled: Promise<unknown> = Promise.resolve();
  const run = async (): Promise<MirrorResult> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const wait =
        lastRunAt +
        (deps.minIntervalMs ?? INVITES_MIN_INTERVAL_MS) -
        Date.now();
      if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
      pending = null;
      if (!sheetWritesEnabled())
        return { ok: false, error: SHEET_WRITES_DISABLED };
      lastRunAt = Date.now();
      const write = (async () => {
        const rows = invitesSheetRows(
          await (deps.load ?? loadInviteSheetRows)(),
          deps.now?.() ?? new Date(),
        );
        const sheet = await (deps.sheet ?? googleInvitesSheet)();
        return writeInvitesTab(sheet, rows);
      })();
      settled = write.catch(() => undefined);
      const rows = await Promise.race([
        write,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`timed out after ${INVITES_TIMEOUT_MS} ms`)),
            INVITES_TIMEOUT_MS,
          );
        }),
      ]);
      lastLoggedError = null;
      return { ok: true, rows };
    } catch (error) {
      // The message only: never the request, headers, or credentials.
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastLoggedError) {
        lastLoggedError = message;
        console.error(`coffee chat invites sheet mirror failed: ${message}`);
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
 * After invites change (Send, a round, a decline's refill, an answer, a
 * reconcile) and the write has committed: start the mirror without making
 * the request wait (waitUntil keeps a Vercel function alive until it
 * finishes). Each run writes every live invite, so a coalesced one is
 * caught up by the next. A no-op while sheet writes are off. Never throws.
 */
export function mirrorCoffeeInvitesLater(): void {
  if (!sheetWritesEnabled()) return;
  waitUntil(mirrorCoffeeInvites());
}
