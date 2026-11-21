import { readFile, writeFile } from "node:fs/promises";

/**
 * Small text values a bot keeps between runs: the last sheet-check DM, the
 * pending heartbeat DMs, cached Slack ids. On a laptop or in GitHub Actions
 * they're files (the same files as before); on Vercel there's no lasting
 * disk, so the cron route passes a database-backed store (bot-state-db.ts).
 */
export type StateStore = {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
};

/** Keys with a path are files; any other key lives only in memory. */
export function fileStore(paths: Record<string, string>): StateStore {
  const memory = new Map<string, string>();
  return {
    async get(key) {
      const path = paths[key];
      if (!path) return memory.get(key) ?? null;
      return readFile(path, "utf8").catch(() => null);
    },
    async set(key, value) {
      const path = paths[key];
      if (!path) memory.set(key, value);
      else await writeFile(path, value);
    },
  };
}

export const memoryStore = (): StateStore => fileStore({});
