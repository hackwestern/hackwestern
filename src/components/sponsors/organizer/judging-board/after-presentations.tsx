import { useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  Card,
  CardHead,
} from "~/components/sponsors/organizer/coffee-sessions/parts";
import { sponsorJudgingBoardCopy } from "~/content/sponsor-judging-board";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { ConfirmDialog } from "./confirm-dialog";
import { round2ScheduleWarnings } from "~/lib/judging-board";

const copy = sponsorPresentationsCopy.organizer;
const NOTE = "m-0 text-sm font-medium text-dashboard-text-medium";
const WARN = "m-0 text-sm font-semibold text-dashboard-text-warning";

/**
 * What organizers do once presentations are done, kept from the old
 * Presentations panel: open round 2 (after a confirm; sponsors can't
 * submit a top 5 until then). Scheduling and notifying moved to the
 * Judging board. The Sponsor Judging sheet tab syncs itself after every
 * judging change, so there's no "Sync to sheet" button, and the cheat
 * check section is off this tab for now (Jazz, 2026-11-20; the
 * /internal/cheat-check page still works).
 */
export function AfterPresentations() {
  const utils = api.useUtils();
  const overview = api.sponsorPresentations.overview.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: 1,
  });
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const board = api.sponsorPresentations.board.useQuery(undefined, {
    enabled: confirming === true,
    staleTime: 0,
    retry: false,
  });
  const round2 = api.sponsorPresentations.setRound2.useMutation({
    onSuccess: () => {
      setConfirming(null);
      void utils.sponsorPresentations.overview.invalidate();
    },
  });
  const data = overview.data;
  if (!data) {
    return overview.isError ? <p className={NOTE}>{copy.failed}</p> : null;
  }
  const round2Open = data.round2OpenedAt !== null;

  return (
    <Card labelledBy="judging-after-heading">
      <CardHead
        id="judging-after-heading"
        title={sponsorJudgingBoardCopy.after.heading}
      />

      <div className="flex flex-col gap-2">
        <p
          className={cn(
            NOTE,
            round2Open && "font-semibold text-dashboard-status-live",
          )}
        >
          {round2Open
            ? copy.round2.openSince(formatSubmittedTime(data.round2OpenedAt!))
            : copy.round2.closed}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <DashboardButton
            variant="small"
            data-tour="judging-round2"
            disabled={round2.isPending}
            onClick={() => setConfirming(!round2Open)}
          >
            {round2Open ? copy.round2.close : copy.round2.open}
          </DashboardButton>
        </div>
        <ConfirmDialog
          open={confirming !== null}
          heading={
            confirming ? "Close round 1 and open round 2?" : "Close round 2?"
          }
          body={
            confirming
              ? copy.round2.openConfirm(data.finalTop)
              : copy.round2.closeConfirm(data.finalTop)
          }
          warnings={
            confirming
              ? [
                  ...(board.data ? round2ScheduleWarnings(board.data) : []),
                  ...(board.isFetching
                    ? ["Checking the current schedule…"]
                    : board.isError || !board.data
                      ? ["Couldn’t verify the current schedule."]
                      : []),
                ]
              : undefined
          }
          ok={confirming ? copy.round2.open : copy.round2.close}
          okDisabled={confirming === true && board.isFetching}
          cancel={copy.cancel}
          onOk={() => {
            if (confirming !== null) round2.mutate({ open: confirming });
          }}
          onClose={() => setConfirming(null)}
        />
        {round2.isError && (
          <p role="alert" className={WARN}>
            {round2.error.data?.code === "BAD_REQUEST"
              ? round2.error.message
              : copy.failed}
          </p>
        )}
      </div>
    </Card>
  );
}
