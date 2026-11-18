// User-facing copy for coffee chat requests: the sponsor's rep count, the
// organizer Cancel / Move-room actions, and error messages from the server.
// Keep wording here, not in components or routers.

export const coffeeChatCopy = {
  reps: {
    heading: "Reps at coffee chats",
    intro:
      "How many people from your team will run coffee chats. Each rep chats with their own hackers, side by side in your room.",
    label: "Reps",
    decrease: "One fewer rep",
    increase: "One more rep",
    parallel: (chats: number, groupSize: number) =>
      groupSize > 1
        ? `You'll run ${chats} group ${chats === 1 ? "chat" : "chats"} at a time (the room fits 6 people).`
        : `You'll run up to ${chats} ${chats === 1 ? "chat" : "chats"} at a time (the room fits 6 people).`,
    saving: "Saving…",
    saved: "Saved",
    error: "Couldn't save. Try again.",
  },

  // Sponsor hub and schedule links to the scanner and the chat list.
  hub: {
    eyebrow: "Coffee chats",
    heading: "Meet hackers for a coffee chat",
    body: "Scan a hacker's badge to offer them a chat at one of your open times. They accept or decline on their live site.",
    scan: "Scan a badge",
    list: "Your coffee chats",
    linksLabel: "Coffee chats",
  },

  // /sponsors/[uuid]/coffee-chats: the sponsor's own chats.
  // A sponsor's own room holds (organizers set a room aside before a
  // hacker is booked). Coffee chats page and the next-event card.
  sponsorHolds: {
    heading: "Your held rooms",
    intro:
      "Hack Western set these rooms aside for you. Offer a chat to a hacker for each one.",
    line: (room: string, start: string, end: string) =>
      `${room} · ${start}–${end}`,
    needsHacker: "You still need a hacker",
    booked: (n: number) =>
      n === 1 ? "1 hacker booked" : `${n} hackers booked`,
    pick: "Pick from candidates",
    scan: "Scan a badge",
    actionsLabel: (room: string, start: string) =>
      `Find a hacker for ${room} at ${start}`,
  },

  sponsorList: {
    seoTitle: "Your coffee chats",
    eyebrow: "Coffee chats",
    title: (sponsor: string) => `${sponsor} coffee chats`,
    intro:
      "Every chat you've offered, by start time. Hackers accept or decline on their live site; an unanswered offer expires 20 minutes before the chat.",
    empty: "No chats yet. Scan a hacker's badge to offer one.",
    scan: "Scan a badge",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    updated: "Chat list updated.",
    minutes: (minutes: number) => `${minutes} min`,
    rep: (name: string) => `With ${name}`,
    noRep: "Any rep",
    roomTbd: "Room to be assigned",
    summary: (accepted: number, pending: number) =>
      `${accepted} accepted · ${pending} waiting for a reply`,
    status: {
      pending: "Waiting",
      accepted: "Accepted",
      declined: "Declined",
      expired: "Expired",
      cancelled: "Cancelled",
    },
  },

  // /live: the toast for a new request and the home summary card.
  live: {
    toast: (sponsor: string) => `${sponsor} wants to chat with you`,
    toastAction: "View",
    // Home summary card; the full list is the Coffee chats tab.
    summary: (pending: number, upcoming: number) =>
      [
        pending > 0 ? `${pending} waiting for your answer` : null,
        upcoming > 0 ? `${upcoming} upcoming` : null,
      ]
        .filter(Boolean)
        .join(" · "),
    viewAll: "View coffee chats",
  },

  // /live?tab=coffee-chats: every chat the hacker has, grouped (T36).
  page: {
    navName: "Coffee chats",
    navBadge: (n: number) =>
      `${n} ${n === 1 ? "chat" : "chats"} waiting for your answer`,
    intro:
      "Sponsors who meet you can offer a short chat on Saturday. Answer here before the reply-by time.",
    codeHeading: "Your hacker code",
    codeHint: "Sponsors can scan your badge or type this code.",
    noCode:
      "Your hacker code shows up here once you confirm your spot. Until then, sponsors can scan the QR code on your badge.",
    copy: "Copy",
    copyLabel: "Copy your hacker code",
    copied: "Copied",
    codeCopied: "Hacker code copied.",
    copyFailed: "Couldn't copy. Select the code and copy it yourself.",
    groups: {
      pending: "Waiting for your answer",
      upcoming: "Upcoming",
      past: "Past & closed",
    },
    pendingEmpty: "Nothing waiting for an answer.",
    upcomingEmpty: "No accepted chats yet.",
    empty:
      "No coffee chats yet. When a sponsor offers you one, it shows up here.",
    loading: "Loading your coffee chats…",
    loadError: "Couldn't load your coffee chats.",
    retry: "Try again",
    when: (day: string, time: string, minutes: number) =>
      `${day} ${time}, ${minutes} min`,
    roomTbd: "Room to be announced",
    rep: (name: string) => `With ${name}`,
    replyBy: (time: string) => `Reply by ${time}`,
    timeLeft: (
      t:
        | { days: number }
        | { hours: number; minutes: number }
        | { underAMinute: true },
    ) =>
      "underAMinute" in t
        ? "Less than a minute left"
        : "days" in t
          ? `${t.days} days left`
          : t.hours === 0
            ? `${t.minutes} min left`
            : t.minutes === 0
              ? `${t.hours} h left`
              : `${t.hours} h ${t.minutes} min left`,
    beAt: (room: string, time: string) => `Be at ${room} at ${time}`,
    beAtNoRoom: (time: string) =>
      `Be there at ${time}. We'll post the room before then.`,
    mapLink: "Find it on the map",
    accept: "Accept",
    acceptLabel: (sponsor: string) => `Accept coffee chat with ${sponsor}`,
    decline: "Decline",
    declineLabel: (sponsor: string) => `Decline coffee chat with ${sponsor}`,
    confirmDecline: (sponsor: string) =>
      `Decline ${sponsor}'s chat? The time goes to another hacker.`,
    confirmYes: "Yes, decline",
    confirmYesLabel: (sponsor: string) =>
      `Yes, decline coffee chat with ${sponsor}`,
    keep: "Keep",
    keepLabel: (sponsor: string) => `Keep coffee chat with ${sponsor}`,
    cantMake: "Can't make it",
    cantMakeLabel: (sponsor: string) =>
      `Can't make it to coffee chat with ${sponsor}`,
    confirmCantMake: (sponsor: string) =>
      `Cancel your chat with ${sponsor}? Your spot goes to another hacker.`,
    confirmCantMakeYes: "Yes, cancel",
    confirmCantMakeYesLabel: (sponsor: string) =>
      `Yes, cancel coffee chat with ${sponsor}`,
    saving: "Saving…",
    accepted: (sponsor: string, time: string) =>
      `Accepted. You're chatting with ${sponsor} at ${time}.`,
    declined: (sponsor: string) => `Declined ${sponsor}'s chat.`,
    closedError:
      "This request can't be answered anymore. It may have expired or been cancelled. Your list is updated.",
    error: "Couldn't save your answer. Check your connection and try again.",
    status: {
      pending: "Needs your answer",
      accepted: "Accepted",
      declined: "Declined",
      expired: "Expired",
      cancelled: "Cancelled",
      finished: "Done",
    },
  },

  // Messages the server sends back; the UI shows them as-is.
  errors: {
    unknownSponsor: "This private link isn't valid.",
    notAHacker: "That badge isn't a Hack Western hacker.",
    notSetUp: "Your coffee chat times aren't set yet.",
    notInWindow: "That time isn't in your coffee chat window.",
    tooLate: "That time is too close to offer now.",
    full: "That time is full. Pick another one.",
    hackerBusy: "This hacker already has a chat at that time.",
    roomTaken: "Another sponsor is using that room then.",
    unknownRoom: "That room isn't on the run of show.",
    roomClash: (room: string, sponsor: string, start: string, end: string) =>
      `${sponsor} already has ${room} from ${start} to ${end}, which overlaps this window.`,
    chatNotFound: "That coffee chat doesn't exist.",
    notPending: "This request can't be answered anymore.",
    alreadyOver: "This chat can't be changed anymore.",
    sheetUnavailable:
      "Couldn't read the run-of-show sheet. Try again in a minute.",
    holdNotFound: "That room hold doesn't exist anymore.",
    holdTimes: "Pick a start and length on the 15-minute grid, up to 4 hours.",
    holdClash: (room: string, sponsor: string, start: string, end: string) =>
      `${sponsor} already has ${room} from ${start} to ${end}. Pick another room or time.`,
  },

  // Shown to sponsors (freeTimes / sponsorChats `watcherName`).
  watcher: {
    line: (name: string) => `Your Hack Western contact for chats: ${name}`,
  },

  organizer: {
    heading: "Booked chats",
    empty: "No coffee chats booked yet.",
    cancel: "Cancel",
    confirmCancel: "Cancel chat",
    cancelConfirm: (hacker: string, sponsor: string, time: string) =>
      `Cancel ${hacker}'s chat with ${sponsor} at ${time}?`,
    moveRoom: "Move room",
    moveTo: "Move to",
    moveHint: (sponsor: string, time: string) =>
      `Moves every ${sponsor} chat at ${time} to the new room.`,
    move: "Move",
    close: "Close",
    roomTbd: "Room to be assigned",
    status: {
      pending: "Waiting for reply",
      accepted: "Accepted",
      declined: "Declined",
      expired: "Expired",
      cancelled: "Cancelled",
    },
    hacker: (first: string, last: string | null) =>
      last ? `${first} ${last}` : first,
    when: (time: string, minutes: number) => `${time} · ${minutes} min`,
    actionError: "Couldn't update the chat.",

    // Saturday room assignment (rooms 2241-2243), one card per sponsor.
    rooms: {
      heading: "Rooms",
      intro:
        "Give each sponsor a coffee chat room. Sponsors in the same room can't overlap. Changing a room moves that sponsor's booked chats and tells each hacker.",
      empty: "No sponsors yet.",
      window: "Window",
      format: "Format",
      hackers: "Hackers",
      room: "Room",
      unassigned: "Not assigned",
      sheetRoom: (room: string) => `Sheet says ${room}`,
      notSetUp: "No coffee chat window in the sheet yet.",
      notRegistered: "Not registered on the site, so no room can be saved.",
      saved: "Saved",
      saveError: "Couldn't save the room.",
      watcher: "Watched by",
      watcherHint:
        "Sponsor team member who watches this sponsor's chats and room.",
      watcherPlaceholder: "Name",
      watcherSave: "Save",
      watcherSaved: "Saved",
      watcherError: "Couldn't save who's watching.",
    },

    // Saturday board: sponsors across, 15-minute slots down (T48).
    board: {
      heading: "Saturday coffee chats",
      intro:
        "Every sponsor side by side. Pick a cell to see its chats, cancel or move them, or add one.",
      viewLabel: "View",
      views: { rooms: "Rooms", table: "By sponsor", list: "List" },
      summaryLabel: "Today's totals",
      totals: {
        offered: "Offered",
        accepted: "Accepted",
        pending: "Waiting for reply",
        seatsLeft: "Seats left today",
        needsHacker: "Holds needing a hacker",
        rooms: "Rooms in use",
      },
      noRooms: "None yet",
      tableLabel: "Coffee chats by sponsor and time",
      scrollHint: "Scroll sideways to see every sponsor.",
      time: "Time",
      now: "Now",
      empty: "No sponsor has coffee chat times in the sheet yet.",
      notSetUp: "Not set up",
      notRegistered: "Not registered on the site",
      format: (minutes: number, groupSize: number) =>
        groupSize > 1
          ? `Group of ${groupSize}, ${minutes} min`
          : `1-on-1, ${minutes} min`,
      reps: (n: number) => `${n} ${n === 1 ? "rep" : "reps"}`,
      counts: (accepted: number, pending: number, total: number) =>
        `${accepted} accepted · ${pending} waiting · ${total} total`,
      room: "Room",
      unassigned: "Unassigned",
      sheetRoom: (room: string) => `Sheet: ${room}`,
      watcher: "Watched by",
      watcherSave: "Save",
      watcherSaved: "Saved",
      outside: "Outside window",
      noStart: "No start time",
      seatsLeft: (n: number) => `${n} ${n === 1 ? "seat" : "seats"} left`,
      full: "Full",
      closed: "Closed",
      shortName: (first: string, last: string | null) =>
        last?.trim() ? `${first} ${last.trim()[0]!.toUpperCase()}.` : first,
      cellLabel: (sponsor: string, time: string) => `${sponsor}, ${time}`,
      status: {
        pending: "Pending",
        accepted: "Accepted",
        declined: "Declined",
        expired: "Expired",
        cancelled: "Cancelled",
      },
      panel: {
        title: (sponsor: string, time: string) => `${sponsor} at ${time}`,
        description: (format: string, room: string | null) =>
          room ? `${format} · ${room}` : `${format} · Room to be assigned`,
        close: "Close",
        chats: "Chats here",
        noChats: "No chats here yet.",
        code: (code: string | null) => code ?? "No hacker ID yet",
        rep: (rep: string | null) => (rep ? `Rep: ${rep}` : "No rep named"),
        addHeading: "Add a chat here",
        addIntro: (sponsor: string, time: string) =>
          `Sends the hacker a request for ${sponsor} at ${time}. They accept on /live.`,
        cantAdd: {
          notRegistered:
            "This sponsor isn't registered on the site, so chats can't be added.",
          notOpen: "This isn't one of the sponsor's start times.",
          full: "No seats left at this time.",
          tooLate: "Too close to the start to send a request now.",
        },
      },
    },

    // Side panel beside the board: the coffee chat rooms on the map and
    // where every sponsor is, at the time picked in the table (T52).
    side: {
      label: "Map and where everyone is",
      showing: (time: string) => `Showing ${time}`,
      live: "Following the clock",
      picked: "Picked in the table",
      now: "Now",
      nowLabel: "Show the current time",
      pickRow: "Pick a time in the table to see that moment.",
      rowLabel: (time: string) => `Show ${time} on the map`,
      mapHeading: "Coffee chat rooms",
      mapIntro: "Pick a room to find its sponsor in the table.",
      free: "Free",
      chatsAt: (n: number, time: string) =>
        `${n} ${n === 1 ? "chat" : "chats"} at ${time}`,
      breakdown: (accepted: number, pending: number) =>
        `${accepted} accepted, ${pending} waiting`,
      roomPin: (room: string, sponsor: string | null, line: string) =>
        sponsor ? `${room}: ${sponsor}, ${line}` : `${room}: free`,
      roomsList: "Coffee chat rooms at this time",
      highlighting: (sponsor: string) => `Highlighting ${sponsor} in the table`,
      clear: "Clear",
      whereHeading: "Where is everyone",
      whereAt: (time: string) => `At ${time}`,
      whereEmpty: "No sponsor is on the run of show at this time.",
      whereError: "Couldn't load where sponsors are.",
      show: (section: string) => `Show ${section}`,
      hide: (section: string) => `Hide ${section}`,
      // The map beside the run of show: now only, no time picking.
      nowAt: (time: string) => `Now · ${time}`,
      mapIntroLive: "Which sponsor is in which coffee chat room right now.",
      roomsNow: "Coffee chat rooms now",
      notToday: "Coffee chats run on Saturday. The map shows them then.",
    },

    // Pick which sponsors the Coffee chats tables and totals show.
    sponsorFilter: {
      label: "Show sponsors",
      all: "All sponsors",
      clear: "Clear",
      count: (shown: number, total: number) =>
        shown === total
          ? `All ${total} sponsors`
          : `${shown} of ${total} sponsors`,
      none: "No sponsors picked. Pick one above, or All sponsors.",
      show: (name: string) => `Show ${name}`,
      highlight: (name: string) => `Highlight ${name} in the rooms table`,
      highlightHint:
        "Tick to show or hide a sponsor. Pick a name to highlight their rooms; Escape clears it.",
    },

    // Rooms down the side of a booking table: one column per room.
    roomTable: {
      heading: "Coffee chat rooms",
      intro: (capacity: number) =>
        `Each room fits ${capacity} people: hackers in chats plus the sponsor's reps.`,
      jump: "Jump to rooms",
      tableLabel: "Coffee chat rooms by time",
      time: "Time",
      legendLabel: "What the cells mean",
      legend: {
        free: "Available: pick any grey time to book or hold",
        booked: "Booked, in the sponsor's colour",
        full: "Full",
        over: "Over capacity",
        held: "Held, needs a hacker",
        dimmed: "Other sponsors (filtered out)",
      },
      free: "Available",
      used: (used: number, capacity: number) => `${used}/${capacity}`,
      hackers: (n: number) => (n === 1 ? "1 hacker" : `${n} hackers`),
      reps: (n: number) => (n === 1 ? "1 rep" : `${n} reps`),
      overWarning: "Over capacity",
      cellLabel: (
        room: string,
        time: string,
        who: string | null,
        used: number,
        capacity: number,
      ) =>
        who
          ? `${room}, ${time}, ${who}, ${used} of ${capacity} booked`
          : `${room}, ${time}, available`,
      notToday: "Coffee chats run on Saturday. Pick Saturday to see the rooms.",
      empty: "No coffee chat times in the sheet yet.",
      dialog: {
        title: (room: string, time: string) => `${room} at ${time}`,
        description: (used: number, capacity: number) =>
          `${used} of ${capacity} places taken.`,
        close: "Close",
        inRoom: "In this room",
        nobody: "Nobody has this room yet.",
        sponsor: "Book for",
        pickSponsor: "Pick a sponsor",
        noSponsors: "No sponsor has an open start time here.",
        otherRoom: (sponsor: string, room: string | null) =>
          room
            ? `${sponsor}'s chats are in ${room}. Move them to this room first to book here.`
            : `${sponsor} has no room yet. Give them this room first to book here.`,
        assign: (room: string) => `Use ${room} for this sponsor`,
        assignError: "Couldn't change the room. Try again.",
      },
      // Organizer room holds: a room set aside for a sponsor before any
      // hacker is booked.
      needsHacker: "Needs a hacker",
      heldFor: (sponsor: string) => `Held for ${sponsor}`,
      heldLabel: (sponsor: string) => `held for ${sponsor}, needs a hacker`,
      holdForm: {
        heading: "Hold room for a sponsor",
        intro: (room: string, time: string) =>
          `Set ${room} aside from ${time} before a hacker is booked. The sponsor sees the room and that they still need a hacker.`,
        sponsor: "Sponsor",
        pickSponsor: "Pick a sponsor",
        length: "Length",
        minutes: (n: number) => `${n} min`,
        note: "Note for organizers (optional)",
        submit: "Hold room",
        saving: "Holding…",
        done: (sponsor: string, room: string, start: string, end: string) =>
          `${room} held for ${sponsor}, ${start} to ${end}.`,
        error: "Couldn't hold the room. Try again.",
      },
      holds: {
        heading: "Room holds",
        span: (start: string, end: string) => `${start} to ${end}`,
        chats: (n: number) => (n === 1 ? "1 chat booked" : `${n} chats booked`),
        addHint: "Add a chat into this hold with the form below.",
        move: "Move hold",
        remove: "Remove hold",
        removeConfirm: (sponsor: string) =>
          `Remove ${sponsor}'s hold? Chats already booked keep their room.`,
        confirmRemove: "Remove",
        room: "Room",
        start: "Start",
        length: "Length",
        save: "Save",
        cancel: "Cancel",
        error: "Couldn't change the hold. Try again.",
      },
    },

    // Organizers add a chat by hand (same rules as a sponsor's offer).
    add: {
      heading: "Add a chat",
      intro:
        "Book a hacker with a sponsor yourself. The hacker still accepts on /live and gets the usual message.",
      sponsor: "Sponsor",
      pickSponsor: "Pick a sponsor",
      hacker: "Hacker",
      hackerPlaceholder: "Name, email or hacker ID",
      searching: "Searching…",
      noMatches: "No admitted hacker matches that.",
      typeMore: "Type at least 2 characters.",
      change: "Change",
      code: (code: string | null) => code ?? "No hacker ID yet",
      time: "Start time",
      pickTime: "Pick a time",
      noTimes: "No open times left for this sponsor and hacker.",
      timeOption: (time: string, seats: number, room: string | null) =>
        `${time} · ${seats} ${seats === 1 ? "seat" : "seats"} left${room ? ` · ${room}` : ""}`,
      rep: "Rep name (optional)",
      submit: "Add chat",
      added: (hacker: string, sponsor: string, time: string) =>
        `Sent ${hacker} a request for ${sponsor} at ${time}.`,
      addError: "Couldn't add the chat.",
    },
  },
} as const;
