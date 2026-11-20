import { readFile } from "node:fs/promises";
import { google } from "googleapis";
import { SlackApiError, slackApi, type SlackResponse } from "./client";
import { readCsv } from "./csv";
import {
  KNOWN_SLACK_IDS,
  linkToken,
  planOrganizerReminders,
  readContacts,
  readRoster,
  readRunOfShow,
  type CellMerge,
  type Person,
} from "./organizer-schedule";

/**
 * Reads the HW13 run of show and Contacts sheets and builds the organizer
 * reminder plan. Shared by the reminder bot (scripts/organizer-notifications.ts (CLI; logic in src/server/slack/organizer-run.ts))
 * and the organizer Ping Logs page, so both see exactly the same DMs.
 */

export const RUN_OF_SHOW_SHEET = "1lnRCD_q_EYaAcmL-IXkmuWZMNAiFIiU1Linbm8jHyAE";
export const RUN_OF_SHOW_RANGE = "'Schedule View'";
export const CONTACTS_SHEET = "16bur9ixrVm-DqXtAs3DJZEWZQ7gXTc92Gs4sflFUxSg";
export const CONTACTS_RANGE = "Sheet1";

/**
 * The bot's dead man's switch: each healthy pass queues a "the bot stopped"
 * DM to the admin this far out and cancels the previous one.
 */
export const ORGANIZER_HEARTBEAT_AFTER_MS = 10 * 60_000;

export type Config = Record<string, string | undefined>;

/** An env value, or undefined when unset or blank. */
export const setting = (value: string | undefined) =>
  value?.trim() ? value.trim() : undefined;

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
  chipRuns?:
    | {
        startIndex?: number | null;
        chip?: { richLinkProperties?: { uri?: string | null } | null } | null;
      }[]
    | null;
  textFormatRuns?:
    | {
        startIndex?: number | null;
        format?: { link?: { uri?: string | null } | null } | null;
      }[]
    | null;
};

/** Runs of a cell (text links or smart chips): each lasts until the next. */
type Run = { start: number; uri: string | null };

/** The run covering character `at` (the last one starting at or before it). */
function covering(runs: Run[], at: number): string | null {
  let uri: string | null = null;
  for (const r of runs) if (r.start <= at) uri = r.uri;
  return uri;
}

/**
 * A cell's text with its linked parts kept as link tokens (see linkToken).
 * Links come from text links ("Auto-Ping" linked by hand) or smart chips
 * (a pasted Google Doc, e.g. "HW13 Help Desk Guide").
 */
function cellText(cell: GridCell): string {
  const text = cell.formattedValue ?? "";
  const textRuns: Run[] = (cell.textFormatRuns ?? []).map((r) => ({
    start: r.startIndex ?? 0,
    uri: r.format?.link?.uri ?? null,
  }));
  const chipRuns: Run[] = (cell.chipRuns ?? []).map((r) => ({
    start: r.startIndex ?? 0,
    uri: r.chip?.richLinkProperties?.uri ?? null,
  }));
  if (![...textRuns, ...chipRuns].some((r) => r.uri)) {
    return cell.hyperlink && text ? linkToken(cell.hyperlink, text) : text;
  }
  const cuts = [
    ...new Set(
      [0, ...textRuns, ...chipRuns].map((r) =>
        typeof r === "number" ? r : r.start,
      ),
    ),
  ]
    .filter((n) => n < text.length)
    .sort((a, b) => a - b);
  return cuts
    .map((start, i) => {
      const part = text.slice(start, cuts[i + 1] ?? text.length);
      const uri = covering(chipRuns, start) ?? covering(textRuns, start);
      return uri && part.trim() ? linkToken(uri, part) : part;
    })
    .join("");
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
        "sheets.merges,sheets.data.rowData.values(formattedValue,hyperlink,textFormatRuns(startIndex,format(link(uri))),chipRuns(startIndex,chip(richLinkProperties(uri))))",
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

export async function loadOrganizerData(config: Config) {
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
export type OrganizerData = Awaited<ReturnType<typeof loadOrganizerData>>;

/** Slack ids by email (null: not on Slack), kept for the life of the process. */
export const slackLookups = new Map<string, string | null>();
const lookups = slackLookups;

/** Slack user id: ORGANIZER_SLACK_IDS / KNOWN_SLACK_IDS, else contact emails. */
export async function slackId(
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
