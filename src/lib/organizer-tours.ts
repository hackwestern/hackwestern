// The organizer sponsor dashboard's tours as data: one short tour per tab
// (ORGANIZER_TABS), each step a `data-tour` target on that tab. They reuse
// the sponsor portal's tour types and overlay; every step is on the tab
// that's open, so steps are `page: "any"` and never navigate. Copy comes
// from src/content/organizer-tour.ts.

import { organizerTourCopy } from "~/content/organizer-tour";
import type { OrganizerTab } from "~/lib/sponsor-organizer";
import {
  hasSeen,
  markSeen,
  type TourDef,
  type TourStorage,
} from "~/lib/sponsor-tour";

const t = organizerTourCopy.tours;

export const ORGANIZER_TOURS: Record<OrganizerTab, TourDef> = {
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
      {
        id: "strip",
        page: "any",
        target: "coffee-strip",
        placement: "bottom",
        ...t.coffee.strip,
      },
      {
        id: "table",
        page: "any",
        target: "coffee-table",
        placement: "top",
        ...t.coffee.table,
      },
      {
        id: "block",
        page: "any",
        target: "coffee-block",
        placement: "right",
        ...t.coffee.block,
      },
      {
        id: "free",
        page: "any",
        target: "coffee-free",
        placement: "right",
        ...t.coffee.free,
      },
    ],
  },
  judging: {
    id: "judging",
    steps: [
      {
        id: "sent",
        page: "any",
        target: "judging-sent",
        placement: "bottom",
        ...t.judging.sent,
      },
      {
        id: "actions",
        page: "any",
        target: "judging-actions",
        placement: "bottom",
        ...t.judging.actions,
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
  pings: {
    id: "pings",
    steps: [
      {
        id: "help",
        page: "any",
        target: "pings-help",
        placement: "bottom",
        ...t.pings.help,
      },
      {
        id: "next",
        page: "any",
        target: "pings-next",
        placement: "top",
        ...t.pings.next,
      },
      {
        id: "log",
        page: "any",
        target: "pings-log",
        placement: "top",
        ...t.pings.log,
      },
    ],
  },
};

/** localStorage key for "this organizer answered the offer on this tab". */
export const organizerTourSeenKey = (tab: OrganizerTab) =>
  `hw-organizer-tour-seen:${tab}`;

/** Offer the tab's tour unless it was answered (or storage is blocked). */
export function shouldOfferOrganizerTour(
  storage: TourStorage | null,
  tab: OrganizerTab,
): boolean {
  return !hasSeen(storage, organizerTourSeenKey(tab));
}

export function markOrganizerTourSeen(
  storage: TourStorage | null,
  tab: OrganizerTab,
): void {
  markSeen(storage, organizerTourSeenKey(tab));
}

/** A running organizer tour: the tab it belongs to and the step shown. */
export interface OrganizerTourState {
  tab: OrganizerTab;
  step: number;
}

/**
 * The tour state after the organizer switches to `tab`: a tour for another
 * tab stops (its targets are gone), one for this tab carries on.
 */
export function tourAfterTabChange(
  state: OrganizerTourState | null,
  tab: OrganizerTab,
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
