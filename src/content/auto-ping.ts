/**
 * Copy for the Auto-Ping mentor, volunteer and judge messenger
 * (scripts/auto-ping.ts). The messages themselves are templates on the
 * Auto-Ping sheet's Messages tab; this is everything else the bot writes:
 * Status and Check-before-sending cells, Log results, test labels and errors.
 */
export const autoPingCopy = {
  /** Message kinds, as shown in Status and --review. */
  kinds: {
    checkin: "Check-in",
    reminder: "Shift reminder",
    after: "After a shift",
    lastDay: "Last day",
    final: "Final thank you",
  },
  /** "Planned messages" tab: one row per message each person will get. */
  planned: {
    header: [
      "Email",
      "Full name",
      "Role",
      "Message",
      "Sends at",
      "Status",
      "Text",
      "Time changed",
    ],
    byHand: "Sun 6:00 PM (once {hackers} and {projects} are filled)",
    /** Text column for a held message: what it's waiting on. */
    heldText: (missing: string) =>
      `(Not written yet: fill in ${missing} on the Messages tab and the full message appears here.)`,
    status: {
      queued: "Queued",
      notQueued: "Not queued yet (next sync)",
      held: (placeholder: string) => `Held: ${placeholder} is blank`,
      sent: "Sent",
      notOnSlack: "Not on Slack",
      notTicked: "Not ticked (Send? off)",
      blocked: "Not sending: see Check before sending",
      noEmail: "No email",
      past: "Past",
      paused: "Bot paused",
      final: "Sent by hand on Sunday",
    },
  },
  /** People column I ("Sent / next"): one line per person. */
  sentNext: {
    header: "Sent / next",
    next: (sent: number, message: string, when: string) =>
      `${sent} sent · next: ${message}, ${when}`,
    allSent: "All sent",
    nothing: "Nothing queued",
    notOnSlack: "Not on Slack yet",
    held: (placeholder: string) => `Held: ${placeholder} is blank`,
    notTicked: "Not ticked",
    blocked: "Not sending: see Check before sending",
    noEmail: "No email",
    paused: "Bot paused",
  },
  /**
   * Check before sending column (J). Lines the bot writes start with
   * `marker`, so the bot can replace its own lines and keep anyone else's.
   */
  /** POC column "@HelpDesk": this replaces the check-in line that names {poc}. */
  helpDesk: {
    checkIn:
      "📍 Your POC is Jessica. She isn't available at the moment to check you in, so please go to the Help Desk when you arrive.",
  },
  flags: {
    marker: "🤖 ",
    removed: "Not on the schedule anymore",
    unknownNote: (cell: string) =>
      `Schedule note in "${cell}" isn't one I understand (use "(2am start)" or "(3-7pm)"), so no timed messages`,
    badShift: (text: string) =>
      `Shift "${text}" isn't a time I can read (like "Sun 8:30am-1:30pm"), so no timed messages`,
    noShift: "No shift, so no timed messages",
    guessed: (scheduleName: string, matched: string) =>
      `Email found by a loose name match: "${scheduleName}" on the schedule = "${matched}". Check it's the same person`,
    noEmailFor: (scheduleName: string) =>
      `No email found for ${scheduleName}; add it in Email override`,
    twoEmails: (scheduleName: string) =>
      `${scheduleName} matches more than one email in the contact info tabs; add the right one in Email override`,
    noEmail: "No email: add one in Email override",
    unknownPoc: (poc: string) =>
      `POC "${poc}" isn't a Slack user I know, so it isn't a real @mention`,
  },
  /** Log tab Result column (G). */
  log: {
    channel: "Slack DM",
    scheduled: (when: string) => `Scheduled for ${when}`,
    rescheduled: (when: string) => `Rescheduled for ${when}`,
    sent: "Sent",
    sentLate: "Sent late",
    cancelled: "Cancelled",
    notOnSlack: "Not on Slack",
    held: (placeholder: string) => `Held: ${placeholder} is blank`,
  },
  /** First line of --send-test DMs. */
  test: (name: string, when: string) => `[TEST for ${name} · ${when}]`,
  errors: {
    share: (email: string) =>
      `Can't open the Auto-Ping sheet: share Auto-Ping with ${email} as Editor`,
    credentials:
      "Set RUN_OF_SHOW_SHEETS_CLIENT_EMAIL and RUN_OF_SHOW_SHEETS_PRIVATE_KEY (or AUTO_PING_SNAPSHOT_DIR for --preview / --review / --send-test)",
    brokenSchedule: (tab: string, first: string) =>
      `The "${tab}" tab isn't loading (first cell is "${first}"). Open Auto-Ping and allow its IMPORTRANGE access. Nothing was changed.`,
    snapshotWrite:
      "--plan, --sync and --send-final write to the live sheet; unset AUTO_PING_SNAPSHOT_DIR",
    finalBlank: (names: string) =>
      `Fill in ${names} on the Messages tab before --send-final`,
    disabled: "AUTO_PING_ENABLED isn't 1, so nothing was sent",
    noPerson: (name: string) => `No one called "${name}" on the People tab`,
    noTestRecipient: (email: string) => `No Slack account for ${email}`,
  },
};
