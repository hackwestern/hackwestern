// User-facing copy for the "Candidates" section and shortlist on
// the sponsor's coffee chats page (/sponsors/[uuid]/coffee-chats#interested;
// the old /sponsors/[uuid]/hackers link redirects there). Keep wording here,
// not in components.

export const sponsorHackersCopy = {
  pageIntro:
    "See who wants to meet you, shortlist the hackers you'd like to chat with, and follow the chats you've offered.",
  chatsHeading: "Your chats",
  // The switch between Your chats and Candidates at the top of the page.
  tabs: {
    label: "Coffee chats",
    chats: "Your chats",
    candidates: "Candidates",
  },
  // The three numbers above the switch.
  stats: {
    label: "Summary",
    accepted: "Accepted",
    waiting: "Waiting",
    shortlisted: "Shortlisted",
    of: (max: number) => `of ${max}`,
  },
  refreshLabel: "Refresh chats and candidates",
  heading: "Candidates",
  // Candidates from the hacker interest form (the usual case).
  introForm:
    "Up to 40 hackers who named you as one of their top 3 sponsors, strongest applications first. Shortlist the ones you'd like to meet.",
  // Candidates from the in-app ranking on /live (when the form can't be read).
  intro:
    "Hackers who put you on their list of sponsors to meet, top picks first. Only hackers who agreed to share their profile with sponsors are shown.",
  // Shown to logged-in organizers only, never to sponsors.
  sourceNote:
    "Organizers only: the hacker interest form couldn't be read (is HACKER_INTEREST_FORM set and shared with the service account?), so this list uses the in-app ranking from /live.",
  shortlistHint:
    "The Hack Western team uses your shortlist to set up coffee chats; you can also scan a badge anytime.",
  shortlistCount: (picked: number, total: number) =>
    `${picked} of ${total} shortlisted`,
  shortlistCap: (max: number) => `You can shortlist up to ${max}.`,
  filterLabel: "Show",
  filterAll: "All",
  filterShortlisted: "Shortlisted",
  filterNotShortlisted: "Not shortlisted",
  filterCount: (label: string, n: number) => `${label}, ${n}`,
  noneShortlisted:
    "You haven't shortlisted anyone yet. Tap Shortlist on a hacker to add them.",
  noneNotShortlisted: "Everyone on this list is on your shortlist.",
  rank: (rank: number) => `#${rank}`,
  rankLabel: (rank: number) => `Rank ${rank}`,
  notShared: "First name only. This hacker didn't share their full profile.",
  offer: "Offer coffee chat",
  offerLabel: (name: string) => `Offer ${name} a coffee chat`,
  shortlist: "Shortlist",
  added: (name: string) => `${name} added to your shortlist.`,
  removed: (name: string) => `${name} removed from your shortlist.`,
  toggleError: (name: string) =>
    `We couldn't update ${name} on your shortlist. Try again.`,
  shortlistFull: (max: number) =>
    `Your shortlist is full (${max} hackers). Remove someone to add another.`,
  empty:
    "No hackers yet. As hackers pick the sponsors they'd like to meet on the live site, they'll show up here.",
  emptyForm:
    "No candidates yet. Hackers who pick you on the interest form will show up here.",
  noTeam: "No team yet",
  pick: (rank: number) => {
    const suffix =
      rank % 100 >= 11 && rank % 100 <= 13
        ? "th"
        : (({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[
            rank % 10
          ] ?? "th");
    return `Their ${rank}${suffix} pick`;
  },
  unnamed: "Hacker",
  links: {
    label: (name: string) => `${name}'s links`,
    resume: "Resume",
    github: "GitHub",
    linkedIn: "LinkedIn",
    devpost: "Devpost",
    extra: "Link",
    /** Icon buttons' names on the shortlist (mock sponsor-chats-v3). */
    resumeIcon: "Résumé",
    extraIcon: "Website",
    opensIn: (link: string, name: string) =>
      `${name}'s ${link} (opens in a new tab)`,
  },
  // Errors the shortlist API returns (shown or announced on the page).
  errors: {
    unknownSponsor: "Unknown sponsor id",
    notCandidate: "That hacker isn't on your candidate list",
    notShared:
      "This hacker hasn't agreed to share their details with sponsors, so they can't be invited",
    shortlistFull: (max: number) => `Your shortlist is full (${max})`,
  },
  loadError:
    "We couldn't load your interested hackers right now. Try again in a minute.",
  retry: "Try again",
} as const;
