import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import {
  DashboardButton,
  dashboardButtonVariants,
} from "~/components/internals/dashboard-button";
import { Card, CardHead } from "~/components/sponsors/organizer/coffee-sessions/parts";
import { sponsorJudgingBoardCopy } from "~/content/sponsor-judging-board";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = sponsorPresentationsCopy.organizer;
const NOTE = "m-0 text-sm font-medium text-dashboard-text-medium";
const WARN = "m-0 text-sm font-semibold text-dashboard-text-warning";

/**
 * What organizers do once presentations are done, kept from the old
 * Presentations panel: open round 2 (after a confirm; sponsors can't
 * submit a top 5 until then), sync the Sponsor Judging sheet tab, and send
 * the sponsors' top teams to the cheat check. Scheduling and notifying
 * moved to the Judging board.
 */
export function AfterPresentations() {
  const utils = api.useUtils();
  const overview = api.sponsorPresentations.overview.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: 1,
  });
  const [confirming, setConfirming] = useState<boolean | null>(null);
  const round2 = api.sponsorPresentations.setRound2.useMutation({
    onSuccess: () => {
      setConfirming(null);
      void utils.sponsorPresentations.overview.invalidate();
    },
  });
  const cheat = api.sponsorPresentations.cheatCheckTopTeams.useMutation();
  const syncSheet = api.sponsorPresentations.syncSheet.useMutation();
  const data = overview.data;
  if (!data) {
    return overview.isError ? <p className={NOTE}>{copy.failed}</p> : null;
  }
  const round2Open = data.round2OpenedAt !== null;
  const ids = data.topTeams.map((t) => t.teamId);

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
            : data.slots.length > 0
              ? copy.round2.closed
              : sponsorPresentationsCopy.errors.round2NoSchedule}
        </p>
        {confirming !== null ? (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <p className={NOTE}>
              {confirming
                ? copy.round2.openConfirm(data.finalTop)
                : copy.round2.closeConfirm(data.finalTop)}
            </p>
            <div className="flex shrink-0 gap-2">
              <DashboardButton
                variant="small"
                onClick={() => setConfirming(null)}
                disabled={round2.isPending}
              >
                {copy.cancel}
              </DashboardButton>
              <DashboardButton
                variant="small"
                onClick={() => round2.mutate({ open: confirming })}
                disabled={round2.isPending}
              >
                {round2.isPending
                  ? confirming
                    ? copy.round2.opening
                    : copy.round2.closing
                  : confirming
                    ? copy.round2.open
                    : copy.round2.close}
              </DashboardButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <DashboardButton
              variant="small"
              disabled={!round2Open && data.slots.length === 0}
              onClick={() => setConfirming(!round2Open)}
            >
              {round2Open ? copy.round2.close : copy.round2.open}
            </DashboardButton>
            {/* The Sponsor Judging tab also updates after every change. */}
            <DashboardButton
              variant="small"
              disabled={syncSheet.isPending}
              onClick={() => syncSheet.mutate()}
            >
              {syncSheet.isPending ? copy.syncing : copy.syncSheet}
            </DashboardButton>
          </div>
        )}
        {round2.isError && (
          <p role="alert" className={WARN}>
            {round2.error.data?.code === "BAD_REQUEST"
              ? round2.error.message
              : copy.failed}
          </p>
        )}
        {syncSheet.data && (
          <p role="status" className={syncSheet.data.ok ? NOTE : WARN}>
            {syncSheet.data.ok
              ? copy.synced(formatSubmittedTime(syncSheet.data.syncedAt))
              : syncSheet.data.disabled
                ? copy.syncDisabled
                : copy.syncFailed(syncSheet.data.error)}
          </p>
        )}
        {syncSheet.isError && (
          <p role="alert" className={WARN}>
            {copy.failed}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-2 border-t border-dashboard-border-subtle pt-3">
        <h3 className="m-0 text-base font-bold">{copy.cheatHeading}</h3>
        <p className={NOTE}>
          {ids.length > 0
            ? copy.cheatIntro(data.finalTop, ids.length)
            : copy.cheatNone(data.finalTop)}
        </p>
        {ids.length > 0 && (
          <>
            <p className="m-0 text-sm text-dashboard-text-heavy">
              {data.topTeams.map((t) => t.name).join(", ")}
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <DashboardButton
                variant="small"
                onClick={() => cheat.mutate()}
                disabled={cheat.isPending}
              >
                {cheat.isPending ? copy.cheatRunning : copy.cheatRun}
              </DashboardButton>
              <Link
                href={`/internal/cheat-check?teams=${ids.map(encodeURIComponent).join(",")}`}
                className={dashboardButtonVariants({ variant: "link" })}
              >
                {copy.cheatOpen}
              </Link>
              {cheat.data && (
                <span
                  role="status"
                  className="inline-flex items-center gap-1 text-sm font-medium text-dashboard-text-medium"
                >
                  <CheckCircle2 aria-hidden className="size-4" />
                  {copy.cheatDone(cheat.data.teamIds.length, cheat.data.failed)}
                </span>
              )}
              {cheat.isError && (
                <span role="alert" className={NOTE}>
                  {copy.failed}
                </span>
              )}
            </div>
          </>
        )}
      </div>
    </Card>
  );
}
