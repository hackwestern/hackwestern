import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { parse } from "dotenv";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { slackApi } from "~/server/slack/client";
import { lookupSlackUser } from "~/server/slack/dm";
import {
  marketingMessageOptions,
  openMarketingDm,
  syncMarketingReminders,
} from "~/server/slack/marketing-notifications";
import {
  marketingOwners,
  planMarketingReminders,
  readMarketingTasks,
  type MarketingOwner,
} from "~/server/slack/marketing-schedule";

async function settings() {
  const file = await readFile(".env", "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return "";
    },
  );
  return { ...parse(file), ...process.env };
}

function owner(value: string): MarketingOwner {
  const match = marketingOwners.find(
    (name) => name.toLowerCase() === value.toLowerCase(),
  );
  if (!match) throw new Error(`Unknown marketing recipient: ${value}`);
  return match;
}

async function slackId(
  config: NodeJS.ProcessEnv,
  token: string,
  name: MarketingOwner,
) {
  const raw = config.MARKETING_SLACK_EMAILS?.trim();
  let emails: unknown;
  if (raw) {
    try {
      emails = JSON.parse(raw);
    } catch {
      throw new Error("MARKETING_SLACK_EMAILS must be a JSON array");
    }
    if (
      !Array.isArray(emails) ||
      emails.length !== marketingOwners.length ||
      emails.some((email: unknown) => typeof email !== "string")
    ) {
      throw new Error(
        "MARKETING_SLACK_EMAILS needs four strings in order: Allison, Brittney, Anson, Jamie",
      );
    }
    const value: unknown = emails[marketingOwners.indexOf(name)];
    const email = typeof value === "string" ? value.trim() : "";
    if (email) {
      if (!/^[^\s@]+@[^\s@]+$/.test(email))
        throw new Error(`Invalid Slack email for ${name}`);
      const user = await lookupSlackUser(token, email, fetch, 10_000);
      if (!user)
        throw new Error(`Slack found no member for ${name}'s configured email`);
      return user.id;
    }
  }
  const id = config[`MARKETING_${name.toUpperCase()}_SLACK_USER_ID`]?.trim();
  if (!id || !/^[UW][A-Z0-9]+$/.test(id)) {
    throw new Error(`Fill in ${name}'s address in MARKETING_SLACK_EMAILS`);
  }
  return id;
}

async function run(mode: string) {
  const config = await settings();
  const enabled = config.MARKETING_NOTIFICATIONS_ENABLED === "1";
  const live = mode === "--sync" || mode === "--watch";
  const testMode = config.MARKETING_NOTIFICATION_TEST_MODE === "1";
  const skipIds = new Set(
    (config.MARKETING_NOTIFICATION_SKIP_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean),
  );
  const plan =
    live && !enabled
      ? []
      : planMarketingReminders(
          readMarketingTasks(
            await readFile(
              config.MARKETING_NOTIFICATION_SCHEDULE_PATH ||
                "context/HW13_Notification_Schedule.csv",
              "utf8",
            ),
          ),
          skipIds,
        );
  if (mode === "--preview" || mode.startsWith("--preview=")) {
    const filter = mode.includes("=")
      ? owner(mode.slice("--preview=".length))
      : null;
    const selected = filter
      ? plan.filter((row) => row.recipientName === filter)
      : plan;
    for (const row of selected) {
      console.log(
        `\n${row.postAt.toISOString()} → ${row.recipientName} (tasks ${row.taskIds.join(", ")})\n${row.text}`,
      );
    }
    console.log(
      `\n${selected.length} reminders for ${selected.reduce((sum, row) => sum + row.taskIds.length, 0)} tasks`,
    );
    return;
  }

  const token = config.SLACK_BOT_TOKEN?.trim();
  if (!token) throw new Error("Set SLACK_BOT_TOKEN");
  if (mode.startsWith("--send-test=")) {
    const selected = owner(mode.slice("--send-test=".length));
    const target = owner(
      config.MARKETING_NOTIFICATION_TEST_RECIPIENT || "Allison",
    );
    const channel = await openMarketingDm(
      token,
      await slackId(config, token, target),
    );
    for (const row of plan.filter((item) => item.recipientName === selected)) {
      await slackApi(
        token,
        "chat.postMessage",
        {
          channel,
          text: `[TEST for ${selected} · ${row.postAt.toISOString()}]\n${row.text}`,
          ...marketingMessageOptions,
        },
        fetch,
        10_000,
      );
      await sleep(1100);
    }
    return;
  }

  const target =
    testMode && enabled
      ? owner(config.MARKETING_NOTIFICATION_TEST_RECIPIENT || "Allison")
      : null;
  const upcoming = plan.filter((row) => +row.postAt > Date.now());
  const recipients = new Set(
    upcoming.map((row) => target ?? row.recipientName),
  );
  const ids = new Map<MarketingOwner, string>();
  for (const recipient of recipients) {
    ids.set(recipient, await slackId(config, token, recipient));
  }
  const desired = upcoming.map((row) => {
    const slackUserId = ids.get(target ?? row.recipientName)!;
    return {
      ...row,
      slackUserId,
      routeKey: `${target ? "test" : "live"}:${slackUserId}`,
      text: target ? `[TEST for ${row.recipientName}]\n${row.text}` : row.text,
    };
  });
  if (!config.DATABASE_URL) throw new Error("Set DATABASE_URL");
  // One connection holds the session lock while Drizzle uses the other.
  const connection = postgres(config.DATABASE_URL, { max: 2 });
  const db = drizzle(connection);
  try {
    const session = await connection.reserve();
    try {
      // Hold a session lock while committing each Slack receipt independently.
      const [lock] =
        await session`select pg_try_advisory_lock(13112026) as acquired`;
      if (!lock?.acquired)
        throw new Error("Another marketing notification sync is running");
      const result = await syncMarketingReminders(db, token, desired);
      const missed = plan.filter((row) => +row.postAt <= Date.now()).length;
      console.log(
        `${result.scheduled} queued, ${result.kept} unchanged, ${result.cancelled} cancelled, ${missed} past schedule times`,
      );
      if (result.issues.length) throw new Error(result.issues.join("\n"));
    } finally {
      // Closing the reserved connection releases its session lock.
      session.release();
    }
  } finally {
    await connection.end();
  }
}

const [mode = "--preview", ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !/^(--preview(=[A-Za-z]+)?|--sync|--watch|--send-test=[A-Za-z]+)$/.test(mode)
) {
  throw new Error(
    "Use --preview[=Owner], --sync, --watch, or --send-test=Owner",
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
