/**
 * Judging end-to-end seed script.
 *
 * Brings a database to a ready-to-judge room in one command:
 *
 *   npm run seed:judging -- --tables 70 --rows 5 --teams 60 --judges 35
 *
 * A remote database (the shared dev branch) needs its host typed out, so a
 * stray run can't wipe the wrong one:
 *
 *   npm run seed:judging -- --db-host <host from DATABASE_URL> --keep-teams
 *
 * What it does, in order:
 *   1. Applies the judging triggers (idempotent — triggers.sql source of truth).
 *   2. Wipes the judging tables (judging_assignment, team_mark, judge,
 *      judging_table, judging_settings) and ALL teams. With --keep-teams the
 *      teams already there (e.g. from the Devpost import) are kept and seated.
 *   3. Inserts `--teams` submitted teams, one minute apart (not with
 *      --keep-teams).
 *   4. Creates or updates `--judges` judge accounts. They're kept between runs
 *      (sessions, scans and cheat checks from a rehearsal point at them).
 *      These are REAL credentials-provider accounts — humans can sign in at
 *      /login with them during a dress rehearsal:
 *        email    judge<n>@judging.hackwestern.dev
 *        password --password (default "hw13-judging")
 *      Also creates organizer@judging.hackwestern.dev (users.type=organizer),
 *      who is the last judge added, for the admin endpoints and views.
 *   5. Optionally promotes existing real accounts to judges via
 *      --emails a@x.com,b@y.com (for rehearsals where organizers use their
 *      own sign-ins).
 *   6. Runs the engine: sets up `--tables` tables in `--rows` rows, seats every
 *      team (random, or submission order with --in-order), and auto-assigns
 *      every judge a section of the snake so each table gets 3 judges.
 *
 *   7. With --marks, every team gets 3 marks from mixed judges: five 0-10
 *      ratings built from a hidden team quality, a per-judge bias
 *      (harsh/generous) and noise, so judging_team_scores / judging_normalize()
 *      have data to chew on.
 *
 * Flags: --tables N  --rows N  --teams N  --judges N  --in-order  --marks
 *        --password STR  --emails a@x,b@y  --keep-teams  --db-host HOST
 *        --yes (skip confirm)
 */
import * as p from "@clack/prompts";
import bcrypt from "bcrypt";
import { faker } from "@faker-js/faker";
import { inArray, like, sql } from "drizzle-orm";

import { conn, db } from "..";
import {
  judges,
  judgingAssignments,
  judgingSettings,
  judgingTables,
  teamMarks,
  teams,
  users,
} from "../schema";
import { applyTriggers } from "../triggers";
import { autoAssign } from "~/server/judging/assignments";
import { seatTeams, setupTables } from "~/server/judging/room";

export const JUDGING_SEED_EMAIL_DOMAIN = "judging.hackwestern.dev";
export const JUDGING_SEED_ORGANIZER_EMAIL = `organizer@${JUDGING_SEED_EMAIL_DOMAIN}`;

type Args = {
  tables: number;
  rows: number;
  teams: number;
  judges: number;
  random: boolean;
  password: string;
  emails: string[];
  yes: boolean;
  marks: boolean;
  keepTeams: boolean;
  dbHost: string | null;
};

function parseArgs(argv: string[]): Args {
  const args: Args = {
    tables: 70,
    rows: 5,
    teams: 60,
    judges: 35,
    random: true,
    password: "hw13-judging",
    emails: [],
    yes: false,
    marks: false,
    keepTeams: false,
    dbHost: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v === undefined) throw new Error(`Missing value for ${flag}`);
      return v;
    };
    switch (flag) {
      case "--tables":
        args.tables = parseInt(next(), 10);
        break;
      case "--rows":
        args.rows = parseInt(next(), 10);
        break;
      case "--teams":
        args.teams = parseInt(next(), 10);
        break;
      case "--judges":
        args.judges = parseInt(next(), 10);
        break;
      case "--in-order":
        args.random = false;
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
      case "--marks":
        args.marks = true;
        break;
      case "--keep-teams":
        args.keepTeams = true;
        break;
      case "--db-host":
        args.dbHost = next();
        break;
      default:
        throw new Error(`Unknown flag: ${flag}`);
    }
  }
  if (args.tables < 1 || args.rows < 1 || args.teams < 1) {
    throw new Error("--tables, --rows and --teams must all be >= 1");
  }
  if (!args.keepTeams && args.teams > args.tables) {
    throw new Error("--teams cannot exceed --tables (one team per table)");
  }
  // The organizer account judges too, so it counts toward the 3 per table.
  if (args.judges + 1 < 3) {
    throw new Error("--judges must be at least 2 (each table needs 3 judges)");
  }
  return args;
}

async function seedJudging(args: Args) {
  // 1. Triggers (idempotent: CREATE OR REPLACE / DROP IF EXISTS).
  await applyTriggers(db);

  let organizerId = "";
  await db.transaction(async (tx) => {
    // 2. Wipe judging state. Order respects FKs. users.team_id and
    // team.judging_table_id are ON DELETE SET NULL, so deleting is safe.
    await tx.delete(judgingAssignments).where(sql`true`);
    await tx.delete(teamMarks).where(sql`true`);
    await tx.delete(judges).where(sql`true`);
    if (!args.keepTeams) await tx.delete(teams).where(sql`true`);
    await tx.delete(judgingTables).where(sql`true`);
    await tx.delete(judgingSettings).where(sql`true`);

    // 3. Teams, all submitted, one minute apart so submission order is clear.
    if (!args.keepTeams) {
      const teamIds = faker.helpers.uniqueArray(
        () => faker.string.alphanumeric(6),
        args.teams,
      );
      const joinCodes = faker.helpers.uniqueArray(
        () =>
          faker.string.fromCharacters("ABCDEFGHJKLMNPQRSTUVWXYZ23456789", 6),
        args.teams,
      );
      const firstSubmission = Date.now() - args.teams * 60_000;
      await tx.insert(teams).values(
        teamIds.map((id, i) => ({
          id,
          joinCode: joinCodes[i]!,
          name: `${faker.hacker.adjective()} ${faker.hacker.noun()}`,
          devpostUrl: `https://devpost.com/software/seed-${id}`,
          githubUrl: `https://github.com/hackwestern/seed-${id}`,
          submissionStatus: "submitted" as const,
          submittedAt: new Date(firstSubmission + i * 60_000),
          tracks: ["General" as const],
        })),
      );
    }

    // 4. Judge + organizer accounts with real credentials-provider logins.
    // Accounts from a previous run are reused, not deleted: sessions, scans
    // and cheat checks from a rehearsal point at them (foreign keys).
    const existing = await tx.query.users.findMany({
      where: like(users.email, `%@${JUDGING_SEED_EMAIL_DOMAIN}`),
      columns: { id: true, email: true },
    });
    const idFor = (email: string) =>
      existing.find((u) => u.email === email)?.id ?? faker.string.uuid();
    const passwordHash = await bcrypt.hash(args.password, 10);
    const judgeUsers = Array.from({ length: args.judges }, (_, i) => {
      const email = `judge${i + 1}@${JUDGING_SEED_EMAIL_DOMAIN}`;
      return {
        id: idFor(email),
        name: `Judge ${i + 1}`,
        email,
        emailVerified: new Date(),
        password: passwordHash,
        type: "hacker" as const,
      };
    });
    organizerId = idFor(JUDGING_SEED_ORGANIZER_EMAIL);
    await tx
      .insert(users)
      .values([
        ...judgeUsers,
        {
          id: organizerId,
          name: "Judging Organizer",
          email: JUDGING_SEED_ORGANIZER_EMAIL,
          emailVerified: new Date(),
          password: passwordHash,
          type: "organizer" as const,
        },
      ])
      .onConflictDoUpdate({
        target: users.id,
        set: {
          name: sql`excluded.name`,
          password: sql`excluded.password`,
          type: sql`excluded.type`,
        },
      });

    // Judges get sections in the order they were added: judge1 first, the
    // organizer last.
    const addedAt = Date.now() - (args.judges + 1) * 1000;
    await tx.insert(judges).values([
      ...judgeUsers.map((u, i) => ({
        id: u.id,
        type: "organizer" as const,
        createdAt: new Date(addedAt + i * 1000),
      })),
      {
        id: organizerId,
        type: "organizer" as const,
        createdAt: new Date(addedAt + args.judges * 1000),
      },
    ]);

    // 5. Promote real accounts (--emails) to judges, after the seeded ones.
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
  });

  // 6. The engine does the rest, exactly as organizers would.
  await setupTables({ tableCount: args.tables, rows: args.rows });
  const seating = await seatTeams({ random: args.random });
  const plan = await autoAssign(organizerId);
  const marks = args.marks ? await seedMarks() : 0;
  return { seating, plan, marks };
}

const clampRating = (v: number) =>
  Math.min(10, Math.max(0, Math.round(v * 2) / 2));
const gauss = () =>
  faker.number.float({ min: 0, max: 1 }) +
  faker.number.float({ min: 0, max: 1 }) +
  faker.number.float({ min: 0, max: 1 }) -
  1.5;

/**
 * Three marks per team: rating = team quality + judge bias + noise, in half
 * steps on 0-10. Judges are picked by rotating strides instead of from the
 * table assignments, which pair the same trio on a block of tables (disconnected
 * groups, so biases couldn't be compared). Real judging shuffles judges across
 * ~3 rounds; this mimics that mixing. A single batch insert per 500 rows.
 */
async function seedMarks() {
  const teamIds = (await db.select({ id: teams.id }).from(teams)).map(
    (t) => t.id,
  );
  const judgeIds = (await db.select({ id: judges.id }).from(judges)).map(
    (j) => j.id,
  );
  const quality = new Map(teamIds.map((id) => [id, 6 + gauss() * 3]));
  const bias = new Map(judgeIds.map((id) => [id, gauss() * 2.5]));
  const perTeam = Math.min(3, judgeIds.length);
  const values = teamIds.flatMap((teamId, i) => {
    const picked = new Set<number>();
    for (const idx of [i * 7, i * 3 + 11, i * 5 + 22]) {
      let j = idx % judgeIds.length;
      while (picked.has(j) && picked.size < perTeam)
        j = (j + 1) % judgeIds.length;
      picked.add(j);
    }
    return [...picked].slice(0, perTeam).map((j) => {
      const judgeId = judgeIds[j]!;
      const base = quality.get(teamId)! + bias.get(judgeId)!;
      const rate = () => clampRating(base + gauss() * 1.2);
      const [impact, creativity, technical, design, adventurous] = [
        rate(),
        rate(),
        rate(),
        rate(),
        rate(),
      ] as [number, number, number, number, number];
      const mean = (impact + creativity + technical + design + adventurous) / 5;
      return {
        teamId,
        judgeId,
        score: mean,
        impactRating: impact,
        creativityRating: creativity,
        technicalRating: technical,
        designRating: design,
        adventurousRating: adventurous,
        superLike: mean >= 8 && faker.datatype.boolean(),
      };
    });
  });
  for (let i = 0; i < values.length; i += 500) {
    await db.insert(teamMarks).values(values.slice(i, i + 500));
  }
  return values.length;
}

console.log("Judging seed script");
const args = parseArgs(process.argv.slice(2));

// Local databases run as before. Anything else (the shared dev branch) needs
// its host typed out with --db-host, so a stray run can't wipe the wrong one.
// Never point this at production: it deletes every team and all judging.
const dbHost = (() => {
  try {
    return new URL(process.env.DATABASE_URL ?? "").hostname;
  } catch {
    return "";
  }
})();
if (!dbHost) {
  console.error("DATABASE_URL is missing or not a URL.");
  process.exit(1);
}
const isLocal = ["localhost", "127.0.0.1", "::1"].includes(dbHost);
if (!isLocal && args.dbHost !== dbHost) {
  console.error(
    `DATABASE_URL points at ${dbHost}, not localhost. To seed it anyway, ` +
      `pass --db-host ${dbHost}. Never use this on production.`,
  );
  process.exit(1);
}
console.log(`Database: ${dbHost}`);

try {
  if (!args.yes) {
    if (!process.stdout.isTTY) {
      console.error("Non-interactive shell: pass --yes to confirm the wipe.");
      process.exit(1);
    }
    // clack is TTY-only, so it's used solely for this interactive confirm.
    const ok = await p.confirm({
      message:
        `This DELETES all rows in ${args.keepTeams ? "" : "team, "}judge, ` +
        "team_mark, judging_table, judging_settings and judging_assignment " +
        `on ${dbHost}. Continue?`,
    });
    if (ok !== true) {
      console.log("Stopped.");
      process.exit(0);
    }
  }

  const started = Date.now();
  const { seating, plan, marks } = await seedJudging(args);
  const secs = ((Date.now() - started) / 1000).toFixed(1);

  console.log(
    [
      `Seeded in ${secs}s:`,
      `  ${args.tables} tables in ${args.rows} rows`,
      `  ${seating.seated} teams seated (${args.random ? "random" : "submission order"}), ${seating.emptyTables} tables empty`,
      `  ${plan.judges} judges, ${plan.tablesPerJudge.min}-${plan.tablesPerJudge.max} tables each, ${plan.judgesPerTable} per table`,
      ...(args.marks
        ? [`  ${marks} marks written (see judging_team_scores)`]
        : []),
      ...(args.emails.length > 0
        ? [`  promoted to judges: ${args.emails.join(", ")}`]
        : []),
      "",
      "Sign in at /login for in-person demos:",
      `  judge1..judge${args.judges}@${JUDGING_SEED_EMAIL_DOMAIN}`,
      `  ${JUDGING_SEED_ORGANIZER_EMAIL}  (organizer/admin, also a judge)`,
      `  password: ${args.password}`,
      "",
      "Room ready.",
    ].join("\n"),
  );
} catch (e) {
  console.error("\nJudging seed failed.", e);
  process.exitCode = 1;
} finally {
  await conn.end();
}
