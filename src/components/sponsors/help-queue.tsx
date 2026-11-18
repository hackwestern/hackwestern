import { useEffect } from "react";
import Link from "next/link";
import { CheckCircle2, MapPin, Phone, User } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { hover } from "~/components/internals/interaction";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { formatHelpTime } from "~/components/sponsors/help-status";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import {
  SPONSOR_HELP_POLL_MS,
  telHref,
  type SponsorHelpReason,
} from "~/lib/sponsor-help";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = sponsorHelpCopy.organizer;

// Organizer backup for sponsor help requests, on the Task pings tab under
// its "Sponsor help requests" heading (so each request is an h3): every open and claimed request
// with its age and who claimed it, plus Resolve (for when Slack is down or
// someone forgot to close the loop). Doesn't depend on the run-of-show sheet.
// `focusSponsorId` lifts that sponsor's request to the top and highlights it
// (`focusName` says so when there is none); `sponsorHref` turns each sponsor
// name into a link back to its row on the sponsor dashboard.
export function HelpQueue({
  focusSponsorId = null,
  focusName = null,
  sponsorHref,
}: {
  focusSponsorId?: string | null;
  focusName?: string | null;
  sponsorHref?: (sponsorId: string) => string;
} = {}) {
  const now = useNow();
  const utils = api.useUtils();
  const q = api.sponsorHelp.list.useQuery(undefined, {
    refetchInterval: SPONSOR_HELP_POLL_MS,
    retry: 1,
  });
  const resolve = api.sponsorHelp.resolve.useMutation({
    onSettled: () =>
      Promise.all([
        utils.sponsorHelp.list.invalidate(),
        utils.sponsorOrganizer.summary.invalidate(),
      ]),
  });
  const focusKey = focusSponsorId?.toLowerCase() ?? null;
  const isFocus = (sponsorId: string) => sponsorId.toLowerCase() === focusKey;
  const focusFound = !!q.data?.some((r) => isFocus(r.sponsorId));
  useEffect(() => {
    if (!focusFound || !focusKey) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    document
      .getElementById(`help-${focusKey}`)
      ?.scrollIntoView({ behavior: reduce.matches ? "auto" : "smooth" });
  }, [focusFound, focusKey]);

  if (q.isLoading) {
    return (
      <div className="flex flex-col gap-3" aria-busy="true">
        {[0, 1].map((i) => (
          <div
            key={i}
            className="h-28 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-safe:animate-pulse"
          />
        ))}
      </div>
    );
  }
  if (!q.data) {
    return (
      <DashboardPanel className="text-center">
        <p className="m-0 text-base text-dashboard-text-medium">
          {copy.loadError}
        </p>
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
  const missing =
    focusKey && !focusFound && focusName ? (
      <DashboardPanel>
        <p className="m-0 text-dashboard-text-medium">
          {copy.noneFor(focusName)}
        </p>
      </DashboardPanel>
    ) : null;
  if (q.data.length === 0) {
    return (
      <DashboardPanel>
        <p className="m-0 flex items-center gap-2 text-dashboard-text-medium">
          <CheckCircle2
            aria-hidden
            className="size-5 text-dashboard-status-live"
          />
          {copy.empty}
        </p>
      </DashboardPanel>
    );
  }

  // The focused sponsor first; otherwise oldest first, as the server sends.
  const rows = [...q.data].sort(
    (a, b) => Number(isFocus(b.sponsorId)) - Number(isFocus(a.sponsorId)),
  );
  return (
    <div className="flex flex-col gap-3">
      {missing}
      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {rows.map((r) => {
          const minutes = Math.max(
            0,
            Math.floor(
              (now.getTime() - new Date(r.createdAt).getTime()) / 60_000,
            ),
          );
          const resolving = resolve.isPending && resolve.variables?.id === r.id;
          const failed = resolve.isError && resolve.variables?.id === r.id;
          return (
            <li
              key={r.id}
              id={`help-${r.sponsorId.toLowerCase()}`}
              className={cn(
                "flex scroll-mt-4 flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:flex-row sm:items-start sm:justify-between sm:p-5",
                isFocus(r.sponsorId) &&
                  "ring-2 ring-dashboard-action-primary ring-offset-2 ring-offset-dashboard-bg-page",
              )}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="m-0 text-lg font-semibold">
                    {sponsorHref ? (
                      <Link
                        href={sponsorHref(r.sponsorId)}
                        className={cn(
                          "rounded-dashboard-sm text-dashboard-text-heavy underline-offset-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                          hover.underline,
                        )}
                      >
                        {r.sponsorName}
                      </Link>
                    ) : (
                      r.sponsorName
                    )}
                  </h3>
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
                  {!r.postedToSlack && (
                    <DashboardTag>{copy.slackOff}</DashboardTag>
                  )}
                </div>
                <p className="m-0 text-base">
                  {sponsorHelpCopy.reasons[r.reason as SponsorHelpReason] ??
                    r.reason}
                </p>
                {(r.repName ?? r.phone) && (
                  <p className="m-0 flex flex-wrap items-center gap-x-3 text-sm">
                    {r.repName && (
                      <span className="inline-flex items-center gap-1">
                        <User
                          aria-hidden
                          className="size-3.5 text-dashboard-text-light"
                        />
                        {copy.rep(r.repName)}
                      </span>
                    )}
                    {r.phone && (
                      <a
                        href={telHref(r.phone)}
                        aria-label={copy.callLabel(
                          r.repName ?? r.sponsorName,
                          r.phone,
                        )}
                        className="inline-flex min-h-11 items-center gap-1 font-semibold text-dashboard-action-primary underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
                      >
                        <Phone aria-hidden className="size-3.5" />
                        {r.phone}
                      </a>
                    )}
                  </p>
                )}
                {r.note && (
                  <p className="m-0 whitespace-pre-line break-words border-l-2 border-dashboard-border-default pl-3 text-sm text-dashboard-text-medium">
                    {r.note}
                  </p>
                )}
                <p className="m-0 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-dashboard-text-light">
                  <time dateTime={new Date(r.createdAt).toISOString()}>
                    {formatHelpTime(new Date(r.createdAt))} ·{" "}
                    {copy.age(minutes)}
                  </time>
                  {r.locationNote ? (
                    <span className="inline-flex items-center gap-1">
                      <MapPin aria-hidden className="size-3.5" />
                      {copy.location(r.locationNote)}
                    </span>
                  ) : (
                    r.location && (
                      <span className="inline-flex items-center gap-1">
                        <MapPin aria-hidden className="size-3.5" />
                        {copy.locationBooth(r.location)}
                      </span>
                    )
                  )}
                </p>
                {failed && (
                  <p
                    role="alert"
                    className="m-0 text-sm text-dashboard-text-warning"
                  >
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
    </div>
  );
}
