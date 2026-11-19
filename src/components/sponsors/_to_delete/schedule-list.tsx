import { MapPin } from "lucide-react";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { scheduleCopy } from "~/content/sponsor-schedule";
import {
  RUN_OF_SHOW_COLUMNS,
  compareRunOfShow,
  formatClock,
  locationFor,
  type RunOfShowItem,
} from "~/lib/run-of-show";
import { isHappeningNow } from "~/lib/run-of-show-time";
import { cn } from "~/lib/utils";

const columnLabel = Object.fromEntries(
  RUN_OF_SHOW_COLUMNS.map((c) => [c.key, c.label]),
) as Record<RunOfShowItem["column"], string>;

// Main events and meals with no room just omit the location line.
const ALL_HANDS = new Set<RunOfShowItem["column"]>(["big-event", "food"]);

// A day's schedule as a phone-first list: time on the left, what and where on
// the right. Items involving `highlightSponsor` get a "You" tag; the item
// happening right now gets a "Now" tag and an accent edge.
export function ScheduleList({
  items,
  now,
  highlightSponsor,
  emptyText = scheduleCopy.emptyDay,
}: {
  items: readonly RunOfShowItem[];
  now: Date;
  highlightSponsor?: string;
  emptyText?: string;
}) {
  if (items.length === 0) {
    return (
      <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-surface p-6 text-center text-base text-dashboard-text-medium shadow-dashboard-card">
        {emptyText}
      </p>
    );
  }

  return (
    <ol className="m-0 flex list-none flex-col gap-2 p-0">
      {[...items].sort(compareRunOfShow).map((item) => {
        const live = isHappeningNow(item, now);
        const mine =
          highlightSponsor !== undefined &&
          item.sponsors.includes(highlightSponsor);
        return (
          <li
            key={item.id}
            aria-current={live ? "time" : undefined}
            className={cn(
              "grid grid-cols-[4.75rem_1fr] gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
              live && "ring-2 ring-dashboard-action-primary",
            )}
          >
            <div className="flex flex-col text-sm leading-tight">
              <span className="font-semibold text-dashboard-text-heavy">
                {formatClock(item.start)}
              </span>
              <span className="text-dashboard-text-light">
                {item.end === "24:00"
                  ? scheduleCopy.midnight
                  : formatClock(item.end)}
              </span>
            </div>
            <div className="flex min-w-0 flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <DashboardTag>{columnLabel[item.column]}</DashboardTag>
                {mine && (
                  <DashboardTag className="bg-dashboard-bg-highlight text-dashboard-text-heavy">
                    {scheduleCopy.you}
                  </DashboardTag>
                )}
                {live && (
                  <DashboardTag className="bg-dashboard-action-primary text-dashboard-text-inverse">
                    {scheduleCopy.now}
                  </DashboardTag>
                )}
              </div>
              <p className="m-0 break-words text-base font-semibold text-dashboard-text-heavy">
                {item.title}
              </p>
              {(item.location ?? !ALL_HANDS.has(item.column)) && (
                <p className="m-0 flex items-start gap-1.5 text-sm text-dashboard-text-medium">
                  <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
                  <span className="break-words">
                    {item.location
                      ? mine && highlightSponsor
                        ? locationFor(item.location, highlightSponsor)
                        : item.location
                      : scheduleCopy.noLocation}
                  </span>
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
