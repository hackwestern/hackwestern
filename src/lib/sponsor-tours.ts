// The sponsor portal tour as data: each step names its page, its
// `data-tour` target and where the callout sits. Copy comes from
// src/content/sponsor-tour.ts. The order follows the organizers' "Sponsor
// Dashboard Workshop" deck: Home, Schedule, Map, Chats, Scan a hacker,
// Judging, Questions (decisions 2026-11-20, "Guided tour back on").
//
// Every targeted step is optional: when its target isn't on the page (data
// still missing, a feature this sponsor doesn't have) the tour skips it
// instead of stopping. The nav steps (nav-*) point at the side nav on
// tablets and up and at the phone tab bar otherwise; whichever is visible
// is the target.
//
// Each page also has its own tour ("Tour this page"): the same steps,
// grouped by page, plus the Judging page's own steps below.

import { sponsorTourCopy } from "~/content/sponsor-tour";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import {
  TOUR_PAGES,
  type TourDef,
  type TourPage,
  type TourStep,
} from "~/lib/sponsor-tour";

const s = sponsorTourCopy.tours.welcome.steps;
const stage = s.chatsStage;

export const WELCOME_TOUR_ID = "welcome";

/** A step that's skipped when its target is missing. */
const step = (def: Omit<TourStep, "optional">): TourStep => ({
  ...def,
  optional: true,
});

const welcomeSteps: TourStep[] = [
  // Home
  step({
    id: "welcome",
    page: "home",
    target: "home-greeting",
    placement: "bottom",
    ...s.welcome,
  }),
  step({
    id: "contacts",
    page: "home",
    target: "home-contacts",
    placement: "bottom",
    ...s.contacts,
  }),
  step({
    id: "up-next",
    page: "home",
    target: "home-upnext",
    placement: "top",
    ...s.upNext,
  }),
  step({
    id: "up-next-buttons",
    page: "home",
    target: "home-upnext-action",
    placement: "bottom",
    ...s.upNextButtons,
  }),
  step({
    id: "key-rooms",
    page: "home",
    target: "home-keyrooms",
    placement: "top",
    ...s.keyRooms,
  }),
  // Schedule
  step({
    id: "schedule-days",
    page: "schedule",
    target: "schedule-days",
    placement: "bottom",
    ...s.scheduleDays,
  }),
  step({
    id: "schedule-hackathon",
    page: "schedule",
    target: "schedule-hackathon",
    placement: "bottom",
    ...s.scheduleHackathon,
  }),
  step({
    id: "schedule-blocks",
    page: "schedule",
    target: "schedule-grid",
    placement: "top",
    ...s.scheduleBlocks,
  }),
  // Map
  step({
    id: "booth",
    page: "map",
    target: "map-booth",
    placement: "bottom",
    ...s.booth,
  }),
  step({
    id: "buildings",
    page: "map",
    target: "map-floors",
    placement: "top",
    ...s.buildings,
  }),
  // Chats
  step({
    id: "chats-nav",
    page: "coffeeChats",
    target: "nav-chats",
    placement: "right",
    ...s.chatsNav,
  }),
  step({
    id: "chats-steps",
    page: "coffeeChats",
    target: "chats-steps",
    placement: "bottom",
    ...s.chatsSteps,
  }),
  // One stage card at a time: whichever is on the page.
  step({
    id: "chats-stage",
    page: "coffeeChats",
    placement: "bottom",
    ...stage.start,
    variants: [
      { target: "chats-start", ...stage.start },
      { target: "chats-shortlist", ...stage.shortlist },
      { target: "chats-waiting", ...stage.waiting },
      { target: "chats-confirmed", ...stage.confirmed },
    ],
  }),
  // Scan a hacker
  step({
    id: "scan",
    page: "scan",
    target: "scan-camera",
    placement: "bottom",
    ...s.scan,
  }),
  step({
    id: "scan-manual",
    page: "scan",
    target: "scan-manual",
    placement: "top",
    ...s.scanManual,
  }),
  // Judging and questions, back on Home
  step({
    id: "judging",
    page: "home",
    target: "nav-judging",
    placement: "right",
    ...s.judging,
  }),
  step({
    id: "help",
    page: "home",
    target: "need-help",
    placement: "right",
    ...s.help,
  }),
];

// The Judging page's own steps: only in its page tour (the full tour
// stays on Home for Judging, since the page is locked until Sunday).
const j = sponsorTourCopy.judgingPage;
const judgingPageSteps: TourStep[] = [
  step({
    id: "judging-intro",
    page: "picks",
    placement: "bottom",
    ...j.intro,
    variants: [
      { target: "judging-intro", ...j.intro },
      { target: "judging-locked", ...j.locked },
    ],
  }),
  step({
    id: "judging-stages",
    page: "picks",
    target: "judging-stages",
    placement: "bottom",
    title: j.stages.title,
    body: j.stages.body(SPONSOR_FINAL_TOP),
  }),
  step({
    id: "judging-score",
    page: "picks",
    target: "judging-first-project",
    placement: "top",
    ...j.score,
  }),
  step({
    id: "judging-submit",
    page: "picks",
    target: "judging-tab-shortlist",
    placement: "bottom",
    ...j.submit,
  }),
];

/** Steps about Judging (gone for sponsors who don't judge). */
const JUDGING_STEP_IDS = new Set(["judging"]);

// ------------------------------------------------------------
// Page tours: one page's steps, started from "Tour this page"
// ------------------------------------------------------------

export const PAGE_TOUR_PREFIX = "page:";

/** The id of a page's own tour ("page:schedule"). */
export const pageTourId = (page: TourPage): string =>
  `${PAGE_TOUR_PREFIX}${page}`;

/** The page a page tour belongs to; null for the full tour. */
export function pageOfTour(id: string): TourPage | null {
  if (!id.startsWith(PAGE_TOUR_PREFIX)) return null;
  const page = id.slice(PAGE_TOUR_PREFIX.length);
  return page in TOUR_PAGES ? (page as TourPage) : null;
}

/** A tour's steps grouped by page, in tour order ("any" steps left out:
 * a page tour never leaves its page). */
export function stepsByPage(
  steps: readonly TourStep[],
): Partial<Record<TourPage, TourStep[]>> {
  const out: Partial<Record<TourPage, TourStep[]>> = {};
  for (const st of steps) {
    if (st.page === "any") continue;
    (out[st.page] ??= []).push(st);
  }
  return out;
}

/** The full tour plus one tour per page that has steps. */
function buildTours(
  welcome: readonly TourStep[],
  extra: readonly TourStep[],
): SponsorTours {
  const tours: SponsorTours = {
    [WELCOME_TOUR_ID]: { id: WELCOME_TOUR_ID, steps: welcome },
  };
  const byPage = stepsByPage([...welcome, ...extra]);
  for (const page of Object.keys(TOUR_PAGES) as TourPage[]) {
    const steps = byPage[page];
    if (steps?.length)
      tours[pageTourId(page)] = { id: pageTourId(page), steps };
  }
  return tours;
}

export type SponsorTourId = string;

/** Every tour by id: the full tour ("welcome") and "page:<page>" tours. */
export type SponsorTours = Record<string, TourDef> & { welcome: TourDef };

/** Every tour, for a sponsor with a prize track (or still loading). */
export const SPONSOR_TOURS: SponsorTours = buildTours(
  welcomeSteps,
  judgingPageSteps,
);

/** Without a prize track: no Judging step, no Judging page tour. */
const NO_JUDGING_TOURS: SponsorTours = buildTours(
  welcomeSteps.filter((st) => !JUDGING_STEP_IDS.has(st.id)),
  [],
);

/**
 * The tours a sponsor gets. Without a prize track there's no Judging in
 * the nav, so the full tour drops its Judging step (it would be skipped
 * anyway; dropping it keeps "Step n of N" right) and there's no Judging
 * page tour. `undefined` (still loading) keeps everything; a missing
 * target skips itself.
 */
export function toursFor(hasPrizeTrack: boolean | undefined): SponsorTours {
  return hasPrizeTrack === false ? NO_JUDGING_TOURS : SPONSOR_TOURS;
}
