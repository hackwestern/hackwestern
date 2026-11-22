// Github commits -> team.commit_log, for every team with a Github URL.
//
//   npx dotenv -e <env file> -- tsx scripts/pull-github-commits.ts           # skip teams already pulled
//   npx dotenv -e <env file> -- tsx scripts/pull-github-commits.ts --force   # pull every team again
//
// Needs HACK_START, HACK_END and GITHUB_TOKEN. Only commits inside the hack
// window are stored. A failed team is reported and left unchanged, so a
// re-run picks it up.
import { eq, isNotNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { teams } from "~/server/db/schema";
import {
  commitsInWindow,
  fetchAllCommits,
  parseGithubUrl,
} from "~/utils/github";

const CONCURRENCY = 4;

async function pullTeam(
  team: { id: string; githubUrl: string },
  window: { since: Date; until: Date },
): Promise<number> {
  const parsed = parseGithubUrl(team.githubUrl);
  if (!parsed) throw new Error(`Can't parse Github URL ${team.githubUrl}`);

  const commitLog = commitsInWindow(
    await fetchAllCommits(parsed.owner, parsed.repo, window),
    window,
  );
  await db.update(teams).set({ commitLog }).where(eq(teams.id, team.id));
  return commitLog.length;
}

async function main() {
  if (!env.HACK_START || !env.HACK_END) {
    throw new Error("Set HACK_START and HACK_END first.");
  }
  if (!env.GITHUB_TOKEN) {
    throw new Error("Set GITHUB_TOKEN first (60 requests/hour without it).");
  }
  const window = {
    since: new Date(env.HACK_START),
    until: new Date(env.HACK_END),
  };
  const force = process.argv.includes("--force");

  const all = await db
    .select({
      id: teams.id,
      name: teams.name,
      githubUrl: teams.githubUrl,
      pulled: sql<boolean>`${teams.commitLog} is not null`,
    })
    .from(teams)
    .where(isNotNull(teams.githubUrl));
  const todo = all.filter((t) => force || !t.pulled);
  console.log(
    `${all.length} teams with a Github URL, ${all.length - todo.length} already pulled, ${todo.length} to pull.`,
  );

  const failed: string[] = [];
  let next = 0;
  const worker = async () => {
    while (next < todo.length) {
      const team = todo[next++]!;
      try {
        const n = await pullTeam(
          { id: team.id, githubUrl: team.githubUrl! },
          window,
        );
        console.log(`  ${team.name}: ${n} commits`);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failed.push(`${team.name} (${team.id}): ${msg}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(
    `\nDone: ${todo.length - failed.length} pulled, ${failed.length} failed.`,
  );
  for (const f of failed) console.log(`  failed ${f}`);
  if (failed.length > 0) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
