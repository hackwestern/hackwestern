/**
 * Sponsor logos for the sponsor dashboard, from the files the website
 * already uses (public/shared/sponsors). Keyed by a loose name match so
 * "StarTech", "StarTech.com" and "Sun Life" / "Sunlife" all resolve.
 * A sponsor missing here falls back to their initials badge.
 */
const LOGOS: Record<string, string> = {
  accenture: "/shared/sponsors/accenture.svg",
  canadalife: "/shared/sponsors/canadalife.png",
  commure: "/shared/sponsors/commure.svg",
  cse: "/shared/sponsors/cse-trimmed.png",
  manulife: "/shared/sponsors/manulife.svg",
  scotiabank: "/shared/sponsors/scotiabank-trimmed.svg",
  startech: "/shared/sponsors/startech.svg",
  sunlife: "/shared/sponsors/sunlife.png",
  tinyfish: "/shared/sponsors/tinyfish.svg",
};

function logoKey(name: string): string {
  return name
    .toLowerCase()
    .replace(/\.com$/, "")
    .replace(/[^a-z0-9]/g, "");
}

/** The logo path for a sponsor, or null when we don't have one. */
export function sponsorLogo(name: string): string | null {
  return LOGOS[logoKey(name)] ?? null;
}
