// Devpost export -> teams. See src/server/teams/devpost-import.ts.
//
//   npx dotenv -e <env file> -- tsx scripts/import-devpost-teams.ts <export.csv>          # dry run
//   npx dotenv -e <env file> -- tsx scripts/import-devpost-teams.ts <export.csv> --apply  # write
//
// The export holds real emails: keep it out of the repo. Nothing from it is
// stored except team names, links, tracks and the flags (names, never emails).
import { readFileSync } from "fs";

import {
  type PlannedTeam,
  applyImport,
  loadAccounts,
  parseDevpostExport,
  planImport,
} from "~/server/teams/devpost-import";
import { type ImportFlag } from "~/server/db/schema";

export function describeFlag(flag: ImportFlag): string {
  switch (flag.reason) {
    case "duplicate":
      return `duplicate: ${flag.name ?? flag.rawId} is also on ${flag.otherProjects.join(", ")}${
        flag.linkedHere ? " (linked here)" : " (linked there)"
      }`;
    case "not_hacker":
      return `not hacker: ${flag.members.join(", ") || "(no IDs or names entered)"}`;
    case "incorrect_team_size":
      return `incorrect team size: ${flag.matched} hackers matched (max 4)`;
  }
}

export function report(
  plan: PlannedTeam[],
  parsed: ReturnType<typeof parseDevpostExport>,
): string {
  const lines: string[] = [];
  const flagged = plan.filter((t) => t.flags.length > 0);
  lines.push(
    `${plan.length} submitted projects, ${parsed.drafts.length} drafts skipped, ${parsed.rejected.length} rows rejected.`,
    `${plan.reduce((n, t) => n + t.linkUserIds.length, 0)} hackers to link, ${flagged.length} teams flagged.`,
  );
  for (const r of parsed.rejected)
    lines.push(`  rejected line ${r.line}: ${r.reason}`);
  if (flagged.length > 0) lines.push("", "Flagged teams:");
  for (const t of flagged) {
    lines.push(`  ${t.project.title} (line ${t.project.line})`);
    for (const f of t.flags) lines.push(`    - ${describeFlag(f)}`);
  }
  const unknown = [...new Set(plan.flatMap((t) => t.project.unknownPrizes))];
  if (unknown.length > 0) {
    lines.push(
      "",
      "Prizes with no track (add them to PRIZE_TRACKS if they should map):",
      ...unknown.map((p) => `  - ${p}`),
    );
  }
  return lines.join("\n");
}

async function main() {
  const file = process.argv[2];
  const apply = process.argv.includes("--apply");
  if (!file || file.startsWith("--")) {
    console.error(
      "Usage: tsx scripts/import-devpost-teams.ts <export.csv> [--apply]",
    );
    process.exit(1);
  }

  const parsed = parseDevpostExport(readFileSync(file, "utf8"));
  const plan = planImport(parsed.projects, await loadAccounts(parsed.projects));
  console.log(report(plan, parsed));

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to write.");
    return;
  }
  const summary = await applyImport(plan);
  console.log(
    `\nDone: ${summary.created} teams created, ${summary.updated} updated, ` +
      `${summary.linked} hackers linked, ${summary.unlinked} unlinked, ` +
      `${summary.flaggedTeams} teams flagged.`,
  );
  if (summary.reseatNeeded) {
    console.log(
      "Tables are already seated: re-run seating so the new teams get a table.",
    );
  }
}

if (process.argv[1]?.includes("import-devpost-teams")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e instanceof Error ? e.message : e);
      process.exit(1);
    });
}
