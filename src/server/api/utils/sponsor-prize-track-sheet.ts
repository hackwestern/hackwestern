import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";
import { createCachedLoader } from "~/server/api/utils/run-of-show-sheet";
import { fetchSheetSponsors } from "~/server/api/utils/sponsor-sheets";

/**
 * Sponsors with a prize track (and so judging) come from the Sponsor Day-Of
 * "Custom API / Prize Track" checkbox (Jazz, 2026-11-19). The list in
 * src/content/sponsor-prize-tracks.ts is the fallback when the sheet can't
 * be read or has no such column, so judging never opens to everyone and
 * never shuts for everyone because of one failed read.
 *
 * Pass the result to hasPrizeTrack / prizeTrackOf (src/lib/sponsor-prize-
 * tracks.ts) as their `tracks` list.
 */

/** Ticked sponsors in sheet order; null when the column is missing. */
export function prizeTrackNamesFromSheet(
  sponsors: readonly { name: string; hasPrizeTrack: boolean | null }[],
): string[] | null {
  if (!sponsors.some((s) => s.hasPrizeTrack !== null)) return null;
  return sponsors.filter((s) => s.hasPrizeTrack === true).map((s) => s.name);
}

let lastLogged: string | null = null;

/**
 * Never rejects: a failed read logs once and resolves to the content list,
 * so the cache keeps the fallback for the same 60 s as a good read. A broken
 * sheet then costs one JWT authorize and two Sheets reads a minute, not one
 * per judging or portal request.
 */
async function loadPrizeTracks(): Promise<readonly string[]> {
  try {
    const names = prizeTrackNamesFromSheet(await fetchSheetSponsors());
    if (names === null) {
      throw new Error(
        'Sponsor Day-Of has no "Custom API / Prize Track" column',
      );
    }
    lastLogged = null;
    return names;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message !== lastLogged) {
      lastLogged = message;
      console.warn(
        `prize tracks: using the built-in list (couldn't read the Sponsor Day-Of checkbox: ${message})`,
      );
    }
    return SPONSOR_PRIZE_TRACKS;
  }
}

// `() => Date.now()` rather than `Date.now`, so fake timers in tests apply.
const cache = createCachedLoader(loadPrizeTracks, 60_000, () => Date.now());

/**
 * The prize track sponsor names, re-read at most once a minute (a failed
 * read included). Never rejects: on a failed read it logs once and returns
 * the content list.
 */
export async function prizeTrackSponsors(): Promise<readonly string[]> {
  return cache.get();
}

/** Test hook: forget the cached list. */
export function clearPrizeTrackCache(): void {
  cache.clear();
}
