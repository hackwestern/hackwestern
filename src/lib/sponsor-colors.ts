/**
 * A stable colour per sponsor for the organizer views (rooms table cells,
 * sponsor filter, the Sponsors tab dot). Built only from existing dashboard
 * tokens: each entry is a light fill for cells and a strong edge for dots
 * and cell edges. Tailwind needs whole class names, so they're spelled out.
 *
 * The tokens give six tellable-apart pairs; with more sponsors than that,
 * colours repeat (see docs/decisions.md, 2026-11-17, sponsor colours).
 */

export type SponsorColor = {
  key: string;
  /** Light background for booked or held cells. */
  fill: string;
  /** Strong left edge for cells. */
  edge: string;
  /** Solid dot next to the sponsor's name. */
  dot: string;
};

export const SPONSOR_PALETTE: readonly SponsorColor[] = [
  {
    key: "blue",
    fill: "bg-dashboard-schedule-blue",
    edge: "border-l-dashboard-action-primary",
    dot: "bg-dashboard-action-primary",
  },
  {
    key: "green",
    fill: "bg-dashboard-schedule-green",
    edge: "border-l-dashboard-status-live",
    dot: "bg-dashboard-status-live",
  },
  {
    key: "pink",
    fill: "bg-dashboard-schedule-pink",
    edge: "border-l-dashboard-text-medium",
    dot: "bg-dashboard-schedule-pink ring-2 ring-inset ring-dashboard-text-medium",
  },
  {
    key: "orange",
    fill: "bg-dashboard-schedule-orange",
    edge: "border-l-dashboard-status-iconBadgeIcon",
    dot: "bg-dashboard-status-iconBadgeIcon",
  },
  {
    key: "amber",
    fill: "bg-dashboard-bg-task",
    edge: "border-l-dashboard-border-task",
    dot: "bg-dashboard-border-task",
  },
  {
    key: "navy",
    fill: "bg-dashboard-bg-navSelected",
    edge: "border-l-dashboard-text-heavy",
    dot: "bg-dashboard-text-heavy",
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
