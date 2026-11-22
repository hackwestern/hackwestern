// Copy for sponsor judging: the sponsor's Judging page
// (/sponsors/[uuid]/picks: browse and score projects, shortlist, submit a
// ranked top list) and the organizer "Sponsor judging" tab. Keep wording
// here, not in components. Sponsors see one wording (Jazz, 2026-11-20):
// the teams they pick are "finalists", the list they submit once is the
// "final shortlist".

import { minPicks } from "~/lib/sponsor-scoring";

const plural = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** "1st", "2nd", "3rd", "4th"... */
const ordinal = (n: number) =>
  `${n}${n % 10 === 1 && n % 100 !== 11 ? "st" : n % 10 === 2 && n % 100 !== 12 ? "nd" : n % 10 === 3 && n % 100 !== 13 ? "rd" : "th"}`;

/** "Dana W." -> "Dana": first word of a rep's name, for short labels. */
const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? name;

export const sponsorJudgingCopy = {
  seoTitle: "Judging",
  brand: "Hack Western 13",
  back: "Back to sponsor hub",
  title: "Judging",
  /** Jazz's exact line (2026-11-20). */
  intro: "Select the teams that you want to hear present!",
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
  noTeamsCurrently: "No teams currently",

  steps: {
    label: "Judging steps",
    browse: "Browse",
    shortlist: "Submit final shortlist",
    presentations: "Presentations",
    top: "Final picks",
    round1: "Round 1",
    round2: "Round 2",
    lockedRound1: "Available during Round 1",
    lockedRound2: "Available after Round 2 opens",
    round1Complete: "Round 1 complete",
    round1Stage: "Round 1 · Final shortlist",
    round2Stage: "Round 2 · Live judging",
  },

  browse: {
    searchLabel: "Search teams",
    searchPlaceholder: "Search teams, members or tracks",
    clearSearch: "Clear search",
    filterLabel: "Show",
    filters: {
      all: "All",
      scored: "Scored",
      shortlisted: "Finalists",
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
    label: (team: string) => `Your score for ${team}, out of 10`,
    heading: "Your score",
    outOf: "/10",
    unscored: "–",
    notScored: "Not scored yet",
    valueText: (score: string) => `${score} out of 10`,
    lower: (team: string) => `Lower your score for ${team} by 0.5`,
    raise: (team: string) => `Raise your score for ${team} by 0.5`,
    low: "1 weak",
    hint: "Scroll, tap or use ← →",
    high: "10 best",
    clear: "Clear",
    clearLabel: (team: string) => `Clear your score for ${team}`,
    rubric: "Rubric",
    rubricLabel: (team: string) => `Open the rubric for ${team}`,
  },

  /** Holia's rubric (newest criteria, c7e6c2e1), shown in a modal. */
  rubric: {
    title: "Rubric",
    intro:
      "Optional. Use it to calibrate one overall score from 1 to 10. Hack Western's judges use the same four criteria.",
    close: "Close rubric",
    bands: { low: "1-3", mid: "4-7", high: "8-10" },
    criteria: [
      {
        name: "Innovation + Impact",
        description:
          "How original is the idea, and how much would it matter to the people it's built for?",
        low: "Seen it many times",
        mid: "Fresh angle on a known problem",
        high: "New and clearly useful",
      },
      {
        name: "Creativity",
        description:
          "How inventive is the approach? Does it use technology or ideas in an unexpected way?",
        low: "Standard approach, expected tools",
        mid: "One clever twist",
        high: "Surprising use of tech or ideas",
      },
      {
        name: "Technical Complexity",
        description:
          "How technically challenging is the project? Did the team push the boundaries with complex algorithms, integrations, or hardware?",
        low: "Mostly slides",
        mid: "Core feature works live",
        high: "Hard problem, works end to end",
      },
      {
        name: "Design/Polish",
        description:
          "How user-friendly, visually appealing and finished does the project feel?",
        low: "Hard to follow",
        mid: "Clear enough to use",
        high: "Polished and intuitive",
      },
    ],
  },

  /** Several reps share one sponsor login. */
  judge: {
    pickTitle: "Who's judging?",
    pickBody:
      "Select your name from the sponsor's coffee-chat reps. Your team sees everyone's scores. This phone remembers your selection.",
    pickLabel: "Coffee-chat rep",
    onTeam: "On your team",
    someoneElse: "Someone else",
    nameLabel: "Your name",
    namePlaceholder: "First name and last initial",
    start: "Start judging",
    judgingAs: "Judging as",
    with: (others: readonly string[]) =>
      others.length > 0 ? `with ${others.map(firstName).join(", ")}` : "",
    switch: "Switch",
    switchLabel: "Switch who's judging on this phone",
  },

  /** One at a time or a list, like hacker judging (no other modes). */
  view: {
    label: "How to go through projects",
    one: "One at a time",
    list: "List",
  },

  scope: {
    label: "Which projects",
    mine: (n: number) => `Your ${n}`,
    all: (n: number) => `Everyone's ${n}`,
    owner: (name: string) => `${firstName(name)}'s list`,
    split: (n: number) =>
      `The projects are split evenly between ${plural(n, "rep", "reps")}. Anyone can still score any project.`,
  },

  one: {
    position: (at: number, total: number) => `${at} of ${total}`,
    progress: (scored: number, total: number) =>
      `${scored} of ${total} scored by you`,
    previous: "Previous project",
    next: "Next project",
    /** Saving a score moves on by itself (Jazz, 2026-11-20). */
    autoNext: "Score a project and the next unscored one opens.",
    done: (total: number) =>
      `You've scored all ${plural(total, "project", "projects")} here.`,
  },

  team: {
    none: "No scores from your team yet",
    average: (avg: string) => `avg ${avg}`,
    scoreOf: (name: string, score: string) => `${firstName(name)} ${score}`,
    label: "Your team's scores",
    disagree: (high: string, low: string) =>
      `${high} · ${low}: talk it through`,
  },

  shortlistToggle: {
    add: "Save as finalist",
    /** Pressed: tap again to remove. */
    added: "Finalist",
    remove: "Remove finalist",
    label: (team: string) => `Save ${team} as a finalist`,
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
    heading: "Rank your finalists",
    intro: (top: number) =>
      `Put your favourite first. The first ${top} are the teams you submit.`,
    empty:
      "No finalists yet. Tap Save as finalist on the projects you want to hear present.",
    browse: "Browse projects",
    needMore: (top: number, have: number) =>
      `Save ${plural(top - have, "more finalist", "more finalists")} to submit your top ${top}.`,
    fillGaps: "Fill the earlier places before submitting.",
    cutLine: (top: number) => `Your top ${top}`,
    place: (n: number) => `${ordinal(n)} place`,
    placeShort: ordinal,
    belowLine: "Not submitted",
    moveUp: (team: string) => `Move ${team} up`,
    moveDown: (team: string) => `Move ${team} down`,
    rank: (n: number) => `#${n}`,
    noScore: "No score",
    scoreOf: (avg: string) => `avg ${avg}/10`,
    remove: (team: string) => `Remove ${team} from your finalists`,
    keyboardHint: "Use the arrow buttons to reorder.",
    moved: (team: string, rank: number) => `${team} moved to number ${rank}.`,
    selected: (team: string, rank: number) =>
      `${team} selected for place ${rank}.`,
    slotsHeading: "Your final picks",
    slotsIntro: "Fill places in order. Drag the cards to reorder.",
    choose: (place: number) => `Choose ${ordinal(place)} place`,
    chooseTitle: "Choose a team",
    chooseSearch: "Search presenting teams",
    chooseTeam: (team: string) => `Choose ${team}`,
    selectedTeam: "Selected",
    addTeam: "Choose team",
    clearTeam: "Clear this place",
    dragTeam: (team: string) => `Drag ${team} to reorder`,
  },

  shortlistSubmitConfirm: {
    title: "Submit your final shortlist?",
    body: (count: number) =>
      `You're submitting ${plural(count, "finalist", "finalists")}. You can only submit your final shortlist once, so check it first.`,
    listLabel: "Your finalists",
    confirm: "Submit final shortlist",
    cancel: "Go back",
  },

  submit: {
    finalPicks: "Submit final picks",
    button: (top: number) => `Submit top ${top}`,
    confirmTitle: (top: number) => `Submit these ${top}?`,
    confirmBody:
      "Hack Western uses this ranking for your prize. This submission is final and cannot be changed.",
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

  /** Round 1 ends with Submit final shortlist; round 2 ranks teams that presented. */
  round: {
    sendHeading: "Your final shortlist",
    sendIntro: (max: number) =>
      `When you're happy with it, submit it to us: up to ${max} finalists, one per presentation slot. We'll schedule each team to present in your room from 10:00.`,
    tooMany: (max: number, have: number) =>
      `The shortlist cap is ${max}. Remove ${plural(have - max, "finalist", "finalists")} before you submit.`,
    /** Next to the button: it can't be undone. */
    onceOnly: "You can only submit this once.",
    /** Shown with the schedule: what one presentation slot holds. */
    format: (pitch: number, qa: number) =>
      `Each presentation: ${pitch} min pitch · ${qa} min Q&A`,
    send: "Submit final shortlist",
    resend: "Send again",
    sending: "Submitting…",
    sentAt: (time: string, n: number) =>
      `Submitted ${time} · ${plural(n, "finalist", "finalists")}`,
    changed: "Your finalists have changed since you submitted.",
    changedAfterSchedule:
      "Your finalists have changed since presentations were scheduled. Tell your Hack Western contact if a team should be added.",
    sendFailed: "Couldn't submit. Check your connection and try again.",
    waiting:
      "Round 2 opens here after presentations: you'll rank your top teams from the ones that presented.",
    /** Round 2 is open but this sponsor has no presentation slot. */
    locked:
      "Round 2 is locked for you: no teams presented to you, so there's nobody to rank. Submit your final shortlist if you haven't, then ask your Hack Western contact to schedule presentations again.",
    presentedHeading: "Rank the teams that presented",
    presentedIntro: (min: number, max: number) =>
      min === max
        ? `Rank all ${max} teams, with your favourite first.`
        : `Rank ${min}–${max} teams, with your favourite first.`,
    noPresenters:
      "No teams are scheduled to present to you. Ask your Hack Western contact.",
    presentsAt: (time: string) => `Presents ${time}`,
    presentingAt: (time: string) => `Presentation at ${time}`,
  },

  errors: {
    unknownSponsor: "Unknown sponsor link",
    emptyShortlist: "Save at least one finalist before submitting.",
    tooMany: (max: number) => `Send at most ${max} teams.`,
    notEligible: "That team isn't one you can judge.",
    trackUnavailable: "Couldn't load your prize track. Try again in a minute.",
    closed: "Judging has closed.",
    round2Closed: "Round 2 isn't open yet. It opens after presentations.",
    noPrizeTrack: "Judging is only for sponsors with a prize track.",
    noSlot: (top: number) =>
      `Round 2 is locked: no teams presented to you, so you can't rank a top ${top}.`,
    digital: (top: number) =>
      `Digital sponsors don't judge in the portal. Send your top ${top} to your Hack Western contact.`,
    notDigital: "That sponsor isn't a digital prize track sponsor.",
    digitalNoMatch: (place: number, link: string) =>
      `${ordinal(place)} place: "${link}" doesn't match a submitted team in this sponsor's track.`,
    digitalAmbiguous: (place: number, link: string) =>
      `${ordinal(place)} place: "${link}" matches more than one team in this sponsor's track. Paste the team ID instead.`,
    noJudge: "Enter the name of who's judging.",
    shortlistAlreadySent: "Your final shortlist has already been submitted.",
    topAlreadySubmitted: (top: number) =>
      `Your top ${top} has already been submitted.`,
    ranking: {
      wrongCount: (top: number) =>
        minPicks(top) === top
          ? `Submit exactly ${top} teams.`
          : `Submit between ${minPicks(top)} and ${top} teams.`,
      duplicate: () => "Each team can appear only once.",
      notShortlisted: () => "Only your finalists can be submitted.",
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
    sponsors: {
      headers: (top: number) => [
        "Sponsor",
        "In person / Digital",
        "Judging room",
        "Round 1 status",
        "Shortlist sent",
        "Shortlist (team IDs)",
        "Round 2 status",
        `Top ${top} sent`,
        ...Array.from({ length: top }, (_, i) => `${ordinal(i + 1)} place`),
        "Notes",
      ],
      inPerson: "In person",
      digital: "Digital",
      status: {
        notRegistered: "No portal link yet",
        notStarted: "Not started",
        scoring: "Scoring",
        shortlistSent: "Shortlist sent",
        digitalRound1: "No round 1 (digital)",
        notOpen: "Not open",
        ranking: "Ranking",
        locked: "Locked: no presentations",
        submitted: (top: number) => `Top ${top} sent`,
        digitalWaiting: "Waiting for the spon team",
        digitalEntered: "Entered by the spon team",
      },
      notes: {
        remote: "Judges remotely; presentations are online.",
        digital: (top: number) =>
          `Digital sponsor: top ${top} entered by the spon team from Devpost links.`,
      },
    },
    /** Each sponsor's top 5, one row per place, links in their own columns. */
    winners: {
      title: "Top 5 by sponsor",
      headers: ["Sponsor", "Place", "Team ID", "Team", "Devpost", "GitHub"],
      place: (n: number) => `${ordinal(n)} place`,
      empty: (top: number) => `No sponsor has sent their top ${top} yet.`,
    },
    schedule: {
      title: "Presentations",
      headers: [
        "Sponsor",
        "Team ID",
        "Team",
        "Members",
        "Time",
        "Room",
        "Notified",
      ],
      notified: { slack: "Slack", email: "Email", failed: "failed" },
    },
  },

  /**
   * The "Judging Scores" tab (sponsor-judging-scores-mirror.ts): one block
   * per in-person sponsor, filled as reps score. The app is the source of
   * truth: where it has a value it wins; hand-typed cells survive only where
   * the app has no value. The backup if the app is down, so the app never
   * blanks a cell.
   */
  scoresSheet: {
    tab: "Judging Scores",
    note: "Filled by the app as reps score. Where the app has a score it wins over anything typed here; if the app is down, type scores here.",
    headers: {
      time: "Time",
      teamId: "Team ID",
      devpost: "Devpost",
      average: "Average",
    },
    /** Placeholder header for an unused rep column; type a name over it. */
    rep: (n: number) => `Rep ${n}`,
  },

  /** The organizer "Sponsor judging" tab on /internal/sponsors. */
  organizer: {
    viewsLabel: "Sponsor judging view",
    views: { sponsors: "Final results", teams: "All teams" },
    /** Rank badge on a submitted top list: "1st", "2nd"... */
    rankOf: ordinal,
    noMembers: "No hackers listed",
    intro: (top: number) =>
      `Each sponsor's reps score projects, the sponsor shortlists some and submits a ranked top ${top}.`,
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
    scoreOf: (avg: string) => `avg ${avg}/10`,
    byJudge: (name: string, score: string) => `${firstName(name)} ${score}`,
    judges: (n: number) => plural(n, "rep scoring", "reps scoring"),
    devpost: "Devpost",
    openDevpost: (team: string) => `Open ${team} on Devpost`,
    openGithub: (team: string) => `Open ${team} on GitHub`,
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
      /** Final results table: each sponsor's ranked teams. */
      place: "Place",
      repScores: "Rep scores",
      hackers: "Hackers",
    },
    inTopCount: (n: number) => plural(n, "sponsor", "sponsors"),
    averageOf: (avg: string, n: number) =>
      `${avg} from ${plural(n, "score", "scores")}`,
    noAverage: "—",
    digital: {
      heading: "Digital sponsors",
      intro: (top: number) =>
        `Digital sponsors don't use the portal. Enter ${minPicks(top)}–${top} ranked teams by Devpost link or team ID, starting at first place. Each must be a submitted team in their track.`,
      place: (n: number) => `${ordinal(n)} place`,
      placeholder: "devpost.com/software/…",
      match: (name: string) => `Matches ${name}`,
      noMatch: "No submitted team in this track has that link.",
      ambiguous:
        "More than one team in this track has that link. Paste the team ID instead.",
      duplicate: "Already used for another place.",
      save: (top: number) => `Save top ${top}`,
      saving: "Saving…",
      savedAt: (time: string) => `Saved ${time}`,
      failed: "Couldn't save. Check the links and try again.",
      loadFailed: "Couldn't load this sponsor's teams.",
      noTeams: "No submitted teams in this track yet.",
      track: (track: string) => `Track: ${track}`,
    },
  },
} as const;
