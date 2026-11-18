import {
  buildJudgingBoard,
  pickCountFromChosenTeams,
} from "~/lib/sponsor-judging-rooms";
import { applySponsorNames } from "~/server/api/utils/run-of-show-parse";
import {
  createCachedLoader,
  getRunOfShow,
} from "~/server/api/utils/run-of-show-sheet";
import {
  fetchAllChosenTeams,
  fetchAllSponsorInfo,
  getSheetsClient,
  getSpreadsheetId,
} from "~/server/api/utils/sponsor-sheets";

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
 * Lucas's judging spreadsheet for the judging view: each sponsor's room
 * (Sponsor Info tab) and chosen teams, one read of each. Cached for 30 s,
 * since the summary polls every 15 s per organizer.
 */
const judgingSheetCache = createCachedLoader(async () => {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();
  const [info, chosen] = await Promise.all([
    // Strict: a failed read must show as "couldn't read", not as no rooms.
    fetchAllSponsorInfo(sheets, spreadsheetId, { strict: true }),
    fetchAllChosenTeams(sheets, spreadsheetId),
  ]);
  return {
    rooms: new Map([...info].map(([name, r]) => [name, r.roomNumber])),
    pickCount: pickCountFromChosenTeams(chosen),
  };
}, 30_000);

/** Null when the judging sheet can't be read (picks show as unknown). */
export async function judgingSheet() {
  try {
    return await judgingSheetCache.get();
  } catch (error) {
    console.error("judging sheet read failed (sponsor judging)", error);
    return null;
  }
}

/**
 * Each registered sponsor's Sunday judging room, by sponsor id, from the
 * same sources as the organizer "Sponsor track judging" panel (sponsor
 * sheet first, then the run-of-show list). No room = absent from the map.
 */
export async function judgingRoomsById(
  sponsors: readonly { id: string; name: string }[],
): Promise<Map<string, string>> {
  const [runOfShow, sheet] = await Promise.all([
    runOfShowFor(sponsors.map((s) => s.name)),
    judgingSheet(),
  ]);
  const board = buildJudgingBoard({
    sponsors,
    items: runOfShow?.items ?? [],
    runOfShowRead: runOfShow !== null,
    sheet,
  });
  const rooms = new Map<string, string>();
  for (const row of board.rows) {
    if (row.sponsorId && row.room) rooms.set(row.sponsorId, row.room);
  }
  return rooms;
}
