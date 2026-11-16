import { CheckCircle2, MapPin } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { formatHelpTime } from "~/components/sponsors/help-status";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { SPONSOR_HELP_POLL_MS, type SponsorHelpReason } from "~/lib/sponsor-help";
import { api } from "~/utils/api";

const copy = sponsorHelpCopy.organizer;

// Organizer backup for sponsor help requests: every open and claimed request
// with its age and who claimed it, plus Resolve (for when Slack is down or
// someone forgot to close the loop). Doesn't depend on the run-of-show sheet.
export function HelpQueue() {
  const now = useNow();
  const utils = api.useUtils();
  const q = api.sponsorHelp.list.useQuery(undefined, {
    refetchInterval: SPONSOR_HELP_POLL_MS,
    retry: 1,
  });
  const resolve = api.sponsorHelp.resolve.useMutation({
    onSettled: () => utils.sponsorHelp.list.invalidate(),
  });

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-28 w-full motion-safe:animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card"
          />
        ))}
      </div>
    );
  }
  if (!q.data) {
    return (
      <DashboardPanel className="text-center">
        <p className="m-0 text-base text-dashboard-text-medium">{copy.loadError}</p>
        <DashboardButton
          variant="outline"
          className="mx-auto h-11"
          onClick={() => void q.refetch()}
        >
          {copy.retry}
        </DashboardButton>
      </DashboardPanel>
    );
  }
  if (q.data.length === 0) {
    return (
      <DashboardPanel>
        <p className="m-0 flex items-center gap-2 text-dashboard-text-medium">
          <CheckCircle2 aria-hidden className="size-5 text-dashboard-status-live" />
          {copy.empty}
        </p>
      </DashboardPanel>
    );
  }

  return (
    <ul className="m-0 flex list-none flex-col gap-3 p-0">
      {q.data.map((r) => {
        const minutes = Math.max(
          0,
          Math.floor((now.getTime() - new Date(r.createdAt).getTime()) / 60_000),
        );
        const resolving = resolve.isPending && resolve.variables?.id === r.id;
        const failed = resolve.isError && resolve.variables?.id === r.id;
        return (
          <li
            key={r.id}
            className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:flex-row sm:items-start sm:justify-between sm:p-5"
          >
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="m-0 text-lg font-semibold">{r.sponsorName}</h2>
                {r.status === "open" ? (
                  <DashboardTag className="bg-dashboard-status-iconBadge text-dashboard-text-warning">
                    {copy.open}
                  </DashboardTag>
                ) : (
                  <DashboardTag className="bg-dashboard-bg-highlight text-dashboard-text-active">
                    {r.claimedByName
                      ? copy.claimed(r.claimedByName)
                      : copy.claimedUnknown}
                  </DashboardTag>
                )}
                {!r.postedToSlack && <DashboardTag>{copy.slackOff}</DashboardTag>}
              </div>
              <p className="m-0 text-base">
                {sponsorHelpCopy.reasons[r.reason as SponsorHelpReason] ?? r.reason}
              </p>
              {r.note && (
                <p className="m-0 whitespace-pre-line break-words border-l-2 border-dashboard-border-default pl-3 text-sm text-dashboard-text-medium">
                  {r.note}
                </p>
              )}
              <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dashboard-text-light">
                <time dateTime={new Date(r.createdAt).toISOString()}>
                  {formatHelpTime(new Date(r.createdAt))} · {copy.age(minutes)}
                </time>
                {r.location && (
                  <span className="inline-flex items-center gap-1">
                    <MapPin aria-hidden className="size-3.5" />
                    {copy.location(r.location)}
                  </span>
                )}
              </p>
              {failed && (
                <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
                  {copy.resolveError}
                </p>
              )}
            </div>
            <DashboardButton
              variant="outline"
              className="h-11 w-full shrink-0 sm:w-auto"
              disabled={resolving}
              onClick={() => resolve.mutate({ id: r.id })}
            >
              {resolving ? copy.resolving : copy.resolve}
              <span className="sr-only"> {r.sponsorName}</span>
            </DashboardButton>
          </li>
        );
      })}
    </ul>
  );
}
