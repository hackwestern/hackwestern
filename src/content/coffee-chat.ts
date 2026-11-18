// User-facing copy for coffee chats: the sponsor's chat request and asks
// for fewer, the organizer rooms view and its actions, and error messages
// from the server.
// Keep wording here, not in components or routers.

export const coffeeChatCopy = {
  // A sponsor's chat request (1-on-1 with N reps, or one group of M
  // hackers). Shared by the organizer view and the sponsor's setup card.
  request: {
    summary: (style: "oneOnOne" | "group", perSlot: number) =>
      style === "group"
        ? `Group · ${perSlot} ${perSlot === 1 ? "hacker" : "hackers"}`
        : `1-on-1 · ${perSlot} ${perSlot === 1 ? "rep" : "reps"}`,
    none: "No chat request yet",
    styleLabel: "How you'll run chats",
    styles: { oneOnOne: "1-on-1 chats", group: "One group chat" },
    perSlotLabel: { oneOnOne: "Reps chatting", group: "Hackers in the group" },
    perSlotLine: (style: "oneOnOne" | "group", n: number) =>
      style === "group"
        ? `We book ${n} ${n === 1 ? "hacker" : "hackers"} into each chat.`
        : `We book ${n} ${n === 1 ? "hacker" : "hackers"} per slot, one per rep.`,
    decrease: "One fewer",
    increase: "One more",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    error: "Couldn't save. Try again.",
  },

  // /sponsors/[uuid]/coffee-chats: "Your chat setup".
  setup: {
    heading: "Your chat setup",
    intro: "Tell us how you'll run coffee chats. We book hackers to match.",
    fromSheet:
      "Filled in from what you told us before. Change it if your plans changed.",
    none: "Pick how you'll run chats.",
    length: (minutes: number) => `Chats are ${minutes} min`,
    hours: (start: string, end: string) => `Available ${start}–${end}`,
    chattingHours: (hours: number) =>
      `${hours} ${hours === 1 ? "hour" : "hours"} of chats`,
  },

  // A sponsor lowers hackers for a slot or an hour (a rep leaves).
  fewer: {
    ask: "Offer less chats",
    askLabel: (time: string) => `Offer less chats at ${time}`,
    hackers: "Hackers then",
    noChat: "0 = no chat then",
    scope: "For",
    slot: "This slot",
    hour: "This hour",
    save: "Save",
    cancel: "Cancel",
    slotLine: (time: string, booked: number, asked: number) =>
      `${time} · ${booked} of ${asked} booked`,
    askedFor: (n: number) => `asked for ${n}`,
    heading: "Less chats",
    item: (start: string, end: string, n: number) =>
      `${start}–${end} · ${n === 0 ? "no chats" : `${n} ${n === 1 ? "hacker" : "hackers"}`}`,
    remove: "Back to full",
    removeLabel: (start: string, end: string) =>
      `Go back to your full request from ${start} to ${end}`,
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

  // A sponsor's own room blocks (one room for a stretch of time that
  // hackers are booked into). Coffee chats page and the next-event card.
  sponsorHolds: {
    heading: "Your coffee chat rooms",
    intro: "Hack Western gave you these rooms. Fill each chat with a hacker.",
    line: (
      room: string,
      start: string,
      end: string,
      filled: number,
      total: number,
    ) => `${room} · ${start}–${end} · ${filled} of ${total} chats filled`,
    needsHacker: "You still need a hacker",
    pick: "Pick from candidates",
    scan: "Scan a badge",
    actionsLabel: (room: string, start: string) =>
      `Find a hacker for ${room} at ${start}`,
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
    noBlock: "Ask the sponsor team for a room at this time.",
    notInWindow: "That time isn't one of your chat start times.",
    tooLate: "That time is too close to offer now.",
    full: "That time is full. Pick another one.",
    hackerBusy: "This hacker already has a chat at that time.",
    roomTaken: "Another sponsor is using that room then.",
    unknownRoom: "That room isn't on the run of show.",
    chatNotFound: "That coffee chat doesn't exist.",
    notPending: "This request can't be answered anymore.",
    alreadyOver: "This chat can't be changed anymore.",
    sheetUnavailable:
      "Couldn't read the run-of-show sheet. Try again in a minute.",
    holdNotFound: "That room block doesn't exist anymore.",
    holdTimes: "Pick a start and length on the 15-minute grid, up to 1 hr 30.",
    blockTooShort: (minutes: number) =>
      `Too short for this sponsor's ${minutes}-min chats. Pick a longer length.`,
    ownBlockOverlap:
      "This sponsor already has a room then. A sponsor is in one room at a time.",
    blockDropsChats:
      "Hackers are booked in the part you'd cut. Cancel those chats first.",
    blockHasChats:
      "Hackers are booked in this room. Cancel their chats first, then release it.",
    limitTimes: "Pick one of your slots, or an hour inside one of your rooms.",
    tooManyLimits:
      "That's a lot of changes. Put one back to full first, or ask Hack Western.",
    requestBelowBooked: (time: string, booked: number) =>
      `${booked} ${booked === 1 ? "hacker is" : "hackers are"} already booked at ${time}. Ask Hack Western to move them first, then lower the number.`,
    limitBelowBooked:
      "More hackers are already booked then. Ask Hack Western to move them first.",
    holdClash: (room: string, sponsor: string, start: string, end: string) =>
      `${sponsor} already has ${room} from ${start} to ${end}. Pick another room or time.`,
  },

  // Shown to sponsors (freeTimes / sponsorChats `watcherName`).
  watcher: {
    line: (name: string) => `Your Hack Western contact for chats: ${name}`,
  },

  organizer: {
    cancel: "Cancel",
    confirmCancel: "Cancel chat",
    cancelConfirm: (hacker: string, sponsor: string, time: string) =>
      `Cancel ${hacker}'s chat with ${sponsor} at ${time}?`,
    status: {
      pending: "Waiting for reply",
      accepted: "Accepted",
      declined: "Declined",
      expired: "Expired",
      cancelled: "Cancelled",
    },
    hacker: (first: string, last: string | null) =>
      last ? `${first} ${last}` : first,
    actionError: "Couldn't update the chat.",

    // Who on the sponsor team watches a sponsor's chats.
    rooms: {
      watcherError: "Couldn't save who's watching.",
    },

    // The Coffee chats tab: one rooms x time view.
    board: {
      heading: "Saturday coffee chats",
      intro:
        "Rooms by time. Pick a sponsor to highlight their rooms, a block to see its hackers, or a free cell to give the room.",
      shortName: (first: string, last: string | null) =>
        last?.trim() ? `${first} ${last.trim()[0]!.toUpperCase()}.` : first,
      watcher: "Watched by",
      watcherSave: "Save",
      watcherSaved: "Saved",
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

    // Rooms down the side of a booking table: one column per room. A room
    // at a time is free or in one sponsor's room block.
    roomTable: {
      heading: "Coffee chat rooms",
      jump: "Jump to rooms",
      tableLabel: "Coffee chat rooms by time",
      time: "Time",
      free: "Free",
      clash: "Two sponsors",
      fill: (booked: number, needed: number) => `${booked}/${needed}`,
      fillLabel: (booked: number, needed: number) =>
        `${booked} of ${needed} hackers booked`,
      needs: (n: number) => `Needs ${n}`,
      needsLabel: (n: number) => `Needs ${n} ${n === 1 ? "hacker" : "hackers"}`,
      full: "Full",
      askedFor: (n: number) => `asked for ${n}`,
      cellLabel: (room: string, time: string, who: string | null) =>
        who ? `${room}, ${time}, ${who}` : `${room}, ${time}, free: give room`,
      floorPlanAlt:
        "Floor 2 plan showing the coffee chat rooms, Rm 2241, Rm 2242 and Rm 2243.",
      empty: "No coffee chat times in the sheet yet.",
      // Block lengths, exactly as organizers pick them.
      length: (minutes: number) =>
        ({
          15: "15 min",
          30: "30 min",
          45: "45 min",
          60: "1 hour",
          75: "1 hr 15",
          90: "1 hr 30",
        })[minutes] ?? `${minutes} min`,
      close: "Close",

      // Per-sponsor strip above the table.
      strip: {
        label: "Sponsors and their rooms",
        window: (start: string, end: string) => `${start}–${end}`,
        hoursBooked: (bookedMinutes: number, hours: number | null) => {
          const h = (n: number) => String(Math.round(n * 100) / 100);
          return hours === null
            ? `${h(bookedMinutes / 60)} hours booked`
            : `${h(bookedMinutes / 60)} of ${h(hours)} hours booked`;
        },
        hackers: (booked: number, target: number) =>
          `${booked}/${target} hackers`,
        mismatch: "Sheet numbers don't add up",
        mismatchDetail: (
          slots: number | null,
          hackers: number | null,
          hours: number | null,
        ) =>
          `Sheet: ${slots ?? "?"} slots, ${hackers ?? "?"} hackers, ${hours ?? "?"} chatting hours`,
        notRegistered: "Not on the site yet",
        highlight: (name: string) => `Highlight ${name} in the rooms table`,
        edit: "Edit request",
        editLabel: (name: string) => `Edit ${name}'s chat request`,
        editTitle: (name: string) => `${name}'s chat request`,
      },

      // A free cell: give the room to a sponsor for a length.
      give: {
        title: "Give this room to a sponsor",
        where: (room: string, time: string) => `${room} · from ${time}`,
        sponsor: "Sponsor",
        pickSponsor: "Pick a sponsor",
        request: (request: string, minutes: number) =>
          `${request} · ${minutes} min`,
        length: "Length",
        submit: "Give room",
        saving: "Giving…",
        noSponsors: "No sponsor is registered on the site yet.",
        error: "Couldn't give the room. Try again.",
      },

      // A block: its slots, Change length and Release room.
      block: {
        title: (room: string, start: string, end: string) =>
          `${room} · ${start}–${end}`,
        request: (request: string, minutes: number) =>
          `${request} · ${minutes} min`,
        slotsLabel: "Chat slots",
        // A slot's status in plain words.
        slotStatus: (missing: number, waiting: number) =>
          [
            missing > 0
              ? `Still missing ${missing} ${missing === 1 ? "hacker" : "hackers"}`
              : "All hackers booked",
            waiting > 0 ? `${waiting} waiting on approval` : null,
          ]
            .filter(Boolean)
            .join(" · "),
        invite: "Invite a hacker",
        inviteLabel: (time: string) => `Invite a hacker at ${time}`,
        sendInvite: "Send invite",
        cancelChat: "Cancel",
        cancelLabel: (hacker: string, time: string) =>
          `Cancel ${hacker}'s chat at ${time}`,
        reject: "Reject",
        rejectLabel: (hacker: string, time: string) =>
          `Reject ${hacker}'s request at ${time}`,
        rejectConfirm: (hacker: string, sponsor: string, time: string) =>
          `Reject ${hacker}'s chat with ${sponsor} at ${time}?`,
        confirmReject: "Reject",
        keep: "Keep",
        status: {
          pending: "Waiting",
          accepted: "Accepted",
          declined: "Declined",
          expired: "Expired",
          cancelled: "Cancelled",
        },
        changeLength: "Change length",
        save: "Save",
        cancel: "Cancel",
        release: "Release room",
        releaseConfirm: (sponsor: string) =>
          `Release this room from ${sponsor}?`,
        confirmRelease: "Release",
        error: "Couldn't change the room. Try again.",
      },
    },

    // Organizers add a hacker to a block slot by hand (same rules as a
    // sponsor's offer).
    add: {
      hacker: "Hacker",
      hackerPlaceholder: "Name, email or hacker ID",
      searching: "Searching…",
      noMatches: "No admitted hacker matches that.",
      typeMore: "Type at least 2 characters.",
      change: "Change",
      code: (code: string | null) => code ?? "No hacker ID yet",
      addError: "Couldn't add the chat.",
    },
  },
} as const;
