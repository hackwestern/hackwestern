import { revertLapse } from "./lapse-unconfirmed";

// Undoes one lapse batch (scripts/lapse-unconfirmed.ts): applications moved to
// DECLINED at exactly --at go back to ACCEPTED. Dry run unless --apply.
//
//   npx tsx scripts/revert-lapse.ts --at=2026-11-07T14:00:03.123Z [--apply]

async function main() {
  const atArg = process.argv
    .find((a) => a.startsWith("--at="))
    ?.slice("--at=".length);
  const at = atArg ? new Date(atArg) : null;
  if (!at || isNaN(at.getTime())) {
    console.error("Pass --at=<the time the lapse batch printed>.");
    process.exit(1);
  }
  const APPLY = process.argv.includes("--apply");
  const n = await revertLapse(at, APPLY);
  console.log(
    APPLY
      ? `Done. Moved ${n} back to ACCEPTED.`
      : `${n} application(s) from the ${at.toISOString()} batch. Mode: DRY RUN.`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
