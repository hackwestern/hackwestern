import {
  DIGITAL_JUDGING_SPONSORS,
  REMOTE_JUDGING_ROOM,
  REMOTE_JUDGING_SPONSORS,
  SPONSOR_PRIZE_TRACKS,
} from "~/content/sponsor-prize-tracks";

/**
 * Loose comparison key for a sponsor name: invisible characters, case,
 * spaces and punctuation ignored ("Sun Life" and "SUNLIFE" agree).
 */
function nameKey(name: string): string {
  return name
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

/**
 * The prize track entry a registered sponsor name matches, or null when the
 * sponsor has no prize track (and so takes no part in judging). A name
 * matches an entry when it equals or contains it, ignoring case, spaces and
 * punctuation.
 */
export function prizeTrackOf(
  sponsorName: string,
  tracks: readonly string[] = SPONSOR_PRIZE_TRACKS,
): string | null {
  const key = nameKey(sponsorName);
  if (!key) return null;
  return (
    tracks.find((entry) => {
      const entryKey = nameKey(entry);
      return entryKey.length > 0 && key.includes(entryKey);
    }) ?? null
  );
}

/** Whether the sponsor has a prize track (and so takes part in judging). */
export function hasPrizeTrack(
  sponsorName: string,
  tracks: readonly string[] = SPONSOR_PRIZE_TRACKS,
): boolean {
  return prizeTrackOf(sponsorName, tracks) !== null;
}

/**
 * Whether the sponsor is a digital prize track sponsor (no portal; the spon
 * team enters their top 3).
 */
export function isDigitalJudging(sponsorName: string): boolean {
  return prizeTrackOf(sponsorName, DIGITAL_JUDGING_SPONSORS) !== null;
}

/** REMOTE_JUDGING_ROOM for a sponsor that judges remotely, else null. */
export function remoteJudgingRoom(sponsorName: string): string | null {
  return prizeTrackOf(sponsorName, REMOTE_JUDGING_SPONSORS) !== null
    ? REMOTE_JUDGING_ROOM
    : null;
}
