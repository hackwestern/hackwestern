// Copy for the organizer coffee chat board (Coffee chats tab of
// /internal/sponsors), from mocks/organizer-coffee-v8. Keep wording here, not
// in components. Help text is the "Coffee chats" and "Where data lives"
// sections of mocks/_data/organizer-help.md, as written there.

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

const workshopsUnknown =
  "Can't read the run of show, so workshop times are unknown. Try again in a minute.";

export const coffeeSessionsCopy = {
  title: "Coffee chats",
  day: "Saturday, Nov 21",
  bookRoom: "Book a room",
  loading: "Loading coffee chats…",
  loadError: "Couldn't load the coffee chat board.",
  retry: "Try again",
  /** Shown while the run of show can't be read; every write is paused. */
  workshopsUnavailable: workshopsUnknown,

  /** Session labels by id (src/lib/coffee-chat-sessions.ts). */
  sessions: {
    "10": "10–11",
    "11": "11–12",
    "13": "1–2",
    "14": "2–3",
    "15": "3–4",
    "16": "4–5",
  } as Record<string, string>,

  sponsors: {
    heading: "Sponsors",
    submittedCount: (n: number, total: number) => `${n} of ${total} submitted`,
    empty: "No sponsors are doing coffee chats yet.",
    status: {
      not: "Not submitted",
      sent: "Sent",
      need: (done: number, total: number) =>
        `Needs scheduling · ${done} of ${total}`,
      scheduled: (done: number, total: number) =>
        `Scheduled · ${done} of ${total}`,
    },
    openLabel: (name: string, status: string) => `${name}, ${status}`,
    notSubmittedYet: "Nothing submitted yet.",
    facts: (p: { hackersPerChat: number; longerOneOnOne: boolean }) =>
      p.hackersPerChat === 1
        ? `1 hacker per chat · ${p.longerOneOnOne ? 30 : 15}-min chats`
        : `${p.hackersPerChat} hackers per chat · 30-min chats`,
    /** A rep's wanted chats and the time they take, e.g. "6 chats · 1.5 h". */
    repWants: (chats: number, minutes: number) => {
      const h = (chats * minutes) / 60;
      const time = h < 1 ? `${chats * minutes} min` : `${Number(h.toFixed(2))} h`;
      return `${plural(chats, "chat")} · ${time}`;
    },
    legend: {
      pick: "Scheduled (room)",
      free: "Free",
      event: "Their event",
    },
    rep: "Rep",
    theirEvent: (sponsor: string) => `${sponsor} workshop, with travel time`,
    repFree: (rep: string, s: string) => `${rep} free ${s}`,
    repNotFree: (rep: string, s: string) => `${rep} not free ${s}`,
    repAt: (rep: string, s: string, room: string) => `${rep}, ${s}, Rm ${room}`,
    repEvent: (rep: string, s: string, what: string) => `${rep}, ${s}: ${what}`,
  },

  contact: {
    button: "Contact",
    buttonLabel: (name: string) => `Contact ${name}`,
    copy: "Copy",
    copied: "Copied",
    copiedLabel: (phone: string) => `Copied ${phone}`,
    text: "Text",
    call: "Call",
    primary: "Primary contact",
    noPhone: "No phone",
    /** Drafted texts for the sms: link (the organizer edits before sending). */
    draft: {
      notSubmitted: (first: string, sponsor: string) =>
        `Hi ${first}, this is Hack Western. We don't have ${sponsor}'s coffee chat times yet. Could you fill them in on the sponsor portal tonight? Invites go out at 10.`,
      ivey: (first: string, sponsor: string, n: number, s: string) =>
        `Hi ${first}, this is Hack Western. At ${s} tomorrow the rooms near the Sponsor Bay are full. Is it OK if ${sponsor}'s ${n} chats are in the Ivey building, a 15-minute walk?`,
      session: (first: string, rep: string, s: string) =>
        `Hi ${first}, this is Hack Western. Could ${rep} do their coffee chat at ${s} tomorrow instead?`,
      fewer: (first: string, rep: string, got: number, want: number) =>
        `Hi ${first}, this is Hack Western. We're short on rooms, so ${rep} may get ${got} of ${want} coffee chats tomorrow. Is that OK?`,
      any: (first: string, sponsor: string) =>
        `Hi ${first}, this is Hack Western about ${sponsor}'s coffee chats tomorrow.`,
    },
  },

  fixes: {
    heading: "Suggested fixes",
    allScheduled: "Everything is scheduled.",
    beforeAuto: "Fixes show up after Auto-schedule.",
    apply: "Apply fix",
    applying: "Applying…",
    suggested: "Suggested:",
    group: (n: number, s: string) =>
      `${plural(n, "rep")} not placed at ${s}.`,
    short: (rep: string, got: number, want: number) =>
      `${rep} has ${got} of ${plural(want, "chat")}.`,
    why: {
      full: "Every room is taken then.",
      near: (k: number) => `All ${k} near rooms are taken then.`,
      ivey: (k: number) => `All ${k} Ivey rooms are taken then.`,
      open: "A room is free in another session they ticked.",
    },
    session: (places: { rep: string; room: string; s: string }[]) =>
      places.map((p) => `put ${p.rep} in ${p.room} at ${p.s}`).join("; ") + ".",
    ivey: (n: number, rooms: string[], s: string) =>
      `put all ${n} reps in Ivey (${rooms.join(", ")}) at ${s} so they stay together.`,
    fewer: (items: { rep: string; got: number; want: number }[]) =>
      items
        .map((i) =>
          i.got === 0
            ? `leave ${i.rep} out (0 of ${plural(i.want, "chat")})`
            : `schedule ${i.rep} for ${plural(i.got, "chat")} instead of ${i.want}`,
        )
        .join("; ") + ".",
  },

  rooms: {
    heading: "Rooms",
    room: "Room",
    near: "Near the Sponsor Bay",
    ivey: "Ivey · 15-min walk",
    workshops: "Workshops",
    rm: (id: string) => `Rm ${id}`,
    iveyRm: (id: string) => `Ivey, Rm ${id}`,
    cellBook: (where: string) => `Book a room: ${where}`,
    cellMoveHere: (where: string) => `Move here: ${where}`,
    moveHere: "Move here",
    where: (room: string, s: string) => `${room}, ${s}`,
    chatLabel: (sponsor: string, rep: string, where: string) =>
      `${sponsor} · ${rep}, ${where}`,
    workshopCell: (room: string | null) =>
      room ? `workshop · ${room}` : "workshop",
    workshopLabel: (sponsor: string, room: string | null, when: string) =>
      `${sponsor} workshop${room ? ` · ${room}` : ""} · ${when}`,
    adhoc: "Booked by organizers",
  },

  detail: {
    close: "Close",
    move: "Move",
    remove: "Remove",
    cancel: "Cancel",
    movePick: (who: string) => `Tap an empty cell when ${who} is free.`,
    format: (p: { hackersPerChat: number; longerOneOnOne: boolean }) =>
      p.hackersPerChat === 1
        ? `1-on-1 · ${p.longerOneOnOne ? 30 : 15} min`
        : `Group of ${p.hackersPerChat}`,
    toInvite: (n: number) => `${n} hackers to invite`,
    sent: "Sent",
    afterSend: (n: number) =>
      `Invites are out. Changing this asks ${n} hackers to confirm again.`,
    pinned: "Pinned: Auto-schedule keeps it here.",
  },

  booking: {
    title: "Book a room",
    room: "Room",
    session: "Session",
    forWho: "Who it's for",
    forWhoPlaceholder: "e.g. Commure, or Mentors",
    note: "Note",
    notePlaceholder: "Optional",
    book: "Book",
    cancel: "Cancel",
    needWho: "Who it's for?",
    roomOption: (id: string, ivey: boolean) => (ivey ? `Ivey ${id}` : id),
  },

  bar: {
    start: "Invites go out by 10 PM",
    review: "Review the rooms, then send",
    fixesOpen: (n: number) => `${n} fix${n === 1 ? "" : "es"} open`,
    autoSchedule: "Auto-schedule",
    rerun: "Re-run auto-schedule",
    send: "Send confirmed schedules & invites",
    working: "Working…",
    sentAt: (time: string) => `Sent ${time}`,
    nothingToSend: "Nothing new to send.",
  },

  toast: {
    scheduled: (n: number) => `Placed ${plural(n, "chat")}.`,
    fixApplied: "Fix applied.",
    moved: "Moved.",
    removed: "Removed.",
    booked: "Room booked.",
    sent: (n: number) => `Sent ${plural(n, "chat")}.`,
    sheetOff: "Sheet writes are off here, so the Room Grid tab wasn't updated.",
    sheetFailed: "Couldn't update the Room Grid tab. The schedule is saved.",
  },

  /** Server error messages (shown as toasts). */
  errors: {
    roomTaken: (room: string, s: string) => `${room} is taken at ${s}.`,
    repBusy: (rep: string, s: string) => `${rep} already has a chat at ${s}.`,
    duringWorkshop: (sponsor: string) => `That's during ${sponsor}'s workshop.`,
    notFree: (rep: string, s: string) => `${rep} isn't free at ${s}.`,
    notSubmitted: (sponsor: string) => `${sponsor} hasn't submitted yet.`,
    unknownFix: "That fix no longer applies. The board changed.",
    unknownPlacement: "That chat is gone. The board changed.",
    unknownBooking: "That booking is gone. The board changed.",
    badCell: "Unknown room or session.",
    boardChanged: "Someone else just changed the board. Refresh and try again.",
    badReference: "That sponsor or rep is gone. Refresh and try again.",
    unknownSponsor: "That sponsor isn't registered. Refresh and try again.",
    workshopsUnknown,
  },

  help: {
    button: "Help",
    title: "How coffee chats work",
    close: "Close",
    give: {
      lead: "What sponsors give us",
      rest: " (at the Friday 5 PM workshop): their team (one primary contact, every rep has a phone), hackers per chat (1–5; 1-on-1s can be 30 min), which 1-hour sessions each rep is free (10–11, 11–12, 1–2, 2–3, 3–4, 4–5), and how many chats each rep wants. The shortlist is optional, up to their number of hacker seats.",
    },
    checksTitle: "Auto-schedule checks, for every placement:",
    checks: [
      "Only sessions the rep ticked as free.",
      "No more sessions than the rep's chats need.",
      "Never during the sponsor's own workshop, or 15 minutes before setup / after it ends (travel buffer).",
      "Never two chats in one room at once, never one rep in two places.",
      "Near rooms (2241–2243) first, then Ivey (1348–1358, a 15-minute walk).",
      "A sponsor's reps in the same session stay in one building.",
      "Sponsors with the fewest free sessions are placed first.",
      "Your manual moves are pinned: re-running Auto-schedule keeps them.",
    ],
    fixes: {
      before: "Anything that can't be placed becomes a ",
      bold: "suggested fix",
      after:
        " (another free session, Ivey together, or fewer chats). Apply it or contact the sponsor.",
    },
    send: {
      lead: "Send (by 10 PM Friday):",
      before: " saves the confirmed schedule, updates the locked ",
      bold: "Coffee Chat Room Grid",
      after:
        " tab, sends each sponsor's primary contact their schedule, and invites hackers in this order: people the sponsor scanned → their shortlist → hackers interested in that sponsor. Sponsors who didn't submit a shortlist by 9:30 PM get interested hackers.",
    },
    after: {
      lead: "After Send:",
      rest: " an unanswered invite expires 20 minutes before the chat (35 for Ivey) and the seat goes to the next person automatically. Changing a sent chat asks those hackers to confirm again.",
    },
    dataTitle: "Where data lives",
    data: "Spon Team RUN OF SHOW sheet: RUN OF SHOW, Sponsor Day-Of, Workshops, Opening + Closing Ceremonies, Coffee Chat Setup, Coffee Chat Room Grid (app-written, locked), Sponsor Status, HW Contacts, Sponsor Judging (app-written). Edits to grey tabs are overwritten by the app.",
  },

  /** The app-written "Coffee Chat Room Grid" tab (one-way mirror). */
  sheet: {
    tab: "Coffee Chat Room Grid",
    note: "Written by the app from the organizer coffee chat board. Don't type here: edits are overwritten.",
    updated: (when: string) => `Updated ${when}`,
    nearHeader: "Near the Sponsor Bay",
    iveyHeader: "Ivey building · 15-minute walk",
    time: "Time",
    rm: (id: string) => `Rm ${id}`,
    chat: (sponsor: string, rep: string, format: string, chats: number) =>
      `${sponsor} · ${rep} · ${format} · ${plural(chats, "chat")}`,
    booking: (label: string, note: string | null) =>
      note ? `${label} · ${note}` : label,
  },
};
