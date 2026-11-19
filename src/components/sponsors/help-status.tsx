import { forwardRef, useId } from "react";
import { CheckCircle2, Clock, UserCheck } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
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

/** Title and body for a request's state (card and screen reader status). */
export function helpStatusText(request: SponsorHelpView) {
  switch (request.status) {
    case "open":
      return { title: copy.openTitle, body: copy.openBody };
    case "claimed":
      return {
        title: copy.claimedTitle(request.claimedByName ?? copy.claimedSomeone),
        body: copy.claimedBody,
      };
    default:
      return { title: copy.resolvedTitle, body: copy.resolvedBody };
  }
}

// Status card for the sponsor's current help request: waiting -> "<name> is
// on the way" -> all sorted. Focusable (tabIndex -1) so focus can move here
// after sending. Changes are announced by SponsorHelp's role="status".
export const HelpStatus = forwardRef<
  HTMLDivElement,
  {
    request: SponsorHelpView;
    /** Narrow version for the side nav. */
    compact?: boolean;
    onCancel: () => void;
    cancelling: boolean;
    cancelError: boolean;
    onDismiss: () => void;
  }
>(function HelpStatus(
  { request, compact = false, onCancel, cancelling, cancelError, onDismiss },
  ref,
) {
  const titleId = useId();
  const { status } = request;
  const live = status === "open" || status === "claimed";
  const { title, body } = helpStatusText(request);
  const Icon =
    status === "open" ? Clock : status === "claimed" ? UserCheck : CheckCircle2;

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-labelledby={titleId}
      className="rounded-dashboard-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2 motion-safe:duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2"
    >
      <DashboardPanel
        className={cn(
          "gap-4 rounded-dashboard-2xl",
          compact ? "gap-3 p-3" : "p-5 sm:p-6",
          status === "claimed" && "bg-dashboard-bg-highlight",
        )}
      >
        <div className="flex items-start gap-3">
          <span
            className={cn(
              "inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-dashboard-bg-nav",
              compact && "hidden",
              status === "resolved"
                ? "text-dashboard-status-live"
                : "text-dashboard-action-primary",
            )}
          >
            <Icon
              aria-hidden
              className={cn(
                "size-5",
                status === "open" && "motion-safe:animate-pulse",
              )}
            />
          </span>
          <div className="flex min-w-0 flex-col gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
              {sponsorHelpCopy.reasons[request.reason]}
            </span>
            <h2
              id={titleId}
              className={cn(
                "m-0 break-words font-semibold",
                compact ? "text-sm" : "text-xl",
              )}
            >
              {title}
            </h2>
            <p
              className={cn(
                "m-0 text-dashboard-text-medium",
                compact ? "text-xs" : "text-base",
              )}
            >
              {body}
            </p>
            {request.note && (
              <p className="m-0 mt-1 whitespace-pre-line break-words border-l-2 border-dashboard-border-default pl-3 text-sm text-dashboard-text-light">
                {request.note}
              </p>
            )}
            <p className="m-0 mt-1 text-xs text-dashboard-text-light">
              {copy.sentAt(formatHelpTime(new Date(request.createdAt)))}
            </p>
            {request.repName && (
              <p className="m-0 text-xs text-dashboard-text-light">
                {copy.pingedAs(request.repName)}
              </p>
            )}
          </div>
        </div>

        {live ? (
          <div className="flex flex-col gap-2">
            <DashboardButton
              variant="outline"
              className={cn(
                "h-11 w-full",
                !compact && "sm:w-auto sm:self-start",
                pressable,
              )}
              onClick={onCancel}
              disabled={cancelling}
            >
              {cancelling ? copy.cancelling : copy.cancel}
            </DashboardButton>
            {cancelError && (
              <p
                role="alert"
                className="m-0 text-sm text-dashboard-text-warning"
              >
                {copy.cancelError}
              </p>
            )}
          </div>
        ) : (
          <DashboardButton
            variant="outline"
            className={cn(
              "h-11 w-full",
              !compact && "sm:w-auto sm:self-start",
              pressable,
            )}
            onClick={onDismiss}
          >
            {copy.dismiss}
          </DashboardButton>
        )}
      </DashboardPanel>
    </div>
  );
});
