import { z } from "zod";
import { env } from "~/env";
import type { ScoreAdjustment } from "~/features/rankings/types";

const adjustmentSchema = z.object({
  field: z.string().min(1),
  multipliers: z.record(z.number()),
});

const adjustmentsSchema = z.array(adjustmentSchema);

/**
 * Parses the raw RANKING_ADJUSTMENTS value into a list of score adjustments.
 * Blank/undefined means "no adjustments" (neutral). Malformed input throws so a
 * misconfigured deployment fails loudly rather than silently scoring wrong.
 */
export function parseRankingAdjustments(
  raw: string | undefined | null,
): ScoreAdjustment[] {
  if (!raw || raw.trim() === "") return [];
  const parsed: unknown = JSON.parse(raw);
  return adjustmentsSchema.parse(parsed);
}

/**
 * Server-only accessor for the live adjustment config. Which applicant fields
 * and values are weighted — and by how much — lives entirely in the
 * RANKING_ADJUSTMENTS env var, never in committed source. Defaults to neutral.
 */
export function getRankingAdjustments(): ScoreAdjustment[] {
  return parseRankingAdjustments(env.RANKING_ADJUSTMENTS);
}
