import { escapeSlackText } from "./client";

export const marketingOwners = [
  "Allison",
  "Brittney",
  "Anson",
  "Jamie",
] as const;
export type MarketingOwner = (typeof marketingOwners)[number];

type Task = {
  id: string;
  owner: MarketingOwner;
  type: "Slack message" | "Story";
  taskAt: Date;
  postAt: Date;
  title: string;
  location: string;
  tags: string;
  notes: string;
  message: string;
};

const zone = "America/Toronto";
const easternClock = new Intl.DateTimeFormat("sv-SE", {
  timeZone: zone,
  dateStyle: "short",
  timeStyle: "short",
});

function easternInstant(value: string): Date {
  const nominal = Date.parse(value.replace(" ", "T") + ":00Z");
  if (!/^\d{4}-\d\d-\d\d \d\d:\d\d$/.test(value) || !Number.isFinite(nominal)) {
    throw new Error(`Invalid Eastern timestamp: ${value}`);
  }
  const localAtNominal = easternClock.format(nominal);
  const offset =
    Date.parse(localAtNominal.replace(" ", "T") + ":00Z") - nominal;
  const result = new Date(nominal - offset);
  if (easternClock.format(result) !== value) {
    throw new Error(`Invalid Eastern timestamp: ${value}`);
  }
  return result;
}

const shiftStart = easternInstant("2026-11-21 20:00");
const shiftEnd = easternInstant("2026-11-22 00:00");

// Parse quoted fields, including escaped quotes, commas and embedded newlines.
function csvRows(csv: string): string[][] {
  const rows: string[][] = [];
  const input = csv.replace(/^\uFEFF/, "");
  const field = /(?:"((?:[^"]|"")*)"|([^",\r\n]*))(,|\r\n|\n|\r|$)/y;
  let row: string[] = [];
  let offset = 0;
  while (offset < input.length) {
    field.lastIndex = offset;
    const match = field.exec(input);
    if (!match) throw new Error(`Malformed CSV on record ${rows.length + 1}`);
    offset = field.lastIndex;
    row.push(match[1]?.replaceAll('""', '"') ?? match[2] ?? "");
    if (match[3] === "," && offset === input.length) row.push("");
    else if (match[3] === ",") continue;
    if (row.length > 1 || row[0]?.trim()) rows.push(row);
    row = [];
  }
  return rows;
}

export function readMarketingTasks(csv: string): Task[] {
  const [header, ...rows] = csvRows(csv);
  const required = [
    "id",
    "task_time_ET",
    "notify_time_ET",
    "owner",
    "type",
    "title",
    "location",
    "ig_tags",
    "notes",
    "message_text",
  ];
  if (
    !header ||
    new Set(header).size !== header.length ||
    required.some((column) => !header.includes(column))
  ) {
    throw new Error(
      "Schedule CSV is missing a required column or has duplicate headers",
    );
  }
  const seen = new Set<string>();
  return rows.map((row, index) => {
    const get = (column: string) => row[header.indexOf(column)] ?? "";
    const id = get("id").trim();
    const type = get("type").trim();
    const title = get("title").trim();
    const message = get("message_text");
    const location = get("location").trim();
    const owner = marketingOwners.find((name) => name === get("owner").trim());
    if (
      row.length !== header.length ||
      !id ||
      seen.has(id) ||
      !title ||
      !owner ||
      (type !== "Story" && type !== "Slack message") ||
      (type === "Story" && !location) ||
      (type === "Slack message" && !message.trim())
    ) {
      throw new Error(
        `Invalid schedule record ${index + 2} (task ${id || "unknown"})`,
      );
    }
    seen.add(id);
    const taskAt = easternInstant(get("task_time_ET").trim());
    const postAt = easternInstant(get("notify_time_ET").trim());
    if (+taskAt - +postAt !== 300_000) {
      throw new Error(
        `Task ${id} must have a notify time five minutes before its task time`,
      );
    }
    return {
      id,
      type,
      title,
      taskAt,
      postAt,
      location,
      message,
      owner:
        type === "Story"
          ? owner
          : taskAt >= shiftStart && taskAt < shiftEnd
            ? "Brittney"
            : "Allison",
      tags: get("ig_tags").trim(),
      notes: get("notes").trim(),
    };
  });
}

const timeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: zone,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const weekday = new Intl.DateTimeFormat("en-US", {
  timeZone: zone,
  weekday: "short",
});

function displayTime(date: Date, relativeTo = date) {
  const time = timeFormat.format(date);
  return easternClock.format(date).slice(0, 10) ===
    easternClock.format(relativeTo).slice(0, 10)
    ? time
    : `${weekday.format(date)} ${time}`;
}

export type MarketingReminder = {
  reminderKey: string;
  recipientName: MarketingOwner;
  postAt: Date;
  taskIds: string[];
  text: string;
};

function formatReminder(
  group: Task[],
  ownerTasks: Task[],
  first: Task,
): string {
  const messages = group.filter((task) => task.type === "Slack message");
  const stories = group.filter((task) => task.type === "Story");
  const mixed = messages.length && stories.length;
  const time = displayTime(first.taskAt);
  const lines = [
    mixed
      ? `⏰ Due in 5 min: ${time} (${group.length} tasks)`
      : messages.length
        ? `⏰ Post in 5 min: ${time}`
        : `⏰ Story in 5 min: ${time}`,
    "",
  ];
  const number = (index: number, count: number) =>
    count > 1 ? ` ${index + 1}/${count}` : "";
  messages.forEach((task, index) => {
    lines.push(
      `📣 Slack message${number(index, messages.length)}: ${escapeSlackText(task.title)}`,
      "\x60\x60\x60\n" + escapeSlackText(task.message) + "\n\x60\x60\x60",
    );
  });
  stories.forEach((task, index) => {
    lines.push(
      `📸 Story${number(index, stories.length)}: ${escapeSlackText(task.title)} · ${escapeSlackText(task.location)}`,
    );
    if (task.tags) lines.push(`Tag: ${escapeSlackText(task.tags)}`);
    if (task.notes) lines.push(`Note: ${escapeSlackText(task.notes)}`);
  });
  if (first.owner === "Allison") {
    const future = ownerTasks.filter((task) => task.taskAt > first.taskAt);
    const story = future.find((task) => task.type === "Story");
    const message = future.find((task) => task.type === "Slack message");
    const more = message
      ? future.filter(
          (task) =>
            task.type === "Slack message" && +task.taskAt === +message.taskAt,
        ).length - 1
      : 0;
    const nextTime = (task: Task) => displayTime(task.taskAt, first.taskAt);
    lines.push(
      "───",
      "📸 Next story: " +
        (story
          ? `${nextTime(story)} · ${escapeSlackText(story.location)} · ${escapeSlackText(story.title)}`
          : "None"),
      "📣 Next message: " +
        (message
          ? `${nextTime(message)} · ${escapeSlackText(message.title)}${more ? ` + ${more} more` : ""}`
          : "None"),
    );
    if (
      first.taskAt >= easternInstant("2026-11-21 00:00") &&
      first.taskAt < shiftEnd &&
      message &&
      message.taskAt >= shiftStart
    ) {
      lines.push("ℹ️ Brittney covers Slack from 8:00 to 11:59 PM tonight.");
    }
  }
  return lines.join("\n");
}

export function planMarketingReminders(
  tasks: Task[],
  skipIds: ReadonlySet<string> = new Set(),
): MarketingReminder[] {
  const active = tasks
    .filter(({ id }) => !skipIds.has(id))
    .sort((a, b) => +a.taskAt - +b.taskAt);
  const groups = new Map<string, Task[]>();
  for (const task of active) {
    const key = `${task.owner}:${task.taskAt.toISOString()}`;
    const group = groups.get(key);
    if (group) group.push(task);
    else groups.set(key, [task]);
  }
  return Array.from(groups, ([reminderKey, group]) => {
    const first = group[0]!;
    return {
      reminderKey,
      recipientName: first.owner,
      postAt: first.postAt,
      taskIds: group.map((task) => task.id),
      text: formatReminder(
        group,
        active.filter((task) => task.owner === first.owner),
        first,
      ),
    };
  });
}
