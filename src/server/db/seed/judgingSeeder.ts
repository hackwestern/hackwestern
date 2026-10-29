import { faker } from "@faker-js/faker";
import { isNotNull, sql } from "drizzle-orm";

import { type Transaction, type db } from "~/server/db";
import {
  judges,
  judgingAssignments,
  judgingQueue,
  judgingRound,
  judgingSkips,
  judgingTables,
  sponsorPitches,
  sponsorRooms,
  teamMarks,
  teams,
  type trackEnum,
  users,
} from "~/server/db/schema";
import { buildLayout } from "~/server/judging/plan";

type Tx = Transaction | typeof db;
type Track = (typeof trackEnum.enumValues)[number];

const SPONSOR_TRACKS: Track[] = [
  "Best Use of Cohere",
  "Best Use of AntiGravity",
  "Best Domain",
];

export type JudgingSeedOptions = {
  teams?: number;
  /** Fixed start for the general round; defaults to the next whole hour. */
  roundStartsAt?: Date;
};

export type JudgingSeedResult = {
  teamIds: string[];
  eligibleTeamIds: string[];
  generalJudgeIds: string[];
  sponsorJudgeIds: string[];
  /** One sponsored judge sits on two tracks, to exercise double-booking. */
  dualTrackJudgeId: string;
  shortlists: Record<string, string[]>;
};

/**
 * Wipe judging data so a re-seed starts clean. Teams go too: they only exist
 * for judging in the seed.
 */
export async function deleteJudging(tx: Tx) {
  await tx.delete(sponsorPitches).where(sql`true`);
  await tx.delete(sponsorRooms).where(sql`true`);
  await tx.delete(judgingAssignments).where(sql`true`);
  await tx.delete(judgingRound).where(sql`true`);
  await tx
    .update(teams)
    .set({ judgingTableId: null })
    .where(isNotNull(teams.judgingTableId));
  await tx.delete(judgingTables).where(sql`true`);
  await tx.delete(teamMarks).where(sql`true`);
  await tx.delete(judgingSkips).where(sql`true`);
  await tx.delete(judgingQueue).where(sql`true`);
  await tx.delete(judges).where(sql`true`);
  await tx.delete(teams).where(sql`true`);
}

/**
 * Seed a realistic judging day: submitted (and some late or draft) teams with
 * members, general judges at roughly teams × 3 ÷ 6, sponsored judges per
 * track, one room and a 10–15 team shortlist per sponsor track, a table
 * layout with a few spare and two switched-off tables, and draft round
 * settings. Seating and visits are left to the engine.
 */
export async function seedJudging(
  tx: Tx,
  opts: JudgingSeedOptions = {},
): Promise<JudgingSeedResult> {
  const teamCount = opts.teams ?? 120;
  const emailTag = faker.string.alphanumeric(6).toLowerCase();
  let userSeq = 0;
  const newUser = (type: "hacker" | "organizer" | "sponsor", slack = false) => {
    userSeq++;
    return {
      id: faker.string.uuid(),
      name: faker.person.fullName(),
      email: `seed-${emailTag}-${userSeq}@judging.hackwestern.test`,
      type,
      slackId: slack ? `U${faker.string.alphanumeric(10).toUpperCase()}` : null,
    };
  };

  const teamRows = Array.from({ length: teamCount }, (_, i) => {
    const roll = faker.number.float();
    const tracks: Track[] =
      roll < 0.7
        ? ["General"]
        : roll < 0.9
          ? ["General", faker.helpers.arrayElement(SPONSOR_TRACKS)]
          : ["General", ...faker.helpers.arrayElements(SPONSOR_TRACKS, 2)];
    const status: "draft" | "late" | "submitted" =
      i % 20 === 0 ? "draft" : i % 10 === 0 ? "late" : "submitted";
    return {
      id: faker.string.alphanumeric(12),
      name: `${faker.word.adjective()} ${faker.word.noun()} ${i + 1}`,
      devpostUrl: `https://devpost.com/software/seed-${i + 1}`,
      githubUrl: `https://github.com/seed/project-${i + 1}`,
      submissionStatus: status,
      tracks,
      joinCode: (i + 1).toString(36).toUpperCase().padStart(6, "0"),
    };
  });
  await tx.insert(teams).values(teamRows);
  const eligible = teamRows.filter((t) => t.submissionStatus !== "draft");

  const hackers = teamRows.flatMap((t) =>
    Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => ({
      ...newUser("hacker", faker.number.float() < 0.8),
      teamId: t.id,
    })),
  );

  const generalCount = Math.ceil((eligible.length * 3) / 6) + 4;
  const generalUsers = Array.from({ length: generalCount }, () =>
    newUser("organizer"),
  );
  const sponsorUsers = SPONSOR_TRACKS.flatMap((track) =>
    Array.from({ length: 3 }, () => ({ ...newUser("sponsor"), track })),
  );

  const allUsers = [
    ...hackers,
    ...generalUsers,
    ...sponsorUsers.map(({ track: _t, ...u }) => u),
  ];
  for (let i = 0; i < allUsers.length; i += 500) {
    await tx.insert(users).values(allUsers.slice(i, i + 500));
  }

  const dualTrackJudgeId = sponsorUsers[0]!.id;
  await tx.insert(judges).values([
    ...generalUsers.map((u) => ({
      id: u.id,
      type: "organizer" as const,
      harshness:
        faker.number.float() < 0.85
          ? faker.number.float({ min: 0.6, max: 1.4, fractionDigits: 2 })
          : null,
    })),
    ...sponsorUsers.map((u) => ({
      id: u.id,
      type: "sponsored" as const,
      track:
        u.id === dualTrackJudgeId ? [u.track, SPONSOR_TRACKS[1]!] : [u.track],
    })),
  ]);

  await tx.insert(sponsorRooms).values(
    SPONSOR_TRACKS.map((track, i) => ({
      track,
      name: `Room ${String.fromCharCode(65 + i)}`,
      location: `Middlesex College ${100 + i * 10}`,
      slotMinutes: [8, 10, 12][i]!,
    })),
  );

  const shortlists: Record<string, string[]> = {};
  for (const track of SPONSOR_TRACKS) {
    const entered = eligible.filter((t) => t.tracks.includes(track));
    const rest = eligible.filter((t) => !t.tracks.includes(track));
    const size = Math.min(
      faker.number.int({ min: 10, max: 15 }),
      eligible.length,
    );
    const picks = [...entered, ...faker.helpers.shuffle(rest)].slice(0, size);
    shortlists[track] = picks.map((t) => t.id);
    if (picks.length > 0) {
      await tx.insert(sponsorPitches).values(
        picks.map((t, rank) => ({
          track,
          teamId: t.id,
          rank: rank + 1,
          submittedBy: sponsorUsers.find((u) => u.track === track)?.id,
        })),
      );
    }
  }

  const tablesNeeded = eligible.length + 6;
  const cols = 10;
  const perZone = Math.ceil(tablesNeeded / 3 / cols);
  const layout = buildLayout([
    { zone: "Main gym", rows: perZone, cols },
    { zone: "Upper gym", rows: perZone, cols },
    { zone: "Hallway", rows: perZone, cols },
  ]);
  const inserted = await tx
    .insert(judgingTables)
    .values(layout)
    .returning({ id: judgingTables.id, number: judgingTables.number });
  const off = inserted.filter((t) => t.number === 7 || t.number === 23);
  for (const t of off) {
    await tx
      .update(judgingTables)
      .set({ isActive: false })
      .where(sql`${judgingTables.id} = ${t.id}`);
  }

  const startsAt = opts.roundStartsAt ?? new Date();
  if (!opts.roundStartsAt) startsAt.setHours(startsAt.getHours() + 1, 0, 0, 0);
  await tx.insert(judgingRound).values({
    id: 1,
    status: "draft",
    startsAt,
    slotMinutes: 10,
    slotCount: 6,
    judgesPerTeam: 3,
  });

  return {
    teamIds: teamRows.map((t) => t.id),
    eligibleTeamIds: eligible.map((t) => t.id),
    generalJudgeIds: generalUsers.map((u) => u.id),
    sponsorJudgeIds: sponsorUsers.map((u) => u.id),
    dualTrackJudgeId,
    shortlists,
  };
}
