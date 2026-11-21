/** Copy for the organizer Ping Logs page (/internal/ping-logs). */
export const pingLogsCopy = {
  seoTitle: "Ping Logs",
  title: "Ping Logs",
  subtitle:
    "Who got pinged, what's going out next, and what didn't send. Run of show reminders from P.O.N.Y, mentor, volunteer and judge DMs, coffee chats, judging times and sponsor help.",
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
  hackers: {
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
    title: (n: number) => `By person (${n})`,
    help: "Everyone with run of show pings. Tap a name to see their pings.",
    cantGet: (why: string) => `Can't get pings: ${why}`,
    got: (n: number) => `${n} got`,
    missed: (n: number) => `${n} missed`,
    queued: (n: number) => `${n} queued`,
    notQueued: (n: number) => `${n} not queued`,
    next: (when: string) => `next ${when}`,
    see: (name: string) => `See pings for ${name}`,
  },
  feed: {
    title: "Pings",
    showing: (shown: number, total: number) =>
      shown === total
        ? `${total} ${total === 1 ? "ping" : "pings"}`
        : `Showing ${shown} of ${total}`,
    more: (n: number) => `Show ${n} more`,
    reset: "Clear search and filters",
    empty: "No pings here.",
    emptyFocus: "Nothing coming up and no problems in the last 6 hours.",
    elsewhere: (n: number) =>
      `${n} ${n === 1 ? "match" : "matches"} in All. Show ${n === 1 ? "it" : "them"}`,
    seeProblems: "See them in the list",
  },
  search: {
    label: "Search by person or task",
    placeholder: "Name, team channel or task",
    clear: "Clear search",
  },
  views: {
    label: "Show",
    focus: "Up next and problems",
    problem: "Problems",
    upcoming: "Upcoming",
    sent: "Sent",
    all: "All",
  },
  sources: {
    label: "From",
    all: "Everything",
    organizer: "Run of show DMs",
    team: "Team channels",
    mentor: "Mentors",
    volunteer: "Volunteers",
    judge: "Judges",
    coffee: "Coffee chats",
    presentation: "Judging times",
    help: "Sponsor help",
    task: "Task reminders",
    marketing: "Marketing",
  },
  /** Names for a whole feed, used when one couldn't load. */
  kinds: {
    organizer: "Run of show",
    autoPing: "Auto-Ping (mentors, volunteers, judges)",
    coffee: "Coffee chats",
    presentation: "Judging times",
    help: "Sponsor help",
    task: "Task reminders",
    marketing: "Marketing",
  },
  sections: {
    problem: "Problems",
    upcoming: "Coming up",
    sent: "Sent",
    off: "Cancelled",
  },
  sort: {
    label: "Sort by",
    by: (label: string) => `Sort by ${label}`,
    default: "Problems, then soonest",
    "time:desc": "Time, latest first",
    "time:asc": "Time, earliest first",
    "to:asc": "Person, A to Z",
    "to:desc": "Person, Z to A",
    "status:asc": "Status, problems first",
    "status:desc": "Status, problems last",
  },
  table: {
    time: "When",
    to: "To",
    what: "About",
    status: "Status",
  },
  relative: {
    now: "now",
    ahead: (minutes: number) => `in ${minutes} min`,
    ago: (minutes: number) => `${minutes} min ago`,
  },
  row: {
    toggleMessage: "Show or hide the full message",
    waitingOn: (fillIn: string) =>
      `Waiting on ${fillIn} on the Auto-Ping sheet's Messages tab.`,
  },
  status: {
    "organizer.queued": "Queued in Slack",
    "organizer.notQueued": "Not queued",
    "organizer.sent": "Sent",
    "organizer.missed.noContact": "Missed · not in Contacts",
    "organizer.missed.noSlack": "Missed · no Slack account",
    "organizer.unreachable.noContact": "Can't send · not in Contacts",
    "organizer.unreachable.noSlack": "Can't send · no Slack account",
    "autoPing.scheduled": "Queued in Slack",
    "autoPing.sent": "Sent",
    "autoPing.cancelled": "Cancelled",
    "autoPing.held": "Held · a fill-in is blank",
    "autoPing.not-on-slack": "Not on Slack",
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
    "Mentor, volunteer and judge rows come from the Auto-Ping sheet's Queue tab. Slack can't list messages it already sent, so a run of show ping whose time has passed counts as received when the person has a Slack account. Coffee chat change and cancel DMs and fallback emails aren't recorded.",
  refreshed: (when: string) => `Updated ${when}, refreshes every minute.`,
};
