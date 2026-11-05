import { and, asc, desc, eq, gt } from "drizzle-orm";
import { z } from "zod";
import {
  createTRPCRouter,
  protectedOrganizerProcedure,
  publicProcedure,
} from "~/server/api/trpc";
import { db } from "~/server/db";
import { applications, broadcastSettings, users } from "~/server/db/schema";
import {
  leaderName,
  parseScheduleGrid,
  rankLeaders,
  type BroadcastActivity,
} from "~/lib/broadcast";
import { cellText, fetchScheduleSheet } from "~/server/schedule-sheet";

const LEADERBOARD_SIZE = 5;
const SCHEDULE_TTL_MS = 60_000;

const DEFAULT_SETTINGS = {
  hackingStartsAt: null,
  hackingEndsAt: null,
  photoSeconds: 8,
  videoSeconds: 20,
  updatedAt: null,
};

async function getSettings() {
  const row = await db.query.broadcastSettings.findFirst();
  return row ?? DEFAULT_SETTINGS;
}

// Top hackers by points earned (spending points on rewards doesn't lower it).
// Ordered by id after points so the cutoff doesn't flicker between polls.
async function getLeaders() {
  const rows = await db
    .select({
      accountName: users.name,
      firstName: applications.firstName,
      lastName: applications.lastName,
      points: users.scavengerHuntEarned,
    })
    .from(users)
    .leftJoin(applications, eq(applications.userId, users.id))
    .where(and(eq(users.type, "hacker"), gt(users.scavengerHuntEarned, 0)))
    .orderBy(desc(users.scavengerHuntEarned), asc(users.id))
    .limit(LEADERBOARD_SIZE);

  return rankLeaders(
    rows.map((row) => ({
      name: leaderName(row.accountName, row.firstName, row.lastName),
      points: row.points ?? 0,
    })),
  );
}

// Every open display polls, so the sheet is cached briefly. If Google fails,
// keep serving the last schedule read (null if none has been read yet).
let schedule: { fetchedAt: Date; activities: BroadcastActivity[] } | undefined;

async function getSchedule() {
  if (schedule && Date.now() - schedule.fetchedAt.getTime() < SCHEDULE_TTL_MS) {
    return schedule;
  }
  try {
    const { rowData, merges } = await fetchScheduleSheet();
    const rows = rowData.map((row) => (row.values ?? []).map(cellText));
    schedule = {
      fetchedAt: new Date(),
      activities: parseScheduleGrid(rows, merges),
    };
  } catch (error) {
    console.error("Broadcast schedule fetch failed:", error);
  }
  return schedule ?? null;
}

const settingsInput = z
  .object({
    hackingStartsAt: z.date().nullable(),
    hackingEndsAt: z.date().nullable(),
    photoSeconds: z.number().int().min(3).max(120),
    videoSeconds: z.number().int().min(3).max(300),
  })
  .refine(
    (s) =>
      !s.hackingStartsAt ||
      !s.hackingEndsAt ||
      s.hackingStartsAt < s.hackingEndsAt,
    { message: "Hacking must end after it starts", path: ["hackingEndsAt"] },
  );

export const broadcastRouter = createTRPCRouter({
  // Public: the display runs in OBS without signing in.
  display: publicProcedure.query(async () => {
    const [settings, leaders, sheet] = await Promise.all([
      getSettings(),
      getLeaders(),
      getSchedule(),
    ]);
    return {
      hackingStartsAt: settings.hackingStartsAt,
      hackingEndsAt: settings.hackingEndsAt,
      photoSeconds: settings.photoSeconds,
      videoSeconds: settings.videoSeconds,
      leaders,
      activities: sheet?.activities ?? null,
      scheduleFetchedAt: sheet?.fetchedAt ?? null,
    };
  }),

  settings: protectedOrganizerProcedure.query(() => getSettings()),

  updateSettings: protectedOrganizerProcedure
    .input(settingsInput)
    .mutation(async ({ input }) => {
      const values = { ...input, updatedAt: new Date() };
      const [row] = await db
        .insert(broadcastSettings)
        .values({ id: 1, ...values })
        .onConflictDoUpdate({ target: broadcastSettings.id, set: values })
        .returning();
      return row;
    }),
});
