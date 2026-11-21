/**
 * Sponsor-winners seed (local db only): gives the prize-track sponsors a
 * submitted final Top 5 so the results sheet's "Sponsor Winners" tab (and the
 * sponsor portal) have data.
 *
 *   npm run seed:sponsor-winners
 *   npm run seed:sponsor-winners -- --clear     # remove the seeded picks
 *
 * What it does:
 *   1. Makes sure every SPONSOR_PRIZE_TRACKS sponsor has a
 *      sponsor_judging_sponsor row (existing rows, and their portal UUIDs,
 *      are kept).
 *   2. For each of them except the last one, writes a final Top 5
 *      (sponsor_final_pick) of random submitted teams, replacing any previous
 *      one. The last sponsor is left without a submission so "Not submitted
 *      yet" is visible too.
 *   Teams are the ones already in the db: run `npm run seed:judging -- --marks
 *   --yes` first for a full room.
 *
 * --clear deletes the final picks of these sponsors (the sponsor rows stay).
 */
import { faker } from "@faker-js/faker";
import { eq, inArray } from "drizzle-orm";

import { conn, db } from "..";
import { sponsorFinalPicks, sponsorJudgingSponsors, teams } from "../schema";
import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";

async function seedSponsorWinners(clear: boolean) {
  const names = [...SPONSOR_PRIZE_TRACKS];

  return db.transaction(async (tx) => {
    await tx
      .insert(sponsorJudgingSponsors)
      .values(names.map((name) => ({ name })))
      .onConflictDoNothing({ target: sponsorJudgingSponsors.name });
    const sponsors = await tx
      .select({
        id: sponsorJudgingSponsors.id,
        name: sponsorJudgingSponsors.name,
      })
      .from(sponsorJudgingSponsors)
      .where(inArray(sponsorJudgingSponsors.name, names));
    const byName = new Map(sponsors.map((s) => [s.name, s.id]));
    const ids = names.map((n) => byName.get(n)!);

    await tx
      .delete(sponsorFinalPicks)
      .where(inArray(sponsorFinalPicks.sponsorId, ids));
    if (clear) return { picks: [] as { sponsor: string; winner: string }[] };

    const submitted = await tx
      .select({ id: teams.id, name: teams.name })
      .from(teams)
      .where(eq(teams.submissionStatus, "submitted"));
    if (submitted.length < SPONSOR_FINAL_TOP) {
      throw new Error(
        `Need at least ${SPONSOR_FINAL_TOP} submitted teams (found ${submitted.length}). ` +
          "Run `npm run seed:judging -- --marks --yes` first.",
      );
    }
    const teamName = new Map(submitted.map((t) => [t.id, t.name]));

    // Everyone but the last sponsor submits; submissions a few minutes apart.
    const submitting = names.slice(0, -1);
    const start = Date.now() - submitting.length * 5 * 60_000;
    const rows = submitting.map((name, i) => ({
      sponsorId: byName.get(name)!,
      teamIds: faker.helpers
        .arrayElements(submitted, SPONSOR_FINAL_TOP)
        .map((t) => t.id),
      submittedAt: new Date(start + i * 5 * 60_000),
    }));
    await tx.insert(sponsorFinalPicks).values(rows);

    return {
      picks: rows.map((r, i) => ({
        sponsor: submitting[i]!,
        winner: teamName.get(r.teamIds[0]!) ?? r.teamIds[0]!,
      })),
      unsubmitted: names.at(-1),
    };
  });
}

if (!process.env.DATABASE_URL?.includes("localhost")) {
  console.error("Seed script must only be run on localhost.");
  process.exit(1);
}

const clear = process.argv.includes("--clear");
try {
  const r = await seedSponsorWinners(clear);
  if (clear) {
    console.log("Removed the prize-track sponsors' final picks.");
  } else {
    console.log(
      [
        "Seeded sponsor final picks (#1 = winner):",
        ...r.picks.map((p) => `  ${p.sponsor}: ${p.winner}`),
        ...("unsubmitted" in r && r.unsubmitted
          ? [`  ${r.unsubmitted}: not submitted`]
          : []),
        "Press Write results to sheet on /internal/judging to see them.",
      ].join("\n"),
    );
  }
} catch (e) {
  console.error("\nSponsor winners seed failed.", e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
