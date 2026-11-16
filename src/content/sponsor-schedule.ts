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

  nextEvent: {
    heading: "Your next event",
    none: "Nothing else scheduled",
    noneBody: "That's everything on your schedule. Thanks for coming to Hack Western!",
    now: "Now",
    countdown: (minutes: number) => {
      if (minutes >= 24 * 60) {
        const d = Math.floor(minutes / (24 * 60));
        const h = Math.floor((minutes % (24 * 60)) / 60);
        return h > 0 ? `in ${d} d ${h} h` : `in ${d} d`;
      }
      if (minutes >= 60) {
        const h = Math.floor(minutes / 60);
        const m = minutes % 60;
        return m > 0 ? `in ${h} h ${m} min` : `in ${h} h`;
      }
      return `in ${Math.max(1, minutes)} min`;
    },
    when: (day: string, time: string) => `${day} at ${time}`,
    ceremonyTitle: (ceremony: "opening" | "closing") =>
      ceremony === "opening"
        ? "You speak at the opening ceremony"
        : "You speak at the closing ceremony",
    coffeeTitle: "Your coffee chats",
    labels: { when: "When", room: "Room" },
  },

  ceremonies: {
    heading: (ceremony: "opening" | "closing") =>
      ceremony === "opening"
        ? "Opening ceremony running order"
        : "Closing ceremony running order",
    when: (day: string, time: string, place: string | null) =>
      place ? `${day} ${time} · ${place}` : `${day} ${time}`,
    duration: (minutes: number) => `${minutes} min`,
    speakersTbd: "Speaker to be confirmed",
    speakersLabel: "Speakers",
    youreOnAt: (time: string, minutes: number | null) =>
      minutes ? `You're on at ${time}, ${minutes} min` : `You're on at ${time}`,
    youreSlot: (order: number, total: number, minutes: number | null) =>
      minutes
        ? `You're #${order} of ${total}, ${minutes} min`
        : `You're #${order} of ${total}`,
    srOrder: (order: number) => `Slot ${order}`,
  },

  workshops: {
    heading: "Your workshops",
    runBy: "Run by",
    runnersTbd: "Not listed yet. Tell your Hack Western contact who's running it.",
    when: "When",
    room: "Room",
    timeTbd: "Time to be confirmed",
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
      "Where each sponsor is during the event: workshops, coffee chat rooms and the Sponsor Bay. Sponsors only see their own rooms.",
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
    tabs: {
      schedule: "Schedule",
      tasks: "Team tasks",
      coffee: "Coffee chats",
      where: "Where is everyone",
    },
    noTasks: "No team tasks this day.",
    ceremoniesHeading: "Ceremony speakers",
    workshopsHeading: "Workshops",
    workshopTable: {
      workshop: "Workshop",
      sponsor: "Sponsor",
      runners: "Run by",
      when: "When",
      room: "Room",
      none: "–",
    },
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
