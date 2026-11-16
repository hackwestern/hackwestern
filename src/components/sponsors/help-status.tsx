import { CheckCircle2, Clock, UserCheck } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import type { SponsorHelpView } from "~/server/api/routers/sponsor-help";
import { cn } from "~/lib/utils";

const copy = sponsorHelpCopy.status;

/** "2:14 PM" in Eastern time (the event's time zone). */
export function formatHelpTime(d: Date): string {
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "America/Toronto",
  });
}

// Status card for the sponsor's current help request: waiting -> "<name> is
// on the way" -> all sorted. Announced politely to screen readers as it
// changes.
export function HelpStatus({
  request,
  onCancel,
  cancelling,
  cancelError,
  onDismiss,
}: {
  request: SponsorHelpView;
  onCancel: () => void;
  cancelling: boolean;
  cancelError: boolean;
  onDismiss: () => void;
}) {
  const { status } = request;
  const live = status === "open" || status === "claimed";
  const title =
    status === "open"
      ? copy.openTitle
      : status === "claimed"
        ? copy.claimedTitle(request.claimedByName ?? copy.claimedSomeone)
        : copy.resolvedTitle;
  const body =
    status === "open"
      ? copy.openBody
      : status === "claimed"
        ? copy.claimedBody
        : copy.resolvedBody;
  const Icon =
    status === "open" ? Clock : status === "claimed" ? UserCheck : CheckCircle2;

  return (
    <section
      aria-label={copy.label}
      className={cn(
        "flex flex-col gap-4 rounded-dashboard-lg p-5 shadow-dashboard-card sm:p-6",
        status === "claimed"
          ? "bg-dashboard-bg-highlight"
          : "bg-dashboard-bg-surface",
      )}
    >
      <div className="flex items-start gap-3" aria-live="polite">
        <span
          className={cn(
            "inline-flex size-10 shrink-0 items-center justify-center rounded-full",
            status === "resolved"
              ? "bg-dashboard-bg-nav text-dashboard-status-live"
              : "bg-dashboard-bg-nav text-dashboard-action-primary",
          )}
        >
          <Icon
            aria-hidden
            className={cn("size-5", status === "open" && "motion-safe:animate-pulse")}
          />
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
            {sponsorHelpCopy.reasons[request.reason]}
          </span>
          <h2 className="m-0 break-words text-xl font-semibold">{title}</h2>
          <p className="m-0 text-base text-dashboard-text-medium">{body}</p>
          {request.note && (
            <p className="m-0 mt-1 whitespace-pre-line break-words border-l-2 border-dashboard-border-default pl-3 text-sm text-dashboard-text-light">
              {request.note}
            </p>
          )}
          <p className="m-0 mt-1 text-xs text-dashboard-text-light">
            {copy.sentAt(formatHelpTime(new Date(request.createdAt)))}
          </p>
        </div>
      </div>

      {live ? (
        <div className="flex flex-col gap-2">
          <DashboardButton
            variant="outline"
            className="h-11 w-full sm:w-auto sm:self-start"
            onClick={onCancel}
            disabled={cancelling}
          >
            {cancelling ? copy.cancelling : copy.cancel}
          </DashboardButton>
          {cancelError && (
            <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
              {copy.cancelError}
            </p>
          )}
        </div>
      ) : (
        <DashboardButton
          variant="outline"
          className="h-11 w-full sm:w-auto sm:self-start"
          onClick={onDismiss}
        >
          {copy.dismiss}
        </DashboardButton>
      )}
    </section>
  );
}
