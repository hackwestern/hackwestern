import { useEffect, useRef, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { HelpQueue } from "~/components/sponsors/help-queue";
import { sponsorHelpCopy } from "~/content/sponsor-help";
import { taskRemindersCopy } from "~/content/task-reminders";
import type { SponsorHelpReason } from "~/lib/sponsor-help";
import {
  PING_LOG_MAX,
  PING_LOG_PAGE,
  type PingLogEntry,
  type PingTarget,
} from "~/lib/task-pings";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

const copy = taskRemindersCopy.tab;

/** "Fri 7:00 PM", in event time. */
const pingTime = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});
const when = (d: Date) => pingTime.format(new Date(d));

const reasonLabel = (reason: string) =>
  sponsorHelpCopy.reasons[reason as SponsorHelpReason] ?? reason;

const targetLabel = (t: PingTarget, mention: string | null) =>
  t.kind === "dm" ? copy.dm(t.name) : copy.channel(mention);

function SectionHeading({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="m-0 text-lg font-semibold">
      {children}
    </h2>
  );
}

// The organizer home's Task pings tab: what pings Slack, the sponsor help
// queue (it needs action, so it comes first), the next task pings, a log of
// pings already out, and whether Slack is connected. Organizer-only data.
export function TaskPingsTab({
  focusSponsorId,
  focusName,
  sponsorHref,
  jumpToHelp,
}: {
  focusSponsorId: string | null;
  focusName: string | null;
  sponsorHref: (sponsorId: string) => string;
  /** Scroll to the help requests (old ?tab=help links). */
  jumpToHelp: boolean;
}) {
  const [limit, setLimit] = useState(PING_LOG_PAGE);
  const status = api.taskReminders.status.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  const activity = api.taskReminders.activity.useQuery(
    { limit },
    {
      refetchInterval: 30_000,
      retry: 1,
      placeholderData: keepPreviousData,
    },
  );
  const helpRef = useRef<HTMLElement>(null);
  useEffect(() => {
    // A focused sponsor's request scrolls itself into view (HelpQueue).
    if (!jumpToHelp || focusSponsorId) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    helpRef.current?.scrollIntoView({
      behavior: reduce.matches ? "auto" : "smooth",
    });
  }, [jumpToHelp, focusSponsorId]);

  const a = activity.data;
  const s = status.data;
  const mention = s?.channelMention ?? null;
  const helpMention = s?.helpMention ?? null;

  return (
    <div className="flex flex-col gap-6">
      <p className="m-0 max-w-prose text-base text-dashboard-text-medium">
        {copy.intro(mention)}
      </p>

      <section
        ref={helpRef}
        id="help"
        aria-labelledby="pings-help"
        data-tour="pings-help"
        className="flex scroll-mt-4 flex-col gap-3"
      >
        <SectionHeading id="pings-help">{copy.helpHeading}</SectionHeading>
        <HelpQueue
          focusSponsorId={focusSponsorId}
          focusName={focusName}
          sponsorHref={sponsorHref}
        />
        {a && a.recentlyResolved.length > 0 && (
          <div className="flex flex-col gap-1">
            <h3 className="m-0 text-sm font-semibold text-dashboard-text-light">
              {copy.resolvedHeading}
            </h3>
            <ul className="m-0 flex list-none flex-col gap-1 p-0 text-sm text-dashboard-text-medium">
              {a.recentlyResolved.map((r) => (
                <li key={r.id} className="break-words">
                  <span className="tabular-nums">{when(r.resolvedAt)}</span>
                  {" · "}
                  {r.sponsorName} · {reasonLabel(r.reason)} ·{" "}
                  {r.claimedByName
                    ? copy.resolvedBy(r.claimedByName)
                    : copy.resolved}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {activity.isLoading ? (
        <div
          aria-busy="true"
          className="h-40 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-safe:animate-pulse"
        />
      ) : !a ? (
        <DashboardPanel className="flex-row flex-wrap items-center gap-3">
          <span className="text-sm text-dashboard-text-warning">
            {copy.loadError}
          </span>
          <DashboardButton
            variant="outline"
            className="h-11"
            onClick={() => void activity.refetch()}
          >
            {copy.retry}
          </DashboardButton>
        </DashboardPanel>
      ) : (
        <>
          <section
            aria-labelledby="pings-next"
            data-tour="pings-next"
            className="flex flex-col gap-3"
          >
            <SectionHeading id="pings-next">
              {copy.upNextHeading}
            </SectionHeading>
            <DashboardPanel className="gap-0 p-0">
              {a.upNext.length === 0 ? (
                <p className="m-0 p-4 text-sm text-dashboard-text-medium sm:px-5">
                  {s && !s.slackConnected
                    ? copy.upNextNoSlack
                    : copy.upNextEmpty}
                </p>
              ) : (
                <ol className="m-0 flex list-none flex-col p-0">
                  {a.upNext.map((p) => (
                    <PingRow
                      key={p.id}
                      at={p.at}
                      what={p.task}
                      where={targetLabel(p.target, mention)}
                    />
                  ))}
                </ol>
              )}
            </DashboardPanel>
          </section>

          <section
            aria-labelledby="pings-log"
            data-tour="pings-log"
            className="flex flex-col gap-3"
          >
            <div className="flex flex-col gap-1">
              <SectionHeading id="pings-log">{copy.logHeading}</SectionHeading>
              <p className="m-0 text-sm text-dashboard-text-light">
                {copy.logNote}
              </p>
            </div>
            <DashboardPanel className="gap-0 p-0">
              {a.log.length === 0 ? (
                <p className="m-0 p-4 text-sm text-dashboard-text-medium sm:px-5">
                  {copy.logEmpty}
                </p>
              ) : (
                <ol className="m-0 flex list-none flex-col p-0">
                  {a.log.map((e) => (
                    <LogRow
                      key={`${e.kind}-${e.id}`}
                      entry={e}
                      mention={e.kind === "help" ? helpMention : mention}
                    />
                  ))}
                </ol>
              )}
            </DashboardPanel>
            {a.hasMore && limit < PING_LOG_MAX && (
              <DashboardButton
                variant="outline"
                className="h-11 self-start"
                disabled={activity.isFetching}
                onClick={() =>
                  setLimit((n) => Math.min(n + PING_LOG_PAGE, PING_LOG_MAX))
                }
              >
                {activity.isFetching ? copy.loadingMore : copy.showMore}
              </DashboardButton>
            )}
          </section>
        </>
      )}

      {s && (
        <p className="m-0 text-sm">
          <span
            className={
              s.slackConnected
                ? "text-dashboard-text-light"
                : "text-dashboard-text-warning"
            }
          >
            {s.slackConnected ? copy.slackConnected : copy.slackNotConnected}
          </span>
          {s.slackConnected && !s.channelConfigured && (
            <span className="text-dashboard-text-warning">
              {" · "}
              {copy.noChannel}
            </span>
          )}
        </p>
      )}
    </div>
  );
}

function PingRow({
  at,
  what,
  where,
  tag,
}: {
  at: Date;
  what: string;
  where: string;
  tag?: { text: string; warning: boolean };
}) {
  return (
    <li className="flex flex-col gap-1 border-b border-dashboard-border-default px-4 py-3 last:border-b-0 sm:flex-row sm:items-baseline sm:gap-4 sm:px-5">
      <time
        dateTime={new Date(at).toISOString()}
        className="shrink-0 text-sm font-semibold tabular-nums text-dashboard-text-heavy sm:w-28"
      >
        {when(at)}
      </time>
      <span className="min-w-0 flex-1 break-words text-base">{what}</span>
      <span className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-dashboard-text-medium">
        {where}
        {tag && (
          <DashboardTag
            className={cn(
              tag.warning &&
                "bg-dashboard-status-iconBadge text-dashboard-text-warning",
            )}
          >
            {tag.text}
          </DashboardTag>
        )}
      </span>
    </li>
  );
}

function LogRow({
  entry: e,
  mention,
}: {
  entry: PingLogEntry;
  mention: string | null;
}) {
  if (e.kind === "task") {
    return (
      <PingRow
        at={e.at}
        what={e.task}
        where={targetLabel(e.target, mention)}
        tag={
          e.status === "failed"
            ? { text: copy.status.failed(e.error), warning: true }
            : { text: copy.status.scheduled, warning: false }
        }
      />
    );
  }
  const what = copy.helpWhat(e.sponsorName, reasonLabel(e.reason));
  return (
    <PingRow
      at={e.at}
      what={e.pingCount > 0 ? `${what} (${copy.rePings(e.pingCount)})` : what}
      where={targetLabel(e.target, mention)}
      tag={
        e.status === "posted"
          ? { text: copy.status.posted, warning: false }
          : { text: copy.status.notPosted, warning: true }
      }
    />
  );
}
