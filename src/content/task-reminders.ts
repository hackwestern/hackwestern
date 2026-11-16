/**
 * Copy for run-of-show task reminders (T49): the Slack message at each
 * task's start time (a DM to its owner, or a sponsor team channel post when
 * nobody owns it on Slack), and the "Slack reminders" panel on the organizer
 * Team tasks tab.
 */
export const taskRemindersCopy = {
  slack: {
    /** DM: "⏰ Now (7:30 PM): Open doors · Rm 1230" (task text pre-escaped). */
    text: (time: string, task: string, location: string | null) =>
      `⏰ Now (${time}): ${task}${location ? ` · ${location}` : ""}`,
    /** Team channel, for a task with no owner on Slack. */
    channelText: (time: string, task: string) =>
      `⏰ Now (${time}): ${task} · no owner yet, can someone grab this?`,
  },

  panel: {
    heading: "Slack reminders",
    intro:
      "At each task's start time its owner gets a Slack DM. Tasks with no owner on Slack go to the sponsor team channel. Reminders follow the sheet: change a task there and its reminder moves too.",
    lastSynced: (ago: string) => `Last synced ${ago}`,
    neverSynced: "Not synced yet",
    agoJustNow: "just now",
    agoMinutes: (minutes: number) => `${minutes} min ago`,
    agoHours: (hours: number) => `${hours} h ago`,
    scheduled: (n: number) => `${n} scheduled`,
    toChannel: (n: number) => `${n} sent to channel (no owner)`,
    notOnSlack: (n: number) =>
      `${n} ${n === 1 ? "owner" : "owners"} not on Slack`,
    tooSoon: (n: number) => `${n} too soon to schedule`,
    failed: (n: number) => `${n} failed`,
    noToken: "Slack isn't connected (SLACK_BOT_TOKEN is not set), so no reminders are sent.",
    noChannel: (n: number) =>
      `No team channel is set (SPONSOR_HELP_SLACK_CHANNEL), so ${n} ${n === 1 ? "task" : "tasks"} with no owner on Slack won't be posted.`,
    sheetError: "Couldn't read the run-of-show sheet just now.",
    resync: "Re-sync reminders",
    resyncing: "Syncing…",
    resyncDone: (scheduled: number, cancelled: number) =>
      `Synced. ${scheduled} scheduled, ${cancelled} cancelled.`,
    resyncNoToken: "Slack isn't connected (SLACK_BOT_TOKEN is not set).",
    resyncError: "Couldn't sync reminders. Try again.",
    loadError: "Couldn't load reminder status.",
    retry: "Try again",

    ownersHeading: "Owners on Slack",
    ownersIntro:
      "Match each owner name from the sheet to the email they use on Slack. Unmatched owners' tasks go to the team channel.",
    ownersEmpty: "No owners in the sheet yet.",
    ownerColumn: "Owner",
    emailColumn: "Slack email",
    matchColumn: "Slack",
    emailLabel: (owner: string) => `Slack email for ${owner}`,
    emailPlaceholder: "name@hackwestern.com",
    save: "Save",
    saveFor: (owner: string) => `Save Slack email for ${owner}`,
    saved: "Saved",
    saveError: "Couldn't save. Check the email.",
    matched: "Matched",
    notFound: "Not found",
    noEmail: "No email",
    notChecked: "Not checked",
    taskCount: (n: number) => `${n} ${n === 1 ? "task" : "tasks"}`,

    unmatchedHeading: "Owners not on Slack",
    unmatchedIntro:
      "Their tasks go to the team channel until an email matches.",
    noOwnerHeading: "Sent to channel (no owner)",
    noOwnerIntro:
      "These tasks have no owner in the sheet, so the team channel gets the reminder.",
    failuresHeading: "Failed reminders",
  },
} as const;
