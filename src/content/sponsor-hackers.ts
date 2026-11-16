// User-facing copy for the sponsor "Interested hackers" page
// (/sponsors/[uuid]/hackers) and its link on the sponsor hub. Keep wording
// here, not in components.

export const sponsorHackersCopy = {
  hubLink: "Interested hackers",
  seoTitle: "Interested hackers",
  eyebrow: "Interested hackers",
  title: (sponsor: string) => `Hackers who want to meet ${sponsor}`,
  intro:
    "Hackers who put you on their list of sponsors to meet, top picks first. Only hackers who agreed to share their profile with sponsors are shown.",
  offerHint:
    "To offer a coffee chat, scan the hacker's badge when you meet them.",
  count: (n: number) => (n === 1 ? "1 hacker" : `${n} hackers`),
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
