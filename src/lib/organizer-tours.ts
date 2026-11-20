// The organizer sponsor dashboard's tours as data: one short tour per tab
// (ORGANIZER_TABS), plus "mine" for the Sponsors tab's My sponsors view,
// each step a `data-tour` target on that tab. They reuse
// the sponsor portal's tour types and overlay; every step is on the tab
// that's open, so steps are `page: "any"` and never navigate. Copy comes
// from src/content/organizer-tour.ts.

import { organizerTourCopy } from "~/content/organizer-tour";
import { ORGANIZER_TABS, type OrganizerTab } from "~/lib/sponsor-organizer";
import {
  hasSeen,
  markSeen,
  type TourDef,
  type TourStorage,
} from "~/lib/sponsor-tour";

const t = organizerTourCopy.tours;

/**
 * A tour per tab, and "mine" for the Sponsors tab while it shows My
 * sponsors (its own steps and its own "seen" flag).
 */
export const ORGANIZER_TOUR_IDS = ["mine", ...ORGANIZER_TABS] as const;
export type OrganizerTourId = (typeof ORGANIZER_TOUR_IDS)[number];

/** The tour for the open tab, given whether Sponsors shows My sponsors. */
export function organizerTourIdFor(
  tab: OrganizerTab,
  mySponsors: boolean,
): OrganizerTourId {
  return tab === "sponsors" && mySponsors ? "mine" : tab;
}

export const ORGANIZER_TOURS: Record<OrganizerTourId, TourDef> = {
  sponsors: {
    id: "sponsors",
    steps: [
      {
        id: "days",
        page: "any",
        target: "org-days",
        placement: "bottom",
        ...t.sponsors.days,
      },
      {
        id: "stats",
        page: "any",
        target: "org-stats",
        placement: "bottom",
        ...t.sponsors.stats,
      },
      {
        id: "search",
        page: "any",
        target: "org-search",
        placement: "bottom",
        ...t.sponsors.search,
      },
      {
        id: "row",
        page: "any",
        target: "org-sponsor-row",
        placement: "bottom",
        ...t.sponsors.row,
      },
      {
        id: "link",
        page: "any",
        target: "org-copy-link",
        placement: "bottom",
        ...t.sponsors.link,
      },
    ],
  },
  schedule: {
    id: "schedule",
    steps: [
      {
        id: "sheet",
        page: "any",
        target: "ros-sheet",
        placement: "bottom",
        ...t.schedule.sheet,
      },
      {
        id: "days",
        page: "any",
        target: "ros-days",
        placement: "bottom",
        ...t.schedule.days,
      },
      {
        id: "toggles",
        page: "any",
        target: "ros-toggles",
        placement: "bottom",
        ...t.schedule.toggles,
      },
      {
        id: "grid",
        page: "any",
        target: "ros-grid",
        placement: "top",
        ...t.schedule.grid,
      },
    ],
  },
  coffee: {
    id: "coffee",
    steps: [
      // The v8 board: every target is always on the page (Sponsors band,
      // Suggested fixes, Rooms grid, Send bar).
      {
        id: "strip",
        page: "any",
        target: "coffee-strip",
        placement: "right",
        ...t.coffee.strip,
      },
      {
        id: "fixes",
        page: "any",
        target: "coffee-fixes",
        placement: "right",
        ...t.coffee.fixes,
      },
      {
        id: "table",
        page: "any",
        target: "coffee-table",
        placement: "left",
        ...t.coffee.table,
      },
      {
        id: "send",
        page: "any",
        target: "coffee-send",
        placement: "top",
        ...t.coffee.send,
      },
    ],
  },
  judging: {
    id: "judging",
    steps: [
      {
        id: "todo",
        page: "any",
        target: "judging-todo",
        placement: "bottom",
        ...t.judging.todo,
      },
      {
        id: "sponsors",
        page: "any",
        target: "judging-sponsors",
        placement: "top",
        ...t.judging.sponsors,
      },
      {
        id: "rooms",
        page: "any",
        target: "judging-rooms",
        placement: "bottom",
        ...t.judging.rooms,
      },
      {
        id: "round2",
        page: "any",
        target: "judging-round2",
        placement: "bottom",
        ...t.judging.round2,
      },
      {
        id: "views",
        page: "any",
        target: "judging-views",
        placement: "bottom",
        ...t.judging.views,
      },
    ],
  },
  mine: {
    id: "mine",
    steps: [
      {
        id: "now",
        page: "any",
        target: "org-now-next",
        placement: "bottom",
        ...t.mine.now,
      },
      {
        id: "view",
        page: "any",
        target: "org-view",
        placement: "bottom",
        ...t.mine.view,
      },
      {
        id: "people",
        page: "any",
        target: "org-people",
        placement: "top",
        ...t.mine.people,
      },
      {
        id: "pills",
        page: "any",
        target: "org-pills",
        placement: "top",
        ...t.mine.pills,
      },
    ],
  },
};

/** localStorage key for "this organizer answered the offer on this tab". */
export const organizerTourSeenKey = (tab: OrganizerTourId) =>
  `hw-organizer-tour-seen:${tab}`;

/** Offer the tab's tour unless it was answered (or storage is blocked). */
export function shouldOfferOrganizerTour(
  storage: TourStorage | null,
  tab: OrganizerTourId,
): boolean {
  return !hasSeen(storage, organizerTourSeenKey(tab));
}

export function markOrganizerTourSeen(
  storage: TourStorage | null,
  tab: OrganizerTourId,
): void {
  markSeen(storage, organizerTourSeenKey(tab));
}

/** A running organizer tour: the tab it belongs to and the step shown. */
export interface OrganizerTourState {
  tab: OrganizerTourId;
  step: number;
}

/**
 * The tour state after the organizer switches to `tab`: a tour for another
 * tab stops (its targets are gone), one for this tab carries on.
 */
export function tourAfterTabChange(
  state: OrganizerTourState | null,
  tab: OrganizerTourId,
): OrganizerTourState | null {
  return state && state.tab === tab ? state : null;
}

/**
 * Step `index` of the tab's tour, or null when it's past either end (Next on
 * the last step ends the tour; Back on the first stays put upstream).
 */
export function organizerStepAt(
  state: OrganizerTourState | null,
  index: number,
): OrganizerTourState | null {
  if (!state) return null;
  const def = ORGANIZER_TOURS[state.tab];
  if (index < 0 || index >= def.steps.length) return null;
  return { tab: state.tab, step: index };
}
