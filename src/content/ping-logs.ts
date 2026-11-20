/** Copy for the organizer Ping Logs page (/internal/ping-logs). */
export const pingLogsCopy = {
  seoTitle: "Ping Logs",
  title: "Ping Logs",
  subtitle:
    "Is everyone getting their pings? Run of show reminders from P.O.N.Y, plus coffee chats, judging times and sponsor help.",
  loading: "Checking pings… (the first load reads the sheet and Slack, ~10 s)",
  error: (message: string) => `Couldn't load pings: ${message}`,
  failed: (names: string) => `Couldn't load: ${names}. The rest is below.`,
  organizerUnavailable: (message: string) =>
    `Can't check run of show pings right now: ${message}`,

  goingOut: {
    question: "Are pings going out?",
    yes: "Yes",
    no: "No: the bot stopped",
    botOk: (when: string) => `Bot checked in at ${when}`,
    botDown: (when: string) =>
      `Bot last checked in at ${when}. Queued pings still send, but sheet edits aren't syncing.`,
    botNever: "The bot hasn't checked in.",
    fix: 'Fix: on the PC, run  schtasks /run /tn "HW Organizer Reminders"',
    last: (when: string, to: string) => `Last ping: ${when} to ${to}`,
    next: (when: string, to: string) => `Next ping: ${when} to ${to}`,
    noNext: "Nothing else queued.",
    lastHour: (n: number) => `${n} sent in the last hour`,
  },
  reach: {
    question: "Can everyone get them?",
    allYes: (n: number) => `Yes, all ${n} people`,
    some: (bad: number, total: number) => `${bad} of ${total} can't get pings`,
    noContact: "not in the HW13 Contacts sheet",
    noSlack: "Slack has no account for their email",
    fixNoContact:
      "Add them to the HW13 Contacts sheet (or a nickname in NICKNAMES).",
    fixNoSlack:
      "Check their email in the Contacts sheet matches their Slack account.",
  },
  missed: {
    question: "Did anyone miss one?",
    none: "No",
    some: (n: number) => `${n} ${n === 1 ? "ping" : "pings"} missed`,
    person: (name: string, n: number) =>
      `${name}: missed ${n} ${n === 1 ? "ping" : "pings"}`,
    atRisk: (n: number) =>
      `${n} upcoming ${n === 1 ? "ping isn't" : "pings aren't"} queued in Slack yet`,
    atRiskHelp:
      "If the bot is running this clears within a minute. If it stays, that person can't be reached.",
  },
  unpinged: {
    title: (n: number) =>
      `${n} run of show ${n === 1 ? "task pings" : "tasks ping"} nobody`,
    help: "Fix the owner line in the run of show so the right people get these.",
    unknown: (names: string) => `"${names}" isn't an organizer or team name`,
  },
  others: {
    title: "Hackers and sponsors",
    presentation: "Judging times",
    presentationLine: (reached: number, total: number) =>
      `${reached} of ${total} team members reached`,
    presentationNone: "Not sent yet",
    notReached: (names: string) => `Not reached: ${names}`,
    coffee: "Coffee chat invites",
    coffeeLine: (
      sent: number,
      accepted: number,
      waiting: number,
      expired: number,
    ) =>
      `${sent} sent · ${accepted} accepted · ${waiting} waiting · ${expired} expired`,
    coffeeNone: "None sent yet",
    help: "Sponsor help",
    helpLine: (posted: number, open: number) =>
      `${posted} posted · ${open} waiting for someone`,
    helpNone: "No requests yet",
    helpFailed: (n: number) =>
      `${n} ${n === 1 ? "request" : "requests"} didn't post to Slack`,
  },
  people: {
    title: "Everyone with run of show pings",
    name: "Who",
    canGet: "Can get pings",
    received: "Got",
    missed: "Missed",
    upcoming: "Queued",
    next: "Next ping",
    yes: "Yes",
    none: "—",
    notQueued: (n: number) => `(+${n} not queued)`,
  },
  feed: {
    title: "Every ping (detail)",
    help: "Each ping on its own row. Use it to look someone up.",
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
  footnote:
    "Slack can't list messages it already sent, so a run of show ping whose time has passed counts as received when the person has a Slack account. Coffee chat change and cancel DMs and fallback emails aren't recorded.",
  refreshed: (when: string) => `Updated ${when}, refreshes every minute.`,
};
