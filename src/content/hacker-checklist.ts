// Copy for the /live Hacker Checklist (src/components/live/hacker-checklist.tsx)
// that isn't in its step table yet. Keep wording here, not in components.

export const hackerChecklistCopy = {
  /** Under "Join the Slack": our bot finds hackers by their application email. */
  slackEmail: {
    caution: "Use the same email as your application",
    yours: (email: string) => `Your email: ${email}`,
    why: "Our bot finds you on Slack by this email, so coffee chat invites and updates reach you.",
  },
} as const;
