// User-facing copy for sponsor help requests: the sponsor's "Need help"
// button and status card, the organizer Help tab, and the Slack messages the
// bot posts. Keep wording here, not in components.

import type { SponsorHelpReason } from "~/lib/sponsor-help";

export const sponsorHelpCopy = {
  reasons: {
    swag: "Out of swag or supplies",
    tech: "Tech or wifi",
    food: "Food or drinks",
    hacker: "Find a hacker",
    other: "Something else",
  } satisfies Record<SponsorHelpReason, string>,

  button: "Need help?",
  buttonHint: "Ping the sponsor team. Someone will come to you.",

  sheet: {
    title: "What do you need?",
    description:
      "Pick one. We'll ping the Hack Western sponsor team and show you who's coming.",
    reasonLegend: "Reason",
    noteLabel: "Anything else? (optional)",
    notePlaceholder: "e.g. We're at the table by the window",
    noteCount: (n: number, max: number) => `${n}/${max}`,
    submit: "Send for help",
    sending: "Sending…",
    close: "Close",
    pickReason: "Pick a reason first.",
    error: "That didn't send. Try again, or call your Hack Western contact.",
  },

  status: {
    label: "Help request",
    openTitle: "Waiting for the sponsor team",
    openBody: "We've pinged them. This page updates when someone's on the way.",
    claimedTitle: (name: string) => `${name} is on the way`,
    claimedSomeone: "Someone from the sponsor team",
    claimedBody: "Hang tight, they'll find you at your booth.",
    resolvedTitle: "All sorted",
    resolvedBody: "Thanks for letting us know. Tap Need help again anytime.",
    sentAt: (time: string) => `Sent at ${time}`,
    cancel: "Cancel request",
    cancelling: "Cancelling…",
    dismiss: "Done",
    cancelError: "Couldn't cancel. Try again.",
  },

  organizer: {
    tab: "Help",
    empty: "No open help requests.",
    open: "Waiting",
    claimed: (name: string) => `Claimed by ${name}`,
    claimedUnknown: "Claimed",
    age: (minutes: number) =>
      minutes < 1 ? "just now" : `${minutes} min ago`,
    location: (where: string) => `At ${where}`,
    resolve: "Resolve",
    resolving: "Resolving…",
    resolveError: "Couldn't resolve. Try again.",
    loadError: "Couldn't load help requests.",
    retry: "Try again",
    slackOff: "Not posted to Slack",
  },

  // Slack messages (mrkdwn). `mention` is SPONSOR_HELP_SLACK_MENTION.
  slack: {
    request: (p: {
      mention: string;
      sponsor: string;
      location: string | null;
      reason: string;
      note: string | null;
    }) =>
      [
        `${p.mention ? `${p.mention} ` : ""}*${p.sponsor}* needs help${
          p.location ? ` at ${p.location}` : ""
        }: ${p.reason}.`,
        p.note ? `> ${p.note.replace(/\n/g, "\n> ")}` : null,
        "React or reply in the thread to claim it.",
      ]
        .filter(Boolean)
        .join("\n"),
    reping: (p: { mention: string; step: 1 | 2; minutes: number }) =>
      p.step === 1
        ? `${p.mention ? `${p.mention} ` : ""}Still unclaimed after ${p.minutes} minutes. React or reply to take it.`
        : `<!here> Still nobody after ${p.minutes} minutes. Can anyone take this?`,
    claimedHeader: (name: string) => `:white_check_mark: Claimed by ${name}`,
    resolvedHeader: ":tada: Resolved",
    cancelledHeader: ":no_entry_sign: Cancelled by the sponsor",
    onIt: (slackUserId: string) =>
      `<@${slackUserId}> is on it. The sponsor's page now shows they're coming.`,
  },
};
