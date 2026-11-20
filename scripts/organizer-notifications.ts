import { readFile, writeFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { parse } from "dotenv";
import { google } from "googleapis";
import { organizerRemindersCopy as copy } from "~/content/organizer-reminders";
import {
  SlackApiError,
  slackApi,
  type SlackResponse,
} from "~/server/slack/client";
import { readCsv } from "~/server/slack/csv";
import {
  KNOWN_SLACK_IDS,
  linkToken,
  planOrganizerReminders,
  planTeamPosts,
  readContacts,
  readRoster,
  readRunOfShow,
  type CellMerge,
  type Person,
} from "~/server/slack/organizer-schedule";
import {
  DM_OPTIONS,
  syncOrganizerDms,
  type DesiredDm,
} from "~/server/slack/organizer-sync";

/**
 * Slack DMs reminding organizers of their HW13 run-of-show tasks, 15 minutes
 * before each. Slack holds the queue (no database), so one --sync can run
 * from GitHub Actions (.github/workflows/organizer-reminders.yml) or a
 * laptop (--watch). See docs/organizer-notifications.md.
 */

const RUN_OF_SHOW_SHEET = "1lnRCD_q_EYaAcmL-IXkmuWZMNAiFIiU1Linbm8jHyAE";
const RUN_OF_SHOW_RANGE = "'Schedule View'";
const CONTACTS_SHEET = "16bur9ixrVm-DqXtAs3DJZEWZQ7gXTc92Gs4sflFUxSg";
const CONTACTS_RANGE = "Sheet1";

type Config = Record<string, string | undefined>;

/** An env value, or undefined when unset or blank. */
const setting = (value: string | undefined) =>
  value?.trim() ? value.trim() : undefined;

async function settings(): Promise<Config> {
  const file = await readFile(".env", "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return "";
    },
  );
  return { ...parse(file), ...process.env };
}

/** The Sheets API as the service account, plus its email for error text. */
function sheetsApi(config: Config) {
  const email = setting(config.RUN_OF_SHOW_SHEETS_CLIENT_EMAIL);
  const key = config.RUN_OF_SHOW_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new Error(
      "Set RUN_OF_SHOW_SHEETS_CLIENT_EMAIL and RUN_OF_SHOW_SHEETS_PRIVATE_KEY (or the ORGANIZER_*_PATH snapshots)",
    );
  }
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  return { api: google.sheets({ version: "v4", auth }), email };
}

type GridCell = {
  formattedValue?: string | null;
  hyperlink?: string | null;
  textFormatRuns?:
    | {
        startIndex?: number | null;
        format?: { link?: { uri?: string | null } | null } | null;
      }[]
    | null;
};

/** A cell's text with its linked parts kept as link tokens (see linkToken). */
function cellText(cell: GridCell): string {
  const text = cell.formattedValue ?? "";
  const runs = (cell.textFormatRuns ?? []).map((r) => ({
    start: r.startIndex ?? 0,
    uri: r.format?.link?.uri ?? null,
  }));
  if (runs.some((r) => r.uri)) {
    return runs
      .map((r, i) => {
        const part = text.slice(r.start, runs[i + 1]?.start ?? text.length);
        return r.uri && part.trim() ? linkToken(r.uri, part) : part;
      })
      .join("");
  }
  return cell.hyperlink && text ? linkToken(cell.hyperlink, text) : text;
}

/**
 * The run of show in one read: cell text (with links) and merged cells (a
 * task's height). A local CSV copy has no links or merges.
 */
async function runOfShow(
  config: Config,
  path: string | undefined,
  sheet: string,
  range: string,
): Promise<{ rows: string[][]; merges: CellMerge[] }> {
  if (path) return { rows: readCsv(await readFile(path, "utf8")), merges: [] };
  const { api, email } = sheetsApi(config);
  try {
    const res = await api.spreadsheets.get({
      spreadsheetId: sheet,
      ranges: [range],
      includeGridData: true,
      fields:
        "sheets.merges,sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns(startIndex,format(link(uri))))",
    });
    const tab = res.data.sheets?.[0];
    return {
      rows: (tab?.data?.[0]?.rowData ?? []).map((r) =>
        (r.values ?? []).map((v) => cellText(v)),
      ),
      merges: (tab?.merges ?? []).map((m) => ({
        startRowIndex: m.startRowIndex ?? 0,
        endRowIndex: m.endRowIndex ?? 0,
        startColumnIndex: m.startColumnIndex ?? 0,
        endColumnIndex: m.endColumnIndex ?? 0,
      })),
    };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 403 || code === 404) {
      throw new Error(`Can't read a sheet: share it with ${email} as a Viewer`);
    }
    throw error;
  }
}

/** A sheet tab as rows of strings: a local CSV when a path is set, else live. */
async function grid(
  config: Config,
  path: string | undefined,
  sheet: string,
  range: string,
): Promise<string[][]> {
  if (path) return readCsv(await readFile(path, "utf8"));
  const { api, email } = sheetsApi(config);
  try {
    const res = await api.spreadsheets.values.get({
      spreadsheetId: sheet,
      range,
    });
    return (res.data.values ?? []).map((row) => row.map((c) => String(c)));
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 403 || code === 404) {
      throw new Error(`Can't read a sheet: share it with ${email} as a Viewer`);
    }
    throw error;
  }
}

async function load(config: Config) {
  const { rows: schedule, merges } = await runOfShow(
    config,
    setting(config.ORGANIZER_RUN_OF_SHOW_PATH),
    setting(config.ORGANIZER_RUN_OF_SHOW_SHEET) ?? RUN_OF_SHOW_SHEET,
    RUN_OF_SHOW_RANGE,
  );
  const contacts = readContacts(
    await grid(
      config,
      setting(config.ORGANIZER_CONTACTS_PATH),
      setting(config.ORGANIZER_CONTACTS_SHEET) ?? CONTACTS_SHEET,
      CONTACTS_RANGE,
    ),
    readRoster(schedule),
  );
  const parsed = readRunOfShow(schedule, contacts.people, merges);
  const skipNames = new Set(
    (config.ORGANIZER_NOTIFICATION_SKIP_NAMES ?? "")
      .split(",")
      .map((name) => name.trim().toLowerCase())
      .filter(Boolean),
  );
  const plan = planOrganizerReminders(parsed.tasks, { skipNames });
  return { ...parsed, ...contacts, plan };
}
type Data = Awaited<ReturnType<typeof load>>;

const lookups = new Map<string, string | null>();

/** Slack user id: ORGANIZER_SLACK_IDS / KNOWN_SLACK_IDS, else contact emails. */
async function slackId(
  config: Config,
  token: string,
  person: Person | undefined,
  name: string,
): Promise<string | null> {
  const overrides = {
    ...KNOWN_SLACK_IDS,
    ...(JSON.parse(setting(config.ORGANIZER_SLACK_IDS) ?? "{}") as Record<
      string,
      string
    >),
  };
  const override = overrides[name]?.trim();
  if (override && /^[UW][A-Z0-9]+$/.test(override)) return override;
  for (const email of override ? [override] : (person?.emails ?? [])) {
    if (!lookups.has(email)) {
      try {
        const res = await slackApi<SlackResponse & { user?: { id?: string } }>(
          token,
          "users.lookupByEmail",
          { email },
          fetch,
          10_000,
        );
        lookups.set(email, res.user?.id ?? null);
      } catch (error) {
        if (
          !(error instanceof SlackApiError && error.code === "users_not_found")
        )
          throw error;
        lookups.set(email, null);
      }
    }
    const id = lookups.get(email);
    if (id) return id;
  }
  return null;
}

async function openDm(token: string, user: string): Promise<string> {
  const res = await slackApi<SlackResponse & { channel?: { id?: string } }>(
    token,
    "conversations.open",
    { users: user },
    fetch,
    10_000,
  );
  if (!res.channel?.id) throw new Error("Slack returned no DM channel");
  return res.channel.id;
}

async function postDm(token: string, channel: string, text: string) {
  await slackApi(
    token,
    "chat.postMessage",
    { channel, text, ...DM_OPTIONS },
    fetch,
    10_000,
  );
}

const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});

/** What to fix in the sheet so everyone who should be pinged is. */
function problemLines(data: Data, noSlack: string[] = []): string[] {
  const p = copy.slack.problems;
  return [
    ...(data.unmatched.length ? [p.noContact(data.unmatched.join(", "))] : []),
    ...(noSlack.length ? [p.noSlack(noSlack.join(", "))] : []),
    ...data.skipped.map((s) =>
      p.skipped(clock.format(s.at), s.title, s.reason),
    ),
    ...data.unrecognized.map((u) =>
      p.unknown(clock.format(u.at), u.title, u.names.join(", ")),
    ),
  ];
}

function review(data: Data) {
  const out: string[] = [
    "# Organizer reminders: review",
    "",
    `${data.plan.length} DMs for ${data.roster.length} people. Times are row times; the DM goes 15 min before.`,
    "",
    "| Row time | Task | Pinged |",
    "|---|---|---|",
  ];
  for (const task of [...data.tasks].sort((a, b) => +a.at - +b.at)) {
    const who = task.everyone
      ? `Everyone (${task.owners.length})`
      : (task.teams.length ? `**${task.teams.join(" + ")} team:** ` : "") +
        task.owners.join(", ");
    out.push(`| ${clock.format(task.at)} | ${task.title} | ${who} |`);
  }
  const problems = problemLines(data);
  out.push(
    "",
    "## Problems to fix in the sheet",
    "",
    ...(problems.length ? problems : ["None"]),
  );
  return out.join("\n");
}

/** The last sheet-check DM, kept in a file so a fresh CI job knows it. */
async function lastSheetCheck(path: string): Promise<string | null> {
  return readFile(path, "utf8").catch(() => null);
}

async function run(mode: string) {
  const config = await settings();
  const quiet = config.ORGANIZER_QUIET === "1"; // CI logs are public: no names
  const log = (loud: string, safe?: string) => {
    if (!quiet) console.log(loud);
    else if (safe) console.log(safe);
  };
  const data = await load(config);
  const byName = new Map(data.people.map((p) => [p.name, p]));

  if (mode === "--review") {
    console.log(review(data));
    return;
  }
  if (mode === "--preview" || mode.startsWith("--preview=")) {
    const filter = mode.split("=")[1]?.toLowerCase();
    const selected = filter
      ? data.plan.filter((r) => r.recipientName.toLowerCase() === filter)
      : data.plan;
    for (const row of selected) {
      console.log(
        `\n${clock.format(row.postAt)} → ${row.recipientName}\n${row.text}`,
      );
    }
    console.log(`\n${selected.length} reminders`);
    return;
  }

  const token = setting(config.SLACK_BOT_TOKEN);
  if (!token) throw new Error("Set SLACK_BOT_TOKEN");
  const testName =
    setting(config.ORGANIZER_NOTIFICATION_TEST_RECIPIENT) ?? "Jasmine";
  const testLabel = (name: string, at: Date) =>
    copy.slack.test(name, clock.format(at));

  if (mode === "--who") {
    for (const name of data.roster) {
      const person = byName.get(name);
      const id = await slackId(config, token, person, name);
      console.log(
        `${name.padEnd(10)} ${(person?.fullName ?? "(no contact)").padEnd(20)} ${id ?? "NOT FOUND on Slack"}`,
      );
    }
    return;
  }

  if (mode.startsWith("--send-test=") || mode.startsWith("--rehearse=")) {
    const [flag, who] = mode.split("=") as [string, string];
    const target = await slackId(config, token, byName.get(testName), testName);
    if (!target) throw new Error(`No Slack account found for ${testName}`);
    const channel = await openDm(token, target);
    const rows = data.plan.filter(
      (r) => r.recipientName.toLowerCase() === who.toLowerCase(),
    );
    if (flag === "--send-test") {
      for (const row of rows) {
        await postDm(
          token,
          channel,
          `${testLabel(row.recipientName, row.postAt)}\n${row.text}`,
        );
        await sleep(1100);
      }
      return;
    }
    // Rehearsal: Slack delivers up to 5 of them, one a minute from 2 minutes
    // from now. The test label keeps the sync from ever touching them.
    const start = Date.now() + 2 * 60_000;
    for (const [index, row] of rows.slice(0, 5).entries()) {
      const at = start + index * 60_000;
      await slackApi(
        token,
        "chat.scheduleMessage",
        {
          channel,
          post_at: String(Math.floor(at / 1000)),
          text: `${testLabel(row.recipientName, row.postAt)} (rehearsal)\n${row.text}`,
          ...DM_OPTIONS,
        },
        fetch,
        10_000,
      );
      console.log(
        `Scheduled for ${clock.format(new Date(at))} (really ${clock.format(row.postAt)})`,
      );
    }
    return;
  }

  // --sync / --watch
  const enabled = config.ORGANIZER_NOTIFICATIONS_ENABLED === "1";
  const testMode = config.ORGANIZER_NOTIFICATION_TEST_MODE === "1";
  const upcoming = enabled
    ? data.plan.filter((row) => +row.postAt > Date.now())
    : [];
  const ids = new Map<string, string | null>();
  for (const name of new Set(
    upcoming.map((r) => (testMode ? testName : r.recipientName)),
  )) {
    ids.set(name, await slackId(config, token, byName.get(name), name));
  }
  const missing = [...ids].filter(([, id]) => !id).map(([name]) => name);
  if (missing.length) {
    log(
      `No Slack account for ${missing.join(", ")}; skipping them`,
      `${missing.length} people with no Slack account`,
    );
  }
  const desired: DesiredDm[] = upcoming.flatMap((row): DesiredDm[] => {
    const slackUserId = ids.get(testMode ? testName : row.recipientName);
    if (!slackUserId) return [];
    const text = testMode
      ? `${testLabel(row.recipientName, row.postAt)}\n${row.text}`
      : row.text;
    return [{ slackUserId, postAt: row.postAt, text }];
  });
  // Team-owned tasks ("Owner: WEB") also go to the team's channel.
  const testId = testMode ? ids.get(testName) : undefined;
  for (const post of enabled ? planTeamPosts(data.tasks) : []) {
    if (+post.postAt <= Date.now()) continue;
    if (testMode) {
      if (testId)
        desired.push({
          slackUserId: testId,
          postAt: post.postAt,
          text: `${testLabel(`#${post.team}`, post.postAt)}\n${post.text}`,
        });
    } else {
      desired.push({
        channel: post.channel,
        postAt: post.postAt,
        text: post.text,
      });
    }
  }
  // Disabled: an empty plan cancels every queued organizer DM.
  const result = await syncOrganizerDms(token, desired);
  console.log(
    `${result.scheduled} queued, ${result.kept} unchanged, ${result.cancelled} cancelled (${data.plan.length - upcoming.length} past or off)`,
  );

  // Tell the admin what to fix in the sheet, only when the list changes.
  const admin = config.ORGANIZER_NOTIFICATION_ADMIN ?? "Jasmine";
  if (enabled && admin) {
    const problems = problemLines(data, testMode ? [] : missing);
    const report = problems.length
      ? [copy.slack.problems.header(problems.length), ...problems].join("\n")
      : copy.slack.problems.allClear;
    const statePath =
      setting(config.ORGANIZER_STATE_FILE) ?? ".organizer-sheet-check.txt";
    const last = await lastSheetCheck(statePath);
    if (report !== last && (problems.length || last !== null)) {
      const adminId = await slackId(config, token, byName.get(admin), admin);
      if (adminId) {
        await postDm(token, await openDm(token, adminId), report);
        await writeFile(statePath, report);
        console.log(`Sent the sheet check (${problems.length} problems)`);
      }
    }
  }
  if (mode === "--watch" && enabled && admin) {
    await pushHeartbeat(config, token, byName.get(admin), admin);
  }
  if (result.issues.length) {
    throw new Error(
      quiet ? `${result.issues.length} Slack errors` : result.issues.join("\n"),
    );
  }
}

const HEARTBEAT_FILE = ".organizer-heartbeat.json";
const HEARTBEAT_AFTER_MS = 10 * 60_000;

/**
 * Dead man's switch for a watcher on a laptop: each healthy pass schedules a
 * "the bot stopped" DM to the admin 10 minutes out and cancels the previous
 * one. If the PC dies or syncs keep failing, nothing pushes it back and Slack
 * delivers it. The new one is queued before old ones are cancelled.
 */
async function pushHeartbeat(
  config: Config,
  token: string,
  person: Person | undefined,
  name: string,
) {
  const user = await slackId(config, token, person, name);
  if (!user) return;
  type Pending = { channel: string; id: string };
  const pending = JSON.parse(
    await readFile(HEARTBEAT_FILE, "utf8").catch(() => "[]"),
  ) as Pending[];
  const channel = await openDm(token, user);
  const res = await slackApi<SlackResponse & { scheduled_message_id?: string }>(
    token,
    "chat.scheduleMessage",
    {
      channel,
      post_at: String(Math.floor((Date.now() + HEARTBEAT_AFTER_MS) / 1000)),
      text: copy.slack.heartbeat(clock.format(new Date())),
      ...DM_OPTIONS,
    },
    fetch,
    10_000,
  );
  const keep: Pending[] = res.scheduled_message_id
    ? [{ channel, id: res.scheduled_message_id }]
    : [];
  for (const old of pending) {
    try {
      await slackApi(
        token,
        "chat.deleteScheduledMessage",
        { channel: old.channel, scheduled_message_id: old.id },
        fetch,
        10_000,
      );
    } catch (error) {
      // Already sent or gone: drop it. Anything else: retry next pass.
      const gone =
        error instanceof SlackApiError &&
        error.code === "invalid_scheduled_message_id";
      if (!gone) keep.push(old);
    }
  }
  await writeFile(HEARTBEAT_FILE, JSON.stringify(keep));
}

const [mode = "--preview", ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !/^(--preview(=[A-Za-z]+)?|--review|--who|--sync|--watch|--send-test=[A-Za-z]+|--rehearse=[A-Za-z]+)$/.test(
    mode,
  )
) {
  throw new Error(
    "Use --preview[=Name], --review, --who, --sync, --watch, --send-test=Name or --rehearse=Name",
  );
}
if (mode === "--watch") {
  for (;;) {
    try {
      await run(mode);
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    await sleep(30_000);
  }
} else {
  await run(mode);
}
