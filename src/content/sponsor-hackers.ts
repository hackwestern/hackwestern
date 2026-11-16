// User-facing copy for the "Interested hackers" section and shortlist on
// the sponsor's coffee chats page (/sponsors/[uuid]/coffee-chats#interested;
// the old /sponsors/[uuid]/hackers link redirects there). Keep wording here,
// not in components.

export const sponsorHackersCopy = {
  pageIntro:
    "See who wants to meet you, shortlist the hackers you'd like to chat with, and follow the chats you've offered.",
  chatsHeading: "Your chats",
  heading: "Interested hackers",
  intro:
    "Hackers who put you on their list of sponsors to meet, top picks first. Only hackers who agreed to share their profile with sponsors are shown.",
  shortlistHint:
    "The Hack Western team uses your shortlist to set up coffee chats; you can also scan a badge anytime.",
  shortlistCount: (picked: number, total: number) =>
    `${picked} of ${total} shortlisted`,
  filterLabel: "Show",
  filterAll: "All",
  filterShortlisted: "Shortlisted only",
  noneShortlisted:
    "You haven't shortlisted anyone yet. Tap Shortlist on a hacker to add them.",
  shortlist: "Shortlist",
  added: (name: string) => `${name} added to your shortlist.`,
  removed: (name: string) => `${name} removed from your shortlist.`,
  toggleError: (name: string) =>
    `We couldn't update ${name} on your shortlist. Try again.`,
  shortlistFull: (max: number) =>
    `Your shortlist is full (${max} hackers). Remove someone to add another.`,
  empty:
    "No hackers yet. As hackers pick the sponsors they'd like to meet on the live site, they'll show up here.",
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
    opensIn: (link: string, name: string) =>
      `${name}'s ${link} (opens in a new tab)`,
  },
  loadError:
    "We couldn't load your interested hackers right now. Try again in a minute.",
  retry: "Try again",
} as const;
