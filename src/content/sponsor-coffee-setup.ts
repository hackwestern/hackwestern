// Copy for the sponsor portal's coffee chat setup on
// /sponsors/[uuid]/coffee-chats: the Chats home, Your team, chatting
// preferences, the shortlist and "Your chats" once organizers send. From
// mocks/sponsor-portal-flow-hacker-v6 with Jazz's later choices
// (docs/decisions.md 2026-11-19). No deadline or auto-submit text: sponsors
// fill this in at the Friday workshop. Keep wording here, not in components.

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/** "1 h 30 min", "45 min", "2 h". */
export const chatTime = (minutes: number) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
};

/** "6 chats · 1 h 30 min" */
const chatsAndTime = (chats: number, minutes: number) =>
  chats === 0 ? "Doesn't chat" : `${plural(chats, "chat")} · ${chatTime(chats * minutes)}`;

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const sponsorSetupCopy = {
  seoTitle: "Coffee chats",

  /** Session labels by id (src/lib/coffee-chat-sessions.ts). */
  sessions: {
    "10": "10–11",
    "11": "11–12",
    "13": "1–2",
    "14": "2–3",
    "15": "3–4",
    "16": "4–5",
  } as Record<string, string>,
  day: "Saturday",
  daySubtitle: "Sat",

  home: {
    title: "Coffee chats",
    intro:
      "Two separate jobs: tell us when your reps can chat (required), then shortlist hackers you'd like to meet (optional).",
    scan: "Add a hacker",
    scanHint: "Scan a hacker you met at your booth. We invite people you scan first.",
    prefs: {
      tag: "Required",
      title: "Chatting preferences",
      body: "When and how your reps will chat.",
      notStarted: "Not started",
      draft: "Not submitted yet",
      submitted: "Submitted",
      confirmed: "Confirmed",
      start: "Start",
      continue: "Continue",
      view: "View preferences",
    },
    shortlist: {
      tag: "Optional",
      title: "Shortlist",
      body: "Hackers you'd like to meet. We invite people you scan first.",
      locked: "Opens once your chatting preferences are submitted.",
      seats: (n: number, max: number) => `${n} of ${max} seats`,
      submitted: (n: number, max: number) => `Submitted · ${n} of ${max} seats`,
      start: "Start",
      continue: "Continue",
      view: "View shortlist",
    },
    scanned: (n: number) => `${plural(n, "person", "people")} you scanned`,
  },

  /** The status card at the top of every coffee chat screen. */
  status: {
    label: "Where things stand",
    state: {
      notStarted: "Not started",
      draft: "Draft saved, not submitted",
      waiting: "Submitted, waiting for organizers to schedule",
      invitesGoingOut: "Scheduled, invites going out",
      accepted: (accepted: number, seats: number) =>
        `Scheduled, ${accepted} of ${plural(seats, "seat")} accepted`,
    } as const,
    todo: {
      notStarted: "You need to: add your team and give us your chatting preferences.",
      draft: "You need to: review and submit your chatting preferences.",
      shortlist: "Nothing required. Optional: shortlist hackers you'd like to meet.",
      waiting: "Nothing to do. You're waiting on organizers.",
      scheduled: "Nothing to do. Your chats are below.",
    },
    next: {
      notStarted: "Next: you submit your preferences. Then organizers confirm chat times Friday evening.",
      draft: "Next: you submit. Then organizers confirm chat times Friday evening.",
      waiting: "Next: organizers confirm chat times Friday evening, then invite hackers.",
      scheduled:
        "Next: hackers answer their invites. If someone can't make it, we invite the next person on your list.",
    },
    changes: {
      since: "Since you were last here",
      last: "Last change",
      scheduled: "Organizers scheduled your chats",
      submittedPrefs: "You submitted your chatting preferences",
      submittedShortlist: "You submitted your shortlist",
      saved: "You saved changes",
    } as Record<string, string>,
    editedAfterSend:
      "You changed your setup after invites went out. Organizers will check it and ask affected hackers to confirm again.",
    at: (what: string, when: string) => `${what} · ${when}`,
  },

  /** Before any change once invites are out (spec: "Changes after invites"). */
  afterInvites: {
    title: "Invites are already out",
    body: (n: number) =>
      n === 0
        ? "Changing this may ask hackers to confirm again, and some may drop off."
        : `Changing this will ask ${plural(n, "hacker")} to confirm again, and some may drop off.`,
    confirm: "Change anyway",
    cancel: "Keep it as is",
  },

  back: "Back to Chats",
  backStep: "Back",
  /** Opens the portal Help (HW lead + emergency contact). */
  help: {
    question: "Need something different?",
    contact: "Contact organizers",
  },
  rail: {
    stepOf: (n: number, total: number) => `Step ${n} of ${total}`,
    label: "Steps",
    done: "done",
    current: "current step",
  },

  prefsFlow: {
    tag: "Required",
    title: "Chatting preferences",
    body: "When and how your reps will chat.",
    steps: ["Your team", "Give us your chatting preferences", "Review & submit preferences"],
  },

  team: {
    heading: (sponsor: string) => `Add each rep from ${sponsor}.`,
    crownNote:
      "The crown marks your primary contact. Organizers use their name and phone. The first rep you add gets it; tap another rep's crown to move it.",
    count: (n: number) => `Reps · ${n}`,
    empty: "No reps yet. Add the people from your team who'll chat with hackers.",
    name: "Name",
    phone: "Phone",
    namePlaceholder: "e.g. Dana W.",
    phonePlaceholder: "e.g. 519-555-0142",
    add: "Add rep",
    save: "Save rep",
    saving: "Saving…",
    cancel: "Cancel",
    edit: "Edit",
    editLabel: (name: string) => `Edit ${name}`,
    remove: "Remove",
    removeLabel: (name: string) => `Remove ${name}`,
    primary: "Primary",
    primaryContact: "Primary contact",
    makePrimary: (name: string) => `Make ${name} the primary contact`,
    isPrimary: (name: string) => `${name} is the primary contact`,
    nowPrimary: (name: string) => `${name} is now the primary contact.`,
    added: (name: string) => `${name} added.`,
    removed: (name: string) => `${name} removed.`,
    saved: (name: string) => `${name} saved.`,
    needName: "Add their name.",
    needPhone: "Add a phone number we can call or text.",
    shortPhone: "That phone number looks too short.",
    full: (max: number) => `You can add up to ${max} reps.`,
    next: "Next: Chatting preferences",
    needRep: "Add at least one rep to continue.",
  },

  prefs: {
    heading: "Give us your chatting preferences",
    intro:
      "Three quick questions. This is when your team is free, not a booking: organizers pick your final chat times from it.",
    q1: "How many hackers per chat?",
    q1Label: "Hackers per chat",
    format: (n: number) =>
      n === 1 ? "1-on-1 · 15 min · 4 hackers an hour per rep" : `Groups of ${n} · 30 min · ${n * 2} hackers an hour per rep`,
    roomCap: "Up to 6 people a chat: 1 rep and up to 5 hackers.",
    q2: "When is each rep free?",
    q2Hint: "Untick any time a rep isn't free.",
    editTeam: "Edit your team",
    yourDay: "Your day",
    yourWorkshop: "Your workshop",
    workshopAt: (when: string) => `Your workshop ${when}`,
    buffer: "Buffer · travel time",
    workshopsUnknown:
      "We can't read the event schedule right now, so your workshop isn't shown. Organizers will check it.",
    sessionsOf: (n: number, total: number) => `${n} of ${total} sessions`,
    cellLabel: (rep: string, session: string, free: boolean) =>
      `${rep}, ${session}: ${free ? "free" : "not free"}`,
    blockedLabel: (rep: string, session: string) =>
      `${rep}, ${session}: your workshop`,
    /** A session the workshop's travel buffer only cuts: the part left. */
    partialOnly: (from: string, to: string) => `${from}–${to} only`,
    /** Screen-reader session name for a cut session: "1–2, 1:00–1:30 only". */
    partialLabel: (session: string, only: string) => `${session}, ${only}`,
    q3: "How many chats?",
    q3Hint: "For each rep. Organizers won't schedule a rep for more than this. 0 means they won't chat.",
    fewer: (name: string) => `Fewer chats for ${name}`,
    more: (name: string) => `More chats for ${name}`,
    chatsLabel: (name: string) => `Chats for ${name}`,
    chatsAndTime,
    notFree: (name: string) => `${name} isn't free any time Saturday.`,
    capped: (name: string, hours: number, chats: number) =>
      `${name} is free for ${plural(hours, "hour")}, so up to ${plural(chats, "chat")}.`,
    totals: (chats: number, hackers: number) =>
      `Up to ${plural(chats, "chat")} · up to ${plural(hackers, "hacker")}`,
    next: "Next: Review & submit",
    saving: "Saving…",
    saved: "Saved.",
    retrying: "Not saved, retrying…",
    noReps: "Add your team first.",
  },

  review: {
    heading: "Review & submit preferences",
    allGood: "Everything checks out.",
    whenFree: "When your team is free",
    summary: (hackersPerChat: number, minutes: number, chats: number, hackers: number) =>
      `${hackersPerChat === 1 ? "1-on-1" : `Groups of ${hackersPerChat}`} · ${minutes} min · up to ${plural(chats, "chat")} · up to ${plural(hackers, "hacker")}`,
    yourTeam: "Your team",
    edit: "Edit",
    freeAt: (sessions: string, n: number) =>
      n === 0 ? "Not free Saturday" : `Free ${sessions} · ${plural(n, "session")}`,
    repChats: (chats: number, minutes: number, wanted: number, capped: boolean) =>
      capped
        ? `${chatsAndTime(chats, minutes)} · asked for ${wanted}`
        : chatsAndTime(chats, minutes),
    contactLine: (name: string, phone: string) =>
      `Organizers call ${name} at ${phone}.`,
    workshop: "Your workshop · Sat",
    workshopLine: (when: string, title: string, location: string | null) =>
      [when, title, location].filter(Boolean).join(" · "),
    buffers: (before: string, after: string) => `Travel buffers ${before} and ${after}`,
    shortlist: "Shortlist",
    shortlistNote: "A separate, optional step. It opens once these preferences are submitted.",
    fixChats: (name: string) => `Change ${firstName(name)}'s chats`,
    fixTeam: "Edit your team",
    fixFree: "Change times",
    submitNote: "This is when your team is free. We'll confirm your final chat times.",
    submit: "Submit preferences",
    submitting: "Submitting…",
    submitted: "Preferences submitted",
    submittedBody:
      "Thanks! Organizers will pick your final chat times from this. You can still make changes.",
    resubmit: "Submit changes",
    shortlistNext: "Next: Shortlist hackers",
    noChats: "No rep has a chat at a time they're free. Tick a session or add chats.",
    noPrimary: "Pick a primary contact (the crown) in Your team.",
  },

  shortlist: {
    tag: "Optional",
    title: "Shortlist",
    body: "Hackers you'd like to meet.",
    steps: ["Shortlist hackers", "Review & submit shortlist"],
    how: [
      "Shortlist hackers you'd like to meet here.",
      "Scan hackers at your booth Friday night. We invite people you scan first.",
      "Submit your shortlist when you're happy with it.",
    ],
    locked: "Submit your chatting preferences first. Your seats come from them.",
    goPrefs: "Go to chatting preferences",
    seats: (n: number, max: number) => `${n} of ${max}`,
    seatsSuffix: "shortlisted",
    /** "14 seats · 3 taken by people you scanned · shortlist up to 11" */
    capLine: (seats: number, scanned: number, cap: number) =>
      scanned === 0
        ? `${plural(seats, "seat")} · shortlist up to ${cap}`
        : `${plural(seats, "seat")} · ${scanned} taken by people you scanned · shortlist up to ${cap}`,
    sentNote:
      "Your chats are scheduled. Changes here only affect who's offered seats in later rounds.",
    noSeats: "Your preferences have no chats yet, so there are no seats to fill.",
    viewLabel: "View",
    oneAtATime: "One at a time",
    list: "List",
    left: (n: number) => `${plural(n, "hacker")} left to look at`,
    allSeen: "You've looked at everyone. Switch to List to review your picks.",
    skip: "Skip",
    add: "Shortlist",
    remove: "Remove",
    addLabel: (name: string) => `Shortlist ${name}`,
    removeLabel: (name: string) => `Remove ${name} from your shortlist`,
    full: (max: number) => `All ${max} seats are shortlisted. Remove someone to add another.`,
    added: (name: string) => `${name} shortlisted.`,
    removed: (name: string) => `${name} removed.`,
    toggleError: "Couldn't update your shortlist. Try again.",
    scannedHeading: "People you scanned · First choice",
    scannedNote: "We invite people you scan first, before your shortlist.",
    scannedBy: (rep: string) => `Scanned by ${rep}`,
    scannedTag: "Met at Hacker Fair",
    filters: { shortlisted: "Shortlisted", not: "Not shortlisted", all: "Everyone" },
    filterLabel: "Show",
    noneShortlisted: "Nobody shortlisted yet.",
    noneLeft: "Everyone here is on your shortlist.",
    nobody: "No hackers to show yet. Check back soon.",
    notShared: "First name only. This hacker didn't share their full profile.",
    noTeam: "No team yet",
    reviewNext: "Next: Review & submit",
    year: (y: string) => `${y} year`,
    reviewHeading: "Review & submit shortlist",
    reviewEmpty: "Your shortlist is empty. You can still submit: we'll invite hackers who asked to chat with you.",
    submit: "Submit shortlist",
    submitting: "Submitting…",
    submitted: "Shortlist submitted",
    submittedBody: "Thanks! We'll invite people you scan first, then your shortlist.",
    edit: "Edit shortlist",
    lockedSubmitted: "Your shortlist is submitted. Tap Edit shortlist to change it.",
    skipForNow: "Skip for now",
  },

  chats: {
    heading: "Your chats",
    confirmed: "Your chats are confirmed",
    confirmedBody: "Here's where each rep chats on Saturday.",
    everyone: "Everyone",
    filterLabel: "Show chats for",
    viewLabel: "View",
    calendar: "Calendar",
    list: "List",
    rep: "Rep",
    yourWorkshop: "Your workshop",
    workshop: "Your workshop",
    none: "—",
    noneLabel: (rep: string, s: string) => `${rep}, ${s}: no chat`,
    room: (room: string) => `Rm ${room}`,
    building: (building: "near" | "ivey") =>
      building === "near" ? "Main building" : "Ivey, 15 min walk",
    format: (hackersPerChat: number, minutes: number) =>
      hackersPerChat === 1 ? `1-on-1 · ${minutes} min` : `Group of ${hackersPerChat} · ${minutes} min`,
    chatCount: (n: number) => plural(n, "chat"),
    until: (end: string) => `until ${end}`,
    hackers: (n: number) => (n === 0 ? "No hackers yet" : plural(n, "hacker")),
    status: { pending: "Invited", accepted: "Confirmed" } as Record<string, string>,
    repChats: (n: number) => plural(n, "chat"),
    emptyRep: "No chats for this rep.",
  },

  scan: {
    heading: (name: string) => `You met ${name}`,
    metLegend: "Which rep wants to talk to them?",
    noRep: "Anyone",
    add: "Add to Met at Hacker Fair",
    adding: "Adding…",
    added: (name: string) => `${name} is on your Met at Hacker Fair list. We'll invite them first.`,
    error: "Couldn't add them. Try again.",
  },

  errors: {
    unknownSponsor: "This private link isn't valid.",
    unknownRep: "That rep isn't on your team anymore. Refresh and try again.",
    afterInvites: (n: number) =>
      n === 0
        ? "Invites are already out. Changing this may ask hackers to confirm again, and some may drop off."
        : `Invites are already out. Changing this will ask ${plural(n, "hacker")} to confirm again, and some may drop off.`,
    tooManyReps: (max: number) => `You can add up to ${max} reps.`,
    shortPhone: "That phone number looks too short.",
    badSession: "That isn't one of the chat sessions.",
    noReps: "Add at least one rep in Your team first.",
    noPrimary: "Pick a primary contact (the crown) in Your team.",
    noChats: "No rep has a chat at a time they're free. Tick a session or add chats.",
    notAHacker: "That isn't a Hack Western hacker's badge.",
    prefsFirst: "Submit your chatting preferences first.",
    shortlistSubmitted: "Your shortlist is submitted. Tap Edit shortlist to change it.",
    shortlistFull: (max: number) =>
      `All ${max} seats are shortlisted. Remove someone to add another.`,
    notCandidate: "This hacker isn't on your list.",
    overCap: (picked: number, cap: number) =>
      `Your shortlist has ${plural(picked, "person", "people")} but you now have ${plural(cap, "seat")}. Remove ${picked - cap}.`,
    loadError: "Couldn't load your coffee chat setup.",
    saveError: "Couldn't save. Try again.",
    scheduleUnknown:
      "We can't read the event schedule right now, so this change wasn't saved. Try again in a minute.",
  },
} as const;
