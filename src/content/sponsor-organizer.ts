// Copy for the organizer sponsor home (/internal/sponsors): the tabs, the
// per-sponsor chats and help strip, and the links between them. Keep wording
// here, not in components.

export const sponsorOrganizerCopy = {
  seoTitle: "Sponsor dashboard",
  eyebrow: "Hack Western 13 · Organizers",
  title: "Sponsor dashboard",
  intro:
    "Sponsors, the run of show, coffee chats and help requests in one place. Times are Eastern.",
  tabsLabel: "Sponsor dashboard sections",
  tabs: {
    sponsors: "Sponsors",
    schedule: "Run of show",
    coffee: "Coffee chats",
    help: "Help",
  },
  /** Screen reader text after the Help tab's count badge. */
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
    advanceLabel: (name: string, next: string) =>
      `Move ${name} to ${next}`,
    copyLink: "Copy link",
    copied: "Copied",
    copyLabel: (name: string) => `Copy ${name}'s private sponsor page link`,
    copiedLabel: (name: string) => `Copied ${name}'s link`,
    openPage: (name: string) => `Open ${name}'s sponsor page in a new tab`,
    linkPending: "Link pending sync",
    empty: "No sponsors yet. Sync from the master sheet to load them.",
    noMatch: "No sponsors match this search and filter.",
    clearFilters: "Clear search and filter",
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
};
