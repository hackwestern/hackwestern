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

import { sponsorTourCopy } from "~/content/sponsor-tour";
import type { TourDef, TourStep } from "~/lib/sponsor-tour";

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

const tours = {
  welcome: { id: WELCOME_TOUR_ID, steps: welcomeSteps },
} satisfies Record<string, TourDef>;

export type SponsorTourId = keyof typeof tours;

export const SPONSOR_TOURS: Record<SponsorTourId, TourDef> = tours;

/** Steps about Judging (gone for sponsors who don't judge). */
const JUDGING_STEP_IDS = new Set(["judging"]);

/**
 * The tours a sponsor gets. Without a prize track there's no Judging in
 * the nav, so the tour drops its Judging step (it would be skipped anyway;
 * dropping it keeps "Step n of N" right). `undefined` (still loading) keeps
 * it, and the step skips itself if the nav item never shows.
 */
export function toursFor(
  hasPrizeTrack: boolean | undefined,
): Record<SponsorTourId, TourDef> {
  if (hasPrizeTrack !== false) return SPONSOR_TOURS;
  return {
    welcome: {
      ...SPONSOR_TOURS.welcome,
      steps: SPONSOR_TOURS.welcome.steps.filter(
        (st) => !JUDGING_STEP_IDS.has(st.id),
      ),
    },
  };
}
