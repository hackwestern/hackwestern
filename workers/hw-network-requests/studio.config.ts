/**
 * Drizzle Studio config for the LOCAL D1 sqlite file (the one `wrangler dev` /
 * `--local` writes under workers/hw-network-requests/.wrangler). Never touches
 * remote D1. Run with `npm run load-tester:studio`.
 */
import fs from "node:fs";
import path from "node:path";
import { defineConfig } from "drizzle-kit";

const dir = path.join(
  __dirname,
  ".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
);
// One file per database id; metadata.sqlite is wrangler's own bookkeeping.
const files = fs.existsSync(dir)
  ? fs
      .readdirSync(dir)
      .filter((f) => f.endsWith(".sqlite") && f !== "metadata.sqlite")
      .map((f) => {
        const file = path.join(dir, f);
        // Recent writes sit in the -wal file until a checkpoint.
        const wal = fs.existsSync(`${file}-wal`)
          ? fs.statSync(`${file}-wal`).mtimeMs
          : 0;
        return { f, t: Math.max(fs.statSync(file).mtimeMs, wal) };
      })
      .sort((a, b) => b.t - a.t)
  : [];
if (!files[0]) {
  throw new Error(
    "No local D1 file yet. Run `npm run load-tester:migrate` first.",
  );
}

export default defineConfig({
  dialect: "sqlite",
  dbCredentials: { url: `file:${path.join(dir, files[0].f)}` },
});
