/**
 * The Sponsor Bay booth layout around the projector screen (Jazz,
 * 2026-11-18; reference image context/refs-img/sponsor-bay-booth-layout.png).
 * Positions are grid cells: 5 columns (left wall, three across the top,
 * right wall) and rows below the screen. Edit here when booths move.
 */
export type BoothSide = "top" | "left" | "right" | "bottom";

export type Booth = {
  sponsor: string;
  side: BoothSide;
  /** 1-based grid column (1-5). */
  col: number;
  /** 1-based grid row below the screen (1-5). */
  row: number;
};

export const SPONSOR_BAY_BOOTHS: readonly Booth[] = [
  { sponsor: "Accenture", side: "top", col: 2, row: 1 },
  { sponsor: "Canada Life", side: "top", col: 3, row: 1 },
  { sponsor: "Manulife", side: "top", col: 4, row: 1 },
  { sponsor: "QNX", side: "left", col: 1, row: 2 },
  { sponsor: "TinyFish", side: "left", col: 1, row: 3 },
  { sponsor: "StarTech", side: "left", col: 1, row: 4 },
  { sponsor: "CSE", side: "right", col: 5, row: 2 },
  { sponsor: "Sun Life", side: "right", col: 5, row: 3 },
  { sponsor: "Scotiabank", side: "right", col: 5, row: 4 },
  { sponsor: "Commure", side: "bottom", col: 2, row: 5 },
];

function key(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.com$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** The booth for a sponsor, matching names loosely ("Sunlife" = "Sun Life"). */
export function boothFor(
  sponsorName: string | null | undefined,
  booths: readonly Booth[] = SPONSOR_BAY_BOOTHS,
): Booth | null {
  if (!sponsorName) return null;
  const k = key(sponsorName);
  return booths.find((b) => key(b.sponsor) === k) ?? null;
}
