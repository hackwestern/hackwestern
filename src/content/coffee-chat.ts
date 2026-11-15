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
    chatNotFound: "That coffee chat doesn't exist.",
    notPending: "This request can't be answered anymore.",
    alreadyOver: "This chat can't be changed anymore.",
    sheetUnavailable:
      "Couldn't read the run-of-show sheet. Try again in a minute.",
  },

  organizer: {
    heading: "Booked chats",
    empty: "No coffee chats booked yet.",
    cancel: "Cancel",
    cancelConfirm: (hacker: string, sponsor: string, time: string) =>
      `Cancel ${hacker}'s chat with ${sponsor} at ${time}?`,
    moveRoom: "Move room",
    moveTo: "Move to",
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
  },
} as const;
