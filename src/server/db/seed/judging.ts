/**
 * Judging end-to-end seed script (M1 test foundation).
 *
 * Brings a clean local database to a full judging-flow state in one command:
 *
 *   npm run seed:judging -- --teams 30 --judges 5 --sponsors 2 --rounds 3
 *
 * What it does, in order:
 *   1. Applies the judging triggers (idempotent — triggers.sql source of truth).
 *   2. Wipes the judging tables (team_mark, judging_skip, judging_queue,
 *      judge), ALL teams, and any judge accounts from a previous run.
 *   3. Inserts `--teams` submitted teams with sponsor-track coverage.
 *   4. Creates `--judges` judge accounts (`--sponsors` of them sponsored with
 *      a track). These are REAL credentials-provider accounts — humans can
 *      sign in at /login with them during a dress rehearsal:
 *        email    judge<n>@judging.hackwestern.dev
 *        password --password (default "hw13-judging")
 *      Also creates organizer@judging.hackwestern.dev (users.type=organizer)
 *      for the admin endpoints and organizer views.
 *   5. Optionally promotes existing real accounts to organizer judges via
 *      --emails a@x.com,b@y.com (for rehearsals where organizers use their
 *      own sign-ins).
 *   6. Loads the queue with `--rounds` rounds per team.
 *
 * Flags: --teams N  --judges N  --sponsors N  --rounds N  --password STR
 *        --emails a@x,b@y  --yes (skip confirm)
 */
import * as p from "@clack/prompts";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import { inArray, like, sql } from "drizzle-orm";

import { conn, db } from "..";
import {
  judges,
  judgingQueue,
  judgingSkips,
  teamMarks,
  teams,
  trackEnum,
  users,
} from "../schema";
import { applyTriggers } from "../triggers";

export const JUDGING_SEED_EMAIL_DOMAIN = "judging.hackwestern.dev";
export const JUDGING_SEED_ORGANIZER_EMAIL = `organizer@${JUDGING_SEED_EMAIL_DOMAIN}`;

type Args = {
  teams: number;
  judges: number;
  sponsors: number;
  rounds: number;
  password: string;
  emails: string[];
  yes: boolean;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    teams: 30,
    judges: 5,
    sponsors: 2,
    rounds: 3,
    password: "hw13-judging",
    emails: [],
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
      case "--teams":
        args.teams = parseInt(next(), 10);
        break;
      case "--judges":
        args.judges = parseInt(next(), 10);
        break;
      case "--sponsors":
        args.sponsors = parseInt(next(), 10);
        break;
      case "--rounds":
        args.rounds = parseInt(next(), 10);
        break;
      case "--password":
        args.password = next();
        break;
      case "--emails":
        args.emails = next()
          .split(",")
          .map((e) => e.trim())
          .filter(Boolean);
        break;
      case "--yes":
        args.yes = true;
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }
  if (args.sponsors > args.judges) {
    throw new Error("--sponsors cannot exceed --judges");
  }
  if (args.teams < 1 || args.judges < 1 || args.rounds < 1) {
    throw new Error("--teams, --judges and --rounds must all be >= 1");
  }
  return args;
}

async function seedJudging(args: Args): Promise<void> {
  const sponsorTracks = trackEnum.enumValues.filter((t) => t !== "General");

  // 1. Triggers (idempotent: CREATE OR REPLACE / DROP IF EXISTS).
  await applyTriggers(db);

  await db.transaction(async (tx) => {
    // 2. Wipe judging state. Order respects FKs (marks/skips/queue -> judge,
    // teams). users.team_id is ON DELETE SET NULL, so deleting teams is safe.
    await tx.delete(teamMarks).where(sql`true`);
    await tx.delete(judgingSkips).where(sql`true`);
    await tx.delete(judgingQueue).where(sql`true`);
    await tx.delete(judges).where(sql`true`);
    await tx.delete(teams).where(sql`true`);
    await tx
      .delete(users)
      .where(like(users.email, `%@${JUDGING_SEED_EMAIL_DOMAIN}`));

    // 3. Teams — all "submitted" (loadQueue only queues submitted/late).
    // Every team carries General plus at least one sponsor track, assigned
    // round-robin so each sponsor track has coverage for the sponsored flow.
    const teamIds = faker.helpers.uniqueArray(
      () => faker.string.alphanumeric(6),
      args.teams,
    );
    await tx.insert(teams).values(
      teamIds.map((id, i) => ({
        id,
        name: `${faker.hacker.adjective()} ${faker.hacker.noun()}`,
        devpostUrl: `https://devpost.com/software/seed-${id}`,
        githubUrl: `https://github.com/hackwestern/seed-${id}`,
        submissionStatus: "submitted" as const,
        tracks: [
          "General" as const,
          sponsorTracks[i % sponsorTracks.length]!,
        ],
      })),
    );

    // 4. Judge + organizer accounts with real credentials-provider logins.
    const passwordHash = await bcrypt.hash(args.password, 10);
    const judgeUsers = Array.from({ length: args.judges }, (_, i) => {
      const n = i + 1;
      const sponsored = i < args.sponsors;
      return {
        id: faker.string.uuid(),
        name: sponsored ? `Judge ${n} (sponsored)` : `Judge ${n}`,
        email: `judge${n}@${JUDGING_SEED_EMAIL_DOMAIN}`,
        emailVerified: new Date(),
        password: passwordHash,
        sponsored,
        track: sponsored ? [sponsorTracks[i % sponsorTracks.length]!] : null,
      };
    });
    await tx.insert(users).values(
      judgeUsers.map(({ sponsored: _s, track: _t, ...u }) => u),
    );
    await tx.insert(users).values({
      id: faker.string.uuid(),
      name: "Judging Organizer",
      email: JUDGING_SEED_ORGANIZER_EMAIL,
      emailVerified: new Date(),
      password: passwordHash,
      type: "organizer",
    });
    await tx.insert(judges).values(
      judgeUsers.map((u) => ({
        id: u.id,
        type: u.sponsored ? ("sponsored" as const) : ("organizer" as const),
        track: u.track,
      })),
    );

    // 5. Promote real accounts (--emails) to organizer judges.
    if (args.emails.length > 0) {
      const found = await tx.query.users.findMany({
        where: inArray(users.email, args.emails),
        columns: { id: true, email: true },
      });
      const foundEmails = new Set(found.map((u) => u.email));
      const missing = args.emails.filter((e) => !foundEmails.has(e));
      if (missing.length > 0) {
        throw new Error(
          `--emails: no user account for ${missing.join(", ")}. ` +
            "They need to sign up in the app first.",
        );
      }
      await tx
        .insert(judges)
        .values(found.map((u) => ({ id: u.id, type: "organizer" as const })))
        .onConflictDoNothing();
    }

    // 6. Load the queue (mirrors judging.admin.loadQueue: every submitted
    // team, `rounds` rounds, defaults for the remaining columns).
    await tx.insert(judgingQueue).values(
      teamIds.map((teamId) => ({
        teamId,
        roundsRemaining: args.rounds,
      })),
    );
  });
}

console.log("Judging seed script");
if (!process.env.DATABASE_URL?.includes("localhost")) {
  console.error("Seed script must only be run on localhost.");
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));

try {
  if (!args.yes) {
    if (!process.stdout.isTTY) {
      console.error("Non-interactive shell: pass --yes to confirm the wipe.");
      process.exit(1);
    }
    // clack is TTY-only, so it's used solely for this interactive confirm.
    const ok = await p.confirm({
      message:
        "This DELETES all rows in team, judge, judging_queue, judging_skip " +
        "and team_mark. Continue?",
    });
    if (ok !== true) {
      console.log("Stopped.");
      process.exit(0);
    }
  }

  const started = Date.now();
  await seedJudging(args);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    [
      `Seeded in ${secs}s:`,
      `  ${args.teams} teams (submitted, sponsor tracks covered)`,
      `  ${args.judges} judges (${args.sponsors} sponsored), ${args.rounds} rounds/team queued`,
      ...(args.emails.length > 0
        ? [`  promoted to judges: ${args.emails.join(", ")}`]
        : []),
      "",
      "Sign in at /login for in-person demos:",
      `  judge1..judge${args.judges}@${JUDGING_SEED_EMAIL_DOMAIN}`,
      `  ${JUDGING_SEED_ORGANIZER_EMAIL}  (organizer/admin)`,
      `  password: ${args.password}`,
      "",
      "Judging flow ready. Run `npm run judging:driver` to smoke-test.",
    ].join("\n"),
  );
} catch (e) {
  console.error("\nJudging seed failed.", e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
