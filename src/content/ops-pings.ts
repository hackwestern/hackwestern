/**
 * Copy for ops pings: the Slack DMs organizers get at the start and end of
 * each of their tasks in the organizer run of show, and the organizer page
 * that shows them (/internal/ops-pings). Slack text arrives pre-escaped.
 */
export const opsPingsCopy = {
  slack: {
    /** 10 minutes before the start. */
    start: (p: {
      title: string;
      when: string;
      location: string | null;
      blurb: string | null;
      owners: string;
    }) =>
      [
        `⏰ *Starting soon: ${p.title}*`,
        `*When:* ${p.when}`,
        `*Where:* ${p.location ?? "No location in the run of show"}`,
        p.blurb ? `*What:* ${p.blurb}` : null,
        `*Owners:* ${p.owners}`,
      ]
        .filter(Boolean)
        .join("\n"),
    /** At the end time. */
    end: (p: { title: string; end: string; location: string | null }) =>
      [
        `✅ *Time to wrap up: ${p.title}* (ends ${p.end})`,
        p.location ? `*Where:* ${p.location}` : null,
        "Wrap up and hand off anything still open.",
      ]
        .filter(Boolean)
        .join("\n"),
    /** "1:00 PM – 2:00 PM", or just the start. */
    when: (start: string, end: string | null) =>
      end ? `${start} – ${end}` : start,
  },

  page: {
    title: "Ops pings",
    eyebrow: "Organizers",
    heading: "Ops pings",
    intro:
      "Every organizer task in the run of show sends a Slack DM to its owners 10 minutes before it starts and again when it ends. Owners are matched to Slack people whose name starts with [ORGANIZER]. Anything that can't be matched is listed here and nobody gets pinged for it.",
    navLabel: "Ops pings",
    backToHome: "Organizer home",
    sheetLink: "Open the run of show",

    refresh: "Refresh from sheet and schedule pings",
    refreshing: "Scheduling…",
    refreshHint:
      "Safe to press again: pings that are already right stay as they are, changed ones are replaced.",

    loadError: "Couldn't load the run of show.",
    retry: "Try again",
    sheetNotConfigured:
      "The run of show sheet isn't set up. Set OPS_RUN_OF_SHOW_SHEET and share the sheet with the run-of-show service account.",
    sheetError: "Couldn't read the run of show sheet. Try again in a minute.",
    noToken:
      "Slack isn't connected (SLACK_BOT_TOKEN isn't set), so nothing can be scheduled. Owners below are matched to organizer accounts only.",
    slackError:
      "Couldn't read the organizer list from Slack. Owners below are matched to organizer accounts only, and nothing was scheduled.",
    syncError: "Scheduling failed. Nothing was changed. Try again.",
    syncDone: (p: {
      created: number;
      cancelled: number;
      failed: number;
      scheduled: number;
    }) =>
      `Done. ${p.scheduled} pings waiting in Slack (${p.created} new, ${p.cancelled} cancelled${p.failed ? `, ${p.failed} failed` : ""}).`,

    summary: (p: { tasks: number; flagged: number; issues: number }) =>
      `${p.tasks} tasks · ${p.flagged} owner names need a look · ${p.issues} cells couldn't be read`,

    needsAttentionHeading: "Needs a look",
    needsAttentionIntro:
      "Nobody is pinged for these. Fix the cell in the sheet (or add an alias in src/content/ops-pings-aliases.ts), then refresh.",
    issueReasons: {
      "no-owner": "No Owner line",
      "no-time": "No time (no Starts line and no time in column A)",
      "no-day": "Not under a day (FRIDAY, SATURDAY, SUNDAY)",
      note: "Note in the time column, not read as a task",
    },
    allClear: "Every cell was read and every owner was matched.",

    dayHeading: (day: string) => day,
    noTasks: "No tasks in the run of show.",
    showPast: "Show past tasks",
    hidePast: "Hide past tasks",

    columns: {
      time: "Time",
      task: "Task",
      owners: "Owners",
      pings: "Pings",
    },
    noEnd: "No end in the sheet: start ping only",
    endFromCell: "End from the cell's height",
    where: (location: string) => `Where: ${location}`,
    cell: (ref: string) => `Cell ${ref}`,

    owner: {
      matched: (name: string) => name,
      via: {
        alias: "alias",
        full: "",
        first: "first name",
        close: "close spelling, check it",
        email: "organizer account email",
      } as Record<string, string>,
      everyone: "Everyone, not pinged",
      spon: (n: number) => `Spon team: ${n} people`,
      sponUnavailable:
        "Spon team list couldn't be read (Team Assignments tab), not pinged",
      noMatch: "No match",
      ambiguous: (names: string[]) => `Ambiguous: ${names.join(" or ")}`,
      noSlack: "Organizer account has no Slack match by email",
    },

    ping: {
      start: (time: string) => `Start ping ${time}`,
      end: (time: string) => `End ping ${time}`,
      status: {
        scheduled: "Scheduled",
        sent: "Sent",
        failed: "Failed",
        pending: "Not scheduled yet",
        "too-soon": "Too soon to schedule",
        passed: "Time passed",
      } as Record<string, string>,
      failedWith: (code: string) => `Failed (${code})`,
      recipients: (n: number) => `${n} ${n === 1 ? "DM" : "DMs"}`,
      nobody: "Nobody to DM",
    },
    preview: "Preview DM",
    previewEnd: "Preview end DM",
  },
};
