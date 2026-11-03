import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

import { judgingTables } from "~/server/db/schema";
import { SCORE_MAX, SCORE_MIN } from "~/schemas/judging";

const tableId = z.number().int().positive();
const assignmentId = z.number().int().positive();
const teamId = z.string().min(1);
const judgeId = z.string().min(1);

// organizer inputs
export const upsertTableSchema = createInsertSchema(judgingTables, {
  number: z.number().int().positive(),
  zone: z.string().trim().min(1).max(64),
  isActive: z.boolean().optional(),
}).omit({ id: true });
export type UpsertTableInput = z.infer<typeof upsertTableSchema>;

export const setTableActiveSchema = z.object({
  tableId,
  isActive: z.boolean(),
});

export const deleteTableSchema = z.object({ tableId });

export const seatTeamSchema = z.object({ teamId, tableId });

export const unseatTeamSchema = z.object({ teamId });

export const addAssignmentSchema = z.object({
  judgeId,
  teamId,
  // Omitted: goes to the end of the judge's list.
  position: z.number().int().positive().optional(),
});
export type AddAssignmentInput = z.infer<typeof addAssignmentSchema>;

export const assignmentIdSchema = z.object({ assignmentId });

export const reorderAssignmentsSchema = z.object({
  judgeId,
  // Every non-cancelled stop for the judge, in the new order.
  assignmentIds: z.array(assignmentId).min(1),
});

// judge inputs
export const submitAssignmentMarkSchema = z.object({
  assignmentId,
  score: z.number().min(SCORE_MIN).max(SCORE_MAX),
});
