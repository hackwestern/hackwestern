// User-facing copy for coffee chat notifications: the offer email (T17), the
// Slack DM and its button results (T22/T23), and the organizer bookings tab
// in the run-of-show sheet (T20). Keep wording here, not in server code.

/** Where hackers answer coffee chat requests. */
export const LIVE_URL = "https://www.hackwestern.com/live";

export const coffeeChatNotifyCopy = {
  /** "Saturday at 10:00 AM (15 min)" */
  when: (time: string, minutes: number) =>
    `Saturday at ${time} (${minutes} min)`,
  roomTba: "room TBA",

  email: {
    from: "Hack Western Team <hello@hackwestern.com>",
    subject: (sponsor: string) => `${sponsor} wants to have a coffee chat`,
    greeting: (firstName: string) =>
      firstName ? `Hi ${firstName},` : "Hi there,",
    intro: (sponsor: string) =>
      `${sponsor} would like to have a coffee chat with you at Hack Western.`,
    whenLabel: "When",
    whereLabel: "Where",
    action: "Accept or decline on your Live page",
    deadline:
      "Please answer at least 20 minutes before the chat. Requests nobody answers expire then.",
    signoff: "The Hack Western 13 Team",
  },

  slack: {
    /** Notification preview text (also the fallback when blocks can't show). */
    text: (sponsor: string) => `${sponsor} wants to have a coffee chat`,
    body: (sponsor: string, when: string, room: string) =>
      `*${sponsor}* wants to have a coffee chat with you.\n*When:* ${when}\n*Where:* ${room}`,
    accept: "Accept",
    decline: "Decline",
    footer: "You can also answer on your Live page:",
    result: {
      accepted: "You accepted this coffee chat. See you there!",
      declined: "You declined this coffee chat.",
      notYours: "This coffee chat isn't linked to your Slack account.",
      notPending: "This request can't be answered anymore.",
      failed: "Something went wrong. Please answer on your Live page.",
    },
  },

  sheet: {
    tab: "Coffee Chat Bookings",
    headers: [
      "Chat ID",
      "Sponsor",
      "Hacker",
      "Start",
      "Length (min)",
      "Room",
      "Status",
      "Rep",
      "Offered at",
      "Answered at",
    ],
  },
} as const;
