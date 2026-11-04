/**
 * Temporary teams seed script.
 *
 * Seeds realistic teams into the `team` and `user` tables so that the
 * sponsor picks page (and any future track filtering) has real team data
 * to display and test with.
 *
 * Usage:
 *   npm run seed:teams
 *   npm run seed:teams -- --count 20
 *   npm run seed:teams -- --clean --yes
 *
 * Flags:
 *   --count N   Number of teams to seed (default: 15)
 *   --clean     Remove previously seeded teams and members before inserting
 *   --yes       Skip confirmation prompt
 */
import * as p from "@clack/prompts";
import { faker } from "@faker-js/faker";
import { customAlphabet } from "nanoid";
import { randomBytes } from "crypto";
import { eq, inArray, like } from "drizzle-orm";

import { conn, db } from "..";
import { teams, trackEnum, users } from "../schema";

export const TEAM_SEED_EMAIL_DOMAIN = "teams.hackwestern.dev";

const SAMPLE_PROJECT_NAMES = [
  "CampusCart",
  "PawSense",
  "LectureLens",
  "RoomieRadar",
  "TransitPal",
  "GreenGrid",
  "StudyBuddy AI",
  "MealPrepMate",
  "FitFoundry",
  "CodeNest",
  "FinLit",
  "BikeBuzz",
  "EcoRoute",
  "HealthPulse",
  "SoundWave",
  "DevFlow",
  "MindMap",
  "SafeWalk",
  "VisionCraft",
  "PeerTutor",
  "SyncSpace",
  "QuickByte",
  "NoteCraft",
  "SmartPantry",
  "CloudCanvas",
  "TaskPulse",
  "WhisperAI",
  "BlockForge",
  "OmniSearch",
  "CarbonZero",
];

type Args = {
  count: number;
  clean: boolean;
  yes: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    count: 15,
    clean: false,
    yes: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${flag}`);
      return v;
    };

    switch (flag) {
      case "--count":
      case "-n":
        args.count = parseInt(next(), 10);
        break;
      case "--clean":
        args.clean = true;
        break;
      case "--yes":
      case "-y":
        args.yes = true;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }

  if (args.count < 1) {
    throw new Error("--count must be at least 1");
  }

  return args;
}

export async function seedTeams(args: Args) {
  const genCode = customAlphabet("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6);
  const tracksList = trackEnum.enumValues;

  await db.transaction(async (tx) => {
    // 1. Clean up previously seeded members and teams if requested
    if (args.clean) {
      const seededUsers = await tx
        .select({ id: users.id, teamId: users.teamId })
        .from(users)
        .where(like(users.email, `%@${TEAM_SEED_EMAIL_DOMAIN}`));

      const teamIdsToDelete = seededUsers
        .map((u) => u.teamId)
        .filter((id): id is string => Boolean(id));

      if (seededUsers.length > 0) {
        await tx
          .delete(users)
          .where(like(users.email, `%@${TEAM_SEED_EMAIL_DOMAIN}`));
      }

      if (teamIdsToDelete.length > 0) {
        await tx.delete(teams).where(inArray(teams.id, teamIdsToDelete));
      }
    }

    // 2. Generate team names
    const names: string[] = [];
    const usedNames = new Set<string>();

    for (let i = 0; i < args.count; i++) {
      let name: string;
      if (i < SAMPLE_PROJECT_NAMES.length && !usedNames.has(SAMPLE_PROJECT_NAMES[i]!)) {
        name = SAMPLE_PROJECT_NAMES[i]!;
      } else {
        do {
          name = `${faker.word.adjective()} ${faker.word.noun()}`
            .replace(/\b\w/g, (c) => c.toUpperCase());
        } while (usedNames.has(name));
      }
      usedNames.add(name);
      names.push(name);
    }

    // 3. Create teams and their members
    const createdSummary: { id: string; name: string; memberCount: number }[] = [];

    for (let i = 0; i < names.length; i++) {
      const name = names[i]!;
      const teamId = randomBytes(6).toString("hex");
      const joinCode = genCode();
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");

      const memberCount = faker.number.int({ min: 2, max: 4 });
      const memberDevpostUsernames: string[] = [];
      const memberGithubUsernames: string[] = [];
      const userRows = [];

      for (let m = 0; m < memberCount; m++) {
        const fullName = faker.person.fullName();
        const username = faker.internet.userName().toLowerCase().replace(/[^a-z0-9]/g, "");
        const githubUser = `${username}-${m + 1}`;
        const devpostUser = `${username}_devpost`;

        memberGithubUsernames.push(githubUser);
        memberDevpostUsernames.push(devpostUser);

        userRows.push({
          id: faker.string.uuid(),
          name: fullName,
          email: `hacker-${teamId}-${m + 1}@${TEAM_SEED_EMAIL_DOMAIN}`,
          emailVerified: new Date(),
          type: "hacker" as const,
          teamId: teamId,
        });
      }

      // Assign tracks round-robin so there's track variety
      const assignedTrack = tracksList[i % tracksList.length]!;

      await tx.insert(teams).values({
        id: teamId,
        name: name,
        joinCode: joinCode,
        devpostUrl: `https://devpost.com/software/${slug}`,
        githubUrl: `https://github.com/hackwestern/${slug}`,
        submissionStatus: "submitted" as const,
        submittedAt: new Date(),
        tracks: [assignedTrack],
        memberGithubUsernames: memberGithubUsernames,
        memberDevpostUsernames: memberDevpostUsernames,
      });

      await tx.insert(users).values(userRows);

      createdSummary.push({
        id: teamId,
        name: name,
        memberCount: memberCount,
      });
    }

    return createdSummary;
  });
}

// Direct CLI execution
const isMain =
  import.meta.url === `file://${process.argv[1]}` ||
  process.argv[1]?.endsWith("/teams.ts");

if (isMain) {
  const args = parseArgs(process.argv.slice(2));

  try {
    if (!args.yes) {
      if (!process.stdout.isTTY) {
        console.error("Non-interactive shell: pass --yes to confirm.");
        process.exit(1);
      }

      const message = args.clean
        ? `This will delete previously seeded teams/members (@${TEAM_SEED_EMAIL_DOMAIN}) and create ${args.count} new teams. Continue?`
        : `This will seed ${args.count} temporary teams into the database. Continue?`;

      const ok = await p.confirm({ message });
      if (ok !== true) {
        console.log("Stopped.");
        process.exit(0);
      }
    }

    const start = Date.now();
    await seedTeams(args);
    const elapsed = ((Date.now() - start) / 1000).toFixed(1);

    console.log(`\nSuccessfully seeded ${args.count} teams in ${elapsed}s!`);
    console.log("Teams are ready to be selected on the sponsor picks page (/sponsors/[uuid]/picks).\n");
  } catch (err) {
    console.error("\nTeams seed failed:", err);
    process.exitCode = 1;
  } finally {
    await conn.end();
  }
}
