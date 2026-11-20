import { readFile } from "node:fs/promises";
import { setTimeout as sleep } from "node:timers/promises";
import { parse } from "dotenv";
import { fileStore } from "~/server/slack/bot-state";
import { setting } from "~/server/slack/organizer-load";
import { ORGANIZER_STATE, runOrganizer } from "~/server/slack/organizer-run";

/**
 * CLI for the organizer run-of-show reminders (src/server/slack/organizer-run.ts).
 * State lives in local files, as it always has. See docs/organizer-notifications.md.
 */

async function settings() {
  const file = await readFile(".env", "utf8").catch(
    (error: NodeJS.ErrnoException) => {
      if (error.code !== "ENOENT") throw error;
      return "";
    },
  );
  return { ...parse(file), ...process.env } as Record<
    string,
    string | undefined
  >;
}

const [mode = "--preview", ...extra] = process.argv.slice(2);
if (
  extra.length ||
  !/^(--preview(=[A-Za-z]+)?|--review|--who|--sync|--dry-run|--watch|--send-test=[A-Za-z]+|--rehearse=[A-Za-z]+)$/.test(
    mode,
  )
) {
  throw new Error(
    "Use --preview[=Name], --review, --who, --sync, --dry-run, --watch, --send-test=Name or --rehearse=Name",
  );
}

// Settings are re-read every pass, so a --watch picks up .env edits.
async function once() {
  const config = await settings();
  const store = fileStore({
    [ORGANIZER_STATE.sheetCheck]:
      setting(config.ORGANIZER_STATE_FILE) ?? ".organizer-sheet-check.txt",
    [ORGANIZER_STATE.heartbeat]: ".organizer-heartbeat.json",
  });
  return mode === "--dry-run"
    ? runOrganizer("--sync", config, { store, dryRun: true })
    : runOrganizer(mode, config, { store });
}

if (mode === "--watch") {
  for (;;) {
    try {
      await once();
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
    }
    await sleep(30_000);
  }
} else {
  await once();
}
