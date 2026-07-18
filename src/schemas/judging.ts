import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { judgeTypeEnum, judges, trackEnum } from "~/server/db/schema";

export const SCORE_MIN = 0;
export const SCORE_MAX = 100;

// judge inputs
export const submitTeamMarkSchema = z.object({
  teamId: z.string().min(1),
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
});

export const editTeamMarkSchema = z.object({
  teamMarkId: z.number().int().positive(),
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
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

export const deleteTeamMarkSchema = z.object({
  teamMarkId: z.number().int().positive(),
});
