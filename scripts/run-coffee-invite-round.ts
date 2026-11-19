import {
  countUnnotifiedInvites,
  deliverUnnotifiedInvites,
  previewDueInviteRound,
  runDueInviteRounds,
  type DeliveryResult,
} from "~/server/api/utils/coffee-chat-invites";

// One tick of the Saturday coffee chat invites: the current round
// (runDueInviteRounds: a no-op before 10:00 AM Saturday and after the last chat; a
// late or missed round catches up as the current one), then the delivery
// sweep (any pending invite whose DM or email hasn't gone out yet). Run by
// .github/workflows/coffee-invite-rounds.yml every 10 minutes on Saturday.
//
//   npx tsx scripts/run-coffee-invite-round.ts [--now=<ISO time>]
//
// A DRY RUN (counts only: no writes, no sends) unless COFFEE_ROUNDS_LIVE is
// "true". --now (dry run only) previews another time. Prints counts only,
// never names or emails: this repo's Actions logs are public.

const counts = (d: DeliveryResult) =>
  `slack ${d.slack}, email ${d.email}, failed ${d.failed}, skipped ${d.skipped}`;

export async function main(argv: readonly string[], liveFlag?: string) {
  const live = liveFlag === "true";
  const nowArg = argv.find((a) => a.startsWith("--now="))?.slice(6);
  if (nowArg && live) throw new Error("--now is for dry runs only.");
  const now = nowArg ? new Date(nowArg) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`Bad --now: ${nowArg}`);

  if (!live) {
    // Nothing in this run may send, whatever else is set.
    process.env.COFFEE_INVITES_ENABLED = "0";
    const preview = await previewDueInviteRound(now);
    const unnotified = await countUnnotifiedInvites(now);
    console.log(
      `Coffee invite round at ${now.toISOString()}. Mode: DRY RUN (set COFFEE_ROUNDS_LIVE=true to send).`,
    );
    console.log(
      `Round ${preview.round}: ${preview.status}, would invite ${preview.invites}, seats no one could fill ${preview.unfilled}.`,
    );
    console.log(`Sweep: ${unnotified} invite(s) waiting to be sent.`);
    console.log("Done. Nothing written or sent.");
    return;
  }

  // Armed: the workflow's COFFEE_ROUNDS_LIVE is the switch here (a "0" set
  // in this environment still wins).
  process.env.COFFEE_INVITES_ENABLED ??= "1";
  console.log(`Coffee invite round at ${now.toISOString()}. Mode: LIVE.`);
  const out = await runDueInviteRounds(now);
  if (out.status === "ran") {
    const r = out.result;
    const created = r.status === "ok" ? r.created.length : 0;
    const open =
      r.status === "ok" ? r.unfilled.reduce((n, u) => n + u.open, 0) : 0;
    console.log(
      `Round ${r.round}: ${r.status}, invited ${created}, seats no one could fill ${open}; sent ${counts(out.delivery)}.`,
    );
  } else {
    console.log(`Round: ${out.status}.`);
  }
  const sweep = await deliverUnnotifiedInvites();
  console.log(`Sweep: ${counts(sweep)}.`);
  console.log("Done.");
}

/**
 * The app's db logs every query with its params (user ids, rep names).
 * Drop those lines here: Actions logs are public.
 */
function hideQueryLogs() {
  const log = console.log.bind(console);
  console.log = (...args: unknown[]) => {
    if (typeof args[0] === "string" && args[0].startsWith("Query: ")) return;
    log(...args);
  };
}

if (process.argv[1]?.includes("run-coffee-invite-round")) {
  hideQueryLogs();
  main(process.argv.slice(2), process.env.COFFEE_ROUNDS_LIVE)
    .then(() => process.exit(0))
    .catch((e: unknown) => {
      // The message only: an error could carry row data.
      console.error(e instanceof Error ? e.message : "failed");
      process.exit(1);
    });
}
