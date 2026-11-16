import {
  locationFor,
  type CompanyLocations,
  type RunOfShowItem,
} from "~/lib/run-of-show";
import { isHappeningNow } from "~/lib/run-of-show-time";
import { mapRoomFor, SPONSOR_MAP_ROOMS } from "~/lib/sponsor-map-rooms";

/** Why a sponsor is in a room at the chosen time. */
export type SponsorMapEntry = {
  sponsor: string;
  kind: "item" | "coffee" | "bay";
  /** Run-of-show title for items; empty for coffee chats and the bay. */
  title: string;
  /** Location text as the sheet (or room assignment) has it. */
  location: string | null;
  /** Sponsor-team member watching this sponsor's coffee chats. */
  watcher: string | null;
};

export type SponsorMapOccupancy = {
  /** Room id (SPONSOR_MAP_ROOMS) -> who is there. */
  byRoom: Record<string, SponsorMapEntry[]>;
  /** Somewhere, but no pin matches the location (or none is given). */
  unplaced: SponsorMapEntry[];
};

/**
 * Where every sponsor is at `at`, by map room. Same precedence as the
 * "Right now" list: a live run-of-show item, else their coffee chat window
 * (organizer-assigned room, else the sheet's), else the Sponsor Bay while
 * it's open. Sponsors with nothing on are left out.
 */
export function sponsorMapOccupancy(
  data: Pick<CompanyLocations, "companies" | "sponsorBay">,
  watchers: Readonly<Record<string, string | null>>,
  at: Date,
): SponsorMapOccupancy {
  const byRoom: Record<string, SponsorMapEntry[]> = {};
  const unplaced: SponsorMapEntry[] = [];
  const bay = data.sponsorBay.find((i) => isHappeningNow(i, at));

  for (const company of data.companies) {
    const watcher = watchers[company.name] ?? null;
    const entry = placeOf(company, bay, at);
    if (!entry) continue;
    const full = { sponsor: company.name, watcher, ...entry };
    const room = mapRoomFor(entry.location);
    if (room) (byRoom[room.id] ??= []).push(full);
    else unplaced.push(full);
  }
  return { byRoom, unplaced };
}

function placeOf(
  company: CompanyLocations["companies"][number],
  bay: RunOfShowItem | undefined,
  at: Date,
): Pick<SponsorMapEntry, "kind" | "title" | "location"> | null {
  const live = company.items.find((i) => isHappeningNow(i, at));
  if (live) {
    return {
      kind: "item",
      title: live.title,
      // A shared cell ("Scotiabank: Rm 2110, Canada Life: Rm 2230") is
      // trimmed to this company's part.
      location: live.location ? locationFor(live.location, company.name) : null,
    };
  }
  const cc = company.coffeeChat;
  if (
    cc?.windowStart &&
    cc.windowEnd &&
    isHappeningNow(
      { day: "Saturday", start: cc.windowStart, end: cc.windowEnd },
      at,
    )
  ) {
    return { kind: "coffee", title: "", location: cc.room };
  }
  // The booth column often has no "Location:"; it's still the Sponsor Bay.
  if (bay)
    return { kind: "bay", title: "", location: bay.location ?? "Sponsor Bay" };
  return null;
}

/** Rooms on one floor, in config order. */
export function roomsOnFloor(floor: string) {
  return SPONSOR_MAP_ROOMS.filter((r) => r.floor === floor);
}
