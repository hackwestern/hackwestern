// User-facing copy for sponsor help. The portal's "Need help?" now shows the
// sponsor's HW lead and the emergency contact with their numbers (`button`,
// `buttonHint`, `contacts`; decisions 2026-11-19). The rest (the request
// sheet, status card, organizer queue and Slack messages) belongs to the
// tracked help flow, switched off and kept for a later rebuild
// (docs/specs/parked-sponsor-help-requests.md). Keep wording here.

import type { SponsorHelpReason } from "~/lib/sponsor-help";

type SlackContact = {
  sponsor: string;
  rep: string | null;
  phone: string | null;
  where: { kind: "now" | "booth" | "none"; text: string };
};

const notGiven = "_not given_";

function slackWhere(where: SlackContact["where"]): string {
  if (where.kind === "now") return where.text;
  if (where.kind === "booth") return `${where.text} (booth)`;
  return notGiven;
}

export const sponsorHelpCopy = {
  reasons: {
    swag: "Out of swag or supplies",
    tech: "Tech or wifi",
    food: "Food or drinks",
    hacker: "Find a hacker",
    other: "Something else",
  } satisfies Record<SponsorHelpReason, string>,

  button: "Need help?",
  /** The page header's Help button (every sponsor page, phones and up). */
  headerButton: "Help",
  buttonHint: "Text or call your Hack Western contact.",

  /** The portal Help: your HW lead, then the emergency contact. */
  contacts: {
    title: "Need help?",
    description:
      "Text or call your Hack Western contact. If you can't reach them, call our emergency contact.",
    close: "Close",
    lead: "Your Hack Western contact",
    emergency: "Emergency contact",
    noLead: "Your contact hasn't been assigned yet.",
    /** The sheet couldn't be read: unknown, not unassigned. */
    loadFailed: "Couldn't load your contact right now. Try again in a minute.",
    noEmergency:
      "Couldn't load the emergency contact. Ask at the sponsor lounge (Rm 2110).",
    noPhone: "Number not available. Ask at the sponsor lounge (Rm 2110).",
    loading: "Loading…",
  },

  /** Server error when the switched-off tracked help is called. */
  trackedOff:
    "Help requests are switched off. Text or call your Hack Western contact, or the emergency contact (Noah) under Need help.",

  sheet: {
    title: "What do you need?",
    description:
      "Pick one. We'll ping the Hack Western sponsor team and show you who's coming.",
    reasonLegend: "Reason",
    contactLegend: "Who should we find?",
    repNameLabel: "Your name",
    repNamePlaceholder: "e.g. Priya Shah",
    phoneLabel: "Phone number",
    phoneHint: "So the sponsor team can call if they can't find you.",
    phonePlaceholder: "e.g. 519-555-0123",
    locationNoteLabel: "Location (optional)",
    locationNoteFallback: "e.g. Sponsor lounge, Rm 2110",
    remembered: "Saved on this device for next time.",
    errors: {
      repNameMissing: "Add your name so the team knows who to find.",
      repNameTooLong: "Keep your name under 80 characters.",
      phoneMissing: "Add a phone number the team can call.",
      phoneInvalid:
        "Enter a phone number with at least 7 digits, like 519-555-0123.",
      locationNoteTooLong: "Keep this under 120 characters.",
    },
    noteLabel: "Message (optional)",
    notePlaceholder: "e.g. We need 2 more chairs at the booth",
    noteCount: (n: number, max: number) => `${n}/${max}`,
    submit: "Send for help",
    sending: "Sending…",
    close: "Close",
    pickReason: "Pick a reason first.",
    error: "That didn't send. Try again, or call your Hack Western contact.",
  },

  status: {
    label: "Help request",
    openTitle: "Someone from the sponsor team will come to you",
    openBody:
      "We've pinged them with your message and location. This page updates when someone's on the way.",
    claimedTitle: (name: string) => `${name} is on the way`,
    claimedSomeone: "Someone from the sponsor team",
    claimedBody: "Hang tight, they're coming to you.",
    resolvedTitle: "All sorted",
    resolvedBody: "Thanks for letting us know. Tap Need help again anytime.",
    sentAt: (time: string) => `Sent at ${time}`,
    pingedAs: (rep: string) => `Pinged as ${rep}`,
    cancel: "Cancel request",
    cancelling: "Cancelling…",
    dismiss: "Done",
    cancelError: "Couldn't cancel. Try again.",
  },

  organizer: {
    tab: "Help",
    empty: "No open help requests.",
    noneFor: (name: string) => `No open help request from ${name}.`,
    open: "Waiting",
    claimed: (name: string) => `Claimed by ${name}`,
    claimedUnknown: "Claimed",
    age: (minutes: number) => (minutes < 1 ? "just now" : `${minutes} min ago`),
    location: (where: string) => `At ${where}`,
    locationBooth: (where: string) => `Booth: ${where}`,
    rep: (name: string) => `Rep: ${name}`,
    callLabel: (name: string, phone: string) => `Call ${name} at ${phone}`,
    resolve: "Resolve",
    resolving: "Resolving…",
    resolveError: "Couldn't resolve. Try again.",
    loadError: "Couldn't load help requests.",
    retry: "Try again",
    slackOff: "Not posted to Slack",
  },

  // Slack messages (mrkdwn). `mention` is SPONSOR_HELP_SLACK_MENTION. Values
  // arrive escaped; `phone` is already a <tel:...|...> link.
  slack: {
    request: (
      p: SlackContact & {
        mention: string;
        reason: string;
        note: string | null;
      },
    ) =>
      [
        `${p.mention ? `${p.mention} ` : ""}:raising_hand: *${p.sponsor}* needs help`,
        `*Sponsor:* ${p.sponsor}`,
        `*Rep:* ${p.rep ?? notGiven}`,
        `*Phone:* ${p.phone ?? notGiven}`,
        `*Where:* ${slackWhere(p.where)}`,
        `*Reason:* ${p.reason}`,
        p.note ? `*Note:*\n> ${p.note.replace(/\n/g, "\n> ")}` : null,
        "React or reply in the thread to claim it.",
      ]
        .filter(Boolean)
        .join("\n"),
    // Repeats who to find and call, so whoever takes it needn't scroll up.
    reping: (
      p: SlackContact & { mention: string; step: 1 | 2; minutes: number },
    ) =>
      [
        p.step === 1
          ? `${p.mention ? `${p.mention} ` : ""}Still unclaimed after ${p.minutes} minutes. React or reply to take it.`
          : `<!here> Still nobody after ${p.minutes} minutes. Can anyone take this?`,
        `*${p.sponsor}* · ${p.rep ?? notGiven} · ${p.phone ?? notGiven} · ${slackWhere(p.where)}`,
      ].join("\n"),
    claimedHeader: (name: string) => `:white_check_mark: Claimed by ${name}`,
    resolvedHeader: ":tada: Resolved",
    cancelledHeader: ":no_entry_sign: Cancelled by the sponsor",
    onIt: (slackUserId: string) =>
      `<@${slackUserId}> is on it. The sponsor's page now shows they're coming.`,
  },
};
