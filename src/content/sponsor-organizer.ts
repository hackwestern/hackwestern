// Copy for the organizer sponsor home (/internal/sponsors): the tabs, the
// per-sponsor chats and help strip, and the links between them. Keep wording
// here, not in components.

export const sponsorOrganizerCopy = {
  seoTitle: "Sponsor dashboard",
  eyebrow: "Hack Western 13 · Organizers",
  title: "Sponsor dashboard",
  intro:
    "Sponsors, the run of show, coffee chats and judging in one place. Times are Eastern.",
  tabsLabel: "Sponsor dashboard sections",
  tabs: {
    sponsors: "Sponsors",
    schedule: "Run of show",
    coffee: "Coffee chats",
    judging: "Sponsor judging",
  },
  jumpToRooms: "Where is everyone",

  /**
   * "Now and next" under the page header: the run-of-show event on now and
   * the next one, and the team task on now and the next one with its owner.
   */
  nowNext: {
    heading: "Happening now",
    headingAt: (time: string) => `Happening now · ${time}`,
    tableLabel: "Now and next on the run of show",
    eventNow: "Event now",
    /** In place of "Event now" before the event starts: nothing is on yet. */
    upNext: "Up next",
    eventNext: "Next event",
    taskNow: "Task now",
    taskNext: "Next task",
    nothing: "Nothing on right now",
    none: "Nothing after this",
    noTask: "No team task right now",
    noNextTask: "No more team tasks",
    notStarted: (when: string) => `Hack Western starts ${when}`,
    over: "Event over",
    at: (when: string) => when,
    room: (room: string) => room,
    owner: (owner: string | null) => (owner ? owner : "No owner"),
    ownerLabel: "Owner",
    loadError: "Couldn't read the run of show. It retries on its own.",
  },

  /**
   * "Needs attention now" at the top of the dashboard, for an organizer
   * arriving hours after sponsors acted. Built from data the app already
   * has; tasks are shown only (no pings, no marking done).
   */
  attention: {
    heading: "Needs attention now",
    /** Group labels: your own sponsors come first (decisions 2026-11-19). */
    groups: {
      yours: "Your sponsors",
      others: "Other sponsors",
      everyone: "All sponsors",
      tasks: "Run of show tasks",
    },
    allClear: "All clear",
    allClearBody: "Nothing needs you right now.",
    noPrefs: (sponsor: string) =>
      `${sponsor} hasn't sent coffee chat preferences`,
    notScheduled: (sponsor: string, placed: number, reps: number) =>
      `${sponsor}: ${placed} of ${reps} ${reps === 1 ? "rep" : "reps"} scheduled`,
    changed: (sponsor: string) =>
      `${sponsor} changed their coffee chat preferences after the schedule was sent`,
    overdueTask: (task: string, when: string, owner: string | null) =>
      owner ? `${task} (${owner}) was due ${when}` : `${task} was due ${when}`,
    toCoffee: "Open coffee chats",
    toSchedule: "Open run of show",
    loading: "Checking what needs attention…",
  },

  /**
   * My sponsors: the sponsors the signed-in organizer leads (HW Contacts
   * "Login email" -> Sponsor Day-Of "HW lead"), one tab per sponsor with
   * stacked attribute tables.
   */
  mine: {
    title: "My sponsors",
    all: "All sponsors",
    viewLabel: "Which sponsors to show",
    signedIn: (name: string) => `Signed in as ${name}`,
    leads: (n: number) =>
      n === 0
        ? "You don't lead a sponsor"
        : n === 1
          ? "You lead 1 sponsor"
          : `You lead ${n} sponsors`,
    contactsError:
      "Can't read HW Contacts, so My sponsors can't tell who you are. Showing All sponsors; it retries on its own.",
    noneLed:
      "Sponsor Day-Of doesn't list you as an HW lead yet, so there's nothing here. All sponsors shows everyone.",
    sponsorTabsLabel: "Your sponsors",
    loading: "Loading your sponsors…",
    loadError: "Couldn't load your sponsors. It retries on its own.",
    sections: {
      people: "People",
      logistics: "Logistics",
      chats: "Coffee chats",
      judging: "Judging",
    },
    people: {
      name: "Name",
      phone: "Phone",
      primary: "Main contact",
      none: "No reps yet. They show here once the sponsor adds their team in the portal.",
    },
    attrs: {
      arrival: "Arrival",
      booth: "Booth",
      portalLink: "Portal link",
      ccWorkshop: "Came to the Friday coffee chat briefing",
      theirWorkshop: "Their workshop",
      preferences: "Preferences",
      shortlist: "Shortlist",
      schedule: "Schedule",
      invites: "Invites",
      judgingShortlist: "Shortlist",
      presentations: "Presentations",
      topPicks: (top: number) => `Top ${top}`,
    },
    pill: {
      arrival: ["Not arrived", "Arrived"] as const,
      booth: ["Not set up", "Set up"] as const,
      ccWorkshop: ["Not attended", "Attended"] as const,
      advance: (label: string, sponsor: string, to: string) =>
        `${label} for ${sponsor}: ${to}. Press to undo.`,
      next: (label: string, sponsor: string, now: string, to: string) =>
        `${label} for ${sponsor}: ${now}. Press to mark ${to}.`,
      saving: "Saving…",
      failed: (message: string) => `Couldn't save: ${message}`,
      /** Sponsor Day-Of has no "At CC workshop" column yet. */
      ccNoColumn: 'Add an "At CC workshop" checkbox column to Sponsor Day-Of to track this',
    },
    value: {
      none: "—",
      boothTbd: "Booth TBD",
      linkGiven: (time: string) => `Given ${time}`,
      linkNotGiven: "Not given yet",
      notRegistered: "No private link yet. Sync from the sponsor sheet.",
      /** The sheet writes seats as "2230 (50)": say "2230 · 50 seats". */
      workshop: (when: string, room: string | null) =>
        room
          ? `${when} · ${room.replace(/\s*\((\d+)\)\s*$/, " · $1 seats")}`
          : when,
      noWorkshop: "No workshop",
      submitted: (time: string) => `Submitted ${time}`,
      notSubmitted: "Not submitted",
      shortlistOptional: "Optional · not submitted",
      placed: (placed: number, reps: number) =>
        `${placed} of ${reps} ${reps === 1 ? "rep" : "reps"} placed`,
      confirmed: "confirmed",
      noReps: "No reps chatting",
      invites: (accepted: number, sent: number) =>
        `${accepted} of ${sent} accepted`,
      invitesNotSent: "Not sent",
      presentations: (n: number, next: string | null) =>
        next ? `${n} scheduled · next ${next}` : `${n} scheduled`,
      noPresentations: "Not scheduled",
      topPicksSent: (time: string) => `Sent ${time}`,
      topPicksNot: "Not sent",
    },
  },

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
    sync: "Sync from sponsor sheet",
    syncing: "Syncing…",
    synced: (n: number) =>
      n === 1
        ? "Synced 1 sponsor from the Sponsor Day-Of tab."
        : `Synced ${n} sponsors from the Sponsor Day-Of tab.`,
    syncFailed: (message: string) => `Sync failed: ${message}`,
    statusFailed: (message: string) => `Couldn't update status: ${message}`,
    /** A pill saved but the sheet wasn't (sheet writes off): the server's note. */
    statusNote: (sponsor: string, note: string) => `${sponsor}: ${note}`,
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
      offSheet: "Not on Sponsor Day-Of",
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
    notOnMaster: "Not on Sponsor Day-Of",
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
    empty: "No sponsors yet. Add them to the Sponsor Day-Of tab, then sync.",
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
    },
    chatType: (request: string, minutes: number) =>
      `${request} · ${minutes} min`,
    unassigned: "Unassigned",
    chatsCell: (accepted: number, waiting: number) =>
      `${accepted} accepted · ${waiting} waiting`,
    needsHackerCell: (n: number) => (n === 0 ? "None" : String(n)),
    notRegistered: "Not registered",
    expand: (name: string) => `Show ${name}'s chats and details`,
    collapse: (name: string) => `Hide ${name}'s chats and details`,
    highlight: (name: string) => `${name}: show on the coffee chat rooms`,
    totalsLabel: (n: number) =>
      n === 1 ? "Totals, 1 sponsor" : `Totals, ${n} sponsors`,
    seatsLeft: (n: number) =>
      n === 1 ? "1 seat left today" : `${n} seats left today`,
    seatsLabel: "Seats left today",
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
        "This sponsor has no private link yet, so no chats. Sync from the sponsor sheet.",
    },
  },

  /**
   * The Sponsors tab follows the event day: Friday arrivals and portal
   * links, Saturday coffee chat slots, Sunday judging and where to be.
   */
  day: {
    pickerLabel: "Show the sponsors' day",
    short: { Friday: "Fri", Saturday: "Sat", Sunday: "Sun" } as Record<
      string,
      string
    >,
    stats: {
      Friday: {
        arrived: "Arrived",
        linkGiven: "Portal link given",
      },
      Saturday: {
        booked: "Hackers booked",
        openSlots: "Slots still open",
        waiting: "Waiting on a hacker",
      },
      Sunday: {
        shortlists: "Shortlists sent",
        topSent: (top: number) => `Top ${top} sent`,
        round2: "Round 2",
        missingRooms: "Missing judging rooms",
      },
      of: (n: number, total: number) => `${n} of ${total}`,
      round2Open: "Open",
      round2Closed: "Not open",
    },
    columns: {
      link: "Portal link",
      slots: "Chat slots (booked/asked)",
      round1: "Round 1 shortlist",
      round2: (top: number) => `Round 2 top ${top}`,
      where: "Where now",
    },
    /** A sheet-only field when the sponsor sheet didn't load. */
    noSheet: "Sheet didn't load",
    // Friday
    linkGiven: "Link given",
    markGiven: "Mark given",
    linkGivenLabel: (name: string, given: boolean) =>
      given
        ? `${name}'s portal link is given. Press to undo.`
        : `Mark ${name}'s portal link as given`,
    linkFailed: (message: string) =>
      `Couldn't save the portal link: ${message}`,
    // Saturday
    slot: (time: string, booked: number, needed: number) =>
      `${time} ${booked}/${needed}`,
    slotLabel: (
      room: string,
      time: string,
      booked: number,
      needed: number,
      over = 0,
    ) =>
      (needed === 0
        ? `${room} at ${time}: asked for no hackers`
        : `${room} at ${time}: ${booked} of ${needed} hackers booked`) +
      (over > 0 ? `, ${over} more than asked for` : ""),
    /** Hackers booked beyond a slot's ask (shown next to "3/3"). */
    slotOver: (n: number) => `+${n} over`,
    noSlots: "No room given yet",
    // Sunday
    round1: {
      sent: (teams: number, time: string) =>
        `Sent ${time} · ${teams} ${teams === 1 ? "team" : "teams"}`,
      working: (scored: number, shortlisted: number) =>
        `Not sent · ${scored} scored, ${shortlisted} shortlisted`,
      notStarted: "Not started",
    },
    round2: {
      sent: (time: string) => `Sent ${time}`,
      ranking: "Not sent yet",
      notOpen: "Opens after presentations",
    },
    where: {
      presenting: (room: string) => `Presentations in ${room}`,
      presentingTeam: (team: string, until: string) =>
        `${team} presenting · until ${until}`,
      presentingUntil: (until: string) => `Until ${until}`,
      presentingNext: (room: string) => `Presentations in ${room}`,
      at: (time: string) => `From ${time}`,
      now: "Now",
      next: (time: string) => `Next at ${time}`,
      noLocation: "No room on the run of show",
      done: "Done for the day",
      none: "Nothing on the run of show",
      unread: "Run of show didn't load",
    },
  },

  strip: {
    label: (name: string) => `${name}: coffee chats`,
    room: (room: string) => `Chat room ${room}`,
    noRoom: "No chat room",
    chats: (accepted: number, pending: number) =>
      `${accepted} accepted · ${pending} pending`,
    needsHacker: (n: number) =>
      n === 1 ? "1 hold needs a hacker" : `${n} holds need a hacker`,
    viewSchedule: "View on schedule",
    coffeeChats: "Coffee chats",
    loading: "Loading chats…",
    loadError: "Couldn't load coffee chats. They'll retry on their own.",
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
