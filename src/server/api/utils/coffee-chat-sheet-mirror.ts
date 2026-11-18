import { asc, eq } from "drizzle-orm";
import { google } from "googleapis";

import { coffeeChatCopy } from "~/content/coffee-chat";
import { coffeeChatNotifyCopy } from "~/content/coffee-chat-notify";
import { formatCoffeeChatTime } from "~/lib/coffee-chats";
import { effectiveCoffeeChatStatus } from "~/lib/coffee-chat-requests";
import {
  runOfShowCredentials,
  runOfShowSpreadsheetId,
} from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

/**
 * One-way mirror of every coffee chat to the "Coffee Chat Bookings" tab of
 * the run-of-show sheet (T20). The DB is the source of truth; the tab is
 * rewritten in full on every change, one row per chat in the order chats
 * were offered, so a chat keeps its row and an expired request shows as
 * expired at the next write. Its own tab, so organizers' setup cells in
 * "Coffee Chats" are never touched.
 *
 * Writes need the spreadsheets scope and the service account as Editor on
 * the sheet. Until then every write fails: the failure is logged once and
 * never reaches the hacker or sponsor.
 */

const WRITE_SCOPE = "https://www.googleapis.com/auth/spreadsheets";
const sheetCopy = coffeeChatNotifyCopy.sheet;
export const BOOKINGS_TAB = sheetCopy.tab;

/** The few Sheets calls the mirror makes; tests pass a fake. */
export type BookingsSheet = {
  tabTitles(): Promise<string[]>;
  addTab(title: string): Promise<void>;
  write(range: string, values: string[][]): Promise<void>;
  clear(range: string): Promise<void>;
};

/**
 * A writer client, separate from the read-only run-of-show reader. Also
 * used by the Sponsor Judging tab mirror (sponsor-judging-sheet-mirror.ts).
 */
export async function googleBookingsSheet(): Promise<BookingsSheet> {
  const { email, key } = runOfShowCredentials();
  const spreadsheetId = runOfShowSpreadsheetId();
  const auth = new google.auth.JWT({ email, key, scopes: [WRITE_SCOPE] });
  await auth.authorize();
  const sheets = google.sheets({ version: "v4", auth });
  return {
    async tabTitles() {
      const res = await sheets.spreadsheets.get({
        spreadsheetId,
        fields: "sheets(properties(title))",
      });
      return (res.data.sheets ?? []).map((s) => s.properties?.title ?? "");
    },
    async addTab(title) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ addSheet: { properties: { title } } }] },
      });
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

const timestamp = (date: Date | null) =>
  date
    ? date.toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

/** Every chat as a sheet row, oldest offer first. */
export async function bookingRows(now: Date = new Date()): Promise<string[][]> {
  const rows = await db
    .select({
      chatId: coffeeChats.id,
      sponsorName: sponsorJudgingSponsors.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
      userName: users.name,
      slotTime: coffeeChats.slotTime,
      durationMinutes: coffeeChats.durationMinutes,
      room: coffeeChats.room,
      status: coffeeChats.status,
      repName: coffeeChats.repName,
      createdAt: coffeeChats.createdAt,
      respondedAt: coffeeChats.respondedAt,
    })
    .from(coffeeChats)
    .innerJoin(
      sponsorJudgingSponsors,
      eq(sponsorJudgingSponsors.id, coffeeChats.sponsorId),
    )
    .innerJoin(users, eq(users.id, coffeeChats.userId))
    .leftJoin(applications, eq(applications.userId, coffeeChats.userId))
    .orderBy(asc(coffeeChats.createdAt), asc(coffeeChats.id));
  return rows.map((row) => {
    const hacker = row.firstName?.trim()
      ? [row.firstName, row.lastName].filter(Boolean).join(" ")
      : (row.userName ?? "");
    const status = effectiveCoffeeChatStatus(row, now);
    return [
      row.chatId,
      row.sponsorName,
      hacker,
      formatCoffeeChatTime(row.slotTime),
      String(row.durationMinutes),
      row.room ?? coffeeChatNotifyCopy.roomTba,
      coffeeChatCopy.organizer.status[status],
      row.repName ?? "",
      timestamp(row.createdAt),
      timestamp(row.respondedAt),
    ];
  });
}

/** Rewrite the bookings tab from the DB. Throws on any Sheets error. */
export async function writeCoffeeChatBookings(
  sheet: BookingsSheet,
  now: Date = new Date(),
): Promise<number> {
  const rows = await bookingRows(now);
  if (!(await sheet.tabTitles()).includes(BOOKINGS_TAB)) {
    await sheet.addTab(BOOKINGS_TAB);
  }
  const tab = `'${BOOKINGS_TAB}'`;
  await sheet.write(`${tab}!A1`, [[...sheetCopy.headers], ...rows]);
  // Rows left over from a longer earlier write (header is row 1).
  await sheet.clear(`${tab}!A${rows.length + 2}:Z`);
  return rows.length;
}

/** Longest one write may take before the queue moves on. */
export const MIRROR_TIMEOUT_MS = 5000;

let lastLoggedError: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Mirror every chat to the sheet. Writes run one at a time (each reads the
 * DB fresh, so the last one wins with the latest state). Never rejects: a
 * failure is logged, once until it changes or a write succeeds.
 */
export function mirrorCoffeeChats(
  deps: { sheet?: () => Promise<BookingsSheet>; now?: () => Date } = {},
): Promise<void> {
  const run = async () => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const write = (async () => {
        const sheet = await (deps.sheet ?? googleBookingsSheet)();
        await writeCoffeeChatBookings(sheet, deps.now?.() ?? new Date());
      })();
      // A hung Google call must not stall every later write in the queue.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${MIRROR_TIMEOUT_MS} ms`)),
          MIRROR_TIMEOUT_MS,
        );
      });
      void write.catch(() => undefined); // a late failure after the timeout
      await Promise.race([write, timeout]);
      lastLoggedError = null;
    } catch (error) {
      // The message only: never the request, headers, or credentials.
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastLoggedError) {
        lastLoggedError = message;
        console.error(
          `coffee chat sheet mirror failed (the run-of-show service account needs Editor on the sheet): ${message}`,
        );
      }
    } finally {
      clearTimeout(timer);
    }
  };
  const next = queue.then(run);
  queue = next;
  return next;
}
