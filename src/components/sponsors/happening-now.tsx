import { keepNamesTogether } from "~/lib/keep-names-together";
import { Radio } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { easternClock, eventDayAt, happeningNow } from "~/lib/happening-now";
import {
  formatClock,
  locationFor,
  type RunOfShowItem,
  type RunOfShowTask,
} from "~/lib/run-of-show";
import { cn } from "~/lib/utils";

const copy = scheduleCopy.happening;

function roomOf(item: RunOfShowItem, sponsorName?: string): string | null {
  return item.location
    ? sponsorName
      ? locationFor(item.location, sponsorName)
      : item.location
    : null;
}

/**
 * "Happening now": what the run of show has on at this minute, and what is
 * next. Organizers also see the team tasks in progress (pass `tasks`);
 * sponsors pass their own `sponsorName` and never get tasks. `now` comes from
 * useNow (ticks each minute) and the items from the page's 60s refetch. Only
 * the list sits in the live region, so a screen reader hears a change in
 * what is on, not the clock ticking.
 */
export function HappeningNowBanner({
  items,
  tasks,
  now,
  sponsorName,
}: {
  items: readonly RunOfShowItem[];
  tasks?: readonly RunOfShowTask[];
  now: Date;
  sponsorName?: string;
}) {
  const r = happeningNow({ items, tasks, now });
  const today = eventDayAt(now);
  const next = r.next[0];
  const when = (day: string, start: string) =>
    `${day === today ? "" : `${day.slice(0, 3)} `}${formatClock(start)}`;

  const nextLine = next
    ? copy.upNextItems(
        r.next.length > 2
          ? `${r.next
              .slice(0, 2)
              .map((i) => i.title)
              .join(", ")} ${copy.more(r.next.length - 2)}`
          : r.next.map((i) => i.title).join(", "),
        when(next.day, next.start),
      )
    : null;

  const live = r.items.length > 0 || r.tasks.length > 0;

  return (
    <DashboardPanel className="gap-2 border-l-4 border-dashboard-action-primary p-4 sm:p-5">
      <p className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
        {/* Green while something is on (no pulse: it's on screen all day). */}
        <Radio
          aria-hidden
          className={cn(
            "size-4",
            r.phase === "during" && live && "text-dashboard-status-live",
          )}
          strokeWidth={1.67}
        />
        {r.phase === "during"
          ? copy.now(formatClock(easternClock(now)))
          : copy.heading}
      </p>
      <div aria-live="polite" className="flex flex-col gap-1">
        {r.phase === "before" && r.firstStart && (
          <p className="m-0 text-lg font-semibold text-dashboard-text-heavy">
            {copy.notStarted(
              `${r.firstStart.day.slice(0, 3)} ${formatClock(r.firstStart.start)}`,
            )}
          </p>
        )}
        {r.phase === "after" && (
          <p className="m-0 text-lg font-semibold text-dashboard-text-heavy">
            {copy.over}
          </p>
        )}
        {r.phase === "during" && (
          <>
            {live ? (
              <ul className="m-0 flex list-none flex-col gap-1 p-0 text-base font-semibold leading-snug text-dashboard-text-heavy sm:text-lg">
                {r.items.map((i) => {
                  const room = roomOf(i, sponsorName);
                  return (
                    <li key={i.id} className="break-words">
                      {keepNamesTogether(i.title, [sponsorName])}
                      {room && (
                        <span className="font-medium text-dashboard-text-medium">
                          {copy.roomSuffix(room)}
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="m-0 text-base font-semibold text-dashboard-text-heavy sm:text-lg">
                {copy.nothing}
              </p>
            )}
            {r.tasks.length > 0 && (
              <ul
                aria-label={copy.tasksLabel}
                className="m-0 flex list-none flex-col gap-0.5 rounded-dashboard-sm border-l-4 border-dashboard-border-task bg-dashboard-bg-task px-2 py-1 text-sm text-dashboard-text-task"
              >
                {r.tasks.map((t, i) => (
                  <li key={`${t.start}-${i}`} className="break-words">
                    {copy.task(t.task, t.owner)}
                  </li>
                ))}
              </ul>
            )}
            {nextLine && (
              <p className="m-0 mt-1 break-words border-t border-dashboard-border-subtle pt-2 text-sm text-dashboard-text-medium">
                <span className="font-semibold text-dashboard-text-heavy">
                  {copy.upNextLabel}
                </span>{" "}
                {nextLine}
              </p>
            )}
          </>
        )}
      </div>
    </DashboardPanel>
  );
}
