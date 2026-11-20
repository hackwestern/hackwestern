/**
 * Slack DM copy for organizer run-of-show reminders
 * (scripts/organizer-notifications.ts). Inputs are already Slack-escaped.
 */
export const organizerRemindersCopy = {
  slack: {
    /** First line when one task is due. */
    header: (lead: number, time: string, title: string) =>
      `⏰ In ${lead} min (${time}): *${title}*`,
    /** First line when several of the person's tasks share a time. */
    headerMany: (lead: number, time: string, count: number) =>
      `⏰ In ${lead} min (${time}): ${count} things`,
    /** Each task's title when several are listed. */
    item: (title: string) => `• *${title}*`,
    /** The other owners of the task. */
    with: (names: string) => `👥 With: ${names}`,
    /** The owner line names a team ("Spon"); names are its other members. */
    withTeams: (teams: string, names: string) =>
      `👥 With: ${teams} team${names ? ` (${names})` : ""}`,
    /** Team channel posts: who on the team owns it. */
    teamLine: (team: string, names: string) => `👥 ${team} team: ${names}`,
    /** The task is for every organizer. */
    everyone: "👥 With: all organizers",
    /** The person's next task after this one. */
    next: (when: string, title: string) =>
      `➡️ Next for you: ${when} · ${title}`,
    /** Nothing after this one. */
    last: "➡️ That's your last task on the run of show 🎉",
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
    /** Prefix on test DMs (--send-test and test mode). */
    test: (name: string, when: string) => `[TEST for ${name} · ${when}]`,
  },
};
