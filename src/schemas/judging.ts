import { z } from "zod";

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
export const loadQueueSchema = z.object({
  roundsPerTeam: z.number().int().min(1).max(20).default(3),
}).default({ roundsPerTeam: 3 });

export const assignJudgeForTeamSchema = z.object({
  judgeId: z.string().min(1),
  teamId: z.string().min(1),
});

export const deleteTeamMarkSchema = z.object({
  teamMarkId: z.number().int().positive(),
});
