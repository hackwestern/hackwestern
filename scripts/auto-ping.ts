import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";
import { parse } from "dotenv";
import { google, type sheets_v4 } from "googleapis";
import { autoPingCopy as copy } from "~/content/auto-ping";
import {
  buildRoster,
  checkText,
  columnLetter,
  emailOf,
  groupUnits,
  matchScore,
  planAll,
  planFinal,
  planUnit,
  readMessages,
  peopleColumns,
  readPeople,
  readSchedule,
  readSignups,
  type Planned,
  type Unit,
} from "~/server/slack/auto-ping-schedule";
import {
  planGrid,
  planLines,
  sentNext,
  queueGrid,
  readQueue,
  reconcile,
  textHash,
  when,
  type LogEvent,
  type QueueRow,
  type SlackPort,
} from "~/server/slack/auto-ping-sync";
import { SlackApiError, type SlackResponse } from "~/server/slack/client";
import { readCsv } from "~/server/slack/csv";
import { DM_OPTIONS, call } from "~/server/slack/organizer-sync";

/**
 * Auto-Ping: Slack DMs for HW13 mentors, volunteers and judges from the
 * Auto-Ping sheet (check-in, shift reminders, after-shift, last day, final
 * thank you). The sheet is the source and the bot's memory: People, Messages
 * the schedule and contact info tabs in; Check before sending, Planned
 * messages, Log and Queue out.
 * See docs/auto-ping.md.
 */

const SHEET = "12O1XRmQN3mT-bwTFGKQEGAQ2gEb6fQIjsB55K_gcHf0";
const TABS = {
  people: "People",
  messages: "Messages",
  mentors: "Mentor schedule",
  volunteers: "Volunteer schedule",
  mentorSignups: "Mentor contact info",
  volunteerSignups: "Volunteer contact info",
  judgeSignups: "Judge contact info",
  log: "Log",
  queue: "Queue",
  planned: "Planned messages",
} as const;
const DEFAULT_TEST_EMAIL = "jazz.gu2004@gmail.com";

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

const quote = (tab: string) => `'${tab.replace(/'/g, "''")}'`;

/** The sheet's tabs as rows of strings, plus a way to write back (live only). */
type SheetInfo = { sheetId: number; formatted: boolean; filtered: boolean };
type Book = {
  tabs: Record<keyof typeof TABS, string[][]>;
  live: sheets_v4.Sheets | null;
  /** Tabs that exist (bot tabs are added on first write), by title. */
  sheets: Map<string, SheetInfo>;
  spreadsheetId: string;
};

async function openBook(config: Config): Promise<Book> {
  const dir = setting(config.AUTO_PING_SNAPSHOT_DIR);
  const spreadsheetId = setting(config.AUTO_PING_SHEET) ?? SHEET;
  if (dir) {
    const read = (tab: string) =>
      readFile(join(dir, `${tab}.csv`), "utf8").then(readCsv, () => []);
    const entries = await Promise.all(
      Object.entries(TABS).map(
        async ([k, tab]) => [k, await read(tab)] as const,
      ),
    );
    return {
      tabs: Object.fromEntries(entries) as Book["tabs"],
      live: null,
      sheets: new Map(),
      spreadsheetId,
    };
  }
  const email = setting(config.RUN_OF_SHOW_SHEETS_CLIENT_EMAIL);
  const key = config.RUN_OF_SHOW_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error(copy.errors.credentials);
  const auth = new google.auth.JWT({
    email,
    key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  try {
    const meta = await sheets.spreadsheets.get({
      spreadsheetId,
      fields:
        "sheets(properties(title,sheetId),conditionalFormats(ranges),basicFilter(range))",
    });
    const info = new Map<string, SheetInfo>(
      (meta.data.sheets ?? []).map((s) => [
        s.properties?.title ?? "",
        {
          sheetId: s.properties?.sheetId ?? 0,
          formatted: Boolean(s.conditionalFormats?.length),
          filtered: Boolean(s.basicFilter),
        },
      ]),
    );
    const titles = new Set(info.keys());
    const names = Object.entries(TABS).filter(([, tab]) => titles.has(tab));
    const res = await sheets.spreadsheets.values.batchGet({
      spreadsheetId,
      ranges: names.map(([, tab]) => `${quote(tab)}!A1:Z1000`),
    });
    const tabs = Object.fromEntries(
      Object.keys(TABS).map((k) => [k, [] as string[][]]),
    ) as Book["tabs"];
    res.data.valueRanges?.forEach((range, i) => {
      tabs[names[i]![0] as keyof typeof TABS] = (range.values ?? []).map(
        (row) => row.map((c) => String(c)),
      );
    });
    return { tabs, live: sheets, sheets: info, spreadsheetId };
  } catch (error) {
    const code = (error as { code?: number }).code;
    if (code === 403 || code === 404) throw new Error(copy.errors.share(email));
    throw error;
  }
}

function load(book: Book) {
  const people = readPeople(book.tabs.people);
  const entries = [
    ...readSchedule(book.tabs.mentors, "Mentor", TABS.mentors),
    ...readSchedule(book.tabs.volunteers, "Volunteer", TABS.volunteers),
  ];
  const signups = [
    ...readSignups(book.tabs.mentorSignups, "Mentor"),
    ...readSignups(book.tabs.volunteerSignups, "Volunteer"),
    ...readSignups(book.tabs.judgeSignups, "Judge"),
  ];
  const roster = buildRoster(people, entries, signups);
  const messages = readMessages(book.tabs.messages);
  return {
    roster,
    messages,
    queue: readQueue(book.tabs.queue),
    columns: peopleColumns(book.tabs.people[0]),
  };
}
type Data = ReturnType<typeof load>;

/**
 * People cells the bot writes: recomputed Shift for schedule people, its own
 * lines in Check before sending, and new rows. Never the Email or preview
 * formulas, and never Jess's columns on existing rows.
 */
async function writeRoster(book: Book, data: Data, addRows = true) {
  const sheets = book.live!;
  const raw: sheets_v4.Schema$ValueRange[] = [];
  const typed: sheets_v4.Schema$ValueRange[] = [];
  const tab = quote(TABS.people);
  const col = data.columns;
  const cell = (key: keyof Data["columns"], row: number) =>
    `${tab}!${columnLetter(col[key])}${row}`;
  let next = Math.max(1, ...data.roster.map((r) => r.row)) + 1;
  for (const row of data.roster) {
    const j = checkText(row.check, row.flags);
    if (row.isNew && !addRows) continue;
    if (row.isNew) {
      row.row = next++;
      const put = (key: keyof Data["columns"], value: string, user = false) =>
        (user ? typed : raw).push({
          range: cell(key, row.row),
          values: [[value]],
        });
      put("role", row.role ?? "");
      put("fullName", row.fullName);
      put("shift", row.newShift ?? "");
      put("poc", row.poc);
      put("send", "FALSE", true); // user-entered, so it stays a checkbox
      put("check", j);
      put("override", row.override);
      continue;
    }
    if (row.newShift !== undefined && row.newShift !== row.shift)
      raw.push({ range: cell("shift", row.row), values: [[row.newShift]] });
    if (j !== row.check.trim())
      raw.push({ range: cell("check", row.row), values: [[j]] });
  }
  const spreadsheetId = book.spreadsheetId;
  if (raw.length)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: raw },
    });
  if (typed.length)
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId,
      requestBody: { valueInputOption: "USER_ENTERED", data: typed },
    });
  return {
    cells: raw.length + typed.length,
    added: addRows ? data.roster.filter((r) => r.isNew).length : 0,
  };
}

/** Rewrite a bot-owned tab (Queue, Planned messages) in full. */
async function writeTab(book: Book, title: string, grid: string[][]) {
  const sheets = book.live!;
  const spreadsheetId = book.spreadsheetId;
  let info = book.sheets.get(title);
  if (!info) {
    const res = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title } } }] },
    });
    const sheetId = res.data.replies?.[0]?.addSheet?.properties?.sheetId ?? 0;
    info = { sheetId, formatted: false, filtered: false };
    book.sheets.set(title, info);
  }
  await sheets.spreadsheets.values.clear({
    spreadsheetId,
    range: `${quote(title)}!A:Z`,
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${quote(title)}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: grid },
  });
  return info;
}

const writeQueue = (book: Book, queue: QueueRow[]) =>
  writeTab(book, TABS.queue, queueGrid(queue));

async function writePlanned(
  book: Book,
  data: Data,
  queue: QueueRow[],
  enabled: boolean,
) {
  const lines = planLines(data.roster, data.messages, {
    queue,
    nowMs: Date.now(),
    enabled,
  });
  const info = await writeTab(book, TABS.planned, planGrid(lines));
  await formatPlanned(book, info);
  return lines.length;
}

const STATUS_COLUMN = copy.planned.header.indexOf("Status");
const rgb = (hex: string) => ({
  red: parseInt(hex.slice(0, 2), 16) / 255,
  green: parseInt(hex.slice(2, 4), 16) / 255,
  blue: parseInt(hex.slice(4, 6), 16) / 255,
});
/** Status colours: green sent, yellow queued, red held / not on Slack, grey off. */
const STATUS_COLOURS: [type: string, value: string, hex: string][] = [
  ["TEXT_EQ", copy.planned.status.sent, "d9ead3"],
  ["TEXT_EQ", copy.planned.status.queued, "fff2cc"],
  ["TEXT_STARTS_WITH", "Held", "f4cccc"],
  ["TEXT_EQ", copy.planned.status.notOnSlack, "f4cccc"],
  ["TEXT_STARTS_WITH", "Not ticked", "efefef"],
  ["TEXT_EQ", copy.planned.status.past, "efefef"],
];

/**
 * Colours and a filter on Planned messages, added once: only when the tab
 * has none, so a sync never stacks duplicate rules.
 */
async function formatPlanned(book: Book, info: SheetInfo) {
  const requests: sheets_v4.Schema$Request[] = [];
  if (!info.formatted) {
    STATUS_COLOURS.forEach(([type, value, hex], index) =>
      requests.push({
        addConditionalFormatRule: {
          index,
          rule: {
            ranges: [
              {
                sheetId: info.sheetId,
                startRowIndex: 1,
                startColumnIndex: STATUS_COLUMN,
                endColumnIndex: STATUS_COLUMN + 1,
              },
            ],
            booleanRule: {
              condition: { type, values: [{ userEnteredValue: value }] },
              format: { backgroundColor: rgb(hex) },
            },
          },
        },
      }),
    );
  }
  if (!info.filtered) {
    requests.push({
      setBasicFilter: {
        filter: {
          range: {
            sheetId: info.sheetId,
            startRowIndex: 0,
            startColumnIndex: 0,
            endColumnIndex: copy.planned.header.length,
          },
        },
      },
    });
  }
  if (!requests.length) return;
  await book.live!.spreadsheets.batchUpdate({
    spreadsheetId: book.spreadsheetId,
    requestBody: { requests },
  });
  info.formatted = true;
  info.filtered = true;
}

/** People column I: "Sent / next" per person, header included. */
async function writeSentNext(
  book: Book,
  data: Data,
  queue: QueueRow[],
  planned: Planned[],
  enabled: boolean,
) {
  const header = book.tabs.people[0] ?? [];
  let at = header.findIndex((h) => /^sent \/ next/i.test(h.trim()));
  // The old Status column (I), header removed: reuse it.
  if (at < 0 && /^(status)?$/i.test(header[8]?.trim() ?? "")) at = 8;
  if (at < 0) return 0;
  const tab = quote(TABS.people);
  const letter = columnLetter(at);
  const nowMs = Date.now();
  const data_: sheets_v4.Schema$ValueRange[] = [];
  if (header[at]?.trim() !== copy.sentNext.header)
    data_.push({
      range: `${tab}!${letter}1`,
      values: [[copy.sentNext.header]],
    });
  for (const row of data.roster) {
    if (!row.role || row.row < 2) continue;
    const text = sentNext(row, { queue, planned, nowMs, enabled });
    if (text !== (book.tabs.people[row.row - 1]?.[at]?.trim() ?? ""))
      data_.push({ range: `${tab}!${letter}${row.row}`, values: [[text]] });
  }
  if (data_.length)
    await book.live!.spreadsheets.values.batchUpdate({
      spreadsheetId: book.spreadsheetId,
      requestBody: { valueInputOption: "RAW", data: data_ },
    });
  return data_.length;
}

const stampFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  weekday: "short",
  month: "short",
  day: "numeric",
  hour: "numeric",
  minute: "2-digit",
});

async function writeLog(book: Book, events: LogEvent[], at: Date) {
  if (!events.length) return;
  await book.live!.spreadsheets.values.append({
    spreadsheetId: book.spreadsheetId,
    range: `${quote(TABS.log)}!A:G`,
    valueInputOption: "RAW",
    insertDataOption: "INSERT_ROWS",
    requestBody: {
      values: events.map((e) => [
        stampFormat.format(at),
        e.role,
        e.name,
        e.email,
        copy.log.channel,
        e.message,
        e.result,
      ]),
    },
  });
}

function slackPort(token: string): SlackPort {
  const api = <T extends SlackResponse>(
    method: string,
    args: Record<string, unknown>,
  ) => call<T>(token, method, args, fetch, (ms) => sleep(ms));
  return {
    async lookup(email) {
      try {
        const res = await api<SlackResponse & { user?: { id?: string } }>(
          "users.lookupByEmail",
          { email },
        );
        return res.user?.id ?? null;
      } catch (error) {
        if (error instanceof SlackApiError && error.code === "users_not_found")
          return null;
        throw error;
      }
    },
    async openDm(user) {
      const res = await api<SlackResponse & { channel?: { id?: string } }>(
        "conversations.open",
        { users: user },
      );
      if (!res.channel?.id) throw new Error("Slack returned no DM channel");
      return res.channel.id;
    },
    async schedule(channel, postAt, text) {
      const res = await api<SlackResponse & { scheduled_message_id?: string }>(
        "chat.scheduleMessage",
        { channel, post_at: String(postAt), text, ...DM_OPTIONS },
      );
      if (!res.scheduled_message_id) throw new Error("Slack returned no id");
      return res.scheduled_message_id;
    },
    async post(channel, text) {
      await api("chat.postMessage", { channel, text, ...DM_OPTIONS });
      await sleep(1100); // chat.postMessage: about one a second
    },
    async cancel(channel, id) {
      try {
        await api("chat.deleteScheduledMessage", {
          channel,
          scheduled_message_id: id,
        });
        return "ok";
      } catch (error) {
        if (
          error instanceof SlackApiError &&
          error.code === "invalid_scheduled_message_id"
        )
          return "gone";
        throw error;
      }
    },
  };
}

/** The unit (merged person) whose name best matches `name`, ignoring Send?. */
function findUnit(data: Data, name: string): Unit {
  const units = groupUnits(data.roster, false);
  const scored = units
    .map((unit) => ({
      unit,
      score: Math.max(...unit.rows.map((r) => matchScore(name, r.fullName))),
    }))
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score);
  if (!scored[0]) throw new Error(copy.errors.noPerson(name));
  return scored[0].unit;
}

function describe(p: Planned) {
  return p.text ?? `(held: ${p.missing} is blank)`;
}

function review(data: Data) {
  const plan = planAll(data.roster, data.messages);
  const out = [
    "# Auto-Ping: review",
    "",
    `${plan.length} timed messages for ${new Set(plan.map((p) => p.email)).size} people (${plan.filter((p) => p.text === null).length} held).`,
    "",
    "| Row | Role | Name | Shifts | Send? | Email | Flags | Planned |",
    "|---|---|---|---|---|---|---|---|",
  ];
  for (const row of data.roster) {
    if (!row.role) continue;
    const email = emailOf(row);
    const mine = plan.filter(
      (p) => p.email === email && p.rows.includes(row.row),
    );
    out.push(
      `| ${row.isNew ? "new" : row.row} | ${row.role} | ${row.fullName} | ${row.shifts.map((s) => s.label).join(", ") || "-"} | ${row.send ? "yes" : "no"} | ${email ? "yes" : "NO"} | ${row.flags.map((f) => (f.blocking ? `**${f.text}**` : f.text)).join("; ") || "-"} | ${mine.map((p) => `${when(p.postAt)} ${p.template}${p.text === null ? ` (held: ${p.missing})` : ""}`).join("<br>") || "-"} |`,
    );
  }
  const blank = Object.entries(data.messages.fills)
    .filter(([, v]) => !v)
    .map(([k]) => `{${k}}`);
  out.push("", `Blank fill-ins: ${blank.join(", ") || "none"}`);
  return out.join("\n");
}

async function run(mode: string) {
  const config = await settings();
  const quiet = config.AUTO_PING_QUIET === "1"; // CI logs are public: counts only
  const book = await openBook(config);
  const data = load(book);

  if (mode === "--review") {
    console.log(review(data));
    return;
  }
  if (mode === "--preview" || mode.startsWith("--preview=")) {
    const name = mode.split("=")[1];
    const rows = name
      ? (() => {
          const unit = findUnit(data, name);
          return [
            ...planUnit(unit, data.messages),
            planFinal(unit, data.messages, new Date()),
          ];
        })()
      : planAll(data.roster, data.messages);
    for (const p of rows) {
      const at = p.kind === "final" ? "by hand (--send-final)" : when(p.postAt);
      console.log(`\n${at} → ${p.name} · ${p.template}\n${describe(p)}`);
    }
    console.log(`\n${rows.length} messages`);
    return;
  }

  if (mode === "--plan") {
    // Sheet only, no Slack: People Shift / Check before sending / Sent /
    // next (no new rows) and the Planned messages tab.
    if (!book.live) throw new Error(copy.errors.snapshotWrite);
    const enabled = config.AUTO_PING_ENABLED === "1";
    const roster = await writeRoster(book, data, false);
    const lines = await writePlanned(book, data, data.queue, enabled);
    const plan = enabled ? planAll(data.roster, data.messages) : [];
    const cells = await writeSentNext(book, data, data.queue, plan, enabled);
    console.log(
      `Planned messages: ${lines} rows; People: ${roster.cells + cells} cells`,
    );
    return;
  }

  const token = setting(config.SLACK_BOT_TOKEN);
  if (!token) throw new Error("Set SLACK_BOT_TOKEN");
  const slack = slackPort(token);

  if (mode.startsWith("--send-test=")) {
    const unit = findUnit(data, mode.slice("--send-test=".length));
    const testEmail =
      setting(config.AUTO_PING_TEST_EMAIL) ?? DEFAULT_TEST_EMAIL;
    const user = await slack.lookup(testEmail);
    if (!user) throw new Error(copy.errors.noTestRecipient(testEmail));
    const channel = await slack.openDm(user);
    const rows = [
      ...planUnit(unit, data.messages),
      planFinal(unit, data.messages, new Date()),
    ];
    let sent = 0;
    for (const p of rows) {
      const at = p.kind === "final" ? copy.kinds.final : when(p.postAt);
      if (p.text === null) {
        console.log(`Skipped ${p.template}: held, ${p.missing} is blank`);
        continue;
      }
      await slack.post(channel, `${copy.test(unit.name, at)}\n${p.text}`);
      sent++;
    }
    console.log(`Sent ${sent} test messages`);
    return;
  }

  if (!book.live) throw new Error(copy.errors.snapshotWrite);
  const enabled = config.AUTO_PING_ENABLED === "1";
  const roster = await writeRoster(book, data);

  if (mode === "--send-final") {
    if (!enabled) throw new Error(copy.errors.disabled);
    const blank = ["hackers", "projects"].filter(
      (k) => !data.messages.fills[k],
    );
    if (blank.length)
      throw new Error(
        copy.errors.finalBlank(blank.map((k) => `{${k}}`).join(" and ")),
      );
    const now = new Date();
    const queue = new Map(data.queue.map((r) => [r.key, r]));
    const events: LogEvent[] = [];
    const finals = groupUnits(data.roster).map((u) =>
      planFinal(u, data.messages, now),
    );
    let sent = 0;
    let held = 0;
    let skipped = 0;
    const failures: string[] = [];
    try {
      for (const p of finals) {
        if (queue.get(p.key)?.status === "sent" || !p.email) {
          skipped++;
          continue;
        }
        if (p.text === null) {
          held++;
          continue;
        }
        try {
          const user = await slack.lookup(p.email);
          const ev = {
            key: p.key,
            role: p.role,
            name: p.name,
            email: p.email,
            message: p.template,
          };
          if (!user) {
            events.push({ ...ev, result: copy.log.notOnSlack });
            continue;
          }
          const channel = await slack.openDm(user);
          await slack.post(channel, p.text);
          queue.set(p.key, {
            ...ev,
            channel,
            messageId: "",
            postAt: now.toISOString(),
            hash: textHash(p.text),
            status: "sent",
            updated: now.toISOString(),
          });
          events.push({ ...ev, result: copy.log.sent });
          sent++;
        } catch (error) {
          failures.push(String(error));
        }
      }
    } finally {
      await writeQueue(book, [...queue.values()]);
      await writeLog(book, events, now);
      await writePlanned(book, data, [...queue.values()], enabled);
      await writeSentNext(book, data, [...queue.values()], [], enabled);
    }
    console.log(
      `Final thank you: ${sent} sent, ${skipped} already sent or no email, ${held} held`,
    );
    if (failures.length)
      throw new Error(
        quiet ? `${failures.length} Slack errors` : failures.join("\n"),
      );
    return;
  }

  // --sync. Off: an empty plan, which cancels everything still queued.
  const planned = enabled ? planAll(data.roster, data.messages) : [];
  const result = await reconcile({ planned, queue: data.queue, slack });
  const now = new Date();
  await writeQueue(book, result.queue);
  await writeLog(book, result.events, now);
  const lines = await writePlanned(book, data, result.queue, enabled);
  await writeSentNext(book, data, result.queue, planned, enabled);
  const c = result.counts;
  console.log(
    `${enabled ? "Live" : "Off"}: ${c.scheduled} queued, ${c.sent} sent now, ${c.kept} unchanged, ${c.cancelled} cancelled, ${c.held} held, ${c.notOnSlack} not on Slack; ` +
      `People: ${roster.added} added, ${roster.cells} cells; ${lines} planned rows; ${result.events.length} log rows`,
  );
  if (result.issues.length) {
    throw new Error(
      quiet ? `${result.issues.length} Slack errors` : result.issues.join("\n"),
    );
  }
}

const [mode = "--preview", ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !/^(--preview(=.+)?|--review|--plan|--sync|--send-final|--send-test=.+)$/.test(
    mode,
  )
) {
  throw new Error(
    'Use --preview[="Full Name"], --review, --plan, --sync, --send-final or --send-test="Full Name"',
  );
}
await run(mode);
