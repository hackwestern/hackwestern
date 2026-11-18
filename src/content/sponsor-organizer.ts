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

  strip: {
    label: (name: string) => `${name}: coffee chats and help`,
    room: (room: string) => `Chat room ${room}`,
    noRoom: "No chat room",
    chats: (accepted: number, pending: number) =>
      `${accepted} accepted · ${pending} pending`,
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
