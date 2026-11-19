import Link from "next/link";
import { ArrowRight, CircleCheck, Radio, TriangleAlert } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { easternClock, eventDayAt } from "~/lib/happening-now";
import { nowAndNext, ownerLine, type NowAndNextTask } from "~/lib/now-and-next";
import {
  formatClock,
  type RunOfShowDay,
  type RunOfShowItem,
  type RunOfShowTask,
} from "~/lib/run-of-show";
import { organizerHomeHref, type AttentionItem } from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";

const copy = sponsorOrganizerCopy.nowNext;
const attnCopy = sponsorOrganizerCopy.attention;

/** "6:20 PM" today, "Sat 1:00 PM" on another day. */
function whenOf(day: RunOfShowDay, start: string, today: RunOfShowDay | null) {
  return `${day === today ? "" : `${day.slice(0, 3)} `}${formatClock(start)}`;
}

/**
 * The top of the organizer dashboard, on every tab: "Needs attention now"
 * (what an organizer arriving cold should act on, each linking to its tab;
 * "All clear" when empty), then "Now and next" from the run of show: the
 * event on now and the next one, the team task on now and the next one
 * with its owner. Replaces the pings-era task list (decisions 2026-11-19):
 * nothing here pings anyone or marks anything done.
 */
export function NowAndNextPanel({
  items,
  tasks,
  now,
  attention,
  attentionScope,
  scheduleFailed,
}: {
  /** Run-of-show items and tasks; null while loading or when unread. */
  items: readonly RunOfShowItem[] | null;
  tasks: readonly RunOfShowTask[] | null;
  now: Date;
  /** Null while it loads. */
  attention: AttentionItem[] | null;
  /** Whose sponsors the list covers. */
  attentionScope: "yours" | "everyone";
  scheduleFailed: boolean;
}) {
  const today = eventDayAt(now);
  const r = items && tasks ? nowAndNext({ items, tasks, now }) : null;

  const eventsLine = (list: RunOfShowItem[], withTime: boolean) =>
    list.map((i) => (
      <span key={i.id} className="block break-words">
        <span className="font-semibold text-dashboard-text-heavy">
          {i.title}
        </span>
        {(i.location ?? withTime) && (
          <span className="text-dashboard-text-medium">
            {" · "}
            {[
              withTime ? copy.at(whenOf(i.day, i.start, today)) : null,
              i.location,
            ]
              .filter(Boolean)
              .join(" · ")}
          </span>
        )}
      </span>
    ));
  const tasksLine = (list: NowAndNextTask[], withTime: boolean) =>
    list.map((k, n) => (
      <span key={`${k.start}-${n}`} className="block break-words">
        <span className="font-semibold text-dashboard-text-heavy">
          {k.title}
        </span>
        <span className="text-dashboard-text-medium">
          {" · "}
          {[
            withTime ? copy.at(whenOf(k.day, k.start, today)) : null,
            copy.owner(k.owner),
          ]
            .filter(Boolean)
            .join(" · ")}
        </span>
      </span>
    ));
  const muted = (text: string) => (
    <span className="text-dashboard-text-light">{text}</span>
  );

  const rows: { key: string; label: string; value: React.ReactNode }[] = r
    ? [
        {
          key: "event-now",
          label: copy.eventNow,
          value:
            r.phase === "before" && r.eventsNext[0]
              ? muted(
                  copy.notStarted(
                    whenOf(r.eventsNext[0].day, r.eventsNext[0].start, null),
                  ),
                )
              : r.phase === "after"
                ? muted(copy.over)
                : r.eventsNow.length
                  ? eventsLine(r.eventsNow, false)
                  : muted(copy.nothing),
        },
        {
          key: "event-next",
          label: copy.eventNext,
          value: r.eventsNext.length
            ? eventsLine(r.eventsNext, true)
            : muted(copy.none),
        },
        {
          key: "task-now",
          label: copy.taskNow,
          value: r.tasksNow.length
            ? tasksLine(r.tasksNow, false)
            : muted(copy.noTask),
        },
        {
          key: "task-next",
          label: copy.taskNext,
          value: r.tasksNext.length
            ? tasksLine(r.tasksNext, true)
            : muted(copy.noNextTask),
        },
      ]
    : [];

  return (
    <div data-tour="org-now-next">
      <DashboardPanel className="gap-4 border-l-4 border-dashboard-action-primary p-4 sm:p-5">
        <h2 className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
          <Radio
            aria-hidden
            strokeWidth={1.67}
            className={cn(
              "size-4",
              r?.phase === "during" &&
                r.eventsNow.length > 0 &&
                "text-dashboard-status-live",
            )}
          />
          {copy.headingAt(formatClock(easternClock(now)))}
        </h2>

        <AttentionList items={attention} scope={attentionScope} today={today} />

        {scheduleFailed && !r ? (
          <p className="m-0 text-sm text-dashboard-text-medium">
            {copy.loadError}
          </p>
        ) : r ? (
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{copy.tableLabel}</caption>
            <tbody aria-live="polite">
              {rows.map((row) => (
                <tr
                  key={row.key}
                  className="border-t border-dashboard-border-subtle first:border-t-0"
                >
                  <th
                    scope="row"
                    className="w-28 py-2 pr-3 align-top text-xs font-semibold text-dashboard-text-light sm:w-36 sm:text-sm"
                  >
                    {row.label}
                  </th>
                  <td className="min-w-0 py-2 align-top">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </DashboardPanel>
    </div>
  );
}

function AttentionList({
  items,
  scope,
  today,
}: {
  items: AttentionItem[] | null;
  scope: "yours" | "everyone";
  today: RunOfShowDay | null;
}) {
  if (!items) {
    return (
      <p className="m-0 text-sm text-dashboard-text-light">
        {attnCopy.loading}
      </p>
    );
  }
  if (items.length === 0) {
    return (
      <p
        data-attention="clear"
        className="m-0 flex items-center gap-2 text-sm font-semibold text-dashboard-text-heavy"
      >
        <CircleCheck
          aria-hidden
          className="size-4 shrink-0 text-dashboard-status-live"
        />
        {attnCopy.allClear}
        <span className="font-medium text-dashboard-text-medium">
          {attnCopy.allClearBody}
        </span>
      </p>
    );
  }
  return (
    <section aria-labelledby="org-attention" className="flex flex-col gap-1">
      <h3
        id="org-attention"
        className="m-0 flex flex-wrap items-baseline gap-x-2 text-base font-semibold text-dashboard-text-heavy"
      >
        {attnCopy.heading}
        <span className="text-xs font-medium text-dashboard-text-light">
          {scope === "yours" ? attnCopy.yours : attnCopy.everyone}
        </span>
      </h3>
      <ul className="m-0 flex list-none flex-col p-0">
        {items.map((item) => {
          const text =
            item.kind === "no-prefs"
              ? attnCopy.noPrefs(item.sponsor)
              : item.kind === "not-scheduled"
                ? attnCopy.notScheduled(item.sponsor, item.placed, item.reps)
                : item.kind === "changed"
                  ? attnCopy.changed(item.sponsor)
                  : attnCopy.overdueTask(
                      item.task.split(/\n/)[0]!.trim().replace(/:$/, ""),
                      whenOf(item.day, item.start, today),
                      ownerLine(item.owner),
                    );
          const href =
            item.kind === "overdue-task"
              ? organizerHomeHref({ tab: "schedule" })
              : organizerHomeHref({ tab: "coffee", sponsor: item.sponsorId });
          return (
            <li
              key={
                item.kind === "overdue-task"
                  ? item.key
                  : `${item.kind}-${item.sponsorId}`
              }
              data-attention={item.kind}
              className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5 border-t border-dashboard-border-subtle py-1.5 first:border-t-0"
            >
              <span className="flex min-w-0 flex-1 items-start gap-2 text-sm text-dashboard-text-heavy">
                <TriangleAlert
                  aria-hidden
                  className="mt-0.5 size-4 shrink-0 text-dashboard-text-warning"
                />
                <span className="min-w-0 break-words">{text}</span>
              </span>
              <DashboardButton variant="link" asChild className="-mr-2 text-sm">
                <Link href={href} shallow scroll={false}>
                  {item.kind === "overdue-task"
                    ? attnCopy.toSchedule
                    : attnCopy.toCoffee}
                  <ArrowRight aria-hidden />
                </Link>
              </DashboardButton>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
