/** Copy for the organizer Ping Logs page (/internal/ping-logs). */
export const pingLogsCopy = {
  seoTitle: "Ping Logs",
  title: "Ping Logs",
  subtitle:
    "Run of show reminders from P.O.N.Y: is the bot running, and who gets pinged for what.",
  loading: "Loading pings…",
  error: (message: string) => `Couldn't load pings: ${message}`,
  bot: {
    healthy: "Bot is running",
    down: "Bot isn't checking in",
    lastCheckIn: (when: string) => `Last check-in ${when}`,
    never: "No check-in queued in Slack",
    healthyHelp:
      "It re-reads the run of show about every 35 seconds, so sheet edits reach Slack within a minute.",
    downHelp:
      'Pings already queued still go out, but new Run of Show edits aren\'t syncing. On the PC, run: schtasks /run /tn "HW Organizer Reminders"',
  },
  counts: {
    queued: (n: number) => `${n} queued`,
    notQueued: (n: number) => `${n} not queued`,
    sent: (n: number) => `${n} sent`,
  },
  filter: {
    label: "Who",
    everyone: "Everyone",
  },
  show: {
    label: "Show",
    upcoming: "Upcoming",
    sent: "Sent",
    all: "All",
  },
  table: {
    time: "Sends at",
    to: "To",
    what: "Reminder",
    status: "Status",
    empty: "No pings here.",
    details: "Full message",
  },
  status: {
    queued: "Queued in Slack",
    notQueued: "Not queued",
    sent: "Sent",
  },
  statusHelp: {
    notQueued:
      "Not in Slack's queue: the bot hasn't synced it yet, or this person has no Slack account the bot can find.",
  },
  footnote:
    "Slack can't list messages it already sent, so a ping whose time has passed shows as Sent.",
  refreshed: (when: string) => `Updated ${when}`,
};
