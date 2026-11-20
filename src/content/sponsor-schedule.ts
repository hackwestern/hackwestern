// User-facing copy for the sponsor schedule, "Where is everyone" and the
// organizer run-of-show pages. Keep wording here, not in components.

export const scheduleCopy = {
  brand: "Hack Western 13",
  /** The live "Happening now" banner (organizer page and sponsor page). */
  happening: {
    heading: "Happening now",
    now: (time: string) => `Happening now · ${time}`,
    nothing: "Nothing scheduled right now",
    notStarted: (when: string) => `Hack Western starts ${when}`,
    over: "Event over",
    more: (n: number) => `+${n} more`,
    tasksLabel: "Team tasks now",
    task: (task: string, owner: string | null) =>
      owner ? `${task} (${owner})` : `${task} (no owner)`,
    inRoom: (title: string, room: string) => `${title} · ${room}`,
    /** The room after an item's title, in lighter type. */
    roomSuffix: (room: string) => ` · ${room}`,
    upNextLabel: "Up next",
    upNextItems: (titles: string, when: string) => `${titles} at ${when}`,
  },
  back: "Back to your portal",
  readAt: (time: string) => `Updated from the run of show at ${time}`,
  loadError:
    "We couldn't load the schedule right now. Try again in a minute, or ask your Hack Western contact.",
  retry: "Try again",
  loading: "Loading the schedule",
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
    seoTitle: "Schedule",
    heading: "Schedule",
    /** Under the heading (mock sponsor-chats-v3). */
    lead: "Times are Eastern",
    /** Rep chips over Saturday's grid, once chats are confirmed. */
    repsLabel: "Show coffee chats for",
    everyone: "Everyone",
    legendChats: "Your coffee chats",
    legendEvents: "Your events",
    /** One block per rep session. */
    chatTitle: (rep: string) => `Coffee chats · ${rep}`,
    chatRoom: (room: string, ivey: boolean) => (ivey ? `Ivey, Rm ${room}` : `Rm ${room}`),
    /** Saturday before chats are confirmed. */
    chatsPlaceholder: "Coffee chats: times confirmed Fri 10 PM",
    eyebrow: "Schedule",
    title: (sponsor: string) => `${sponsor} at Hack Western`,
    intro:
      "Your workshops, coffee chats and booth hours, with the rest of the hackathon greyed out behind them. Times are Eastern.",
  },

  timeline: {
    dayHeading: (day: string, date: number) => `${day}, November ${date}`,
    showHackathon: "Show hackathon events",
    showOrganizers: "Organizers",
    // The grid's narrow "who's around" column (organizers only).
    organizers: {
      header: "Organizers",
      nobody: "No one",
      onCall: (names: string) => `On call: ${names}`,
      sr: (start: string, end: string, present: string, onCall: string) =>
        [
          `${start} to ${end}`,
          present ? `here: ${present}` : "no one here",
          onCall ? `on call: ${onCall}` : null,
        ]
          .filter(Boolean)
          .join(", "),
    },
    srYours: "Yours",
    srHackathon: "Hackathon event",
    srTime: (start: string, end: string) => `${start} to ${end}`,
    gap: (from: string, to: string) => `Nothing on from ${from} to ${to}`,
    gridLabel: (day: string) => `${day} schedule, scrolls sideways`,
    timeHeader: "Time",
    runOfShow: "Run of show",
    srTask: "Team task",
    openDetails: "Show details",
    details: {
      description: "Full details for this event",
      taskDescription: "Full details for this team task",
      close: "Close",
      when: "When",
      where: "Where",
      sponsors: "Sponsors",
      owner: "Owner",
      runBy: "Run by",
      about: "About this workshop",
      tasks: "Team tasks during this event",
      noTasks: "No team tasks during this event.",
      happening: "Happening at this time",
      nothingHappening: "No events at this time.",
      hackathonNote: "From the public hackathon schedule.",
      time: (day: string, date: number, start: string, end: string) =>
        `${day}, November ${date} · ${start} to ${end}`,
      taskTime: (day: string, date: number, start: string) =>
        `${day}, November ${date} · ${start}`,
    },
    columns: {
      hackathon: "Hackathon events",
      "sponsor-workshop": "Workshops",
      food: "Food",
      "spon-booth": "Sponsor Bay",
      "coffee-chats": "Coffee chats",
      judging: "Judging",
      other: "Other events",
      tasks: "Team tasks",
    },
    // Fold the schedule to its header (Jazz, 2026-11-18).
    // Labels for the icon-only button (screen readers + tooltip).
    collapse: { collapse: "Minimize schedule", expand: "Show schedule" },
    focus: {
      focusColumn: (column: string) => `Focus on ${column}`,
      showAll: "Show all columns",
      hint: "Tap a column heading to focus on it.",
      focused: (column: string) =>
        `Showing ${column}. Press Escape to show all columns.`,
    },
    booking: {
      hackers: (n: number) => (n === 1 ? "1 hacker" : `${n} hackers`),
      status: (accepted: number, waiting: number) =>
        [
          accepted > 0 ? `${accepted} accepted` : null,
          waiting > 0 ? `${waiting} waiting` : null,
        ]
          .filter(Boolean)
          .join(", "),
      who: "Hackers",
      description: "Booked coffee chat details",
      liveNote: "Booked on the dashboard. Updates live.",
    },
    categories: {
      "big-event": "Main event",
      "sponsor-workshop": "Workshop",
      food: "Food",
      "spon-booth": "Sponsor Bay",
      "coffee-chats": "Coffee chats",
      "coffee-chat": "Coffee chat",
      main: "Main event",
      sponsor: "Sponsor workshop",
      workshop: "Workshop",
      activity: "Activity",
      booth: "Sponsor Bay",
      scavenger: "Scavenger hunt",
      other: "Other",
      task: "Team task",
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
    noneBody:
      "That's everything on your schedule. Thanks for coming to Hack Western!",
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
    holdTitle: "Your coffee chat room",
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
      coffee: "Coffee chats",
      where: "Where is everyone",
    },
    emptyDay: "Nothing on the run of show this day.",
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
    // "Spon team availability" timetable under the run of show.
    availability: {
      heading: "Spon team availability",
      everyone: "Everyone",
      onCall: "On call",
      away: (start: string, end: string) => `Out ${start} to ${end}`,
      notAround: "Not around",
      srFree: (start: string, end: string) => `Free ${start} to ${end}`,
      srShift: (start: string, end: string) => `On shift ${start} to ${end}`,
      srOnCall: (start: string, end: string) => `On call ${start} to ${end}`,
      srRequired: (start: string, end: string) =>
        `Everyone needed ${start} to ${end}`,
      generalNotes: (notes: string) => `Notes: ${notes}`,
    },
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
