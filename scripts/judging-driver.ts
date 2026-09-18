/**
 * Judging end-to-end driver: exercises the real judging endpoints against the
 * local database seeded by `npm run seed:judging`. No UI required — each
 * seeded judge gets its own tRPC caller, so this covers the flows a dress
 * rehearsal needs plus the concurrency scenario humans can't reproduce.
 *
 *   npm run db:start && npm run db:migrate
 *   npm run seed:judging -- --yes
 *   npm run judging:driver
 *
 * Scenarios (numbering from the launch-readiness plan, section 4):
 *   S1  setup sanity        judges registered, queue fully loaded      (4.1)
 *   S2  single judge        assign -> mark -> stats -> edit            (4.2)
 *   S3  concurrency         5 judges assign + submit simultaneously    (4.3)
 *   S4  edge cases          skip, force-assign, final-mark trigger     (4.4)
 *   S5  sponsored flow      track filter, sponsored round, exclusion   (4.5)
 *   S6  ranking + purge     ranking ordered/regular-only; purge keeps
 *                           marks                                      (4.4/4.7)
 *
 * Not covered here: the 15-minute stale-hold reclaim (needs a clock; the
 * vitest suite covers it by backdating assigned_at).
 *
 * The driver consumes queue rounds and ends by purging the queue — rerun
 * `npm run seed:judging` afterwards before an in-person demo.
 */
import { and, eq, like, sql } from "drizzle-orm";
import type { Session } from "next-auth";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db, conn } from "~/server/db";
import {
  judges,
  judgingQueue,
  judgingSkips,
  teamMarks,
  teams,
  users,
} from "~/server/db/schema";

const SEED_DOMAIN = "judging.hackwestern.dev";
const ORGANIZER_EMAIL = `organizer@${SEED_DOMAIN}`;

type Caller = ReturnType<typeof createCaller>;
type JudgeHandle = {
  id: string;
  name: string;
  type: "organizer" | "sponsored";
  track: string[] | null;
  caller: Caller;
};

function callerFor(user: { id: string; name: string | null }): Caller {
  const session: Session = {
    user: { id: user.id, name: user.name },
    expires: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
  };
  return createCaller(createInnerTRPCContext({ session }));
}

/* ---------- tiny assertion harness ---------- */

let passed = 0;
let failed = 0;
const failures: string[] = [];

function check(label: string, condition: boolean, detail?: string) {
  if (condition) {
    passed++;
    console.log(`  ✓ ${label}`);
  } else {
    failed++;
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ""}`);
  }
}

async function expectThrow(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    check(label, false, "expected an error, call succeeded");
  } catch {
    check(label, true);
  }
}

function section(title: string) {
  console.log(`\n=== ${title} ===`);
}

/* ---------- db helpers ---------- */

async function queueRow(teamId: string) {
  return db.query.judgingQueue.findFirst({
    where: eq(judgingQueue.teamId, teamId),
  });
}

async function judgeStats(judgeId: string) {
  const row = await db.query.judges.findFirst({
    where: eq(judges.id, judgeId),
  });
  if (!row) throw new Error(`judge row missing for ${judgeId}`);
  return row;
}

async function countMarks(roundType?: "regular" | "sponsored") {
  const [row] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(teamMarks)
    .where(roundType ? eq(teamMarks.roundType, roundType) : sql`true`);
  return row?.n ?? 0;
}

/* ---------- main ---------- */

async function main() {
  if (!process.env.DATABASE_URL?.includes("localhost")) {
    throw new Error("Driver must only run against a localhost database.");
  }

  // Load the seeded cast.
  const judgeRows = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      type: judges.type,
      track: judges.track,
    })
    .from(users)
    .innerJoin(judges, eq(judges.id, users.id))
    .where(like(users.email, `%@${SEED_DOMAIN}`))
    .orderBy(users.email);
  const organizerUser = await db.query.users.findFirst({
    where: eq(users.email, ORGANIZER_EMAIL),
  });
  if (judgeRows.length < 4 || !organizerUser) {
    throw new Error(
      "Seeded judging state not found — run `npm run seed:judging` first " +
        "(needs >= 4 judges).",
    );
  }

  const cast: JudgeHandle[] = judgeRows.map((j) => ({
    id: j.id,
    name: j.name ?? j.id,
    type: j.type,
    track: j.track,
    caller: callerFor(j),
  }));
  const organizers = cast.filter((j) => j.type === "organizer");
  const sponsored = cast.filter((j) => j.type === "sponsored");
  const admin = callerFor(organizerUser);

  section("S1 setup sanity (4.1)");
  const allJudges = await admin.judging.admin.getAllJudges();
  const registeredIds = new Set(allJudges.map((j) => j.id));
  check(
    "all seeded judges appear in getAllJudges",
    cast.every((j) => registeredIds.has(j.id)),
  );
  check(
    "sponsored judges carry their track array",
    sponsored.length > 0 && sponsored.every((j) => (j.track?.length ?? 0) > 0),
  );
  const queued = await db.select({ teamId: judgingQueue.teamId }).from(
    judgingQueue,
  );
  check(`queue is loaded (${queued.length} teams)`, queued.length > 0);

  section("S2 single judge happy path (4.2)");
  const j1 = organizers[0]!;
  const team1 = { teamId: (await j1.caller.judging.me.getNextTeam()).team.id };
  check("getNextTeam returns a team", !!team1?.teamId);
  const heldRow = await queueRow(team1.teamId);
  check(
    "queue row shows the hold",
    heldRow?.currentJudgeId === j1.id && heldRow?.status === "assigned",
  );
  const roundsBefore = heldRow?.roundsRemaining ?? 0;
  await j1.caller.judging.me.submitTeamMark({ teamId: team1.teamId, score: 72 });
  const afterMark = await queueRow(team1.teamId);
  check(
    "rounds_remaining decremented and hold released",
    roundsBefore === 1
      ? afterMark === undefined
      : afterMark?.roundsRemaining === roundsBefore - 1 &&
          afterMark?.currentJudgeId === null,
  );
  let stats = await judgeStats(j1.id);
  check(
    "judge stats after 1 mark (n=1, sum=72)",
    stats.marksCount === 1 && stats.marksSum === 72,
  );
  const team2 = { teamId: (await j1.caller.judging.me.getNextTeam()).team.id };
  check("second getNextTeam returns a different team", team2.teamId !== team1.teamId);
  const myMarks = await j1.caller.judging.me.getSubmittedTeamMarks();
  const mark = myMarks.find((m) => m.teamId === team1.teamId);
  check("submitted mark visible in getSubmittedTeamMarks", !!mark);
  if (mark) {
    await j1.caller.judging.me.editTeamMark({ teamMarkId: mark.id, score: 80 });
    stats = await judgeStats(j1.id);
    check(
      "stats consistent after edit (n=1, sum=80)",
      stats.marksCount === 1 &&
        stats.marksSum === 80 &&
        stats.marksSquaredSum === 6400,
    );
  }
  // Release j1's hold so S3 starts clean.
  await j1.caller.judging.me.skipAssignment();

  section("S3 concurrent judges (4.3)");
  const assignments = await Promise.allSettled(
    cast.map((j) => j.caller.judging.me.getNextTeam()),
  );
  const assignedTeams = assignments.flatMap((r) =>
    r.status === "fulfilled" ? [r.value.team.id] : [],
  );
  check(
    `all ${cast.length} simultaneous getNextTeam calls succeed`,
    assignments.every((r) => r.status === "fulfilled"),
    assignments
      .filter((r) => r.status === "rejected")
      .map((r) => String((r as PromiseRejectedResult).reason))
      .join("; "),
  );
  check(
    "every judge received a different team",
    new Set(assignedTeams).size === assignedTeams.length,
  );
  const marksBefore = await countMarks();
  const submissions = await Promise.allSettled(
    cast.map((j, i) =>
      j.caller.judging.me.submitTeamMark({
        teamId: assignedTeams[i]!,
        score: 55 + i * 7,
      }),
    ),
  );
  check(
    "all simultaneous submits commit",
    submissions.every((r) => r.status === "fulfilled"),
  );
  check(
    "queue accounting correct after burst",
    (await countMarks()) === marksBefore + cast.length,
  );

  section("S4 edge cases (4.4)");
  const j2 = organizers[1]!;
  const skipTarget = { teamId: (await j2.caller.judging.me.getNextTeam()).team.id };
  const skipRoundsBefore = (await queueRow(skipTarget.teamId))?.roundsRemaining;
  await j2.caller.judging.me.skipAssignment();
  const skipRows = await db.query.judgingSkips.findMany({
    where: and(
      eq(judgingSkips.teamId, skipTarget.teamId),
      eq(judgingSkips.judgeId, j2.id),
    ),
  });
  const afterSkip = await queueRow(skipTarget.teamId);
  check("skip inserts a judging_skip row", skipRows.length === 1);
  check(
    "skip leaves rounds_remaining unchanged and releases the hold",
    afterSkip?.roundsRemaining === skipRoundsBefore &&
      afterSkip?.currentJudgeId === null,
  );

  // Force-assign: overrides another judge's hold; the evicted judge can no
  // longer submit for that team.
  const evicted = organizers[0]!;
  const held = { teamId: (await evicted.caller.judging.me.getNextTeam()).team.id };
  await admin.judging.admin.assignJudgeForTeam({
    judgeId: j2.id,
    teamId: held.teamId,
  });
  const forced = await queueRow(held.teamId);
  check(
    "force-assign overrides the existing hold",
    forced?.currentJudgeId === j2.id,
  );
  await expectThrow("evicted judge can no longer submit for that team", () =>
    evicted.caller.judging.me.submitTeamMark({ teamId: held.teamId, score: 50 }),
  );
  await j2.caller.judging.me.submitTeamMark({ teamId: held.teamId, score: 61 });
  check("new holder submits successfully", true);

  // Final-mark trigger: a team on its last round leaves the queue on submit.
  const lastRoundTeam = await db.query.judgingQueue.findFirst({
    where: eq(judgingQueue.roundsRemaining, 1),
  });
  let finalTeamId = lastRoundTeam?.teamId;
  if (!finalTeamId) {
    // Manufacture the condition — the driver owns this test database.
    const anyWaiting = await db.query.judgingQueue.findFirst({
      where: eq(judgingQueue.status, "waiting"),
    });
    finalTeamId = anyWaiting?.teamId;
    if (finalTeamId) {
      await db
        .update(judgingQueue)
        .set({ roundsRemaining: 1 })
        .where(eq(judgingQueue.teamId, finalTeamId));
    }
  }
  if (finalTeamId) {
    await admin.judging.admin.assignJudgeForTeam({
      judgeId: organizers[0]!.id,
      teamId: finalTeamId,
    });
    await organizers[0]!.caller.judging.me.submitTeamMark({
      teamId: finalTeamId,
      score: 68,
    });
    check(
      "final mark deletes the queue row (trigger)",
      (await queueRow(finalTeamId)) === undefined,
    );
  } else {
    check("final-mark trigger", false, "no queue row available to test");
  }

  section("S5 sponsored flow (4.5)");
  const s1 = sponsored[0];
  if (!s1) {
    check("sponsored flow", false, "seed had no sponsored judges");
  } else {
    const sTeam = { teamId: (await s1.caller.judging.me.getNextTeam()).team.id };
    const teamTracks =
      (
        await db.query.teams.findFirst({
          where: eq(teams.id, sTeam.teamId),
          columns: { tracks: true },
        })
      )?.tracks ?? [];
    check(
      "sponsored judge only sees teams overlapping their track",
      s1.track!.some((t) => teamTracks.includes(t as never)),
    );
    await s1.caller.judging.me.submitTeamMark({ teamId: sTeam.teamId, score: 90 });
    const sMark = await db.query.teamMarks.findFirst({
      where: and(
        eq(teamMarks.teamId, sTeam.teamId),
        eq(teamMarks.judgeId, s1.id),
        eq(teamMarks.score, 90),
      ),
    });
    check(
      "sponsored mark stored with round_type = 'sponsored'",
      sMark?.roundType === "sponsored",
    );
  }

  section("S6 ranking + purge (4.4/4.7)");
  const ranking = await admin.judging.admin.getLatestRanking();
  check("ranking returns rows", ranking.length > 0);
  const scores = ranking
    .map((r) => r.normalized_score)
    .filter((s): s is number => s !== null);
  check(
    "ranking sorted by normalized score, descending",
    scores.every((s, i) => i === 0 || scores[i - 1]! >= s),
  );
  const regularMarks = await countMarks("regular");
  const rankedMarks = ranking.reduce((acc, r) => acc + Number(r.num_marks), 0);
  check(
    `ranking counts only regular marks (${rankedMarks}/${regularMarks})`,
    rankedMarks === regularMarks,
  );

  const marksBeforePurge = await countMarks();
  await admin.judging.admin.purgeQueue();
  const [queueLeft] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(judgingQueue);
  check("purge empties judging_queue", (queueLeft?.n ?? -1) === 0);
  check("purge leaves team_mark untouched", (await countMarks()) === marksBeforePurge);

  /* ---------- report ---------- */
  console.log(`\n${"=".repeat(40)}`);
  console.log(`${passed} passed, ${failed} failed`);
  if (failed > 0) {
    console.log(`Failures:\n  - ${failures.join("\n  - ")}`);
    process.exitCode = 1;
  }
  console.log(
    "\nQueue was purged by the last scenario — rerun `npm run seed:judging` " +
      "before an in-person demo.",
  );
}

try {
  await main();
} catch (e) {
  console.error("\nDriver crashed:", e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
