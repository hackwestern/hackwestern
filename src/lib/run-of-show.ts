/**
 * Contract for data read from the run-of-show Google Sheet (the single source
 * of truth for schedules and rooms, docs/decisions.md 2026-11-14).
 *
 * Shapes only (plus tiny pure helpers). The parser lives in
 * src/server/api/utils/run-of-show-sheet.ts; pages consume these types.
 * Dependency-free so client components can import it.
 */
import type { SponAvailability } from "~/lib/spon-availability";

export const RUN_OF_SHOW_DAYS = ["Friday", "Saturday", "Sunday"] as const;
export type RunOfShowDay = (typeof RUN_OF_SHOW_DAYS)[number];

/** Columns B-F of the "RUN OF SHOW" tab (header row 2). */
export const RUN_OF_SHOW_COLUMNS = [
  { key: "big-event", header: "Big Event", label: "Main event" },
  { key: "sponsor-workshop", header: "Sponsor Workshop", label: "Workshop" },
  { key: "food", header: "Food", label: "Food" },
  { key: "spon-booth", header: "Spon Booth", label: "Sponsor Bay" },
  { key: "coffee-chats", header: "Coffee Chats", label: "Coffee chats" },
] as const;
export type RunOfShowColumn = (typeof RUN_OF_SHOW_COLUMNS)[number]["key"];

/** One block on the schedule, e.g. "Scotiabank Workshop" Sat 10:00-11:00. */
export type RunOfShowItem = {
  /** Stable within one read: `${day}-${start}-${column}`. */
  id: string;
  day: RunOfShowDay;
  /** 24h "HH:MM", Eastern time. */
  start: string;
  /** 24h "HH:MM"; end of the merged block (start + 30 min when unmerged). */
  end: string;
  column: RunOfShowColumn;
  /** Cell text before "Location:", trimmed, newlines collapsed. */
  title: string;
  /** Text after "Location:", e.g. "Rm 2230 (50)"; null when absent. */
  location: string | null;
  /**
   * Canonical sponsor names (from the registered sponsor list) mentioned in
   * the title, e.g. ["Scotiabank"]. Empty for all-hands items.
   */
  sponsors: string[];
};

/** Organizer-only rows from the Task/Owner columns. Never sent to sponsors. */
export type RunOfShowTask = {
  day: RunOfShowDay;
  start: string;
  task: string;
  owner: string | null;
};

/** A sponsor's row in the "Coffee Chats" tab. */
export type CoffeeChatSetup = {
  sponsor: string;
  /** "HH:MM"; null when the sponsor's row is blank (not set up yet). */
  windowStart: string | null;
  windowEnd: string | null;
  durationMinutes: 15 | 30;
  /** 1 = individual 1-on-1, 3 = group of 3. */
  groupSize: number;
  slots: number | null;
  hackers: number | null;
  /** Raw FORMAT cell, e.g. "Groups (30 mins with 3 people)". */
  format: string | null;
  /** Coffee chat room, e.g. "Rm 2241"; null until organizers assign one. */
  room: string | null;
};

export const CEREMONIES = ["opening", "closing"] as const;
export type CeremonyKind = (typeof CEREMONIES)[number];

/**
 * One speaker slot from the "Opening + Closing Ceremonies" tab, e.g.
 * "Canada Life (1 min)" / "Rob Craig, Manager Emerging Talent and Programs".
 */
export type CeremonySegment = {
  ceremony: CeremonyKind;
  /** 1-based running order within its ceremony (sheet row order by default). */
  order: number;
  /** 24h "HH:MM" when the sheet gives a time; null otherwise. */
  start: string | null;
  durationMinutes: number | null;
  /** Topic when given, otherwise the company name. */
  title: string;
  /** Registered sponsor name when one matches, else the sheet's company text. */
  sponsor: string | null;
  speakers: string[];
};

/** A sponsor's view of a segment: `yours` marks their own slot. */
export type SponsorCeremonySegment = CeremonySegment & { yours: boolean };

/**
 * One row of the "Workshops" tab, with time and room filled in from the
 * workshop's block on the RUN OF SHOW tab when the Workshops tab has none.
 */
export type WorkshopInfo = {
  title: string;
  sponsor: string | null;
  /** Who runs it. Empty until the sheet lists them. */
  runners: string[];
  day: RunOfShowDay | null;
  /** 24h "HH:MM". */
  start: string | null;
  room: string | null;
  description: string | null;
};

/** sponsorSchedule.get: what one sponsor sees (UUID link). */
export type SponsorSchedule = {
  sponsorName: string;
  /** ISO time the sheet was last read (cache). */
  readAt: string;
  /** All-hands items (big events, food) plus this sponsor's own items. */
  items: RunOfShowItem[];
  coffeeChat: CoffeeChatSetup | null;
  /** This sponsor's own ceremony slots only; never the running order. */
  ceremonies: SponsorCeremonySegment[];
  /** Only this sponsor's workshops. */
  workshops: WorkshopInfo[];
};

/** One company in the "Where is everyone" view. */
export type CompanyLocation = {
  name: string;
  /** Every item mentioning this company, in time order. */
  items: RunOfShowItem[];
  coffeeChat: CoffeeChatSetup | null;
};

/** sponsorSchedule.organizerCompanies: every sponsor's whereabouts. */
export type CompanyLocations = {
  readAt: string;
  /** Sponsor Bay hours (booth column), shared by all companies. */
  sponsorBay: RunOfShowItem[];
  companies: CompanyLocation[];
};

/** Organizer view: everything, including team tasks. */
export type OrganizerRunOfShow = {
  readAt: string;
  sheetUrl: string | null;
  items: RunOfShowItem[];
  tasks: RunOfShowTask[];
  coffeeChats: CoffeeChatSetup[];
  ceremonies: CeremonySegment[];
  workshops: WorkshopInfo[];
  /** The sponsor team's availability (organizers only). */
  availability: SponAvailability;
};

/** "13:30" -> "1:30 PM". */
export function formatClock(time: string): string {
  const [h, m] = time.split(":").map(Number) as [number, number];
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

/** Sort by day, then start time. */
export function compareRunOfShow(
  a: { day: RunOfShowDay; start: string },
  b: { day: RunOfShowDay; start: string },
): number {
  const d = RUN_OF_SHOW_DAYS.indexOf(a.day) - RUN_OF_SHOW_DAYS.indexOf(b.day);
  return d !== 0 ? d : a.start.localeCompare(b.start);
}

/**
 * The part of a multi-sponsor location that belongs to one sponsor, e.g.
 * ("Scotiabank: Rm 2110, Canada Life: Rm 2230", "Scotiabank") -> "Rm 2110".
 * Returns the whole location when it isn't split by sponsor.
 */
export function locationFor(location: string, sponsor: string): string {
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, "");
  for (const part of location.split(/[,\n]/)) {
    const [who, ...rest] = part.split(":");
    if (rest.length > 0 && norm(who ?? "") === norm(sponsor)) {
      return rest.join(":").trim();
    }
  }
  return location;
}

/**
 * Every "name: room" part of a per-company location, in sheet order, e.g.
 * "Scotiabank: Rm 2110, QNX: Rm 2235" -> [{ name: "Scotiabank", room:
 * "Rm 2110" }, { name: "QNX", room: "Rm 2235" }]. Same split as locationFor;
 * parts without a label or without a room are skipped. Organizer-only use:
 * it lists every company's room.
 */
export function labelledLocations(
  location: string,
): { name: string; room: string }[] {
  const out: { name: string; room: string }[] = [];
  for (const part of location.split(/[,\n]/)) {
    const [who, ...rest] = part.split(":");
    const name = (who ?? "").trim();
    const room = rest.join(":").trim();
    if (rest.length > 0 && name && room) out.push({ name, room });
  }
  return out;
}

/**
 * What one sponsor may see of a location. A per-sponsor list ("Scotiabank:
 * Rm 2110, Canada Life: Rm 2230", two or more "name: room" parts) becomes
 * that sponsor's room only, or null when they aren't in it, so another
 * sponsor's room never reaches them. A single part labelled with another
 * known sponsor ("Scotiabank: Rm 2110") is foreign too. Anything else (a
 * place such as "SEB: 2nd floor") is returned as is.
 */
export function ownLocation(
  location: string,
  sponsor: string,
  knownSponsors: readonly string[] = [],
): string | null {
  const norm = (v: string) => v.toLowerCase().replace(/\s+/g, "");
  const parts = location
    .split(/[,\n]/)
    .map((p) => p.trim())
    .filter(Boolean);
  const labelled = parts.filter((p) => /^[^:]+:\s*\S/.test(p));
  const known = new Set(knownSponsors.map(norm));
  const namesSponsor = labelled.some((p) =>
    known.has(norm(p.split(":")[0] ?? "")),
  );
  if (labelled.length < 2 && !namesSponsor) return location;
  const own = locationFor(location, sponsor);
  return own === location ? null : own;
}
