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
