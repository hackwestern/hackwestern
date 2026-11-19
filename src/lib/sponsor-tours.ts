// The sponsor portal's tours as data: each step names its page, its
// `data-tour` target, where the callout sits and whether it waits for the
// sponsor's own click. Copy comes from src/content/sponsor-tour.ts.
//
// The nav steps (nav-*) point at the side nav on tablets and up and at the
// phone tab bar otherwise; whichever is visible is the target, and the
// callout goes beside it when there's room, else above.
//
// The coffee chat steps target the coffee chats v2 page (sd-room-blocks):
// the Your chats / Candidates tabs and the Candidates panel.

import { sponsorTourCopy } from "~/content/sponsor-tour";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import type { TourDef } from "~/lib/sponsor-tour";

const t = sponsorTourCopy.tours;

export const WELCOME_TOUR_ID = "welcome";

const tours = {
  welcome: {
    id: "welcome",
    steps: [
      {
        id: "welcome",
        page: "home",
        target: "welcome",
        placement: "bottom",
        ...t.welcome.steps.welcome,
      },
      {
        id: "help",
        page: "home",
        target: "need-help",
        placement: "bottom",
        ...t.welcome.steps.help,
      },
      {
        id: "scan",
        page: "any",
        target: "nav-scan",
        placement: "right",
        ...t.welcome.steps.scan,
      },
      {
        id: "chats",
        page: "any",
        target: "nav-chats",
        placement: "right",
        ...t.welcome.steps.chats,
      },
      {
        id: "schedule",
        page: "any",
        target: "nav-schedule",
        placement: "right",
        ...t.welcome.steps.schedule,
      },
      {
        id: "judging",
        page: "any",
        target: "nav-judging",
        placement: "right",
        ...t.welcome.steps.judging,
      },
      {
        id: "important",
        page: "home",
        target: "important",
        placement: "top",
        ...t.welcome.steps.important,
      },
      {
        id: "booths",
        page: "home",
        target: "booths",
        placement: "top",
        ...t.welcome.steps.booths,
      },
      {
        id: "map",
        page: "any",
        target: "map",
        placement: "bottom",
        ...t.welcome.steps.map,
      },
    ],
  },

  coffeeChat: {
    id: "coffeeChat",
    steps: [
      {
        id: "scan",
        page: "any",
        target: "nav-scan",
        placement: "right",
        waitForClick: true,
        ...t.coffeeChat.steps.scan,
      },
      {
        id: "camera",
        page: "scan",
        target: "scan-camera",
        placement: "top",
        ...t.coffeeChat.steps.camera,
      },
      {
        id: "offer",
        page: "scan",
        target: "scan-camera",
        placement: "top",
        ...t.coffeeChat.steps.offer,
      },
      {
        id: "candidates",
        page: "coffeeChats",
        target: "chats-candidates-tab",
        placement: "bottom",
        waitForClick: true,
        ...t.coffeeChat.steps.candidates,
      },
      {
        id: "pick",
        page: "coffeeChats",
        target: "chats-candidates",
        placement: "top",
        ...t.coffeeChat.steps.pick,
      },
      {
        id: "accept",
        page: "coffeeChats",
        target: "chats-tab",
        placement: "bottom",
        ...t.coffeeChat.steps.accept,
      },
    ],
  },

  help: {
    id: "help",
    steps: [
      {
        id: "button",
        page: "home",
        target: "need-help",
        placement: "bottom",
        ...t.help.steps.button,
      },
      {
        id: "next",
        page: "home",
        target: "need-help",
        placement: "bottom",
        ...t.help.steps.next,
      },
    ],
  },

  map: {
    id: "map",
    steps: [
      {
        id: "open",
        page: "any",
        target: "map",
        placement: "bottom",
        waitForClick: true,
        ...t.map.steps.open,
      },
      {
        id: "floors",
        page: "any",
        target: "map-floors",
        placement: "bottom",
        ...t.map.steps.floors,
      },
      {
        id: "lounge",
        page: "any",
        target: "map-place-2110",
        placement: "top",
        ...t.map.steps.lounge,
      },
      {
        id: "belongings",
        page: "any",
        target: "map-place-2244",
        placement: "top",
        ...t.map.steps.belongings,
      },
    ],
  },

  judging: {
    id: "judging",
    steps: [
      {
        id: "tile",
        page: "any",
        target: "nav-judging",
        placement: "right",
        ...t.judging.steps.tile,
      },
      {
        id: "intro",
        page: "picks",
        target: "judging-intro",
        placement: "bottom",
        ...t.judging.steps.intro,
      },
      {
        id: "score",
        page: "picks",
        target: "judging-first-project",
        placement: "top",
        ...t.judging.steps.score,
      },
      {
        id: "shortlist",
        page: "picks",
        target: "judging-shortlist-tab",
        placement: "bottom",
        waitForClick: true,
        ...t.judging.steps.shortlist,
      },
      {
        id: "send",
        page: "picks",
        target: "judging-send",
        placement: "top",
        ...t.judging.steps.send,
      },
      {
        id: "presentations",
        page: "picks",
        placement: "center",
        ...t.judging.steps.presentations,
      },
      {
        id: "rank",
        page: "picks",
        target: "judging-rank",
        placement: "top",
        title: t.judging.steps.rank.title(SPONSOR_FINAL_TOP),
        body: t.judging.steps.rank.body(SPONSOR_FINAL_TOP),
      },
    ],
  },
} satisfies Record<string, TourDef>;

export type SponsorTourId = keyof typeof tours;

export const SPONSOR_TOURS: Record<SponsorTourId, TourDef> = tours;

/** The quick how-to flows in the "?" menu, in menu order. */
export const HOW_TO_TOURS: readonly SponsorTourId[] = [
  "coffeeChat",
  "help",
  "map",
  "judging",
];

export const tourName = (id: SponsorTourId): string => t[id].name;
