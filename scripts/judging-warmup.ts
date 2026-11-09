/**
 * Pre-fills a freshly seeded judging demo so the control room has something
 * to show: judge3-5 and the sponsor judges each score a few teams through the
 * real tRPC procedures, then judge3 and judge4 are left holding a team.
 * Judges are deliberately strict or generous so the normalized ranking has
 * something to correct. organizer@ is left untouched for a person to drive.
 *
 *   npm run seed:judging -- --teams 30 --judges 5 --sponsors 2 --rounds 3 --yes
 *   npm run judging:warmup
 */
import { eq, like } from "drizzle-orm";
import type { Session } from "next-auth";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { conn, db } from "~/server/db";
import { judges, users } from "~/server/db/schema";

// How many teams each seeded judge scores, and how generous they are.
const ROUNDS: Record<string, number> = {
  judge1: 2,
  judge2: 2,
  judge3: 8,
  judge4: 7,
  judge5: 7,
};
const LENIENCY: Record<string, number> = {
  judge1: 4,
  judge2: -2,
  judge3: 8,
  judge4: -6,
  judge5: 0,
};

function callerFor(user: { id: string; name: string | null }) {
  const session: Session = {
    user: { id: user.id, name: user.name },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  return createCaller(createInnerTRPCContext({ session }));
}

/** A stable made-up quality per team (-15..15), so judges roughly agree. */
function quality(teamId: string) {
  let h = 0;
  for (const c of teamId) h = (h * 31 + c.charCodeAt(0)) % 1000;
  return (h / 1000) * 30 - 15;
}

async function main() {
  if (!process.env.DATABASE_URL?.includes("localhost")) {
    console.error("Warm-up must only run on localhost.");
    process.exit(1);
  }
  const rows = await db
    .select({ id: users.id, name: users.name, email: users.email })
    .from(judges)
    .innerJoin(users, eq(users.id, judges.id))
    .where(like(users.email, "judge%@judging.hackwestern.dev"));

  let marks = 0;
  for (const u of rows) {
    const key = u.email.split("@")[0] ?? "";
    const caller = callerFor(u);
    for (let i = 0; i < (ROUNDS[key] ?? 0); i++) {
      const next = await caller.judging.me.getNextTeam().catch(() => null);
      if (!next) break;
      const noise = (Math.random() - 0.5) * 10;
      const score = Math.max(
        0,
        Math.min(
          100,
          Math.round(70 + quality(next.team.id) + (LENIENCY[key] ?? 0) + noise),
        ),
      );
      await caller.judging.me.submitTeamMark({ teamId: next.team.id, score });
      marks++;
    }
  }

  for (const key of ["judge3", "judge4"]) {
    const u = rows.find((r) => r.email.startsWith(`${key}@`));
    if (u)
      await callerFor(u)
        .judging.me.getNextTeam()
        .catch(() => undefined);
  }
  console.log(
    `Warm-up done: ${marks} marks submitted; judge3 and judge4 are each holding a team.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => void conn.end());
