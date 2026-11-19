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

/**
 * The one sentence for a change after invites (simplify-decisions, "Changes
 * after invites"), used by the warning dialog and the status card. N counts
 * only invites in the chats being changed (invitesAffected). True for every
 * edit: a rename re-asks, a removed chat moves or cancels.
 */
const afterInvitesEffect = (n: number) =>
  n === 0
    ? "This doesn't affect any invited hackers."
    : `This affects ${plural(n, "invited hacker")}. Organizers will update their chats, and the hackers will be told.`;

export const sponsorSetupCopy = {
  seoTitle: "Coffee chats",

  /** Session labels by id (src/lib/coffee-chat-sessions.ts). */
  sessions: {
    "10": "10–11 AM",
    "11": "11 AM–12 PM",
    "13": "1–2 PM",
    "14": "2–3 PM",
    "15": "3–4 PM",
    "16": "4–5 PM",
  } as Record<string, string>,
  day: "Saturday",
  daySubtitle: "Sat",
  /** Above a table wider than the screen (ScrollHint). */
  scrollHint: "Scroll for later times",

  home: {
    title: "Coffee chats",
    intro: "First, tell us when your reps can chat. Then, if you like, pick hackers to meet.",
    scan: "Add a hacker",
    scanHint: "Met someone at your booth? Add them and we'll invite them first.",
    /** After Send: the setup cards collapse into links under Your chats. */
    afterSend: {
      heading: "Your setup",
      change: "Change your team or times",
      shortlist: "Shortlist",
    },
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
      body: "Hackers you'd like to meet. People you met at your booth are invited first.",
      locked: "Opens once your chatting preferences are submitted.",
      /** Shortlist places (seats minus people met at the booth), not seats. */
      seats: (n: number, max: number) =>
        n > max ? `${n} shortlisted, room for ${max}. Remove ${n - max}.` : `${n} of ${max} shortlisted`,
      submitted: (n: number, max: number) => `Submitted · ${n} of ${max} shortlisted`,
      start: "Start",
      continue: "Continue",
      view: "View shortlist",
    },
    scanned: (n: number) => `${plural(n, "person", "people")} met at your booth`,
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
      scheduled: (answerBy: string | null) =>
        answerBy
          ? `Next: hackers answer their invites by ${answerBy}. If someone can't make it, we invite the next person on your list.`
          : "Next: hackers answer their invites. If someone can't make it, we invite the next person on your list.",
    },
    changes: {
      since: "Since you were last here",
      last: "Last change",
      scheduled: "Organizers confirmed your chats",
      submittedPrefs: "You submitted your chatting preferences",
      submittedShortlist: "You submitted your shortlist",
      saved: "You saved changes",
    } as Record<string, string>,
    /** While filling in preferences (not submitted yet): where they are. */
    inFlow: (n: number, total: number, what: string) => `Step ${n} of ${total}: ${what}`,
    flowSteps: ["add your team", "say when they're free", "review and submit"],
    editedAfterSend: (n: number) =>
      `You changed your setup after invites went out. ${afterInvitesEffect(n)}`,
    at: (what: string, when: string) => `${what} · ${when}`,
    /** Round 1's answer-by time (Sat 10:00 AM), in "Next". */
    roundOneAnswerBy: "Sat 10 AM",
    /** After Send: live invite counts, not a change log. */
    invites: (accepted: number, waiting: number, open: number) =>
      `Invites: ${accepted} accepted · ${waiting} waiting · ${open} open`,
    /** A sent chat organizers moved or removed (from, to: "2:00"). */
    moved: (rep: string, from: string, to: string | null, room: string | null) =>
      to && room
        ? `Organizers moved ${rep}'s ${from} chat to ${to}, Rm ${room}`
        : to
          ? `Organizers moved ${rep}'s ${from} chat to ${to}`
          : `Organizers moved ${rep}'s ${from} chat to Rm ${room ?? ""}`,
    removed: (rep: string, from: string) => `Organizers removed ${rep}'s ${from} chat`,
  },

  /** Before any change once invites are out (spec: "Changes after invites"). */
  afterInvites: {
    title: "Invites are already out",
    body: afterInvitesEffect,
    confirm: "Change anyway",
    cancel: "Keep it as is",
  },

  back: "Back to Chats",
  backStep: "Back",
  /** Opens the portal Help (HW lead + emergency contact). */
  help: {
    question: "Something doesn't fit?",
    contact: "Ask an organizer",
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
      "The crown marks your main contact. Organizers call this person. The first rep you add gets it; tap Make main contact on another rep to move it.",
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
    primary: "Main contact",
    primaryContact: "Main contact",
    /** The crown button's visible text on a rep who isn't the main contact. */
    makePrimaryShort: "Make main contact",
    makePrimary: (name: string) => `Make ${name} the main contact`,
    isPrimary: (name: string) => `${name} is the main contact`,
    nowPrimary: (name: string) => `${name} is now the main contact.`,
    added: (name: string) => `${name} added.`,
    removed: (name: string) => `${name} removed.`,
    undo: "Undo",
    undoLabel: (name: string) => `Undo removing ${name}`,
    restored: (name: string) => `${name} is back.`,
    saved: (name: string) => `${name} saved.`,
    needName: "Add their name.",
    needPhone: "Add a phone number we can call or text.",
    shortPhone: "That phone number looks too short.",
    full: (max: number) => `You can add up to ${max} reps.`,
    next: "Next: When they're free",
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
    /** Under the hackers-per-chat pick; follows the pick. */
    roomCap: (n: number) => `Each chat: 1 rep + ${plural(n, "hacker")}`,
    q2: "When is each rep free?",
    q2Hint: "Untick any time a rep isn't free.",
    editTeam: "Edit your team",
    yourDay: "Your events",
    yourWorkshop: "Your workshop",
    /** Legend for the hatched cells, shown only when the grid has one. */
    legend: "Your workshop, with 15 minutes' travel time either side",
    /** A rep at 0 chats: their row is greyed. */
    doesntChat: "Doesn't chat",
    /** A rep free no time at all, in place of "4 chats · 2 h". */
    noFreeTime: "No free time",
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
    noPrimary: "Pick a main contact (the crown) in Your team.",
  },

  shortlist: {
    tag: "Optional",
    title: "Shortlist",
    body: "Hackers you'd like to meet.",
    steps: ["Shortlist hackers", "Review & submit shortlist"],
    how: ["Shortlist hackers you'd like to meet here.", "Submit your shortlist when you're happy with it."],
    locked: "Submit your chatting preferences first. Your seats come from them.",
    goPrefs: "Go to chatting preferences",
    seats: (n: number, max: number) => `${n} of ${max}`,
    seatsSuffix: "shortlisted",
    /** "14 seats · 3 taken by people you met · shortlist up to 11" */
    capLine: (seats: number, scanned: number, cap: number) =>
      scanned === 0
        ? `${plural(seats, "seat")} · shortlist up to ${cap}`
        : `${plural(seats, "seat")} · ${scanned} taken by people you met · shortlist up to ${cap}`,
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
    full: "Your shortlist is full. Remove someone to add another.",
    added: (name: string) => `${name} shortlisted.`,
    removed: (name: string) => `${name} removed.`,
    toggleError: "Couldn't update your shortlist. Try again.",
    scannedHeading: "People you met · invited first",
    scannedNote: "We invite people you met at your booth first, before your shortlist.",
    scannedBy: (rep: string) => `Talked to ${rep}`,
    scannedTag: "Met at your booth",
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
    submittedBody: "Thanks! We'll invite people you met at your booth first, then your shortlist.",
    edit: "Edit shortlist",
    lockedSubmitted: "Your shortlist is submitted. Editing un-submits it until you submit again.",
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
    /** When chats in a cut (or short) session run: "2:30–3:00". */
    between: (start: string, end: string) => `${start}–${end}`,
    hackers: (n: number) => (n === 0 ? "No hackers yet" : plural(n, "hacker")),
    status: { pending: "Invited", accepted: "Confirmed" } as Record<string, string>,
    repChats: (n: number) => plural(n, "chat"),
    emptyRep: "No chats for this rep.",
  },

  /** The scan card: one job, add the hacker to "Met at your booth". */
  scan: {
    heading: (name: string) => `You met ${name}`,
    already: (when: string, rep: string | null) =>
      rep ? `Already on your list · added ${when} · talked to ${rep}` : `Already on your list · added ${when}`,
    metLegend: "Who talked to them? (optional)",
    noRep: "Anyone",
    add: "Add to my list",
    save: "Save",
    adding: "Adding…",
    added: (name: string) => `${name} is on your list. We'll invite them first.`,
    error: "Couldn't add them. Try again.",
  },

  errors: {
    unknownSponsor: "This private link isn't valid.",
    unknownRep: "That rep isn't on your team anymore. Refresh and try again.",
    afterInvites: "Invites are already out. Confirm the change to save it.",
    tooManyReps: (max: number) => `You can add up to ${max} reps.`,
    shortPhone: "That phone number looks too short.",
    badSession: "That isn't one of the chat sessions.",
    noReps: "Add at least one rep in Your team first.",
    noPrimary: "Pick a main contact (the crown) in Your team.",
    noChats: "No rep has a chat at a time they're free. Tick a session or add chats.",
    notAHacker: "That isn't a Hack Western hacker's badge.",
    prefsFirst: "Submit your chatting preferences first.",
    shortlistSubmitted: "Your shortlist is submitted. Tap Edit shortlist to change it.",
    shortlistFull: "Your shortlist is full. Remove someone to add another.",
    notCandidate: "This hacker isn't on your list.",
    /** Fewer chats after shortlisting: shortlist places, not seats (B5). */
    overCap: (picked: number, cap: number) =>
      cap === 0
        ? `You now have no room on your shortlist. Remove ${picked}.`
        : `You now have room for ${cap} on your shortlist. Remove ${picked - cap}.`,
    loadError: "Couldn't load your coffee chat setup.",
    saveError: "Couldn't save. Try again.",
    scheduleUnknown:
      "We can't read the event schedule right now, so this change wasn't saved. Try again in a minute.",
  },
} as const;
