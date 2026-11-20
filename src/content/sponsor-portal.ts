// User-facing copy for the sponsor portal home (/sponsors/[uuid]) and the
// shared bits of its sub-pages. Keep wording here, not in components.

import { RUN_OF_SHOW_DATES } from "~/lib/run-of-show-time";

/** "Nov 20 to 22, 2026", from the event dates. */
function eventDateRange(): string {
  const day = (iso: string) => new Date(`${iso}T12:00:00Z`);
  const start = day(RUN_OF_SHOW_DATES.Friday);
  const end = day(RUN_OF_SHOW_DATES.Sunday);
  const month = start.toLocaleString("en-US", {
    month: "short",
    timeZone: "UTC",
  });
  return `${month} ${start.getUTCDate()} to ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

export const sponsorPortalCopy = {
  seoTitle: "Sponsor Portal",
  brand: "Hack Western 13",
  skipToContent: "Skip to content",
  invalid: {
    title: "Link not recognised",
    body: "This private link isn't valid. If you believe this is an error, please reach out to your Hack Western organizer contact for assistance.",
  },
  welcome: {
    title: (sponsor: string) => `Welcome, ${sponsor}!`,
    body: "We're thrilled to have you with us this weekend. Use this portal to set up coffee chats, find your booth and, if you have a prize track, judge projects.",
    fallbackName: "Sponsor",
    logoAlt: (sponsor: string) => `${sponsor} logo`,
  },
  // The portal's one nav (design: mocks/sponsor-portal-flow-hacker-v6): a
  // side nav on tablets and up, a bottom tab bar on phones. Help is a
  // button in the page header that opens a dialog over the current page.
  nav: {
    label: "Sponsor portal",
    home: "Home",
    scan: "Scan",
    chats: "Chats",
    schedule: "Schedule",
    judging: "Judging",
    /** Judging's phone tab: "Judging" and its lock don't fit a sixth of 360 px. */
    judgingTab: "Judge",
    map: "Map",
    /** Side nav label over Chats and Judging. */
    tasks: "Your tasks",
    /** The phone top bar's title per section. */
    titles: {
      home: "Home",
      chats: "Coffee chats",
      scan: "Scan a hacker",
      schedule: "Schedule",
      judging: "Judging",
      map: "Map",
    },
    /** Beside the sponsor's logo at the top of the side nav. */
    portal: "Sponsor portal",
    homeLink: "Hack Western 13 sponsor portal home",
    /** Bottom of the side nav. */
    footer: `Times are Eastern · ${eventDateRange()}`,
    judgingLocked: (opens: string) => `Judging, locked until ${opens}`,
    judgingLockedTitle: "When judging opens",
    /** Beside Judging once it's open: has the team sent its top picks? */
    judgingSent: "Sent",
    judgingNotSent: "Not sent",
  },
  /** Home, for sponsors without a prize track (no Judging in the nav). */
  noPrizeTrack: "No prize track: you're not judging this weekend.",
  details: {
    heading: "Event details",
    booth: { label: "Booth", hint: "Your assigned sponsor booth table" },
    judging: {
      label: "Judging room",
      value: (room: string) => `Room ${room}`,
      hint: "Head here when judging deliberations start",
    },
    workshop: { label: "Workshop", location: "Location", time: "Time" },
    /** Name and phone come from the Help contacts (sponsor-help.ts). */
    contact: {
      label: "Your Hack Western contact",
    },
  },
  footer:
    "Need help during the hackathon? Text or call your Hack Western contact.",
  /** Under the welcome banner: the one thing to do now. */
  todo: {
    label: "What to do now",
    chats: "Tell us when your reps can chat",
    chatsHint: "Required · at the Friday 5 PM workshop",
    chatsDone: "Your coffee chats",
    chatsDoneHint: "See your chats, or add a hacker you met at your booth",
  },
} as const;
