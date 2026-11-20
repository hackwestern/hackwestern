import { readFile } from "node:fs/promises";
import { parse } from "dotenv";
import { runAutoPing } from "~/server/slack/auto-ping-run";

/**
 * CLI for Auto-Ping, the mentor, volunteer and judge DMs
 * (src/server/slack/auto-ping-run.ts). See docs/auto-ping.md.
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
  !/^(--preview(=.+)?|--review|--plan|--sync|--dry-run|--send-final|--send-test=.+)$/.test(
    mode,
  )
) {
  throw new Error(
    'Use --preview[="Full Name"], --review, --plan, --sync, --dry-run, --send-final or --send-test="Full Name"',
  );
}
const config = await settings();
if (mode === "--dry-run") await runAutoPing("--sync", config, { dryRun: true });
else await runAutoPing(mode, config);
