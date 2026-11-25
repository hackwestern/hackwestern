// Github commits -> team.commit_log, for every submitted team with a Github URL.
//
//   npx dotenv -e <env file> -- tsx scripts/pull-github-commits.ts           # skip teams already pulled
//   npx dotenv -e <env file> -- tsx scripts/pull-github-commits.ts --force   # pull every team again
//
// Needs HACK_START, HACK_END and GITHUB_TOKEN. Commits from every branch are
// stored once each (by sha) with the branches it is on, and only those inside
// the hack window. A failed team is reported and left unchanged, so a re-run
// picks it up. On a Github rate limit it stops and prints when to re-run.
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";

import { env } from "~/env";
import { db } from "~/server/db";
import { teams } from "~/server/db/schema";
import {
  type LoggedCommit,
  GithubRateLimitError,
  commitsInWindow,
  fetchAllCommits,
  fetchBranches,
  parseGithubUrl,
} from "~/utils/github";

const CONCURRENCY = 4;

async function pullTeam(
  team: { id: string; githubUrl: string },
  window: { since: Date; until: Date },
): Promise<number> {
  const parsed = parseGithubUrl(team.githubUrl);
  if (!parsed) throw new Error(`Can't parse Github URL ${team.githubUrl}`);

  // Branches share history, so the same commit is listed once per branch.
  const bySha = new Map<string, LoggedCommit>();
  for (const branch of await fetchBranches(parsed.owner, parsed.repo)) {
    for (const c of await fetchAllCommits(parsed.owner, parsed.repo, branch)) {
      const seen = bySha.get(c.sha);
      if (seen) seen.branches.push(branch);
      else bySha.set(c.sha, { ...c, branches: [branch] });
    }
  }

  // Filter by author date here, not with Github's since/until: those use the
  // commit date, which a rebase after the deadline moves out of the window.
  const commitLog = commitsInWindow([...bySha.values()], window);
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
    .where(
      and(
        isNotNull(teams.githubUrl),
        inArray(teams.submissionStatus, ["submitted", "late"]),
      ),
    );
  const todo = all.filter((t) => force || !t.pulled);
  console.log(
    `${all.length} submitted teams with a Github URL, ${all.length - todo.length} already pulled, ${todo.length} to pull.`,
  );

  const failed: string[] = [];
  let pulled = 0;
  let rateLimitedUntil = null as Date | null;
  let next = 0;
  const worker = async () => {
    while (next < todo.length && !rateLimitedUntil) {
      const team = todo[next++]!;
      try {
        const n = await pullTeam(
          { id: team.id, githubUrl: team.githubUrl! },
          window,
        );
        pulled++;
        console.log(`  ${team.name}: ${n} commits`);
      } catch (e) {
        if (e instanceof GithubRateLimitError) {
          rateLimitedUntil = e.resetAt;
          break;
        }
        const msg = e instanceof Error ? e.message : String(e);
        failed.push(`${team.name} (${team.id}): ${msg}`);
      }
    }
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));

  console.log(`\nDone: ${pulled} pulled, ${failed.length} failed.`);
  for (const f of failed) console.log(`  failed ${f}`);
  if (rateLimitedUntil) {
    console.log(
      `Github rate limit hit, stopped early. Re-run after ${rateLimitedUntil.toLocaleString()} to pull the rest.`,
    );
  }
  if (failed.length > 0 || rateLimitedUntil) process.exitCode = 1;
}

main()
  .then(() => process.exit(process.exitCode ?? 0))
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
