import { TRPCError } from "@trpc/server";

import { sponsorJudgingCopy } from "~/content/sponsor-judging";
import { hasPrizeTrack, isDigitalJudging } from "~/lib/sponsor-prize-tracks";

/**
 * The one gate for every public (sponsor UUID) judging and scoring
 * procedure: only prize track sponsors judge, and digital sponsors (the
 * "In person / Digital" = Digital column, kept in DIGITAL_JUDGING_SPONSORS)
 * have no portal, so they can't read the track roster or their top 3
 * either. Both throw FORBIDDEN. Whether a sponsor has a DB row never
 * decides this: submitDigital creates one for PCBWay.
 */
export function assertPortalJudge(sponsorName: string) {
  if (!hasPrizeTrack(sponsorName)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: sponsorJudgingCopy.errors.noPrizeTrack,
    });
  }
  // Digital sponsors: the spon team enters their top 3 (submitDigital).
  // Jazz, 2026-11-19.
  if (isDigitalJudging(sponsorName)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: sponsorJudgingCopy.errors.digital,
    });
  }
}
