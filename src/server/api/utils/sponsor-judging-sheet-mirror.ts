import { eq, inArray } from "drizzle-orm";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";
import { formatPresentationTime, slotsKey } from "~/lib/sponsor-presentations";
import { prizeTrackOf } from "~/lib/sponsor-prize-tracks";
import {
  googleBookingsSheet,
  type BookingsSheet,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { membersByTeam } from "~/server/api/utils/sponsor-judging-teams";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";

/**
 * One-way mirror of Sunday sponsor judging to the "Sponsor Judging" tab of
 * the run-of-show sheet (docs/flows/sponsor-judging.md). The app is the
 * source of truth: the tab is rewritten in full from the DB on every
 * judging change (shortlist sent, presentations scheduled, hackers
 * notified, top 5 submitted) and by the organizer "Sync to sheet" button.
 * Same pattern as the coffee chat mirror: its own tab (created if
 * missing), the spreadsheets write scope, writes one at a time, and a
 * failure is logged once and never blocks the action.
 *
 * Three tables, top to bottom, a blank row between them:
 *   1. Tracks: one row per prize track sponsor.
 *   2. Chosen teams and presentation schedule: one row per shortlisted or
 *      scheduled team per sponsor.
 *   3. Final results: one row per sponsor per rank.
 * Only stored data; a missing value is a blank cell.
 */

const sheetCopy = sponsorJudgingCopy.sheet;
export const JUDGING_TAB = sheetCopy.tab;
/** Widest table (the schedule): every row is padded to this. */
const WIDTH = sheetCopy.schedule.headers.length;

type TrackRow = { name: string; sponsorId: string | null };

/** Everything the tab shows, loaded from the DB (tests pass fixtures). */
export type JudgingSheetInput = {
  /** Prize track sponsors in list order; sponsorId null = not registered. */
  tracks: readonly TrackRow[];
  /** Judging room by sponsor id (absent = no room). */
  rooms: ReadonlyMap<string, string>;
  sends: readonly { sponsorId: string; teamIds: string[]; sentAt: Date }[];
  finals: readonly {
    sponsorId: string;
    teamIds: string[];
    submittedAt: Date;
  }[];
  presentations: readonly {
    sponsorId: string;
    teamId: string;
    room: string | null;
    startMinute: number | null;
  }[];
  teamNames: ReadonlyMap<string, string>;
  /** Member names by team id. */
  members: ReadonlyMap<string, readonly string[]>;
  /** How each scheduled team's members heard, by team id ("" = not yet). */
  notified: ReadonlyMap<string, string>;
  writtenAt: Date;
};

const timestamp = (date: Date | null | undefined) =>
  date
    ? date.toLocaleString("en-CA", {
        timeZone: "America/Toronto",
        dateStyle: "short",
        timeStyle: "short",
      })
    : "";

const pad = (row: readonly string[]) => [
  ...row,
  ...Array<string>(Math.max(0, WIDTH - row.length)).fill(""),
];

/**
 * How a team's members heard about their current times: "Slack", "Email",
 * "failed", or several joined ("Slack, Email, failed"); "" when nobody was
 * tried. `statuses` are the members' notice statuses for those times.
 */
export function notifiedLabel(
  statuses: readonly { status: string; reached: boolean }[],
): string {
  const labels = sheetCopy.schedule.notified;
  const parts: string[] = [];
  if (statuses.some((s) => s.reached && s.status === "sent"))
    parts.push(labels.slack);
  if (statuses.some((s) => s.reached && s.status === "emailed"))
    parts.push(labels.email);
  if (statuses.some((s) => s.status === "failed" || s.status === "not-found"))
    parts.push(labels.failed);
  return parts.join(", ");
}

/** The whole tab as rows, from row 1. Pure: tests build it from fixtures. */
export function judgingSheetRows(input: JudgingSheetInput): string[][] {
  const sendOf = new Map(input.sends.map((s) => [s.sponsorId, s]));
  const finalOf = new Map(input.finals.map((f) => [f.sponsorId, f]));
  const teamName = (id: string) => input.teamNames.get(id) ?? id;
  const membersOf = (id: string) => (input.members.get(id) ?? []).join(", ");

  const rows: string[][] = [
    [sheetCopy.note, sheetCopy.updated(timestamp(input.writtenAt))],
    [],
  ];

  // 1. Tracks.
  rows.push([sheetCopy.tracks.title], [...sheetCopy.tracks.headers]);
  for (const t of input.tracks) {
    const id = t.sponsorId;
    rows.push([
      t.name,
      sheetCopy.tracks.yes,
      id ? (input.rooms.get(id) ?? "") : "",
      id ? timestamp(sendOf.get(id)?.sentAt) : "",
      id ? timestamp(finalOf.get(id)?.submittedAt) : "",
    ]);
  }
  rows.push([]);

  // 2. Chosen teams (the sent shortlist) and their presentation slots.
  rows.push([sheetCopy.schedule.title], [...sheetCopy.schedule.headers]);
  for (const t of input.tracks) {
    if (!t.sponsorId) continue;
    const slotOf = new Map(
      input.presentations
        .filter((p) => p.sponsorId === t.sponsorId)
        .map((p) => [p.teamId, p]),
    );
    const teamIds = [
      ...new Set([
        ...(sendOf.get(t.sponsorId)?.teamIds ?? []),
        ...slotOf.keys(),
      ]),
    ];
    const start = (id: string) => slotOf.get(id)?.startMinute ?? null;
    teamIds.sort((a, b) => {
      const sa = start(a);
      const sb = start(b);
      if (sa !== null && sb !== null) return sa - sb;
      if (sa !== null) return -1;
      if (sb !== null) return 1;
      return teamName(a).localeCompare(teamName(b));
    });
    for (const id of teamIds) {
      const slot = slotOf.get(id);
      const placed = slot?.startMinute != null;
      rows.push([
        t.name,
        sheetCopy.schedule.round1,
        teamName(id),
        membersOf(id),
        placed ? formatPresentationTime(slot.startMinute!) : "",
        placed ? (slot.room ?? "") : "",
        placed ? (input.notified.get(id) ?? "") : "",
      ]);
    }
  }
  rows.push([]);

  // 3. Final results: each submitted top 5 in rank order.
  rows.push([sheetCopy.finals.title], [...sheetCopy.finals.headers]);
  for (const t of input.tracks) {
    const final = t.sponsorId ? finalOf.get(t.sponsorId) : undefined;
    final?.teamIds.forEach((id, i) => {
      rows.push([t.name, String(i + 1), teamName(id), membersOf(id)]);
    });
  }

  return rows.map(pad);
}

/** Load the tab's data from the DB (rooms from the same sheets as scheduling). */
export async function loadJudgingSheetInput(
  writtenAt: Date = new Date(),
): Promise<JudgingSheetInput> {
  const registered = await db
    .select({
      id: sponsorJudgingSponsors.id,
      name: sponsorJudgingSponsors.name,
    })
    .from(sponsorJudgingSponsors)
    .orderBy(sponsorJudgingSponsors.name);
  // In list order; a track with no registered sponsor still gets a row.
  const tracks = SPONSOR_PRIZE_TRACKS.flatMap((entry): TrackRow[] => {
    const matched = registered.filter((s) => prizeTrackOf(s.name) === entry);
    return matched.length > 0
      ? matched.map((s) => ({ name: s.name, sponsorId: s.id }))
      : [{ name: entry, sponsorId: null }];
  });
  const trackSponsors = tracks.flatMap((t) =>
    t.sponsorId ? [{ id: t.sponsorId, name: t.name }] : [],
  );
  const ids = trackSponsors.map((s) => s.id);
  if (ids.length === 0) {
    return {
      tracks,
      rooms: new Map(),
      sends: [],
      finals: [],
      presentations: [],
      teamNames: new Map(),
      members: new Map(),
      notified: new Map(),
      writtenAt,
    };
  }

  const [rooms, sends, finals, presentations] = await Promise.all([
    judgingRoomsById(trackSponsors),
    db
      .select({
        sponsorId: sponsorShortlistSends.sponsorId,
        teamIds: sponsorShortlistSends.teamIds,
        sentAt: sponsorShortlistSends.sentAt,
      })
      .from(sponsorShortlistSends)
      .where(inArray(sponsorShortlistSends.sponsorId, ids)),
    db
      .select({
        sponsorId: sponsorFinalPicks.sponsorId,
        teamIds: sponsorFinalPicks.teamIds,
        submittedAt: sponsorFinalPicks.submittedAt,
      })
      .from(sponsorFinalPicks)
      .where(inArray(sponsorFinalPicks.sponsorId, ids)),
    // Every sponsor's slots: a team's notices cover all of its slots.
    db
      .select({
        sponsorId: sponsorPresentations.sponsorId,
        teamId: sponsorPresentations.teamId,
        room: sponsorPresentations.room,
        startMinute: sponsorPresentations.startMinute,
      })
      .from(sponsorPresentations),
  ]);

  const teamIds = [
    ...new Set([
      ...sends.flatMap((s) => s.teamIds),
      ...finals.flatMap((f) => f.teamIds),
      ...presentations
        .filter((p) => ids.includes(p.sponsorId))
        .map((p) => p.teamId),
    ]),
  ];
  const [nameRows, members, notices] = await Promise.all([
    teamIds.length > 0
      ? db
          .select({ id: teams.id, name: teams.name })
          .from(teams)
          .where(inArray(teams.id, teamIds))
      : [],
    membersByTeam(teamIds),
    teamIds.length > 0
      ? db
          .select({
            teamId: sponsorPresentationNotices.teamId,
            memberTeam: users.teamId,
            status: sponsorPresentationNotices.status,
            slotsKey: sponsorPresentationNotices.slotsKey,
            sentAt: sponsorPresentationNotices.sentAt,
          })
          .from(sponsorPresentationNotices)
          .innerJoin(users, eq(users.id, sponsorPresentationNotices.userId))
          .where(inArray(sponsorPresentationNotices.teamId, teamIds))
      : [],
  ]);

  // A notice counts only for the team's current times (same rule as the
  // organizer By hacker view).
  const slotsOf = new Map<
    string,
    { sponsorId: string; room: string; start: number }[]
  >();
  for (const p of presentations) {
    if (p.startMinute === null) continue;
    const list = slotsOf.get(p.teamId) ?? [];
    list.push({
      sponsorId: p.sponsorId,
      room: p.room ?? "",
      start: p.startMinute,
    });
    slotsOf.set(p.teamId, list);
  }
  const notified = new Map<string, string>();
  for (const [teamId, slots] of slotsOf) {
    const key = slotsKey(slots);
    const current = notices.filter(
      (n) =>
        n.teamId === teamId && n.memberTeam === teamId && n.slotsKey === key,
    );
    notified.set(
      teamId,
      notifiedLabel(
        current.map((n) => ({ status: n.status, reached: n.sentAt !== null })),
      ),
    );
  }

  return {
    tracks,
    rooms,
    sends,
    finals,
    presentations,
    teamNames: new Map(nameRows.map((t) => [t.id, t.name])),
    members: new Map(
      [...members].map(([id, list]) => [
        id,
        list.map((m) => m.name).filter((name) => name.length > 0),
      ]),
    ),
    notified,
    writtenAt,
  };
}

/** Rewrite the tab from `input`. Throws on any Sheets error. */
export async function writeJudgingSheet(
  sheet: BookingsSheet,
  input: JudgingSheetInput,
): Promise<number> {
  const rows = judgingSheetRows(input);
  if (!(await sheet.tabTitles()).includes(JUDGING_TAB)) {
    await sheet.addTab(JUDGING_TAB);
  }
  const tab = `'${JUDGING_TAB}'`;
  await sheet.write(`${tab}!A1`, rows);
  // Rows left over from a longer earlier write.
  await sheet.clear(`${tab}!A${rows.length + 1}:Z`);
  return rows.length;
}

/** Longest one write may take before the queue moves on. */
export const MIRROR_TIMEOUT_MS = 5000;
/** Longest a judging action waits on the mirror before responding. */
export const MIRROR_WAIT_MS = 2500;

export type MirrorResult =
  | { ok: true; rows: number }
  | { ok: false; error: string };

let lastLoggedError: string | null = null;
let queue: Promise<unknown> = Promise.resolve();

/**
 * Mirror judging to the sheet. Writes run one at a time (each reads the DB
 * fresh, so the last one wins with the latest state). Never rejects: a
 * failure is logged, once until it changes or a write succeeds, and
 * returned for the organizer "Sync to sheet" button.
 */
export function mirrorSponsorJudging(
  deps: {
    sheet?: () => Promise<BookingsSheet>;
    load?: () => Promise<JudgingSheetInput>;
  } = {},
): Promise<MirrorResult> {
  const run = async (): Promise<MirrorResult> => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const write = (async () => {
        const input = await (deps.load ?? loadJudgingSheetInput)();
        const sheet = await (deps.sheet ?? googleBookingsSheet)();
        return writeJudgingSheet(sheet, input);
      })();
      // A hung Google call must not stall every later write in the queue.
      const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`timed out after ${MIRROR_TIMEOUT_MS} ms`)),
          MIRROR_TIMEOUT_MS,
        );
      });
      void write.catch(() => undefined); // a late failure after the timeout
      const rows = await Promise.race([write, timeout]);
      lastLoggedError = null;
      return { ok: true, rows };
    } catch (error) {
      // The message only: never the request, headers, or credentials.
      const message = error instanceof Error ? error.message : String(error);
      if (message !== lastLoggedError) {
        lastLoggedError = message;
        console.error(
          `sponsor judging sheet mirror failed (the run-of-show service account needs Editor on the sheet): ${message}`,
        );
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
 * Mirror after a judging change: waits at most MIRROR_WAIT_MS (work after
 * the response can be frozen on Vercel, so callers await this), then lets
 * the write finish in the background. Never rejects.
 */
export async function mirrorSponsorJudgingSoon(): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  await Promise.race([
    mirrorSponsorJudging(),
    new Promise<void>((resolve) => {
      timer = setTimeout(resolve, MIRROR_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
}
