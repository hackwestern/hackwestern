// Copy for Sunday sponsor presentations (docs/flows/sponsor-judging.md):
// the organizer "Sponsor judging" tab's presentations section, the hacker
// panel on /live, and the Slack DM to each team member. Keep wording here,
// not in components.

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "3 min pitch · 2 min Q&A": what one presentation slot holds. */
export const presentationFormat = (pitch: number, qa: number) =>
  `${pitch} min pitch · ${qa} min Q&A`;

export const sponsorPresentationsCopy = {
  /** Organizer, ?tab=judging. */
  organizer: {
    heading: "Presentations",
    intro: (slot: number, perRoom: number, gap: number) =>
      `Each sponsor sends a shortlist of up to ${perRoom} teams. Scheduling gives every shortlisted team a ${slot}-minute slot in that sponsor's room from 10:00, at least ${gap} minutes apart for the same team.`,
    sentLabel: "Shortlists",
    sent: (time: string, n: number) =>
      `Sent ${time} · ${plural(n, "team", "teams")}`,
    notSent: "Not sent",
    noRoom: "No room",
    sentAfterSchedule: "Sent after scheduling",
    schedule: "Schedule presentations",
    reschedule: "Schedule again",
    scheduling: "Scheduling…",
    checking: "Checking…",
    /** `changed`: hackers who have their times and would get new ones. */
    rescheduleConfirm: (changed: number) =>
      changed > 0
        ? `This replaces the current schedule. ${plural(changed, "hacker who already has their times gets", "hackers who already have their times get")} new ones; notify them after.`
        : "This replaces the current schedule. No hacker who already has their times would get new ones.",
    confirm: "Replace schedule",
    cancel: "Cancel",
    nothingSent: "No sponsor has sent a shortlist yet.",
    scheduledAt: (time: string, placed: number) =>
      `Scheduled ${time} · ${plural(placed, "slot", "slots")}`,
    notScheduled: "Not scheduled yet.",
    /** Scheduling ran but placed no team: not a success. */
    nothingPlaced: "Nothing scheduled yet. See why below.",
    notify: "Notify hackers",
    /** Only members who don't have their current times yet. */
    notifyRest: (n: number) => `Notify ${plural(n, "hacker", "hackers")}`,
    notifyAgain: "Notify again",
    resendConfirm: (n: number) =>
      `Send every scheduled hacker their times again? ${plural(n, "hacker already has", "hackers already have")} them.`,
    resendButton: "Send again",
    notifying: "Sending…",
    notified: (
      reached: number,
      members: number,
      emailed: number,
      time: string,
    ) =>
      `${reached}/${members} hackers have their times${emailed > 0 ? ` (${emailed} by email)` : ""} · last sent ${time}`,
    notNotified: "Hackers not notified yet",
    notifyResult: (
      sent: number,
      emailed: number,
      missing: number,
      failed: number,
      skipped: number,
    ) =>
      [
        `Sent ${plural(sent, "DM", "DMs")}.`,
        emailed > 0
          ? `Emailed ${plural(emailed, "member", "members")} not on Slack.`
          : "",
        skipped > 0 ? `${skipped} already had their times.` : "",
        missing > 0
          ? `${plural(missing, "member", "members")} not on Slack with no email.`
          : "",
        failed > 0
          ? `${plural(failed, "message", "messages")} failed; try again.`
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    notOnSlack: (names: string) => `Not on Slack, no email: ${names}`,
    notReached: (n: number) =>
      `${plural(n, "member hasn't", "members haven't")} been reached`,
    notReachedReasons: {
      "not-on-slack": "Not on Slack, no email",
      failed: "Slack DM or email failed",
      "not-sent": "Not sent yet",
    },
    memberOf: (name: string, team: string, reason: string) =>
      `${name} · ${team} · ${reason}`,
    /** Round 2 (sponsors rank the teams that presented), opened by hand. */
    round2: {
      open: "Open round 2",
      close: "Close round 2",
      opening: "Opening…",
      closing: "Closing…",
      openConfirm: (top: number) =>
        `Open round 2 for every sponsor? Sponsors with presentations rank the teams that presented and submit their top ${top}.`,
      closeConfirm: (top: number) =>
        `Close round 2? Sponsors can't submit a top ${top} until you open it again. Rankings already submitted are kept.`,
      openSince: (time: string) => `Round 2 open since ${time}`,
      closed: "Round 2 closed. Open it after presentations.",
    },
    views: { rooms: "By room", teams: "By team", hackers: "By hacker" },
    /** The per-hacker view: every scheduled hacker and how they heard. */
    hackers: {
      filterLabel: "Show",
      all: "All hackers",
      notReached: (n: number) => `Not reached (${n})`,
      sponsorLabel: "Room",
      allSponsors: "All rooms",
      count: (shown: number, total: number) =>
        shown === total
          ? plural(total, "hacker", "hackers")
          : `${shown} of ${plural(total, "hacker", "hackers")}`,
      status: {
        sent: "Slack sent",
        emailed: "Emailed",
        "not-on-slack": "Not on Slack",
        failed: "Failed",
        "not-sent": "Not sent yet",
      },
      /** "Slack sent 10:42 AM" */
      statusAt: (status: string, time: string) => `${status} ${time}`,
      none: "No hackers match.",
      noMembers: "No hackers on this team.",
    },
    viewsLabel: "Schedule view",
    flagged: (n: number) =>
      n === 1
        ? "1 team couldn't be scheduled"
        : `${n} teams couldn't be scheduled`,
    /** Why a team wasn't placed; says where to fix it. */
    reasons: {
      full: (sponsor: string) =>
        `No slot left in ${sponsor}'s room that keeps this team's gaps`,
      "no-room": (sponsor: string) =>
        `${sponsor} has no judging room on Sponsor Day-Of`,
      /** An old send with more teams than the cap: only the first 15 go. */
      "over-cap": (sponsor: string) =>
        `Not scheduled: over 15 on ${sponsor}'s shortlist (only the first 15 present)`,
    },
    roomOf: (sponsor: string, room: string) => `${sponsor} · ${room}`,
    slotCount: (n: number, max: number) => `${n}/${max}`,
    teamSlots: (n: number) => plural(n, "presentation", "presentations"),
    /** Rewrite the "Sponsor Judging" tab of the run-of-show sheet now. */
    syncSheet: "Sync to sheet",
    syncing: "Syncing…",
    synced: (time: string) => `Sponsor Judging tab updated ${time}.`,
    syncDisabled:
      "Sheet writes are off on this server (they only run in production, or with SHEET_WRITES=1), so the Sponsor Judging tab wasn't touched.",
    syncFailed: (error: string) =>
      `Couldn't write the Sponsor Judging tab (${error}). The run-of-show service account needs Editor on the sheet. Judging still works.`,
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
    footer: (pitch: number, qa: number) =>
      `Each presentation is a ${pitch} min pitch and ${qa} min of Q&A. Be at the room a few minutes early. Your times are also on`,
  },

  /** Email to a team member Slack can't find (same times as the DM). */
  email: {
    from: "Hack Western Team <hello@hackwestern.com>",
    subject: (team: string) => `Your sponsor presentation times for ${team}`,
    greeting: (firstName: string) =>
      firstName ? `Hi ${firstName},` : "Hi there,",
    intro: (team: string, pitch: number, qa: number) =>
      `Here are ${team}'s sponsor presentations on Sunday. Each one is a ${pitch} min pitch and ${qa} min of Q&A, so be at the room a few minutes early.`,
    line: (time: string, sponsor: string, room: string) =>
      `${time}: ${sponsor}, ${room}`,
    action: "See your times on your Live page",
    signoff: "The Hack Western 13 Team",
  },

  errors: {
    slackOff:
      "Slack isn't set up on this server (SLACK_BOT_TOKEN is missing), so no messages were sent.",
    noSchedule: "Schedule presentations first.",
    round2NoSchedule:
      "Schedule presentations before opening round 2. No team has a presentation slot yet.",
  },
} as const;
