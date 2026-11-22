import { eq, inArray, sql } from "drizzle-orm";

import { addJudges } from "~/server/api/routers/judging";
import { db } from "~/server/db";
import { accounts, judges, users } from "~/server/db/schema";

/** EXTERNAL_JUDGE_EMAILS: comma, space or newline separated, any case. */
export function parseJudgeEmails(raw: string | undefined): string[] {
  return [
    ...new Set(
      (raw ?? "")
        .split(/[\s,]+/)
        .map((e) => e.trim().toLowerCase())
        .filter(Boolean),
    ),
  ];
}

/**
 * Adds every listed email that now has a Hack Western account as a general
 * judge, the same as an organizer's "Add judge". Only accounts whose email is
 * proven count: a verified email, or a Google/GitHub/Discord sign-in. Anyone
 * already a judge is left alone (a no-show stays a no-show).
 */
export async function addListedJudges(emails: string[]) {
  if (emails.length === 0) return { added: [], waiting: [] };
  const found = await db
    .select({
      id: users.id,
      email: users.email,
      verified: users.emailVerified,
      judgeId: judges.id,
    })
    .from(users)
    .leftJoin(judges, eq(judges.id, users.id))
    .where(inArray(sql`lower(${users.email})`, emails));
  const oauth = new Set(
    found.length === 0
      ? []
      : (
          await db
            .select({ userId: accounts.userId })
            .from(accounts)
            .where(
              inArray(
                accounts.userId,
                found.map((f) => f.id),
              ),
            )
        ).map((a) => a.userId),
  );
  const toAdd = found.filter(
    (f) => f.judgeId === null && (f.verified !== null || oauth.has(f.id)),
  );
  if (toAdd.length > 0) {
    await addJudges(toAdd.map((f) => ({ id: f.id, type: "organizer" })));
  }
  const done = new Set(
    found
      .filter((f) => f.judgeId !== null || toAdd.includes(f))
      .map((f) => f.email.toLowerCase()),
  );
  return {
    added: toAdd.map((f) => f.email.toLowerCase()),
    waiting: emails.filter((e) => !done.has(e)),
  };
}
