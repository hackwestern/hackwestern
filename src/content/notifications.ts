// Copy for the hacker notification center on /live (the bell): coffee chat
// and sponsor presentation notices, and the "Email you use on Slack"
// setting. Keep wording here, not in components or routers.

export const notificationsCopy = {
  bellLabel: (unread: number) =>
    unread > 0 ? `Notifications, ${unread} unread` : "Notifications",
  heading: "Notifications",
  empty: "Nothing yet. Coffee chat offers and your judging times show up here.",
  loading: "Loading…",
  loadError: "Couldn't load your notifications.",
  retry: "Try again",
  newLabel: "New",

  coffeeChat: {
    title: {
      pending: (sponsor: string) => `${sponsor} wants to chat`,
      accepted: (sponsor: string) => `Coffee chat with ${sponsor} is on`,
      declined: (sponsor: string) => `You declined ${sponsor}'s chat`,
      expired: (sponsor: string) => `${sponsor}'s chat request expired`,
      cancelled: (sponsor: string) =>
        `Your chat with ${sponsor} was called off`,
    },
    status: {
      pending: "Needs an answer",
      accepted: "Confirmed",
      declined: "Declined",
      expired: "Expired",
      cancelled: "Cancelled",
    },
    /** "Sat 10:15 AM · 15 min · Rm 2241" */
    detail: (time: string, minutes: number, room: string) =>
      `Sat ${time} · ${minutes} min · ${room}`,
    roomTbd: "Room TBA",
    open: "Answer",
  },

  presentation: {
    title: (sponsor: string) => `Your team presents to ${sponsor}`,
    /** "Sun 10:05 AM · Rm 2110" */
    detail: (time: string, room: string) => `Sun ${time} · ${room}`,
    status: "Judging",
    /** One member's tap confirms for the whole team. */
    confirm: "Confirm our times",
    confirming: "Confirming…",
    confirmed: "Confirmed",
  },

  channel: {
    slack: "Slack DM",
    email: "Email",
  },

  settings: {
    heading: "Email you use on Slack",
    hint: (applicationEmail: string) =>
      `We find you on Slack with this email. Leave it blank to use ${applicationEmail}.`,
    fallback: (applicationEmail: string) =>
      `Not on Slack? We email ${applicationEmail} instead.`,
    placeholder: "you@example.com",
    save: "Save",
    saving: "Saving…",
    saved: "Saved",
    /** After saving: who Slack finds for the email we'll try first. */
    found: (name: string) => `Saved. Found you on Slack as ${name}.`,
    foundNoName: (email: string) =>
      `Saved. Found a Slack account for ${email}.`,
    notFound: (email: string) =>
      `Saved, but no Slack account uses ${email}. Check it for typos.`,
    notFoundApplication: (email: string) =>
      `Saved. No Slack account uses ${email}, so we'll email you there.`,
    invalid: "That doesn't look like an email.",
    error: "Couldn't save. Try again.",
  },
};
