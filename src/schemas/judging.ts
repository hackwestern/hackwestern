import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { CRITERION_IDS, type CriterionId } from "~/lib/judging-criteria";
import { judgeTypeEnum, judges, trackEnum } from "~/server/db/schema";

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
  notes: z.string().max(2000).optional(),
  superLike: z.boolean().optional(),
});

// judge inputs
/** What a judge sends with a mark: ratings by criterion id, notes, super like. */
export type ScoreBreakdown = z.infer<typeof scoreBreakdownSchema>;

export const submitTeamMarkSchema = z.object({
  teamId: z.string().min(1),
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
  breakdown: scoreBreakdownSchema.optional(),
});

export const editTeamMarkSchema = z.object({
  teamMarkId: z.number().int().positive(),
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
  breakdown: scoreBreakdownSchema.optional(),
});

// organizer inputs
export const loadQueueSchema = z
  .object({
    roundsPerTeam: z.number().int().min(1).max(20).default(3),
  })
  .default({ roundsPerTeam: 3 });

export const assignJudgeForTeamSchema = z.object({
  judgeId: z.string().min(1),
  teamId: z.string().min(1),
});

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
