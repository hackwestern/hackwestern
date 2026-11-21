/**
 * Sponsor-picks seed: teams + members to exercise the sponsor picks page
 * (listAllTeams) locally.
 *
 *   npx dotenv -- tsx ./src/server/db/seed/sponsor-picks.ts -- --teams 15 --yes
 *
 * What it does:
 *   1. Wipes only its own previous data: teams whose id starts with "sp"
 *      and users on the sponsorseed.hackwestern.dev domain (their
 *      applications cascade; team members elsewhere keep their rows).
 *   2. Inserts `--teams` teams — devpost/github links, sponsor-track
 *      coverage (70% in Canada Life's track, plus the other Hack Western
 *      sponsor tracks), one "late" and one "draft" submission so the
 *      submitted-only filter on the picks page is visible.
 *   3. Adds 2-4 members per team (users + applications with names). One
 *      team has no members at all so the "No members listed" card state
 *      is testable.
 *   4. Prints an existing sponsor's private picks URL for a quick look.
 *      Sponsor mappings live in sponsor_judging_sponsor and are NOT
 *      touched by this script.
 *
 * Flags: --teams N  --canada-life-track TRACK  --yes (skip confirm)
 * TRACK is one of the values in src/lib/sponsor-track.ts. The script auto-
 * reads Canada Life's track from the sponsor sheet; use the flag to override.
 */
import * as p from "@clack/prompts";
import { faker } from "@faker-js/faker";
import { asc, like } from "drizzle-orm";

import { conn, db } from "..";
import { applications, sponsorJudgingSponsors, teams, users } from "../schema";
import { TRACK_VALUES, type TrackValue } from "~/lib/sponsor-track";
import { fetchSponsorTrack } from "~/server/api/utils/sponsor-judging-teams";

const SEED_TEAM_ID_PREFIX = "sp";
const SEED_EMAIL_DOMAIN = "sponsorseed.hackwestern.dev";

type Args = {
  teams: number;
  canadaLifeTrack: TrackValue | null;
  yes: boolean;
};

function parseArgs(): Args {
  const args: Args = { teams: 15, canadaLifeTrack: null, yes: false };
  const argv = process.argv.slice(2).filter((arg) => arg !== "--");
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case "--teams":
        args.teams = Number.parseInt(argv[i + 1] ?? "", 10);
        i += 1;
        break;
      case "--canada-life-track": {
        const value = argv[i + 1];
        i += 1;
        if (!value || !TRACK_VALUES.includes(value as TrackValue)) {
          throw new Error(
            `--canada-life-track must be one of: ${TRACK_VALUES.join(", ")}`,
          );
        }
        args.canadaLifeTrack = value as TrackValue;
        break;
      }
      case "--yes":
        args.yes = true;
        break;
      default:
        throw new Error(`Unknown flag: ${argv[i]}`);
    }
  }
  if (args.teams < 1) throw new Error("--teams must be >= 1");
  return args;
}

// 70% of the teams use Canada Life's actual track. The remaining teams
// round-robin across the other sponsor tracks, with General still included
// so there is a small cross-track/multi-track mix.
function tracksForTeam(
  index: number,
  canadaLifeTrack: TrackValue,
): TrackValue[] {
  if (index % 10 < 7) {
    return canadaLifeTrack === "General"
      ? ["General"]
      : ["General", canadaLifeTrack];
  }

  const otherTracks = TRACK_VALUES.filter(
    (track) => track !== canadaLifeTrack && track !== "General",
  );
  const track =
    otherTracks[index % Math.max(1, otherTracks.length)] ?? "General";
  return track === "General" ? ["General"] : ["General", track];
}

function submissionStatusForTeam(
  index: number,
  total: number,
): "submitted" | "late" | "draft" {
  // Second-to-last team is "late"; the last is a "draft" that must NOT
  // appear on the sponsor picks page.
  if (index === total - 2) return "late";
  if (index === total - 1) return "draft";
  return "submitted";
}

function memberCountForTeam(index: number): number {
  if (index === 0) return 0; // empty-team card state
  if (index === 1) return 2;
  if (index === 2) return 5;
  return faker.number.int({ min: 2, max: 4 });
}

async function seedSponsorPicks(args: Args): Promise<void> {
  const spinner = p.spinner();
  let canadaLifeTrack = args.canadaLifeTrack;

  if (!canadaLifeTrack) {
    const sponsors = await db.query.sponsorJudgingSponsors.findMany();
    const canadaLife = sponsors.find((sponsor) =>
      sponsor.name.toLowerCase().includes("canada life"),
    );
    if (canadaLife) {
      try {
        canadaLifeTrack = await fetchSponsorTrack(canadaLife.name);
      } catch (error) {
        console.warn(
          "Could not read Canada Life's track from the sponsor sheet.",
          error instanceof Error ? error.message : error,
        );
      }
    }
  }
  canadaLifeTrack ??= "General";
  console.log(`Canada Life track: ${canadaLifeTrack}`);

  await db.transaction(async (tx) => {
    // 1. Wipe this script's previous output only.
    spinner.start("Wiping previous sponsor-picks seed data");
    await tx.delete(users).where(like(users.email, `%@${SEED_EMAIL_DOMAIN}`));
    await tx.delete(teams).where(like(teams.id, `${SEED_TEAM_ID_PREFIX}%`));
    spinner.stop("Wiped previous sponsor-picks seed data");

    // 2. Teams.
    const teamIds = Array.from(
      { length: args.teams },
      () =>
        `${SEED_TEAM_ID_PREFIX}${faker.string.alphanumeric({ length: 4, casing: "lower" })}`,
    );
    const joinCodes = faker.helpers.uniqueArray(
      () => faker.string.fromCharacters("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6),
      args.teams,
    );

    const teamRows = teamIds.map((id, i) => ({
      id,
      joinCode: joinCodes[i]!,
      name: `${faker.hacker.adjective()} ${faker.hacker.noun()}`,
      devpostUrl: `https://devpost.com/software/${id}-${faker.hacker.adjective()}`,
      githubUrl: `https://github.com/hackwestern/${id}-${faker.hacker.noun()}`,
      submissionStatus: submissionStatusForTeam(i, args.teams),
      tracks: tracksForTeam(i, canadaLifeTrack),
    }));
    await tx.insert(teams).values(teamRows);

    // 3. Members — users with a teamId plus a named application row (the
    // picks page reads application first/last names first).
    const memberRows: (typeof users.$inferInsert)[] = [];
    const applicationRows: (typeof applications.$inferInsert)[] = [];
    teamIds.forEach((teamId, i) => {
      const memberCount = memberCountForTeam(i);
      for (let m = 0; m < memberCount; m++) {
        const userId = faker.string.uuid();
        const firstName = faker.person.firstName();
        const lastName = faker.person.lastName();
        memberRows.push({
          id: userId,
          name: `${firstName} ${lastName}`,
          email: `${teamId}-m${m}@${SEED_EMAIL_DOMAIN}`,
          emailVerified: new Date(),
          type: "hacker",
          teamId,
        });
        applicationRows.push({
          userId,
          firstName,
          lastName,
          githubLink: `https://github.com/${faker.internet.userName()}`,
          linkedInLink: `https://linkedin.com/in/${faker.internet.userName()}`,
          devpostLink: faker.internet.userName(),
        });
      }
    });

    if (memberRows.length > 0) {
      await tx.insert(users).values(memberRows);
      await tx.insert(applications).values(applicationRows);
    }

    const submitted = teamRows.filter(
      (t) => t.submissionStatus !== "draft",
    ).length;
    console.log(
      `\nSeeded ${teamRows.length} teams (${submitted} submitted/late, ${teamRows.length - submitted} draft) and ${memberRows.length} members.`,
    );
  });

  // 4. Point the user at a real sponsor's picks page (mappings untouched).
  const sponsors = await db.query.sponsorJudgingSponsors.findMany({
    orderBy: asc(sponsorJudgingSponsors.createdAt),
  });
  const sponsor =
    sponsors.find((row) => row.name.toLowerCase().includes("canada life")) ??
    sponsors[0];
  if (sponsor) {
    console.log(`\nTry the picks page as an existing sponsor:`);
    console.log(
      `  http://localhost:3000/sponsors/${sponsor.id}/picks  (${sponsor.name})`,
    );
  } else {
    console.log(
      "\nNo sponsor mappings registered yet — create one on /internal/sponsors.",
    );
  }
}

const isLocalDb = process.env.DATABASE_URL?.includes("localhost");
if (!isLocalDb) {
  console.error("Seed script must only be run on localhost.");
  process.exit(1);
}

const args = parseArgs();
p.intro("Sponsor-picks team seed");
if (!args.yes) {
  const shouldSeed = await p.confirm({
    message: `Seed ${args.teams} teams, 70% in Canada Life's track (wipes previous sp* sponsor-picks seed data only)?`,
  });
  if (!shouldSeed) {
    p.outro("Stopped seed script.");
    process.exit(0);
  }
}
try {
  await seedSponsorPicks(args);
  p.outro("Done!");
} catch (e) {
  console.error("\nSomething went wrong when seeding.", e);
  p.outro("Seed script failed.");
} finally {
  await conn.end();
}
