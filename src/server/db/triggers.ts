/**
 * Applies the judging trigger DDL (src/server/db/triggers.sql).
 *
 * `triggers.sql` is the source of truth. The production migration runs that
 * file; the Vitest harness calls `applyTriggers(db)` after `pushSchema` so
 * tests run against the real triggers (pushSchema only loads Drizzle's
 * schema DSL, which can't express triggers).
 */
import { readFileSync } from "node:fs";
import { sql } from "drizzle-orm";

const triggersSqlPath = new URL("./triggers.sql", import.meta.url);

/**
 * Split SQL into individual statements, respecting `$$`-quoted function
 * bodies (a naive split on `;` would break the plpgsql bodies in two).
 */
function splitSqlStatements(text: string): string[] {
  const statements: string[] = [];
  let current = "";
  let inDollar = false;
  for (let i = 0; i < text.length; i++) {
    if (text.startsWith("$$", i)) {
      inDollar = !inDollar;
      current += "$$";
      i += 1; // skip the second '$'
      continue;
    }
    const ch = text[i]!;
    if (ch === ";" && !inDollar) {
      if (current.trim()) statements.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  if (current.trim()) statements.push(current.trim());
  return statements;
}

export function getTriggerStatements(): string[] {
  const text = readFileSync(triggersSqlPath, "utf8");
  return splitSqlStatements(text);
}

/**
 * Execute the trigger DDL against a Drizzle database (PGlite or postgres-js).
 * Idempotent — the statements use CREATE OR REPLACE / DROP IF EXISTS.
 */
export async function applyTriggers(database: {
  execute: (query: ReturnType<typeof sql.raw>) => Promise<unknown>;
}): Promise<void> {
  for (const statement of getTriggerStatements()) {
    await database.execute(sql.raw(statement));
  }
}
