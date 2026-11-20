import { CheckCircle2 } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = sponsorPresentationsCopy.live;

/**
 * "Confirm our times" for the hacker's team's sponsor presentations: one
 * member's tap confirms for the whole team (Jazz, 2026-11-19), and the
 * organizer Judging board shows the team as Accepted. Once confirmed it
 * reads "Your team confirmed these times." instead.
 */
export function ConfirmTimesButton({
  confirmed,
  variant = "primary",
  className,
}: {
  confirmed: boolean;
  /** "small" inside a notification row; "primary" on the times card. */
  variant?: "primary" | "small";
  className?: string;
}) {
  const utils = api.useUtils();
  const confirm = api.sponsorPresentations.confirm.useMutation({
    onSettled: () =>
      Promise.all([
        utils.sponsorPresentations.myConfirmation.invalidate(),
        utils.notifications.center.invalidate(),
      ]),
  });

  if (confirmed || confirm.isSuccess) {
    return (
      <p
        role="status"
        className={cn(
          "m-0 inline-flex items-center gap-1.5 text-sm font-semibold text-dashboard-status-live",
          className,
        )}
      >
        <CheckCircle2 aria-hidden className="size-4 shrink-0" />
        {copy.confirmed}
      </p>
    );
  }
  return (
    <div className={cn("flex flex-col items-start gap-1", className)}>
      <DashboardButton
        variant={variant}
        onClick={() => confirm.mutate()}
        disabled={confirm.isPending}
      >
        {confirm.isPending ? copy.confirming : copy.confirm}
      </DashboardButton>
      {confirm.isError ? (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {confirm.error.data?.code === "CONFLICT"
            ? confirm.error.message
            : copy.confirmFailed}
        </p>
      ) : (
        <p className="m-0 text-xs text-dashboard-text-light">
          {copy.confirmHint}
        </p>
      )}
    </div>
  );
}
