import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";

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
 * A sheet entry's name without its bracketed asides: "QNX (BlackBerry)" ->
 * "QNX". The Sponsor Day-Of list spells some sponsors that way.
 */
function withoutAsides(entry: string): string {
  return entry.replace(/\([^)]*\)|\[[^\]]*\]/g, " ");
}

/**
 * The prize track entry a registered sponsor name matches, or null when the
 * sponsor has no prize track (and so takes no part in judging). A name
 * matches an entry when it equals or contains it, ignoring case, spaces and
 * punctuation. It also matches when it contains the entry's name outside
 * brackets, so registered "QNX" matches the sheet's "QNX (BlackBerry)".
 * A plain "entry contains the name" rule would also make "Canada" match
 * "Canada Life", so the reverse direction is limited to bracketed asides.
 */
export function prizeTrackOf(
  sponsorName: string,
  tracks: readonly string[] = SPONSOR_PRIZE_TRACKS,
): string | null {
  const key = nameKey(sponsorName);
  if (!key) return null;
  return (
    tracks.find((entry) =>
      [nameKey(entry), nameKey(withoutAsides(entry))].some(
        (entryKey) => entryKey.length > 0 && key.includes(entryKey),
      ),
    ) ?? null
  );
}

/** Whether the sponsor has a prize track (and so takes part in judging). */
export function hasPrizeTrack(
  sponsorName: string,
  tracks: readonly string[] = SPONSOR_PRIZE_TRACKS,
): boolean {
  return prizeTrackOf(sponsorName, tracks) !== null;
}
