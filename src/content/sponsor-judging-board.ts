// Copy for the organizer Judging board (mock organizer-judging-board-v2,
// approved with changes by Jazz on 2026-11-19; docs/decisions.md).

/**
 * The three Sunday judging rooms (run of show). "Other…" covers a 4th
 * sponsor with a typed room.
 */
export const JUDGING_ROOMS = ["Rm 2230", "Rm 2235", "Rm 2110"] as const;

export const sponsorJudgingBoardCopy = {
  intro: (start: string, end: string) =>
    `Sunday · Round 1 presentations ${start}–${end}`,
  loadFailed: "Couldn't load the judging board.",
  retry: "Try again",

  todo: {
    heading: "To do",
    open: (n: number) => `${n} open`,
    none: "Nothing to do right now.",
    allNotified: (time: string) => `All teams notified · ${time}`,
    /** "Sun Life's shortlist isn't in" */
    problem: {
      shortlist: (sponsor: string) => `${sponsor}'s shortlist isn't in`,
      noScores: (sponsor: string) => `${sponsor} has no scores yet`,
      top5: (sponsor: string, top: number) =>
        `${sponsor}'s top ${top} isn't in`,
    },
    textLead: (name: string) => `Text ${name} (lead)`,
    noLead: "No lead's phone on file",
    needsRoom: (sponsor: string) => `${sponsor} needs a room`,
    notifyButton: "Notify teams",
    /** Next to the disabled button until every sponsor has a room. */
    roomsFirst: (n: number) =>
      `Give every sponsor a room first (${n} to go).`,
    notifying: "Notifying…",
    /** Asked before notifying (Jazz, 2026-11-20). */
    notifyConfirm: {
      heading: "Notify teams?",
      body: "This action can't be undone. Every single team will be notified.",
      ok: "Notify teams",
      cancel: "Cancel",
    },
    notifyResult: (sent: number, emailed: number) =>
      emailed > 0
        ? `Sent ${sent} on Slack, emailed ${emailed}.`
        : `Sent ${sent} on Slack.`,
    notifyFailed: "Couldn't notify teams. Try again.",
    digitalTop5: (sponsor: string, top: number) =>
      `Enter ${sponsor}'s top ${top}`,
  },

  sponsors: {
    heading: "Sponsors",
    shortlistsIn: (n: number, of: number) => `${n} of ${of} shortlists in`,
    expand: (sponsor: string) => `Show ${sponsor}'s details`,
    collapse: (sponsor: string) => `Hide ${sponsor}'s details`,
    line: {
      teams: (teams: number, reps: number) =>
        `${teams} ${teams === 1 ? "team" : "teams"} · ${reps} ${reps === 1 ? "rep" : "reps"} judging`,
      scored: (scored: number, teams: number) =>
        `${scored} of ${teams} scored`,
      topIn: (top: number) => `Top ${top} in`,
      shortlistMissing: "Shortlist isn't in",
      missedRound1: "No shortlist: missed round 1",
      noScores: "No scores yet",
      topLate: (top: number) => `Top ${top} late`,
    },
    headRep: "Lead",
    reps: "Reps",
    noReps: "No reps listed yet.",
    remote: "Remote (judges online)",
    digitalHeading: "Digital",
    digitalIntro: (top: number, due: string) =>
      `Judges on Devpost. Organizers enter its top ${top}. Top ${top} due ${due}.`,
    enterTop: (top: number) => `Enter top ${top}`,
    hideTop: "Close",
    topEntered: (top: number, time: string) => `Top ${top} entered ${time}`,
  },

  room: {
    label: (sponsor: string) => `${sponsor}'s judging room`,
    /** Two sponsors can't share a room: the second is refused. */
    takenError: (room: string, sponsor: string) =>
      `${room} is ${sponsor}'s. Pick another.`,
    failed: "Couldn't change the room. Try again.",
  },

  phone: {
    copy: (name: string) => `Copy ${name}'s phone number`,
    copied: "Copied",
  },

  rooms: {
    heading: "Rooms",
    views: { calendar: "Calendar", schedule: "Schedule" },
    viewsLabel: "Rooms view",
    empty: "No presentations yet. Teams show here as shortlists come in.",
    tableLabel: "Presentations by time and room",
    time: "Time",
    twoSponsors: (n: number) => `${n} sponsors`,
    legend: {
      twoSponsors: "On 2+ shortlists, always 10+ min apart",
    },
    roomTeams: (n: number) => `${n} ${n === 1 ? "team" : "teams"}`,
    /** A sponsor's column header: type its room right there. */
    roomPlaceholder: "Rm ____",
    /**
     * Slots after the window's end still show (Jazz, 2026-11-20: "I want
     * to be able to see everything").
     */
    pastEnd: (end: string) => `Runs past ${end}`,
    overBy: (n: number, end: string, last: string, minutes: number) =>
      `${n} ${n === 1 ? "presentation runs" : "presentations run"} past ${end}. The last ends at ${last}, ${minutes} min over.`,
    /** Only if even the overflow slots can't fit a team (very rare). */
    unplaced: (names: readonly string[]) =>
      `No time yet for ${names.length === 1 ? "this team" : "these teams"}: ${names.join(", ")}.`,
  },

  status: {
    /** Before Notify teams: shown as a plain cell, no chip (2026-11-20). */
    "not-sent": "Not notified yet",
    waiting: "Waiting",
    accepted: "Accepted",
  },

  team: {
    close: "Close",
    devpost: (team: string) => `${team} on Devpost`,
    github: (team: string) => `${team} on GitHub`,
    /**
     * Check-in, not the team accepting its times (that's the status pill).
     * One member checked in is enough (Jazz, 2026-11-20).
     */
    teamCheckedIn: "Checked in",
    noneConfirmed: "No one from this team has checked in",
    presentsTo: "Presents to",
    slot: (time: string, room: string) => `${time} · ${room}`,
    apart: (minutes: number) => `${minutes} min apart`,
    members: "Members",
    noMembers: "No members on this team.",
    checkedIn: "Checked in",
    notCheckedIn: "Not checked in",
    year: (year: string) => `${year} year`,
    links: {
      linkedin: (name: string) => `${name} on LinkedIn`,
      github: (name: string) => `${name} on GitHub`,
      resume: (name: string) => `${name}'s résumé`,
      website: (name: string) => `${name}'s website`,
    },
    loading: "Loading team…",
    failed: "Couldn't load this team.",
  },

  after: {
    heading: "After presentations",
  },
} as const;
