// Copy for sponsor judging: the sponsor's Judging page
// (/sponsors/[uuid]/picks: browse and score projects, shortlist, submit a
// ranked top list) and the organizer "Sponsor judging" tab. Keep wording
// here, not in components.

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

export const sponsorJudgingCopy = {
  seoTitle: "Judging",
  brand: "Hack Western 13",
  back: "Back to sponsor hub",
  title: "Judging",
  intro: (top: number) =>
    `Look through the projects, score each one out of 10 and save the strongest to your shortlist. Then rank your shortlist and submit your top ${top}.`,
  trackTag: (track: string) => `Showing teams in ${track}`,
  invalid: {
    title: "Link not recognised",
    body: "This private link isn't valid. Ask your Hack Western contact for a new one.",
  },
  loadFailed: "Couldn't load the projects.",
  /** A sponsor without a prize track (src/content/sponsor-prize-tracks.ts). */
  noPrizeTrack: {
    title: "No prize track",
    body: "Judging is only for sponsors with a prize track, and yours doesn't have one this year. If that's wrong, tell your Hack Western contact.",
  },
  retry: "Try again",

  steps: {
    label: "Judging steps",
    browse: "Browse projects",
    shortlist: "Your shortlist",
  },

  browse: {
    searchLabel: "Search teams",
    searchPlaceholder: "Search teams, members or tracks",
    clearSearch: "Clear search",
    filterLabel: "Show",
    filters: {
      all: "All",
      scored: "Scored",
      shortlisted: "Shortlisted",
      unreviewed: "Not reviewed",
    },
    sortLabel: "Sort by",
    sorts: { name: "Name", score: "Score" },
    count: (shown: number, total: number) =>
      shown === total
        ? plural(total, "project", "projects")
        : `${shown} of ${plural(total, "project", "projects")}`,
    noMatch: (query: string) => `No teams match "${query}".`,
    noFilterMatch: "No projects here yet.",
    noTeams: (track: string | null) =>
      track
        ? `No submitted teams in ${track} yet.`
        : "No teams have submitted yet.",
    noMembers: "No members listed",
    devpost: "Devpost",
    github: "GitHub",
    openOn: (team: string, site: string) => `Open ${team} on ${site}`,
  },

  score: {
    label: (team: string) => `Score for ${team}, out of 10`,
    heading: "Score",
    outOf: "/10",
    clear: "Clear",
    clearLabel: (team: string) => `Clear score for ${team}`,
  },

  shortlistToggle: {
    add: "Save to shortlist",
    added: "Shortlisted",
    label: (team: string) => `Save ${team} to your shortlist`,
  },

  note: {
    add: "Add a note",
    edit: "Note",
    label: (team: string) => `Private note on ${team}`,
    placeholder: "Only you and Hack Western organizers see this",
    left: (n: number) => `${n} left`,
  },

  saving: "Saving…",
  saved: "Saved",
  saveFailed: "Couldn't save. Check your connection and try again.",

  shortlist: {
    heading: "Rank your shortlist",
    intro: (top: number) =>
      `Put your favourite first. The first ${top} are the teams you submit.`,
    empty: "Your shortlist is empty. Save projects to it while you browse.",
    browse: "Browse projects",
    needMore: (top: number, have: number) =>
      `Shortlist ${plural(top - have, "more team", "more teams")} to submit your top ${top}.`,
    cutLine: (top: number) => `Your top ${top}`,
    belowLine: "Not submitted",
    moveUp: (team: string) => `Move ${team} up`,
    moveDown: (team: string) => `Move ${team} down`,
    rank: (n: number) => `#${n}`,
    noScore: "No score",
    scoreOf: (n: number) => `${n}/10`,
    remove: (team: string) => `Remove ${team} from your shortlist`,
    keyboardHint: "Use the arrow buttons to reorder.",
    moved: (team: string, rank: number) => `${team} moved to number ${rank}.`,
  },

  submit: {
    button: (top: number) => `Submit top ${top}`,
    resubmit: (top: number) => `Resubmit top ${top}`,
    confirmTitle: (top: number) => `Submit these ${top}?`,
    confirmBody:
      "Hack Western uses this ranking for your prize. You can change it and resubmit while judging is open.",
    confirm: "Confirm and submit",
    cancel: "Go back",
    submitting: "Submitting…",
    submittedAt: (time: string) => `Submitted ${time}`,
    changed: "Your ranking has changed since you submitted.",
    teamGone: (n: number) =>
      n === 1
        ? "A team you submitted can no longer be judged. Rank a replacement and resubmit."
        : `${n} teams you submitted can no longer be judged. Rank replacements and resubmit.`,
    sheetPending:
      "Saved, but the judging sheet didn't update. Submit again to retry, or tell your Hack Western contact.",
    failed: "Couldn't submit. Check your connection and try again.",
    closed: "Judging has closed. Your last submission stands.",
  },

  /** Round 1 ends with Send shortlist; round 2 ranks teams that presented. */
  round: {
    sendHeading: "Your shortlist",
    sendIntro:
      "When you're happy with it, send it to us. We'll schedule each team to present in your room from 10:00.",
    send: "Send shortlist",
    resend: "Send again",
    sending: "Sending…",
    sentAt: (time: string, n: number) =>
      `Sent ${time} · ${plural(n, "team", "teams")}`,
    changed: "Your shortlist has changed since you sent it.",
    changedAfterSchedule:
      "Your shortlist has changed since presentations were scheduled. Tell your Hack Western contact if a team should be added.",
    sendFailed: "Couldn't send. Check your connection and try again.",
    waiting:
      "Round 2 opens here after presentations: you'll rank your top teams from the ones that presented.",
    /** Round 2 is open but this sponsor has no presentation slot. */
    locked:
      "Round 2 is locked for you: no teams presented to you, so there's nobody to rank. Send your shortlist if you haven't, then ask your Hack Western contact to schedule presentations again.",
    presentedHeading: "Rank the teams that presented",
    presentedIntro: (top: number) =>
      `Put your favourite first. The first ${top} are the teams you submit.`,
    noPresenters:
      "No teams are scheduled to present to you. Ask your Hack Western contact.",
    presentsAt: (time: string) => `Presents ${time}`,
  },

  errors: {
    unknownSponsor: "Unknown sponsor link",
    emptyShortlist: "Shortlist at least one team before sending.",
    notEligible: "That team isn't one you can judge.",
    trackUnavailable: "Couldn't load your prize track. Try again in a minute.",
    closed: "Judging has closed.",
    round2Closed: "Round 2 isn't open yet. It opens after presentations.",
    noPrizeTrack: "Judging is only for sponsors with a prize track.",
    noSlot:
      "Round 2 is locked: no teams presented to you, so you can't rank a top 5.",
    ranking: {
      wrongCount: (top: number) => `Submit exactly ${top} teams.`,
      duplicate: () => "Each team can appear only once.",
      notShortlisted: () => "Only teams on your shortlist can be submitted.",
      notPresented: () => "Only teams that presented to you can be submitted.",
      closed: () => "Judging has closed.",
    },
  },

  /**
   * The "Sponsor Judging" tab the app writes in the run-of-show sheet
   * (sponsor-judging-sheet-mirror.ts). Rewritten in full on every change.
   */
  sheet: {
    tab: "Sponsor Judging",
    note: "Written by the Hack Western app from its database. Edits here are overwritten on the next change.",
    updated: (time: string) => `Updated ${time}`,
    tracks: {
      title: "Tracks",
      headers: [
        "Sponsor",
        "Has track",
        "Judging room",
        "Round 1 shortlist sent",
        "Round 2 top 5 sent",
      ],
      yes: "Yes",
    },
    schedule: {
      title: "Chosen teams and presentation schedule",
      headers: [
        "Sponsor",
        "Round",
        "Team",
        "Members",
        "Time",
        "Room",
        "Notified",
      ],
      round1: "Round 1",
      notified: { slack: "Slack", email: "Email", failed: "failed" },
    },
    finals: {
      title: "Final results",
      headers: ["Sponsor", "Rank", "Team", "Members"],
    },
  },

  /** The organizer "Sponsor judging" tab on /internal/sponsors. */
  organizer: {
    viewsLabel: "Sponsor judging view",
    views: { sponsors: "Final results", teams: "All teams" },
    /** Rank badge on a submitted top list: "1st", "2nd"... */
    rankOf: (n: number) =>
      `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`,
    noMembers: "No hackers listed",
    intro: (top: number) =>
      `Each sponsor scores projects, shortlists some and submits a ranked top ${top}.`,
    submittedAt: (time: string) => `Submitted ${time}`,
    notYet: "Not submitted yet",
    sheetPending: "Sheet not updated",
    unsynced: (n: number) =>
      n === 1
        ? "1 sponsor's ranking isn't in the judging sheet yet. It retries when they open Judging again, or they can resubmit."
        : `${n} sponsors' rankings aren't in the judging sheet yet. Each retries when that sponsor opens Judging again, or they can resubmit.`,
    ineligible: "No longer eligible",
    scored: (n: number) => plural(n, "scored", "scored"),
    shortlisted: (n: number) => plural(n, "shortlisted", "shortlisted"),
    noScore: "No score",
    scoreOf: (n: number) => `${n}/10`,
    devpost: "Devpost",
    openDevpost: (team: string) => `Open ${team} on Devpost`,
    noSponsors: "No sponsors have a private link yet.",
    noTeams: "No sponsor has scored or submitted a team yet.",
    loadFailed: "Couldn't load sponsor judging.",
    retry: "Try again",
    columns: {
      rank: "#",
      team: "Team",
      inTop: (top: number) => `In a top ${top}`,
      sponsors: "Sponsors",
      average: "Avg score",
      links: "Links",
    },
    inTopCount: (n: number) => plural(n, "sponsor", "sponsors"),
    averageOf: (avg: string, n: number) =>
      `${avg} from ${plural(n, "score", "scores")}`,
    noAverage: "—",
  },
} as const;
