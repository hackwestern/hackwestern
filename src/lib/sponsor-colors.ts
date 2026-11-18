/**
 * A stable colour and initials per sponsor for the organizer views (rooms
 * table cells, sponsor filter, the Sponsors tab). Built only from existing
 * dashboard tokens: each entry is a light fill for cells, a strong left
 * edge, and a badge (strong background, readable text) that carries the
 * sponsor's initials, so a sponsor never rests on colour alone. Tailwind
 * needs whole class names, so they're spelled out.
 *
 * The six pairs are the most distinct the tokens allow: blue, green, navy,
 * amber, slate and pink. Orange is left out (it reads as the warning used
 * for over capacity and holds). Pink has no strong token yet, so its edge
 * and badge use the darkest text colour on the pink tint; docs/decisions.md
 * (2026-11-17, sponsor colours) lists the tokens that would fix it.
 */

export type SponsorColor = {
  key: string;
  /** Light background for booked or held cells. */
  fill: string;
  /** Strong left edge for cells (use with border-l-4). */
  edge: string;
  /** Initials badge: strong background and readable text. */
  badge: string;
};

export const SPONSOR_PALETTE: readonly SponsorColor[] = [
  {
    key: "blue",
    fill: "bg-dashboard-schedule-blue",
    edge: "border-l-dashboard-action-primary",
    badge: "bg-dashboard-action-primary text-dashboard-text-inverse",
  },
  {
    key: "green",
    fill: "bg-dashboard-schedule-green",
    edge: "border-l-dashboard-status-live",
    badge: "bg-dashboard-status-live text-dashboard-text-inverse",
  },
  {
    key: "navy",
    fill: "bg-dashboard-bg-navSelected",
    edge: "border-l-dashboard-text-heavy",
    badge: "bg-dashboard-text-heavy text-dashboard-text-inverse",
  },
  {
    key: "amber",
    fill: "bg-dashboard-bg-task",
    edge: "border-l-dashboard-border-task",
    badge: "bg-dashboard-border-task text-dashboard-text-heavy",
  },
  {
    key: "slate",
    fill: "bg-dashboard-border-muted",
    edge: "border-l-dashboard-border-strong",
    badge: "bg-dashboard-border-strong text-dashboard-text-inverse",
  },
  {
    key: "pink",
    fill: "bg-dashboard-schedule-pink",
    edge: "border-l-dashboard-text-heavy",
    badge:
      "bg-dashboard-schedule-pink text-dashboard-text-heavy ring-1 ring-inset ring-dashboard-text-heavy",
  },
];

/** FNV-1a: a small, stable string hash. */
function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Palette index per sponsor name. Each name prefers the slot its hash
 * picks; names are placed in sorted order and step to the next free slot,
 * so up to the palette size every sponsor gets a different colour, and the
 * same set of names always gets the same colours (on every page).
 */
export function sponsorColorIndexes(
  names: readonly string[],
  size: number = SPONSOR_PALETTE.length,
): Map<string, number> {
  const out = new Map<string, number>();
  const used = new Set<number>();
  for (const name of [...new Set(names)].sort()) {
    let slot = hash(name) % size;
    if (used.size < size) {
      while (used.has(slot)) slot = (slot + 1) % size;
    }
    used.add(slot);
    out.set(name, slot);
  }
  return out;
}

/** The colour for `name` from a sponsorColorIndexes map (hash if missing). */
export function sponsorColor(
  indexes: ReadonlyMap<string, number>,
  name: string,
): SponsorColor {
  const i = indexes.get(name) ?? hash(name) % SPONSOR_PALETTE.length;
  return SPONSOR_PALETTE[i % SPONSOR_PALETTE.length]!;
}

/**
 * Two-letter initials for a sponsor's badge: the first letters of the first
 * two words ("Canada Life" -> "CL"), else the first two letters ("RBC" ->
 * "RB"). Letters and digits only, by code point, upper-cased.
 */
export function sponsorInitials(name: string): string {
  const words = name.split(/[^\p{L}\p{N}]+/u).filter((w) => w.length > 0);
  const first = words[0] ? Array.from(words[0]) : [];
  const second = words[1] ? Array.from(words[1]) : [];
  const letters = second.length > 0 ? [first[0], second[0]] : first.slice(0, 2);
  return letters.join("").toLocaleUpperCase() || "?";
}
