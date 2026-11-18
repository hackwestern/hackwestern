// Copy for Sunday sponsor presentations (docs/flows/sponsor-judging.md):
// the organizer "Sponsor judging" tab's presentations section, the hacker
// panel on /live, and the Slack DM to each team member. Keep wording here,
// not in components.

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const sponsorPresentationsCopy = {
  /** Organizer, ?tab=judging. */
  organizer: {
    heading: "Presentations",
    intro:
      "Each sponsor sends a shortlist. Scheduling gives every shortlisted team a 5 minute slot in that sponsor's room from 10:00, at least 10 minutes apart for the same team.",
    sentLabel: "Shortlists",
    sent: (time: string, n: number) =>
      `Sent ${time} · ${plural(n, "team", "teams")}`,
    notSent: "Not sent",
    noRoom: "No room",
    sentAfterSchedule: "Sent after scheduling",
    schedule: "Schedule presentations",
    reschedule: "Schedule again",
    scheduling: "Scheduling…",
    rescheduleConfirm:
      "This replaces the current schedule. Hackers already notified keep their old times until you notify them again.",
    confirm: "Replace schedule",
    cancel: "Cancel",
    nothingSent: "No sponsor has sent a shortlist yet.",
    scheduledAt: (time: string, placed: number) =>
      `Scheduled ${time} · ${plural(placed, "slot", "slots")}`,
    notScheduled: "Not scheduled yet.",
    notify: "Notify hackers",
    notifyAgain: "Notify again",
    notifying: "Sending…",
    notifiedAt: (time: string) => `Hackers notified ${time}`,
    notNotified: "Hackers not notified yet",
    notifyResult: (sent: number, missing: number, failed: number) =>
      [
        `Sent ${plural(sent, "DM", "DMs")}.`,
        missing > 0
          ? `${plural(missing, "member", "members")} not on Slack.`
          : "",
        failed > 0 ? `${plural(failed, "DM", "DMs")} failed; try again.` : "",
      ]
        .filter(Boolean)
        .join(" "),
    notOnSlack: (names: string) => `Not on Slack: ${names}`,
    views: { rooms: "By room", teams: "By team" },
    viewsLabel: "Schedule view",
    flagged: (n: number) =>
      n === 1
        ? "1 team couldn't be scheduled"
        : `${n} teams couldn't be scheduled`,
    reasons: {
      full: "No slot left that keeps this team's gaps",
      "no-room": "Sponsor has no room",
    },
    roomOf: (sponsor: string, room: string) => `${sponsor} · ${room}`,
    slotCount: (n: number, max: number) => `${n}/${max}`,
    teamSlots: (n: number) => plural(n, "presentation", "presentations"),
    cheatHeading: "Cheat check",
    cheatIntro: (top: number, n: number) =>
      `${plural(n, "team is", "teams are")} in a sponsor's top ${top}.`,
    cheatNone: (top: number) => `No sponsor has submitted a top ${top} yet.`,
    cheatRun: "Run checks",
    cheatRunning: "Running…",
    cheatDone: (n: number, failed: number) =>
      failed > 0
        ? `Checked ${plural(n, "team", "teams")}; ${failed} had errors.`
        : `Checked ${plural(n, "team", "teams")}.`,
    cheatOpen: "Open in cheat check",
    failed: "Something went wrong. Try again.",
  },

  /** Cheat check page, when opened from the judging tab. */
  cheatCheckFilter: {
    showing: (n: number) =>
      `Showing ${plural(n, "sponsor top team", "sponsor top teams")}.`,
    missing: (n: number) =>
      `${plural(n, "team has", "teams have")} no results yet.`,
    showAll: "Show all teams",
  },

  /** Hacker, /live home. */
  live: {
    heading: "Sponsor presentations",
    intro: "Sunday. Be at each room a few minutes early.",
    slot: (time: string, sponsor: string, room: string) =>
      `${time} · ${sponsor} · ${room}`,
  },

  /** Slack DM to each team member. */
  slack: {
    text: (team: string) => `Your sponsor presentations for ${team}`,
    heading: (team: string) =>
      `*Your sponsor presentations on Sunday* (${team})`,
    line: (time: string, sponsor: string, room: string) =>
      `• ${time}: ${sponsor}, ${room}`,
    footer:
      "Each presentation is 5 minutes. Be at the room a few minutes early. Your times are also on",
  },

  errors: {
    slackOff:
      "Slack isn't set up on this server (SLACK_BOT_TOKEN is missing), so no messages were sent.",
    noSchedule: "Schedule presentations first.",
  },
} as const;
