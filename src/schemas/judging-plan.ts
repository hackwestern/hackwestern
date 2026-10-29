import { z } from "zod";

import { trackEnum } from "~/server/db/schema";
import { SCORE_MAX, SCORE_MIN } from "./judging";

const sponsorTrack = z
  .enum(trackEnum.enumValues)
  .refine((t) => t !== "General", "General is not a sponsor track.");

// organizer inputs: venue + round
export const saveLayoutSchema = z.object({
  zones: z
    .array(
      z.object({
        zone: z.string().trim().min(1).max(64),
        rows: z.number().int().min(1).max(50),
        cols: z.number().int().min(1).max(50),
      }),
    )
    .min(1),
  startNumber: z.number().int().min(1).default(1),
});

export const setTableActiveSchema = z.object({
  tableId: z.number().int().positive(),
  isActive: z.boolean(),
});

export const saveRoundSettingsSchema = z.object({
  startsAt: z.date(),
  slotMinutes: z.number().int().min(1).max(120),
  slotCount: z.number().int().min(1).max(20).default(6),
  judgesPerTeam: z.number().int().min(1).max(10).default(3),
});

// organizer inputs: day-of fixes
export const setAssignmentAbsentSchema = z.object({
  assignmentId: z.number().int().positive(),
  absent: z.boolean(),
});

export const reassignVisitSchema = z.object({
  assignmentId: z.number().int().positive(),
  judgeId: z.string().min(1),
});

// judge inputs
export const submitVisitMarkSchema = z.object({
  assignmentId: z.number().int().positive(),
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
});

// sponsor judging
export const upsertSponsorRoomSchema = z.object({
  track: sponsorTrack,
  name: z.string().trim().min(1).max(255),
  location: z.string().trim().max(255).optional(),
  slotMinutes: z.number().int().min(1).max(120),
});

export const setShortlistSchema = z.object({
  track: sponsorTrack,
  teams: z
    .array(
      z.object({
        teamId: z.string().min(1),
        rank: z.number().int().min(1),
      }),
    )
    .max(50),
});

export const schedulePitchesSchema = z.object({
  startsAt: z.date(),
});

export type SaveLayoutInput = z.infer<typeof saveLayoutSchema>;
export type SaveRoundSettingsInput = z.infer<typeof saveRoundSettingsSchema>;
export type UpsertSponsorRoomInput = z.infer<typeof upsertSponsorRoomSchema>;
export type SetShortlistInput = z.infer<typeof setShortlistSchema>;
