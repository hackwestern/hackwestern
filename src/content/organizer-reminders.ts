/**
 * Slack DM copy for organizer run-of-show reminders
 * (scripts/organizer-notifications.ts (CLI; logic in src/server/slack/organizer-run.ts)). Inputs are already Slack-escaped.
 */
export const organizerRemindersCopy = {
  slack: {
    /** First line when one task is due (the DM arrives 15 min before the row time). */
    header: (title: string) => `⏰ Coming up: *${title}*`,
    /** First line when several of the person's tasks share a time. */
    headerMany: (count: number) => `⏰ Coming up: ${count} things`,
    /** Each task's title when several are listed. */
    item: (title: string) => `• *${title}*`,
    /** The cell's own "Starts:" time, else its row time. */
    starts: (time: string) => `Starts: ${time}`,
    /** From the cell's height on the run of show; left out when not clear. */
    ends: (time: string) => `Ends: ${time}`,
    /** The other owners of the task. */
    with: (names: string) => `👥 With: ${names}`,
    /** The owner line names a team ("Spon"); names are its other members. */
    withTeams: (teams: string, names: string) =>
      `👥 With: ${teams} team${names ? ` (${names})` : ""}`,
    /** Team channel posts: who on the team owns it. */
    teamLine: (team: string, names: string) => `👥 ${team} team: ${names}`,
    /** The task is for every organizer. */
    everyone: "👥 With: all organizers",
    /** Sheet-check DM to the admin when the problem list changes. */
    problems: {
      header: (count: number) =>
        `🛠️ Run of show check: ${count} ${count === 1 ? "thing" : "things"} to fix so the right people get pinged`,
      noContact: (names: string) =>
        `• No contact for ${names}: no DMs for them. Add them to the HW13 Contacts sheet, or set their full name in NICKNAMES.`,
      noSlack: (names: string) =>
        `• Slack found no account for ${names}'s email: no DMs for them.`,
      skipped: (when: string, title: string, reason: string) =>
        `• ${when} · ${title}: ${reason}, so nobody is pinged.`,
      unknown: (when: string, title: string, names: string) =>
        `• ${when} · ${title}: "${names}" isn't an organizer or team name, so it's ignored.`,
      allClear:
        "✅ Run of show check: every task has an owner the bot recognizes.",
    },
    /** Dead man's switch: delivered only if the watcher stops checking in. */
    heartbeat: (lastSync: string) =>
      `⚠️ The organizer reminder bot on your PC hasn't checked in since ${lastSync}. Queued reminders still go out, but Run of Show edits aren't syncing. Check the PC (Tailscale), or run: schtasks /run /tn "HW Organizer Reminders"`,
    /** Prefix on test DMs (--send-test and test mode). */
    test: (name: string, when: string) => `[TEST for ${name} · ${when}]`,
  },
};
