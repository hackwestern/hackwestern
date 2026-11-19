import { eq, inArray } from "drizzle-orm";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { formatPresentationTime, slotsKey } from "~/lib/sponsor-presentations";
import {
  isDigitalJudging,
  prizeTrackOf,
  remoteJudgingRoom,
} from "~/lib/sponsor-prize-tracks";
import { SPONSOR_FINAL_TOP, teamIdAndLink } from "~/lib/sponsor-scoring";
import { prizeTrackSponsors } from "~/server/api/utils/sponsor-prize-track-sheet";
import {
  googleBookingsSheet,
  SHEET_WRITES_DISABLED,
  type BookingsSheet,
  type MirrorResult,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import { sheetWritesEnabled } from "~/server/api/utils/run-of-show-sheet";
import { round2OpenedAt } from "~/server/api/utils/sponsor-judging-settings";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { membersByTeam } from "~/server/api/utils/sponsor-judging-teams";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingSponsors,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  sponsorTeamScores,
  teams,
  users,
} from "~/server/db/schema";

/**
 * One-way mirror of Sunday sponsor judging to the "Sponsor Judging" tab of
 * the run-of-show sheet (docs/flows/sponsor-judging.md). The app is the
 * source of truth: the tab is rewritten in full from the DB on every
 * judging change (shortlist sent, presentations scheduled, hackers
 * notified, top 3 submitted or entered) and by the organizer "Sync to
 * sheet" button. Same pattern as the coffee chat mirror: its own tab
 * (created if missing), the spreadsheets write scope, writes one at a time,
 * and a failure is logged once and never blocks the action. Outside
 * production (unless SHEET_WRITES=1) and in tests nothing is written.
 *
 * Layout (Jazz, 2026-11-19: "Sponsor Judging sheet tab is wide"):
 *   1. Sponsors: one row per prize track sponsor. Sponsor, In person /
 *      Digital, Judging room, Round 1 status, Shortlist sent, Shortlist
 *      (team IDs), Round 2 status, Top 3 sent, 1st, 2nd, 3rd place, Notes.
 *      Place cells read "<team ID> · <Devpost link>".
 *   2. Presentations: one row per shortlisted or scheduled team per
 *      sponsor (Sponsor, Team ID, Team, Members, Time, Room, Notified).
 * Only stored data; a missing value is a blank cell.
 */

const sheetCopy = sponsorJudgingCopy.sheet;
export const JUDGING_TAB = sheetCopy.tab;
/** Widest table (the sponsor rows): every row is padded to this. */
const WIDTH = sheetCopy.sponsors.headers(SPONSOR_FINAL_TOP).length;

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
  /** Devpost link by team id (absent or null = none). */
  teamLinks: ReadonlyMap<string, string | null>;
  /** Member names by team id. */
  members: ReadonlyMap<string, readonly string[]>;
  /** How each scheduled team's members heard, by team id ("" = not yet). */
  notified: ReadonlyMap<string, string>;
  /** Sponsors with at least one rep's score. */
  scoring: ReadonlySet<string>;
  /** Organizers have opened round 2. */
  round2Open: boolean;
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
  const teamCell = (id: string) =>
    teamIdAndLink(id, input.teamLinks.get(id) ?? null);
  const membersOf = (id: string) => (input.members.get(id) ?? []).join(", ");
  const placedFor = (sponsorId: string) =>
    input.presentations.filter(
      (p) => p.sponsorId === sponsorId && p.startMinute !== null,
    ).length;
  const status = sheetCopy.sponsors.status;

  const rows: string[][] = [
    [sheetCopy.note, sheetCopy.updated(timestamp(input.writtenAt))],
    [],
  ];

  // 1. One row per prize track sponsor.
  rows.push([...sheetCopy.sponsors.headers(SPONSOR_FINAL_TOP)]);
  for (const t of input.tracks) {
    const id = t.sponsorId;
    const digital = isDigitalJudging(t.name);
    const sent = id ? sendOf.get(id) : undefined;
    const final = id ? finalOf.get(id) : undefined;
    const remote = remoteJudgingRoom(t.name);
    const room = remote ?? (id ? (input.rooms.get(id) ?? "") : "");
    const round1 = digital
      ? status.digitalRound1
      : !id
        ? status.notRegistered
        : sent
          ? status.shortlistSent
          : input.scoring.has(id)
            ? status.scoring
            : status.notStarted;
    const round2 = final
      ? digital
        ? status.digitalEntered
        : status.submitted
      : digital
        ? status.digitalWaiting
        : !input.round2Open
          ? status.notOpen
          : id && placedFor(id) > 0
            ? status.ranking
            : status.locked;
    const places = Array.from({ length: SPONSOR_FINAL_TOP }, (_, i) => {
      const teamId = final?.teamIds[i];
      return teamId ? teamCell(teamId) : "";
    });
    rows.push([
      t.name,
      digital ? sheetCopy.sponsors.digital : sheetCopy.sponsors.inPerson,
      digital ? "" : room,
      round1,
      timestamp(sent?.sentAt),
      sent ? [...sent.teamIds].join(", ") : "",
      round2,
      timestamp(final?.submittedAt),
      ...places,
      digital
        ? sheetCopy.sponsors.notes.digital
        : remote
          ? sheetCopy.sponsors.notes.remote
          : "",
    ]);
  }
  rows.push([]);

  // 2. Presentations: the sent shortlist and each team's slot.
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
        teamCell(id),
        teamName(id),
        membersOf(id),
        placed ? formatPresentationTime(slot.startMinute!) : "",
        placed ? (slot.room ?? "") : "",
        placed ? (input.notified.get(id) ?? "") : "",
      ]);
    }
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
  const trackList = await prizeTrackSponsors();
  const tracks = trackList.flatMap((entry): TrackRow[] => {
    const matched = registered.filter(
      (s) => prizeTrackOf(s.name, trackList) === entry,
    );
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
      teamLinks: new Map(),
      members: new Map(),
      notified: new Map(),
      scoring: new Set(),
      round2Open: (await round2OpenedAt()) !== null,
      writtenAt,
    };
  }

  const [rooms, sends, finals, presentations, scorers, openedAt] =
    await Promise.all([
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
      db
        .selectDistinct({ sponsorId: sponsorTeamScores.sponsorId })
        .from(sponsorTeamScores)
        .where(inArray(sponsorTeamScores.sponsorId, ids)),
      round2OpenedAt(),
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
          .select({
            id: teams.id,
            name: teams.name,
            devpostUrl: teams.devpostUrl,
          })
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
    teamLinks: new Map(
      nameRows.map((t) => [
        t.id,
        t.devpostUrl?.trim() ? t.devpostUrl.trim() : null,
      ]),
    ),
    members: new Map(
      [...members].map(([id, list]) => [
        id,
        list.map((m) => m.name).filter((name) => name.length > 0),
      ]),
    ),
    notified,
    scoring: new Set(scorers.map((r) => r.sponsorId)),
    round2Open: openedAt !== null,
    writtenAt,
  };
}

/**
 * Rewrite the tab from `input`. Throws on any Sheets error. Stops between
 * steps once `isCurrent` says a newer run has started, so a run that timed
 * out can't overwrite or clear what the newer run wrote.
 */
export async function writeJudgingSheet(
  sheet: BookingsSheet,
  input: JudgingSheetInput,
  isCurrent: () => boolean = () => true,
): Promise<number> {
  const rows = judgingSheetRows(input);
  if (!(await sheet.tabTitles()).includes(JUDGING_TAB)) {
    if (!isCurrent()) return rows.length;
    await sheet.addTab(JUDGING_TAB);
  }
  if (!isCurrent()) return rows.length;
  const tab = `'${JUDGING_TAB}'`;
  await sheet.write(`${tab}!A1`, rows);
  if (!isCurrent()) return rows.length;
  // Rows left over from a longer earlier write.
  await sheet.clear(`${tab}!A${rows.length + 1}:Z`);
  return rows.length;
}

/** Longest one write may take before the queue moves on. */
export const MIRROR_TIMEOUT_MS = 5000;
/** Longest a judging action waits on the mirror before responding. */
export const MIRROR_WAIT_MS = 2500;

export type { MirrorResult };

let lastLoggedError: string | null = null;
let queue: Promise<unknown> = Promise.resolve();
/** Bumped as each run starts; an older run stops writing once it changes. */
let generation = 0;

/**
 * Mirror judging to the sheet. Writes run one at a time (each reads the DB
 * fresh, so the last one wins with the latest state). Never rejects: a
 * failure is logged, once until it changes or a write succeeds, and
 * returned for the organizer "Sync to sheet" button. With sheet writes off
 * (sheetWritesEnabled) nothing is written and it returns
 * `{ ok: false, error: "disabled" }`, logged once.
 */
export function mirrorSponsorJudging(
  deps: {
    sheet?: () => Promise<BookingsSheet>;
    load?: () => Promise<JudgingSheetInput>;
  } = {},
): Promise<MirrorResult> {
  const run = async (): Promise<MirrorResult> => {
    if (!sheetWritesEnabled()) {
      if (lastLoggedError !== SHEET_WRITES_DISABLED) {
        lastLoggedError = SHEET_WRITES_DISABLED;
        console.warn(
          "sponsor judging sheet mirror: sheet writes are off outside production (set SHEET_WRITES=1 to write)",
        );
      }
      return { ok: false, error: SHEET_WRITES_DISABLED };
    }
    const gen = ++generation;
    const isCurrent = () => gen === generation;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const write = (async () => {
        const input = await (deps.load ?? loadJudgingSheetInput)();
        if (!isCurrent()) return 0;
        const sheet = await (deps.sheet ?? googleBookingsSheet)();
        if (!isCurrent()) return 0;
        return writeJudgingSheet(sheet, input, isCurrent);
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
 * the write finish in the background. Returns the mirror's result, or null
 * when it was still running at the wait. Never rejects.
 */
export async function mirrorSponsorJudgingSoon(): Promise<MirrorResult | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const result = await Promise.race([
    mirrorSponsorJudging(),
    new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), MIRROR_WAIT_MS);
    }),
  ]);
  clearTimeout(timer);
  return result;
}
