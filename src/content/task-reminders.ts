/**
 * Copy for run-of-show task reminders (T49): the Slack message at each
 * task's start time (a DM to its owner, or a sponsor team channel post when
 * no one person owns it), and the organizer home's Task pings tab.
 */
export const taskRemindersCopy = {
  slack: {
    /** DM: "⏰ Now (7:30 PM): Open doors · Rm 1230" (task text pre-escaped). */
    text: (time: string, task: string, location: string | null) =>
      `⏰ Now (${time}): ${task}${location ? ` · ${location}` : ""}`,
    /**
     * Team channel, for a task with no clear owner (empty, "All", several
     * people) or an owner nobody on Slack matches. `mention` is
     * SPONSOR_HELP_SLACK_MENTION (default @here); the rest arrives escaped.
     */
    channelText: (p: {
      mention: string;
      time: string;
      task: string;
      location: string | null;
      owner: string | null;
    }) =>
      [
        `${p.mention ? `${p.mention} ` : ""}⏰ Now (${p.time}): ${p.task}${p.location ? ` · ${p.location}` : ""}`,
        p.owner
          ? `Owner in the sheet: ${p.owner}. No one person to DM, can someone grab this?`
          : "No owner in the sheet, can someone grab this?",
      ].join("\n"),
  },

  /** The organizer home's Task pings tab (?tab=pings). */
  tab: {
    /** `mention` is the readable channel mention ("@here"), or null. */
    intro: (mention: string | null) =>
      `Task owners get a Slack DM when their task starts. Tasks without a clear owner go to the team channel${mention ? ` with ${mention}` : ""}, and so do sponsors' help requests.`,

    helpHeading: "Sponsor help requests",
    resolvedHeading: "Recently resolved",
    resolvedBy: (name: string) => `resolved, claimed by ${name}`,
    resolved: "resolved",

    upNextHeading: "Up next",
    upNextEmpty: "No task pings waiting.",
    upNextNoSlack: "Slack isn't connected, so no task pings are scheduled.",
    dm: (name: string) => `DM ${name}`,
    channel: (mention: string | null) =>
      mention ? `Team channel (${mention})` : "Team channel",

    logHeading: "Ping log",
    logNote:
      "Slack sends task pings itself at their time, so a task ping here means Slack took it for that time, not that we saw it delivered.",
    logEmpty: "No pings yet.",
    helpWhat: (sponsor: string, reason: string) => `Help: ${sponsor} · ${reason}`,
    rePings: (n: number) => (n === 1 ? "1 re-ping" : `${n} re-pings`),
    status: {
      scheduled: "Handed to Slack",
      failed: (code: string | null) =>
        code ? `Failed (${code})` : "Failed",
      posted: "Posted",
      notPosted: "Not posted to Slack",
    },
    showMore: "Show more",
    loadingMore: "Loading…",

    slackConnected: "Slack connected",
    slackNotConnected: "Slack not connected",
    noChannel: "No team channel set (SPONSOR_HELP_SLACK_CHANNEL)",
    loadError: "Couldn't load task pings.",
    retry: "Try again",
  },
} as const;
