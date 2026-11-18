/**
 * Copy for run-of-show task reminders (T49): the Slack message at each
 * task's start time (a DM to its owner, or a sponsor team channel post when
 * no one person owns it), and the "Task pings" panel in the organizer
 * Schedule tab's "Task pings" section.
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

  panel: {
    /** Collapsible section on the Schedule tab that holds the panel. */
    sectionTitle: "Task pings",
    intro:
      "Task pings are on: each task's owner gets a Slack DM at its start time; tasks without a clear owner go to the team channel with @here.",
    nextPing: (when: string) => `Next ping: ${when}`,
    noNextPing: "No pings waiting",
    failed: (n: number) => `${n} couldn't be scheduled`,
    noToken: "Slack not connected",
    noChannel: "No team channel set (SPONSOR_HELP_SLACK_CHANNEL)",
    loadError: "Couldn't load task pings.",
    retry: "Try again",
  },
} as const;
