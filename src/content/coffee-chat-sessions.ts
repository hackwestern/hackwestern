// Copy for the organizer coffee chat board (Coffee chats tab of
// /internal/sponsors), from mocks/organizer-coffee-v8 to v12. Keep wording here, not
// in components. Help text is the "Coffee chats" and "Where data lives"
// sections of mocks/_data/organizer-help.md, as written there.

const plural = (n: number, one: string, many = `${one}s`) =>
  `${n} ${n === 1 ? one : many}`;

/**
 * "Dana's chat you placed by hand at 1–2" (an organizer moved or fixed it),
 * "Dana's sent chat at 1–2", or "Dana's chat at 1–2". Auto-schedule keeps
 * the first two where they are.
 */
export type ChatHow = "hand" | "sent" | null;
const chatAt = (rep: string, s: string, how: ChatHow) =>
  how === "hand"
    ? `${rep}'s chat you placed by hand at ${s}`
    : how === "sent"
      ? `${rep}'s sent chat at ${s}`
      : `${rep}'s chat at ${s}`;

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
    /** The status chip, in plain words for an organizer arriving cold. */
    status: {
      not: "Not submitted",
      /** Submitted, and every rep asked for 0 chats. */
      none: "Submitted, no chats asked",
      /** Submitted, but no rep who wants chats has a session they can do. */
      unavailable: "Submitted, no availability",
      need: "Needs scheduling",
      scheduled: "Scheduled, not sent",
      sent: "Sent",
    },
    /**
     * The problem flag beside the stage chip, e.g. "Sent" + "1 rep not
     * placed". One stage per sponsor; problems listed separately.
     */
    flags: {
      notPlaced: (n: number) => `${plural(n, "rep")} short of chats`,
      broken: (n: number) => `${plural(n, "chat")} ${n === 1 ? "needs" : "need"} a fix`,
      /** Seats are re-offered at once; one left empty means no eligible hacker is free. */
      unfilled: (n: number) => `${plural(n, "seat")} couldn't be filled (no one free)`,
    },
    /** Flag on a sponsor that edited after the schedule was sent. */
    changedAfterSend: "Changed after invites",
    openLabel: (name: string, status: string, flags: string[] = []) =>
      [name, status, ...flags].join(", "),
    notSubmittedYet: "Nothing submitted yet.",
    /**
     * Once a sponsor is sent: their hackers' invites, all chats together.
     * No declined or open count: a "no" is replaced by the next hacker.
     */
    invites: (seats: number, accepted: number, waiting: number) =>
      `Invites: ${plural(seats, "seat")} · ${accepted} accepted · ${waiting} waiting`,
    invitesOff: "Invites are switched off on this server, so none go out.",
    facts: (p: { hackersPerChat: number }) =>
      p.hackersPerChat === 1
        ? "1 hacker per chat · 15-min chats"
        : `${p.hackersPerChat} hackers per chat · 30-min chats`,
    /** A rep's wanted chats and the time they take, e.g. "6 chats · 1.5 h". */
    repWants: (chats: number, minutes: number) => {
      if (chats === 0) return "0 chats · doesn't chat";
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
    /** A session a workshop's travel buffer cuts: only part of it is usable. */
    repPartial: (rep: string, s: string, time: string) => `${rep} free ${s}, usable ${time}`,
    people: "People",
    /**
     * A rep booked back to back in two buildings (allowed, never blocked):
     * a 15-minute walk between chats. `s` is the later session.
     */
    walk: (toIvey: boolean, s: string) =>
      toIvey ? `Walk to Ivey between chats (${s})` : `Walk back from Ivey between chats (${s})`,
    /** A rep placed for fewer chats than asked (a partial session), e.g. "3 of 4 chats". */
    chatsOf: (got: number, want: number) => `${got} of ${plural(want, "chat")}`,
    /** Next to each rep in People, e.g. "Asked for 6 chats · 1.5 h". */
    asked: (wants: string) => `Asked for ${wants}`,
  },

  /** Phones on the board: each number has a copy icon beside it. */
  phone: {
    copyLabel: (name: string, phone: string) => `Copy ${name}'s number, ${phone}`,
    copied: "Copied",
    copiedLabel: (phone: string) => `Copied ${phone}`,
    primary: "Main contact",
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
      workshop: "Workshop times come from the run of show, plus 15 minutes of travel time.",
      notFree: "Their free sessions changed after this chat was placed.",
      notSubmitted: "Only sponsors who submitted get chats.",
      overCap: "The rep now asks for fewer chats than they have.",
      partial: "A workshop cuts one of their sessions short, so it fits fewer chats.",
    },
    /** Partial sessions left a rep short of the chats they asked for. */
    partialShort: (rep: string, got: number, want: number) => `${rep} gets ${got} of ${plural(want, "chat")}.`,
    extra: (rep: string, room: string, s: string) => `add a session: put ${rep} in ${room} at ${s}.`,
    /** A chat already on the board that breaks a rule now. */
    invalid: {
      workshop: (rep: string, s: string, how: ChatHow, sponsor: string) =>
        `${chatAt(rep, s, how)} is now during ${sponsor}'s workshop.`,
      notFree: (rep: string, s: string, how: ChatHow) =>
        `${chatAt(rep, s, how)} is at a time ${rep} isn't free anymore.`,
      notSubmitted: (rep: string, s: string, how: ChatHow, sponsor: string) =>
        `${chatAt(rep, s, how)} is placed, but ${sponsor} hasn't submitted.`,
      overCap: (rep: string, s: string, how: ChatHow) =>
        `${chatAt(rep, s, how)} is one more than ${rep} now wants.`,
    },
    move: (room: string, s: string) => `move to ${s} (${room}) / remove.`,
    removeIt: "remove it.",
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
    cellMoveHere: (where: string) => `Drop here: ${where}`,
    /** A lit cell while dragging: the rep can take it with no question. */
    dropHere: "Drop here",
    /** The red zone over the bottom bar while dragging. */
    dropRemove: "Drop here to remove",
    where: (room: string, s: string) => `${room}, ${s}`,
    /** "Sun Life · Dana W., 2241, 10–11, 2 chats · 3 each, Draft" (+ ", Not free"). */
    chatLabel: (sponsor: string, rep: string, where: string, format?: string, tag?: string, forced?: boolean) =>
      [`${sponsor} · ${rep}`, where, format, tag, forced ? "Not free" : ""].filter(Boolean).join(", "),
    /** A cell's tooltip: its lines joined, "Dana W. · Sun Life · 2 chats · 3 each · Draft". */
    cellTitle: (parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" · "),
    /**
     * A chat cell's third line: chats first, then their size. A partial
     * session leads with the part of the hour it uses.
     */
    cellFormat: (chats: number, hackersPerChat: number, part?: string | null) =>
      [part, `${plural(chats, "chat")} · ${hackersPerChat === 1 ? "1-on-1" : `${hackersPerChat} each`}`]
        .filter(Boolean)
        .join(" · "),
    hintMouse: "Drag a chat to move it. Click it for details.",
    hintTouch: "Press and hold a chat, then drag to move it. Tap it for details.",
    tagSent: "Sent",
    tagDraft: "Draft",
    tagForced: "Not free",
    workshopCell: (room: string | null) =>
      room ? `workshop · ${room}` : "workshop",
    /** "Sun Life workshop · 2:30–3:30 PM · Rm 2230" (time before room). */
    workshopLabel: (sponsor: string, room: string | null, when: string) =>
      `${sponsor} workshop · ${when}${room ? ` · ${room}` : ""}`,
    adhoc: "Booked by organizers",
    /** A chat in a partial session: the part of the hour it uses. */
    partialTime: (from: string, to: string) => `${from}–${to}`,
    partialNote: "Part of the session: the sponsor's workshop cuts the rest.",
  },

  detail: {
    close: "Close",
    remove: "Remove",
    cancel: "Cancel",
    format: (p: { hackersPerChat: number }) =>
      p.hackersPerChat === 1
        ? "1-on-1 · 15 min"
        : `Group of ${p.hackersPerChat}`,
    sent: "Sent",
    draft: "Draft",
    pinned: "Placed by hand: Auto-schedule keeps it here.",
    forcedNote: (rep: string) => `Moved by hand to a time ${rep} isn't free.`,
    notSentYet: "Not sent yet. Hackers are invited when Noah sends.",
    /** "Sun Life · Rm 2241 · 10–11" under the rep's name. */
    sub: (sponsor: string, where: string) => `${sponsor} · ${where}`,
    /** A draft: "6 seats in 2 chats". */
    draftSum: (seats: number, chats: number) => `${plural(seats, "seat")} in ${plural(chats, "chat")}`,
    /** A sent chat: "10 seats in 2 chats · 6 accepted · 4 waiting". */
    sum: (seats: number, chats: number, accepted: number, waiting: number) =>
      `${plural(seats, "seat")} in ${plural(chats, "chat")} · ${accepted} accepted · ${waiting} waiting`,
    /** Move to… (the keyboard way to move): only cells the rep can take with no question. */
    moveTo: "Move to…",
    moveListTitle: (who: string) => `Free cells for ${who}`,
    moveNone: (who: string) => `No empty room when ${who} is free.`,
    moveToLabel: (room: string, s: string) => `Move to ${room} at ${s}`,
  },

  /** A sent chat's hackers in the modal, one block per chat. */
  hackers: {
    label: "Invited hackers",
    chatLabel: (time: string) => `Chat at ${time}`,
    /** "10:00–10:15 · 1-on-1 · 1 accepted"; zero counts are left out. */
    chatHead: (time: string, hackersPerChat: number, accepted: number, waiting: number) =>
      [
        time,
        hackersPerChat === 1 ? "1-on-1" : `Group of ${hackersPerChat}`,
        [accepted ? `${accepted} accepted` : "", waiting ? `${waiting} waiting` : ""].filter(Boolean).join(", "),
      ]
        .filter(Boolean)
        .join(" · "),
    accepted: "Accepted",
    waiting: "Waiting",
    answerBy: (time: string) => `answer by ${time}`,
    /** Why they were invited (coffee_chat.source). */
    why: {
      organizer: "Added by organizer",
      scanned: "Met at your booth",
      shortlist: "Shortlist",
      interested: "Interested",
    } as Record<string, string>,
    edit: "Edit hackers",
    done: "Done",
    remove: "Remove",
    removeLabel: (name: string) => `Remove ${name}`,
    queueTitle: "Next in line",
    queueNone: "Nobody is in line.",
    addButton: "Put someone first in line",
    loading: "Loading hackers…",
    loadError: "Couldn't load this chat's hackers.",
  },

  /** Warnings before a change that tells hackers, or a move to a time the rep isn't free. */
  warn: {
    confirmedTitle: "This chat is confirmed.",
    /** "This hour has 4 hackers in 4 chats (3 accepted, 1 waiting)." */
    invited: (hackers: number, chats: number, accepted: number, waiting: number) =>
      `This hour has ${plural(hackers, "hacker")} in ${plural(chats, "chat")} (${[
        accepted ? `${accepted} accepted` : "",
        waiting ? `${waiting} waiting` : "",
      ]
        .filter(Boolean)
        .join(", ")}).`,
    moveAsk: "Moving it asks them to confirm the new time or room.",
    removeAsk: "Removing it cancels the chat and tells them.",
    moveTell: "Move and tell them",
    removeTell: "Remove and tell them",
    cancel: "Cancel",
    /** Two steps: contact the rep, then confirm they can do it. */
    check: {
      title: (rep: string, s: string) => `${rep} isn't free at ${s}`,
      notFree: (s: string) => `They didn't tick ${s} as free.`,
      contact: (who: string) => `Contact ${who} before moving the chat.`,
      call: "Call",
      callLabel: (name: string, phone: string) => `Call ${name}, ${phone}`,
      contacted: (who: string) => `I've contacted ${who}`,
      ask: (who: string, s: string) => `Did ${who} confirm they can do ${s}?`,
      sentLine: (hackers: number, chats: number) =>
        `${plural(hackers, "hacker")} in ${plural(chats, "chat")} will be asked to confirm the new time or room.`,
      yes: "Yes, move the chat",
      yesTell: "Yes, move and tell them",
      no: "No, keep it where it is",
    },
  },

  /** Editing a sent chat's hackers: remove one (who gets the seat?) and put someone first in line. */
  line: {
    removeTitle: (name: string) => `Remove ${name} from this chat?`,
    removeLine: (name: string) => `${name} will be told the chat is cancelled.`,
    whoGets: "Who gets this seat?",
    next: (name: string, why: string) => `Next in line: ${name} · ${why}`,
    nextNone: "Next in line: nobody is in line",
    other: "Someone else: scan or enter a hacker ID",
    idLabel: "Hacker ID",
    idPlaceholder: "Hacker ID, e.g. brave-otter-kite",
    scanLabel: "Scan a hacker's badge",
    stopScan: "Stop scanning",
    camera: {
      starting: "Starting the camera…",
      scanning: "Hold the badge's QR code up to the camera.",
      denied: "Camera access is blocked. Type the hacker ID instead.",
      unavailable: "No camera here. Type the hacker ID instead.",
      error: "The camera stopped. Type the hacker ID instead.",
      notCode: "That code isn't a hacker ID.",
      label: "Camera",
    },
    checking: "Checking…",
    /** A valid "Someone else" pick. */
    front: (name: string) => `${name} · goes to the front of the line`,
    removeGo: (name: string) => `Remove and invite ${name}`,
    removeGoEmpty: "Remove and invite…",
    addTitle: "Put someone first in line",
    addHint: "Scan or enter a hacker ID.",
    addLine: (name: string) =>
      `${name} will get this sponsor's next free seat (before booth, shortlist and interested hackers).`,
    addGo: "Add to front",
    cancel: "Cancel",
    toastReplaced: (old: string, name: string) => `Removed ${old}. Invited ${name}.`,
    toastFront: (name: string) => `${name} is first in line.`,
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
    /** Beside the disabled Send button for anyone but Noah (or someone with his HW Contacts "Same view as"). */
    onlyNoah: "Only Noah (or someone with Noah's view) sends",
  },

  /** The one pause before Send: it messages hackers and can't be undone. */
  sendConfirm: {
    title: "Send schedules and invites?",
    body: (sponsors: number, hackers: number) => {
      const who = sponsors === 1 ? "1 sponsor's" : `${sponsors} sponsors'`;
      return hackers > 0
        ? `Send ${who} schedules and invite hackers to ${plural(hackers, "seat")}? Invited hackers get a Slack message now.`
        : `Send ${who} schedules? No new hackers are invited.`;
    },
    send: "Send now",
    cancel: "Cancel",
  },

  /**
   * What changed since the board was last scheduled or sent, for an
   * organizer arriving hours after sponsors acted. Only sponsors write
   * their preferences, so "who" is the sponsor.
   */
  changes: {
    heading: "Since last time",
    none: "No sponsor changes since the last new chat.",
    submitted: (sponsor: string, time: string) => `${sponsor} submitted · ${time}`,
    editedAfterSend: (sponsor: string, time: string) =>
      `${sponsor} edited reps or times after Send · ${time}`,
    editedAfterSchedule: (sponsor: string, time: string) =>
      `${sponsor} edited reps or times since the last new chat · ${time}`,
    /** Time of the newest chat placed (Auto-schedule, a fix or a move adds one). */
    lastScheduled: (time: string) => `Last new chat ${time}`,
    lastSent: (time: string) => `Last sent ${time}`,
  },

  /** One line at the top: what needs doing now, then what happens next. */
  summary: {
    nothingYet:
      "No sponsor has submitted yet. They give their chatting preferences at the Friday workshop.",
    notScheduled: (n: number) =>
      `${plural(n, "sponsor")} submitted. Run Auto-schedule, then Noah sends schedules and invites by 10 PM.`,
    need: (n: number) =>
      `${plural(n, "sponsor")} ${n === 1 ? "needs" : "need"} scheduling. Then Noah sends schedules and invites by 10 PM.`,
    fixes: (n: number) =>
      `${plural(n, "suggested fix", "suggested fixes")} open. Then Noah sends schedules and invites by 10 PM.`,
    ready: "Everything is scheduled. Next: Noah sends schedules and invites by 10 PM.",
    changedAfterSend: (n: number) =>
      `${plural(n, "sponsor")} changed after invites. Check their chats, then Noah sends again.`,
    sent: (time: string) => `Schedules sent ${time}. Nothing to do now.`,
    notSubmittedTail: (n: number) =>
      ` ${plural(n, "sponsor")} still ${n === 1 ? "hasn't" : "haven't"} submitted.`,
  },

  toast: {
    scheduled: (n: number) => `Placed ${plural(n, "chat")}.`,
    fixApplied: "Fix applied.",
    moved: "Moved.",
    movedSent: "Moved. Hackers invited to this chat were asked to confirm the new time or room.",
    removed: "Removed.",
    /** On the "Removed." toast for a draft chat or a booking. */
    undo: "Undo",
    restored: "Put back.",
    booked: "Room booked.",
    sent: (chats: number, invited: number) =>
      `Sent ${plural(chats, "chat")}. Invited ${plural(invited, "hacker")}.`,
    /** Sponsors who changed after invites; Send confirmed their schedule again. */
    reconfirmed: (n: number) =>
      `Re-confirmed ${plural(n, "sponsor")} who changed after invites.`,
    /** Invites are switched off on this server (dev, previews). */
    invitesOff: "Invites are switched off on this server, so no hacker was messaged.",
    sheetOff: "Sheet writes are off here, so the Room Grid tab wasn't updated.",
    /** COFFEE_INVITES_ENABLED=dry: added to the Send toast. */
    dryRun: " (dry run: nothing was messaged)",
    sheetFailed: "Couldn't update the Room Grid tab. The schedule is saved.",
  },

  /** Server error messages (shown as toasts). */
  errors: {
    roomTaken: (room: string, s: string) => `${room} is taken at ${s}.`,
    repBusy: (rep: string, s: string) => `${rep} already has a chat at ${s}.`,
    repAtCap: (n: number) =>
      `This rep already has ${n === 1 ? "1 session" : `${n} sessions`}, all their chats need. Remove one first.`,
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
    /** Why Send is refused (only Noah Medland sends). */
    sender: {
      notSender: "Only Noah sends the confirmed schedule.",
      noLoginEmail:
        "Noah's row in HW Contacts has no login email, so nobody can send. Add it in the sheet.",
      sheetUnreadable: "Can't read HW Contacts, so nobody can send right now. Try again in a minute.",
    },
  },

  help: {
    button: "Help",
    title: "How coffee chats work",
    close: "Close",
    cellNote: "A cell is one rep for one hour. Groups run 2 chats an hour; 1-on-1s run 4.",
    give: {
      lead: "What sponsors give us",
      rest: " (at the Friday 5 PM workshop): their team (one main contact, every rep has a phone), hackers per chat (1–5; a 1-on-1 is 15 min, a group 30), which 1-hour sessions each rep is free (10–11, 11–12, 1–2, 2–3, 3–4, 4–5), and how many chats each rep wants. The shortlist is optional, up to their number of hacker seats.",
    },
    checksTitle: "Auto-schedule checks, for every placement:",
    checks: [
      "Only sessions the rep ticked as free.",
      "No more sessions than the rep's chats need.",
      "Never during the sponsor's own workshop, or 15 minutes before setup / after it ends (travel buffer).",
      "A session that buffer cuts can still use the part before or after the cut, in whole chats. For example, a workshop with setup at 2:00 leaves 1:00–1:30 of its 1–2 for 30-minute chats. That rep gets fewer chats from it. The board shows the part left on each cell.",
      "Reps who asked for 0 chats aren't placed.",
      "Never two chats in one room at once, never one rep in two places.",
      "Near rooms (2241–2243) first, then Ivey (1348–1358, a 15-minute walk).",
      "A sponsor's reps in the same session stay in one building.",
      "A rep's back-to-back chats stay in one building when a room is free there. When not, the rep gets a \"Walk to Ivey between chats\" note; it's never blocked.",
      "Sponsors with the fewest free sessions are placed first.",
      "Chats you place by hand (moves and applied fixes) stay put: re-running Auto-schedule keeps them.",
    ],
    fixes: {
      before: "Anything that can't be placed becomes a ",
      bold: "suggested fix",
      after:
        " (another free session, Ivey together, or fewer chats). Apply it or contact the sponsor.",
    },
    send: {
      lead: "Send (Noah only, by 10 PM Friday):",
      before: " marks every draft chat confirmed, re-confirms sponsors who changed after invites (their hackers were already asked again when they saved), and updates the locked ",
      bold: "Coffee Chat Room Grid",
      after:
        " tab (on the live site only). Each sponsor sees their confirmed chats under Your chats in their portal. Hackers get one invite per seat on Slack (email if Slack can't reach them): people the sponsor met at their booth first, then their shortlist, then hackers interested in them. They answer by Sat 10 AM. When someone declines, their seat goes to the next hacker right away; from 10 AM Saturday, new invites go out every 30 minutes.",
    },
    /** Sponsors and organizers name the same state differently. */
    sameWord: `A sponsor's "Confirmed" (in their portal) means the same as your "Sent" here.`,
    after: {
      lead: "After Send:",
      rest: " a confirmed chat you move or fix stays confirmed, and its invited hackers are asked right away to confirm the new room or time. Removing one moves its hackers to another open seat of that sponsor, or cancels their invite and tells them. Sponsor edits (fewer chats, a removed rep, a new group size) update invites the same way. Moves, removals and booking changes update the Room Grid tab right away.",
    },
    dataTitle: "Where data lives",
    data: "Spon Team RUN OF SHOW sheet: RUN OF SHOW, Sponsor Day-Of, Workshops, Opening + Closing Ceremonies, Coffee Chat Setup, Coffee Chat Room Grid (app-written, locked), HW Contacts, Sponsor Judging (app-written). Edits to grey tabs are overwritten by the app.",
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
