// User-facing copy for the sponsor portal home (/sponsors/[uuid]) and the
// shared bits of its sub-pages. Keep wording here, not in components.

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
  // The portal's one nav: a side nav on tablets and up, a bottom tab bar on
  // phones (Venue is side nav only; phones have the Map button).
  nav: {
    label: "Sponsor portal",
    home: "Home",
    scan: "Scan",
    chats: "Chats",
    schedule: "Schedule",
    judging: "Judging",
    venue: "Venue",
    howItWorks: "How this works",
    judgingLocked: (opens: string) => `Judging, locked. ${opens}`,
    judgingLockedTitle: "When judging opens",
    /** Beside Judging once it's open: has the team sent its top picks? */
    judgingSent: "Sent",
    judgingNotSent: "Not sent",
    /** Slim top bar: "Hack Western 13 · Sat 2:14 PM". */
    now: (when: string) => `Hack Western 13 · ${when}`,
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
  footer: "Need help during the hackathon? Text or call your Hack Western contact.",
  /** Under the welcome banner: the one thing to do now. */
  todo: {
    label: "What to do now",
    chats: "Tell us when your reps can chat",
    chatsHint: "Required · at the Friday 5 PM workshop",
    chatsDone: "Your coffee chats",
    chatsDoneHint: "See your chats, or add a hacker you met at your booth",
  },
} as const;
