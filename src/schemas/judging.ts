import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { CRITERION_IDS, type CriterionId } from "~/lib/judging-criteria";
import { judgeTypeEnum, judges, trackEnum } from "~/server/db/schema";

// Scores are 0-10, the judge app's rubric range.
export const SCORE_MIN = 0;
export const SCORE_MAX = 10;

const ratingSchema = z.number().min(SCORE_MIN).max(SCORE_MAX).multipleOf(0.5);

/**
 * The rubric a judge sends with a mark. Each criterion is stored in its own
 * team_mark column, so only the criteria in CRITERION_IDS are accepted.
 */
export const scoreBreakdownSchema = z.object({
  ratings: z
    .object(
      Object.fromEntries(
        CRITERION_IDS.map((id) => [id, ratingSchema.optional()]),
      ) as Record<CriterionId, z.ZodOptional<typeof ratingSchema>>,
    )
    .strict(),
  notes: z.string().max(2000).nullish(),
  superLike: z.boolean().optional(),
});

/** What a judge sends with a mark: ratings by criterion id, notes, super like. */
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

const score = z.number().min(SCORE_MIN).max(SCORE_MAX);
const assignmentId = z.number().int().positive();
const seatId = z.number().int().positive();
const teamId = z.string().min(1);
const judgeId = z.string().min(1);

// judge inputs
export const assignmentIdSchema = z.object({ assignmentId });

// The team the judge's screen showed (null for an empty table). Optional, but
// when sent, a stale screen can't mark a newly seated team absent.
export const reportAbsentSchema = z.object({
  assignmentId,
  teamId: z.string().min(1).nullable().optional(),
});

// `teamId` is the team the judge's screen showed for this stop. The engine
// refuses if a different team is seated there now (e.g. after a swap).
export const startStopSchema = z.object({ assignmentId, teamId });

export const submitStopSchema = z.object({
  assignmentId,
  teamId,
  score,
  breakdown: scoreBreakdownSchema.optional(),
});

export const editTeamMarkSchema = z.object({
  teamMarkId: z.number().int().positive(),
  score,
  breakdown: scoreBreakdownSchema.optional(),
});

// organizer inputs: room setup, seating, assignment
export const setupTablesSchema = z.object({
  tableCount: z.number().int().min(1).max(500),
  rows: z.number().int().min(1).max(100),
  judgesPerSeat: z.number().int().min(1).max(10).optional(),
  zone: z.string().trim().min(1).max(64).optional(),
});
export type SetupTablesInput = z.infer<typeof setupTablesSchema>;

export const setSeatActiveSchema = z.object({
  seatId,
  isActive: z.boolean(),
});

export const seatTeamsSchema = z
  .object({
    // Random by default; false seats in submission order.
    random: z.boolean().default(true),
  })
  .default({ random: true });

export const swapTeamsSchema = z
  .object({ teamAId: teamId, teamBId: teamId })
  .refine((v) => v.teamAId !== v.teamBId, {
    message: "Pick two different teams.",
    path: ["teamBId"],
  });

export const moveTeamSchema = z.object({ teamId, seatId });

export const handOffJudgeSchema = z
  .object({ fromJudgeId: judgeId, toJudgeId: judgeId })
  .refine((v) => v.fromJudgeId !== v.toJudgeId, {
    message: "Pick a different judge to hand off to.",
    path: ["toJudgeId"],
  });

export const addSeatToJudgeSchema = z.object({ judgeId, seatId });

// `id` is the user id being promoted to a judge. Stats columns are
// server-derived, so they're omitted. `track` needs the array override
// (drizzle-zod v0.5 generates a single-value schema for `.array()` columns).
export const addJudgeSchema = createInsertSchema(judges, {
  id: z.string().min(1),
  type: z.enum(judgeTypeEnum.enumValues).default("organizer"),
  track: z.array(z.enum(trackEnum.enumValues)).optional(),
})
  .omit({
    marksCount: true,
    marksSum: true,
    marksSquaredSum: true,
    createdAt: true,
  })
  .refine((v) => v.type !== "sponsored" || (v.track?.length ?? 0) > 0, {
    message: "Sponsored judges must have at least one track.",
    path: ["track"],
  });

// Bulk add: one or more judges in a single call (all-or-nothing).
export const addJudgesSchema = z.array(addJudgeSchema).min(1);

export type AddJudgeInput = z.infer<typeof addJudgeSchema>;

// Control-room form: the organizer types the person's account email instead
// of a user id. Stored emails are canonical (trim+lowercase), so normalize.
export const addJudgeByEmailSchema = z
  .object({
    email: z.string().trim().toLowerCase().email(),
    type: z.enum(judgeTypeEnum.enumValues).default("organizer"),
    track: z.array(z.enum(trackEnum.enumValues)).optional(),
  })
  .refine((v) => v.type !== "sponsored" || (v.track?.length ?? 0) > 0, {
    message: "Sponsored judges must have at least one track.",
    path: ["track"],
  });

export const deleteTeamMarkSchema = z.object({
  teamMarkId: z.number().int().positive(),
});
