// User-facing copy for the sponsor schedule, "Where is everyone" and the
// organizer run-of-show pages. Keep wording here, not in components.

export const scheduleCopy = {
  brand: "Hack Western 13",
  back: "Back to your portal",
  readAt: (time: string) => `Updated from the run of show at ${time}`,
  loadError:
    "We couldn't load the schedule right now. Try again in a minute, or ask your Hack Western contact.",
  retry: "Try again",
  invalidLink: {
    title: "Link not recognised",
    body: "This private link isn't valid. Please reach out to your Hack Western organizer contact.",
  },
  dayPicker: "Pick a day",
  emptyDay: "Nothing scheduled for you this day.",
  now: "Now",
  you: "You",
  noLocation: "Location to be confirmed",
  midnight: "Midnight",

  hubLinks: {
    label: "Event info",
    schedule: "Your schedule",
    where: "Where is everyone",
  },

  schedule: {
    seoTitle: "Your schedule",
    eyebrow: "Schedule",
    title: (sponsor: string) => `${sponsor} at Hack Western`,
    intro:
      "Your workshops, coffee chats and booth hours, with the rest of the hackathon greyed out behind them. Times are Eastern.",
  },

  timeline: {
    dayHeading: (day: string, date: number) => `${day}, November ${date}`,
    legendLabel: "What the colours mean",
    yours: "Yours",
    hackathon: "Hackathon events",
    showHackathon: "Show hackathon events",
    srYours: "Yours",
    srHackathon: "Hackathon event",
    srTime: (start: string, end: string) => `${start} to ${end}`,
    gap: (from: string, to: string) => `Nothing on from ${from} to ${to}`,
    gridLabel: (day: string) => `${day} schedule, scrolls sideways`,
    timeHeader: "Time",
    columns: {
      "big-event": "Main event",
      "sponsor-workshop": "Workshops",
      food: "Food",
      "spon-booth": "Sponsor Bay",
      "coffee-chats": "Coffee chats",
      other: "Other events",
    },
    categories: {
      "big-event": "Main event",
      "sponsor-workshop": "Workshop",
      food: "Food",
      "spon-booth": "Sponsor Bay",
      "coffee-chats": "Coffee chats",
      main: "Main event",
      sponsor: "Sponsor workshop",
      workshop: "Workshop",
      activity: "Activity",
      booth: "Sponsor Bay",
      scavenger: "Scavenger hunt",
      other: "Other",
    },
  },

  sheetEdit: {
    readOnly: "Read-only here. Make changes in the sheet.",
    button: "Edit in Google Sheets",
    newTab: "(opens in a new tab)",
  },

  coffeeChat: {
    heading: "Your coffee chats",
    notSetUp:
      "Your coffee chat times aren't set yet. Your Hack Western contact will confirm them.",
    window: (start: string, end: string) => `Saturday ${start} to ${end}`,
    format: (minutes: number, groupSize: number) =>
      groupSize > 1
        ? `${minutes}-minute groups of ${groupSize} hackers`
        : `${minutes}-minute 1-on-1 chats`,
    hackers: (n: number) => `${n} hackers`,
    room: (room: string) => room,
    roomTbd: "Room to be assigned",
    labels: {
      when: "When",
      room: "Room",
      format: "Format",
      hackers: "Hackers",
    },
  },

  where: {
    seoTitle: "Where is everyone",
    eyebrow: "Where is everyone",
    title: "Find any company",
    intro:
      "Where each sponsor is during the event: workshops, coffee chat rooms and the Sponsor Bay.",
    sponsorBay: "Sponsor Bay",
    sponsorBayHours: "Every company has a table here while it's open.",
    nothingListed: "Nothing on the run of show yet.",
    coffeeChats: "Coffee chats",
    rightNow: "Right now",
    nowAt: (place: string) => `Now: ${place}`,
  },

  organizer: {
    seoTitle: "Run of show",
    title: "Run of show",
    intro:
      "Live from the run-of-show sheet. Sponsors see their own items and the main events, never team tasks.",
    tabs: { schedule: "Schedule", tasks: "Team tasks", coffee: "Coffee chats" },
    noTasks: "No team tasks this day.",
    owner: (owner: string) => `Owner: ${owner}`,
    unowned: "No owner",
    coffeeTable: {
      sponsor: "Sponsor",
      window: "Window",
      format: "Format",
      hackers: "Hackers",
      room: "Room",
      notSetUp: "Not set up",
    },
  },
} as const;
