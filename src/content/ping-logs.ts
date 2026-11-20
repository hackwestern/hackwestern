/** Copy for the organizer Ping Logs page (/internal/ping-logs). */
export const pingLogsCopy = {
  seoTitle: "Ping Logs",
  title: "Ping Logs",
  subtitle:
    "Every ping P.O.N.Y and the site send: run of show reminders, coffee chat invites, judging times, sponsor help and more.",
  loading: "Loading pings…",
  error: (message: string) => `Couldn't load pings: ${message}`,
  bot: {
    healthy: "Reminder bot is running",
    down: "Reminder bot isn't checking in",
    lastCheckIn: (when: string) => `Last check-in ${when}`,
    never: "No check-in queued in Slack",
    healthyHelp:
      "It re-reads the run of show about every 35 seconds, so sheet edits reach Slack within a minute.",
    downHelp:
      'Run of show pings already queued still go out, but new edits aren\'t syncing. On the PC, run: schtasks /run /tn "HW Organizer Reminders"',
    unavailable: (message: string) =>
      `Can't check the run of show reminders right now: ${message}`,
  },
  kinds: {
    all: "All",
    organizer: "Run of show",
    coffee: "Coffee chats",
    presentation: "Judging times",
    help: "Sponsor help",
    task: "Task reminders",
    marketing: "Marketing",
  },
  kindHelp: {
    organizer: "15 min before each task, to its owners (DM) and team channels.",
    coffee: "Coffee chat invites DMed to hackers, with their answer.",
    presentation: "Judging presentation times sent to each team member.",
    help: "Sponsor help requests posted to the team's Slack channel.",
    task: "Task reminders the site schedules from the run of show.",
    marketing: "Marketing post reminders to the marketing team.",
  },
  failed: (names: string) => `Couldn't load: ${names}. The rest is below.`,
  search: {
    label: "Search",
    placeholder: "Name, sponsor or team",
  },
  show: {
    label: "Show",
    past: "Sent",
    upcoming: "Upcoming",
    all: "All",
  },
  problemsOnly: (n: number) => `Problems only (${n})`,
  table: {
    time: "When",
    kind: "Type",
    to: "To",
    what: "About",
    status: "Status",
    empty: "No pings here.",
  },
  status: {
    "organizer.queued": "Queued in Slack",
    "organizer.notQueued": "Not queued",
    "organizer.sent": "Sent",
    "coffee.pending": "Sent · no answer yet",
    "coffee.accepted": "Accepted",
    "coffee.declined": "Declined",
    "coffee.expired": "Expired, no answer",
    "coffee.cancelled": "Cancelled",
    "presentation.sent": "Sent on Slack",
    "presentation.emailed": "Emailed (no Slack)",
    "presentation.sending": "Sending…",
    "presentation.not-found": "Not reached",
    "presentation.failed": "Failed",
    "help.notPosted": "Slack post failed",
    "help.open": "Posted · nobody yet",
    "help.claimed": "Claimed",
    "help.resolved": "Resolved",
    "help.cancelled": "Cancelled",
    "scheduled.scheduled": "Scheduled",
    "scheduled.cancelled": "Cancelled",
    "scheduled.failed": "Failed",
    "scheduled.sent-window-passed": "Sent",
  } as Record<string, string>,
  statusHelp: {
    "organizer.notQueued":
      "Not in Slack's queue: the bot hasn't synced it yet, or this person has no Slack account the bot can find.",
  } as Record<string, string>,
  footnote:
    "Run of show pings come from Slack's queue, which can't list sent messages, so a passed one shows as Sent. Coffee chat change and cancel DMs and fallback emails aren't recorded, so they don't appear here.",
  refreshed: (when: string) => `Updated ${when}`,
};
