// Copy for the organizer sponsor home (/internal/sponsors): the tabs, the
// per-sponsor chats and help strip, and the links between them. Keep wording
// here, not in components.

export const sponsorOrganizerCopy = {
  seoTitle: "Sponsor dashboard",
  eyebrow: "Hack Western 13 · Organizers",
  title: "Sponsor dashboard",
  intro:
    "Sponsors, the run of show, coffee chats, help requests and task pings in one place. Times are Eastern.",
  tabsLabel: "Sponsor dashboard sections",
  tabs: {
    sponsors: "Sponsors",
    schedule: "Run of show",
    coffee: "Coffee chats",
    judging: "Sponsor judging",
    pings: "Task pings",
  },
  /** Screen reader text after the Task pings tab's count badge. */
  openHelpCount: (n: number) =>
    n === 1 ? "1 open help request" : `${n} open help requests`,
  jumpToRooms: "Where is everyone",

  focus: {
    showing: (name: string) => `Showing ${name}`,
    showingUnknown: "Showing one sponsor",
    back: "Back to sponsors",
    backTo: (name: string) => `Back to ${name}`,
    clear: "Show everyone",
  },

  /** Lucas's sponsor board on the Sponsors tab. */
  board: {
    updatedAgo: (ago: string) => `Updated ${ago} ago`,
    loading: "Loading…",
    sync: "Sync from master sheet",
    syncing: "Syncing…",
    synced: (n: number) =>
      n === 1
        ? "Synced 1 sponsor from the master sheet."
        : `Synced ${n} sponsors from the master sheet.`,
    syncFailed: (message: string) => `Sync failed: ${message}`,
    statusFailed: (message: string) => `Couldn't update status: ${message}`,
    dismiss: "Dismiss",
    loadFailed: (message: string) => `Couldn't load sponsors: ${message}.`,
    retry: "Try again",
    searchLabel: "Search sponsors",
    searchPlaceholder: "Search company, room or contact",
    clearSearch: "Clear search",
    filtersLabel: "Filter by status",
    all: "All",
    statsLabel: "Sponsor totals",
    stats: {
      total: "Sponsors",
      picks: "Picks received",
      unregistered: "No private link yet",
      offSheet: "Not on master sheet",
    },
    columns: {
      company: "Company",
      status: "Status",
      room: "Room",
      booth: "Booth",
      tier: "Tier",
      hwContact: "HW contact",
      companyContact: "Company contact",
      picks: "Picks",
      page: "Sponsor page",
    },
    tableLabel: "Sponsors",
    notOnMaster: "Not on master sheet",
    roomTbd: "Room TBD",
    room: (room: string) => (/^\d/.test(room) ? `Room ${room}` : room),
    boothTbd: "TBD",
    none: "—",
    picks: (n: number) => (n === 1 ? "1 team picked" : `${n} teams picked`),
    noPicks: "No picks yet",
    changeStatus: (name: string) => `Change status for ${name}`,
    advance: {
      "Not arrived": "Check in",
      "Checked in": "Booth set up",
      "Booth set up": "Workshop live",
      "Workshop live": "Mark left",
      Left: null,
    } as Record<string, string | null>,
    advanceLabel: (name: string, next: string) => `Move ${name} to ${next}`,
    copyLink: "Copy link",
    copied: "Copied",
    copyLabel: (name: string) => `Copy ${name}'s private sponsor page link`,
    copiedLabel: (name: string) => `Copied ${name}'s link`,
    openPage: (name: string) => `Open ${name}'s sponsor page in a new tab`,
    linkPending: "Link pending sync",
    empty: "No sponsors yet. Sync from the master sheet to load them.",
    noMatch: "No sponsors match this search and filter.",
    clearFilters: "Clear search and filter",

    // The combined sponsor table: Lucas's columns plus each sponsor's
    // coffee chats, holds and help (sponsorOrganizer.summary).
    chatColumns: {
      sponsor: "Sponsor",
      chatType: "Chat type",
      chatRoom: "Chat room",
      chats: "Chats",
      needsHacker: "Needs a hacker",
      help: "Help",
    },
    chatType: (request: string, minutes: number) => `${request} · ${minutes} min`,
    unassigned: "Unassigned",
    chatsCell: (accepted: number, waiting: number) =>
      `${accepted} accepted · ${waiting} waiting`,
    needsHackerCell: (n: number) => (n === 0 ? "None" : String(n)),
    helpOpen: "Open",
    helpClaimed: "On it",
    noHelp: "None",
    notRegistered: "Not registered",
    expand: (name: string) => `Show ${name}'s chats and details`,
    collapse: (name: string) => `Hide ${name}'s chats and details`,
    highlight: (name: string) => `${name}: show on the coffee chat rooms`,
    totalsLabel: (n: number) =>
      n === 1 ? "Totals, 1 sponsor" : `Totals, ${n} sponsors`,
    seatsLeft: (n: number) =>
      n === 1 ? "1 seat left today" : `${n} seats left today`,
    seatsLabel: "Seats left today",
    openHelp: (n: number) => (n === 1 ? "1 open" : `${n} open`),
    details: {
      chatsHeading: "Coffee chats",
      detailsHeading: "Details",
      noChats: "No chats booked yet.",
      holdsHeading: "Room holds",
      hold: (room: string, start: string, end: string) =>
        `${room} · ${start}–${end}`,
      holdBooked: "Hacker booked",
      chat: (time: string, room: string | null) =>
        room ? `${time} · ${room}` : time,
      status: { accepted: "Accepted", pending: "Waiting" },
      roomLabel: "Sponsor room",
      notRegistered:
        "This sponsor has no private link yet, so no chats or help. Sync from the master sheet.",
    },
  },

  strip: {
    label: (name: string) => `${name}: coffee chats and help`,
    room: (room: string) => `Chat room ${room}`,
    noRoom: "No chat room",
    chats: (accepted: number, pending: number) =>
      `${accepted} accepted · ${pending} pending`,
    needsHacker: (n: number) =>
      n === 1 ? "1 hold needs a hacker" : `${n} holds need a hacker`,
    helpOpen: (minutes: number) =>
      minutes < 1 ? "Help: waiting, just now" : `Help: waiting ${minutes} min`,
    helpClaimed: (name: string | null) =>
      name ? `Help: ${name} is on it` : "Help: claimed",
    noHelp: "No help request",
    viewSchedule: "View on schedule",
    coffeeChats: "Coffee chats",
    help: "Help",
    loading: "Loading chats and help…",
    loadError:
      "Couldn't load coffee chats and help requests. They'll retry on their own.",
  },

  /**
   * Sunday sponsor track judging: rooms (Lucas's sheet, else the run-of-show
   * list), picks and status. Rooms are filled in by the team in the sheets;
   * the app never assigns one.
   */
  judging: {
    heading: "Sponsor track judging",
    when: (title: string, start: string, end: string) =>
      `${title} · ${start}–${end}`,
    noSlot: "No judging block on the run of show yet.",
    summary: (withRoom: number, sponsors: number, enoughPicks: number) =>
      `${withRoom} of ${sponsors} ${sponsors === 1 ? "sponsor has" : "sponsors have"} a room · ${enoughPicks} ${enoughPicks === 1 ? "has" : "have"} enough picks`,
    tableLabel: "Judging rooms and picks by sponsor",
    columns: {
      sponsor: "Sponsor",
      room: "Judging room",
      picks: "Picks",
      status: "Status",
    },
    source: {
      "sponsor-sheet": "Sponsor sheet",
      "run-of-show": "Run of show",
    },
    otherRoom: (room: string) => `Run of show says ${room}`,
    missing: "Missing",
    roomUnknown: "Unknown",
    picks: (n: number, min: number, max: number) => `${n} of ${min}–${max}`,
    picksUnknown: "—",
    status: {
      ready: "Ready",
      "missing-room": "Missing room",
      "room-unknown": "Room unknown",
      "too-few-picks": "Too few picks",
      "picks-unknown": "Picks unavailable",
      "not-registered": "Not registered",
    },
    sheetUnread:
      "Couldn't read the judging sheet, so picks and sheet rooms are missing. It retries on its own.",
    runOfShowUnread:
      "Couldn't read the run of show, so the judging time and its room list are missing. It retries on its own.",
    loadFailed: "Couldn't load judging rooms. It retries on its own.",
    empty: "No sponsors registered yet.",
    // Sponsors tab
    column: "Judging",
    cell: (room: string | null, picks: number | null, roomKnown = true) =>
      `${room ?? (roomKnown ? "Missing" : "Unknown")}${picks === null ? "" : ` · ${picks} ${picks === 1 ? "pick" : "picks"}`}`,
    labelled: (label: string, value: string) => `${label}: ${value}`,
    withSource: (value: string, source: string) => `${value} · ${source}`,
    missingRooms: (n: number) =>
      n === 0
        ? "All rooms set"
        : n === 1
          ? "1 missing room"
          : `${n} missing rooms`,
    detailLabel: "Judging",
  },
};
