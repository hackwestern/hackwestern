import { eq } from "drizzle-orm";

import {
  buildJudgingBoard,
  pickCountFromChosenTeams,
} from "~/lib/sponsor-judging-rooms";
import { remoteJudgingRoom } from "~/lib/sponsor-prize-tracks";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import {
  createCachedLoader,
  getRunOfShow,
} from "~/server/api/utils/run-of-show-sheet";
import {
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";
import { db } from "~/server/db";
import {
  sponsorFinalPicks,
  sponsorJudgingRooms,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

/**
 * The run of show with registered sponsor names applied (coffee chat rooms
 * and the judging item); null when the sheet can't be read (optional here).
 */
export async function runOfShowFor(sponsorNames: string[]) {
  try {
    return applySponsorNames(await getRunOfShow(), sponsorNames);
  } catch (error) {
    console.error("run-of-show sheet read failed (sponsor judging)", error);
    return null;
  }
}

/**
 * Each registered sponsor's saved picks (their ranked top list in
 * sponsor_final_pick), by sponsor name. A registered sponsor that hasn't
 * submitted has none ([]), so the panel shows 0, not unknown. The old
 * "Judging" tab was deleted on 2026-11-19 (Jazz: count the DB).
 */
export async function savedPicksByName(): Promise<Map<string, string[]>> {
  const rows = await db
    .select({
      name: sponsorJudgingSponsors.name,
      teamIds: sponsorFinalPicks.teamIds,
    })
    .from(sponsorJudgingSponsors)
    .leftJoin(
      sponsorFinalPicks,
      eq(sponsorFinalPicks.sponsorId, sponsorJudgingSponsors.id),
    );
  return new Map(rows.map((r) => [r.name, r.teamIds ?? []]));
}

/**
 * The judging view's rooms (Lucas's Sponsor Info tab) and pick counts
 * (savedPicksByName, from the database). Cached for 30 s, since the
 * summary polls every 15 s per organizer.
 */
const judgingSheetCache = createCachedLoader(async () => {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const [info, chosen] = await Promise.all([
    // Strict: a failed read must show as "couldn't read", not as no rooms.
    fetchAllSponsorInfo(sheets, spreadsheetId, { strict: true }),
    savedPicksByName(),
  ]);
  return {
    rooms: new Map([...info].map(([name, r]) => [name, r.roomNumber])),
    pickCount: pickCountFromChosenTeams(chosen),
  };
}, 30_000);

/** Tests: drop the cached read. */
export function clearJudgingSheetCache() {
  judgingSheetCache.clear();
}

/** Null when the judging sheet can't be read (picks show as unknown). */
export async function judgingSheet() {
  try {
    return await judgingSheetCache.get();
  } catch (error) {
    console.error("judging sheet read failed (sponsor judging)", error);
    return null;
  }
}

/** Where a sponsor's judging room came from. */
export type JudgingRoomSource = "board" | "sheet" | "remote";

/**
 * Each registered sponsor's Sunday judging room and where it came from, by
 * sponsor id. An organizer's pick on the Judging board (sponsor_judging_room)
 * wins; otherwise the same sources as the organizer "Sponsor track
 * judging" panel (sponsor sheet first, then the run-of-show list). A
 * sponsor that judges remotely (REMOTE_JUDGING_SPONSORS) always gets REMOTE_JUDGING_ROOM,
 * whatever the sheets say (Jazz, 2026-11-19). No room = absent.
 */
export async function judgingRoomsWithSource(
  sponsors: readonly { id: string; name: string }[],
): Promise<Map<string, { room: string; source: JudgingRoomSource }>> {
  const [runOfShow, sheet, picked] = await Promise.all([
    runOfShowFor(sponsors.map((s) => s.name)),
    judgingSheet(),
    db.select().from(sponsorJudgingRooms),
  ]);
  const board = buildJudgingBoard({
    sponsors,
    items: runOfShow?.items ?? [],
    runOfShowRead: runOfShow !== null,
    sheet,
  });
  const rooms = new Map<string, { room: string; source: JudgingRoomSource }>();
  for (const row of board.rows) {
    if (row.sponsorId && row.room) {
      rooms.set(row.sponsorId, { room: row.room, source: "sheet" });
    }
  }
  for (const p of picked) rooms.set(p.sponsorId, { room: p.room, source: "board" });
  for (const s of sponsors) {
    const remote = remoteJudgingRoom(s.name);
    if (remote) rooms.set(s.id, { room: remote, source: "remote" });
  }
  return rooms;
}

/** judgingRoomsWithSource without the source. */
export async function judgingRoomsById(
  sponsors: readonly { id: string; name: string }[],
): Promise<Map<string, string>> {
  const rooms = await judgingRoomsWithSource(sponsors);
  return new Map([...rooms].map(([id, r]) => [id, r.room]));
}
