import { useEffect, useId, useState } from "react";
import { MapPin } from "lucide-react";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { locationFor, type RunOfShowDay } from "~/lib/run-of-show";
import { RUN_OF_SHOW_DATES } from "~/lib/run-of-show-time";
import {
  axisOffset,
  buildAxis,
  formatMinutes,
  layoutGrid,
  minutesIntoDay,
  type GridColumn,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";
import { cn } from "~/lib/utils";

const copy = scheduleCopy.timeline;

// Same rhythm as the /live schedule grid: a 56px row per half hour, long
// empty stretches folded into one dashed row.
const SLOT_HEIGHT = 56;
const GAP_HEIGHT = 40;
// Columns keep a readable width; on phones the grid scrolls sideways inside
// its own box (time column pinned), never the page.
const TIME_WIDTH = 64;
const COLUMN_MIN = 128;

const STORAGE_KEY = "hw-sponsor-schedule-show-hackathon";

/** "Show hackathon events", remembered on this device. */
export function useShowHackathon(): [boolean, (show: boolean) => void] {
  const [show, setShow] = useState(true);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "0") setShow(false);
    } catch {
      // Storage blocked: keep the default.
    }
  }, []);
  const update = (next: boolean) => {
    setShow(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // Storage blocked: the choice lasts for this visit only.
    }
  };
  return [show, update];
}

// The sponsor's own blocks are coloured by sheet column, like /live's blocks,
// in dashboard tints. Hackathon events are all one muted grey.
const COLUMN_TINT: Record<GridColumn, string> = {
  "big-event": "bg-dashboard-schedule-blue",
  "sponsor-workshop": "bg-dashboard-schedule-pink",
  food: "bg-dashboard-schedule-blue",
  "spon-booth": "bg-dashboard-schedule-green",
  "coffee-chats": "bg-dashboard-schedule-orange",
  other: "bg-dashboard-schedule-blue",
};

// Main events, meals and the Sponsor Bay (a place itself) with no room just
// omit the location line.
const NO_ROOM_NEEDED = new Set<TimelineEntry["category"]>([
  "big-event",
  "food",
  "spon-booth",
]);

/** Legend plus the hide/show switch for hackathon events. */
export function TimelineKey({
  showHackathon,
  onShowHackathonChange,
}: {
  showHackathon: boolean;
  onShowHackathonChange: (show: boolean) => void;
}) {
  const toggleId = useId();
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
      <ul
        aria-label={copy.legendLabel}
        className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1 p-0 text-sm text-dashboard-text-medium"
      >
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-4 rounded-dashboard-xs border-l-4 border-dashboard-action-primary bg-dashboard-schedule-pink"
          />
          {copy.yours}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-4 rounded-dashboard-xs border border-dashed border-dashboard-border-control bg-dashboard-bg-inset"
          />
          {copy.hackathon}
        </li>
      </ul>
      <label
        htmlFor={toggleId}
        className="flex min-h-11 cursor-pixel-hover items-center gap-1.5 text-sm font-medium text-dashboard-text-heavy"
      >
        <DashboardCheckbox
          id={toggleId}
          checked={showHackathon}
          onCheckedChange={(v) => onShowHackathonChange(v === true)}
        />
        {copy.showHackathon}
      </label>
    </div>
  );
}

// One day laid out like the run-of-show sheet and the /live schedule: a time
// column (30-minute rows, Eastern), one column per sheet category, each item
// a block spanning its start to end, and a line at the current time. The
// sponsor's items are full strength with "You"/"Now" tags; hackathon events
// are greyed out.
export function DayGrid({
  day,
  entries,
  now,
  sponsorName,
  emptyText = scheduleCopy.emptyDay,
}: {
  day: RunOfShowDay;
  entries: readonly TimelineEntry[];
  now: Date;
  sponsorName: string;
  emptyText?: string;
}) {
  const headingId = useId();
  const date = Number(RUN_OF_SHOW_DATES[day].slice(8));
  const rows = buildAxis(entries);
  const columns = layoutGrid(entries);
  const height = rows.reduce(
    (h, r) => h + (r.type === "slot" ? SLOT_HEIGHT : GAP_HEIGHT),
    0,
  );
  const y = (minute: number) =>
    axisOffset(rows, minute, SLOT_HEIGHT, GAP_HEIGHT) ?? 0;
  const nowMinute = minutesIntoDay(day, now);
  const nowY =
    nowMinute >= 0 && rows.length > 0
      ? axisOffset(rows, nowMinute, SLOT_HEIGHT, GAP_HEIGHT)
      : null;
  const template = `${TIME_WIDTH}px repeat(${columns.length}, minmax(${COLUMN_MIN}px, 1fr))`;
  const minWidth = TIME_WIDTH + columns.length * COLUMN_MIN;

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-dashboard-lg bg-dashboard-bg-surface p-3 shadow-dashboard-card sm:p-5"
    >
      <h2
        id={headingId}
        className="m-0 mb-3 text-lg font-bold text-dashboard-text-heavy sm:text-2xl"
      >
        {copy.dayHeading(day, date)}
      </h2>

      {entries.length === 0 ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-6 text-center text-base text-dashboard-text-medium">
          {emptyText}
        </p>
      ) : (
        <div
          role="region"
          aria-label={copy.gridLabel(day)}
          tabIndex={0}
          className="max-h-[80vh] overflow-auto rounded-dashboard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          <div style={{ minWidth }}>
            {/* Column headers, pinned while the grid scrolls. */}
            <div
              aria-hidden
              className="sticky top-0 z-40 grid border-b-2 border-dashboard-border-default bg-dashboard-bg-surface"
              style={{ gridTemplateColumns: template }}
            >
              <span className="sticky left-0 z-10 bg-dashboard-bg-surface py-2 text-[11px] font-semibold uppercase tracking-wide text-dashboard-text-light">
                {copy.timeHeader}
              </span>
              {columns.map(({ column }) => (
                <span
                  key={column}
                  className="px-1 py-2 text-center text-[11px] font-semibold uppercase leading-tight tracking-wide text-dashboard-text-medium"
                >
                  {copy.columns[column]}
                </span>
              ))}
            </div>

            <div
              className="relative grid"
              style={{ gridTemplateColumns: template, height }}
            >
              {/* Half-hour rules across every column (visual only). */}
              <div aria-hidden className="pointer-events-none absolute inset-0">
                {rows.map((row) =>
                  row.type === "slot" ? (
                    <div
                      key={`rule-${row.minute}`}
                      className="absolute inset-x-0 border-t border-dashboard-border-subtle"
                      style={{ top: y(row.minute) }}
                    />
                  ) : (
                    <div
                      key={`gap-${row.from}`}
                      className="absolute inset-x-0 my-1 flex items-center justify-center rounded-dashboard-sm border border-dashed border-dashboard-border-default bg-dashboard-bg-inset text-dashboard-text-light"
                      style={{
                        top: y(row.from) - GAP_HEIGHT / 2,
                        height: GAP_HEIGHT - 8,
                      }}
                    >
                      ⋯
                    </div>
                  ),
                )}
              </div>

              {/* Time column, pinned on the left while scrolling sideways. */}
              <div
                aria-hidden
                className="sticky left-0 z-30 bg-dashboard-bg-surface"
              >
                {rows.map((row) =>
                  row.type === "slot" ? (
                    <span
                      key={`time-${row.minute}`}
                      className="absolute left-0 border-t border-dashboard-border-subtle pr-2 pt-1 text-[11px] leading-tight text-dashboard-text-light sm:text-xs"
                      style={{ top: y(row.minute), width: TIME_WIDTH }}
                    >
                      {formatMinutes(row.minute)}
                    </span>
                  ) : null,
                )}
              </div>

              {columns.map(({ column, entries: laid }) => (
                <ol
                  key={column}
                  aria-label={copy.columns[column]}
                  className="relative m-0 list-none border-l border-dashboard-border-subtle p-0"
                >
                  {laid.map((entry) => (
                    <GridBlock
                      key={entry.id}
                      entry={entry}
                      column={column}
                      top={y(entry.start)}
                      height={Math.max(y(entry.end) - y(entry.start), 28)}
                      nowMinute={nowMinute}
                      sponsorName={sponsorName}
                    />
                  ))}
                </ol>
              ))}

              {nowY !== null && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-[35] flex items-center"
                  style={{ top: nowY, transform: "translateY(-50%)" }}
                >
                  <span
                    className="sticky left-0 shrink-0 bg-dashboard-bg-surface"
                    style={{ width: TIME_WIDTH }}
                  >
                    <span className="rounded-dashboard-xs bg-dashboard-action-primary px-1.5 py-0.5 text-[10px] font-bold text-dashboard-text-inverse sm:text-[11px]">
                      {formatMinutes(Math.floor(nowMinute))}
                    </span>
                  </span>
                  <span className="h-0.5 flex-1 bg-dashboard-action-primary" />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function GridBlock({
  entry,
  column,
  top,
  height,
  nowMinute,
  sponsorName,
}: {
  entry: TimelineEntry & { lane: number; lanes: number };
  column: GridColumn;
  top: number;
  height: number;
  nowMinute: number;
  sponsorName: string;
}) {
  const yours = entry.kind === "yours";
  const live = yours && nowMinute >= entry.start && nowMinute < entry.end;
  const mine = yours && (entry.item?.sponsors.includes(sponsorName) ?? false);
  const location = entry.location
    ? mine
      ? locationFor(entry.location, sponsorName)
      : entry.location
    : yours && !NO_ROOM_NEEDED.has(entry.category)
      ? scheduleCopy.noLocation
      : null;

  return (
    <li
      aria-current={live ? "time" : undefined}
      className={cn("absolute p-1", yours ? "z-20" : "z-10")}
      style={{
        top,
        height,
        left: `${(entry.lane / entry.lanes) * 100}%`,
        width: `${100 / entry.lanes}%`,
      }}
    >
      <div
        className={cn(
          "relative flex h-full flex-col gap-0.5 overflow-hidden rounded-dashboard-sm p-1.5 sm:p-2",
          yours
            ? cn(
                "border-l-4 border-dashboard-action-primary bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card",
                live && "ring-2 ring-dashboard-action-primary",
              )
            : "border border-dashed border-dashboard-border-control bg-dashboard-bg-inset text-dashboard-text-light",
        )}
      >
        {/* Tint over white so the block stays opaque over the rules. */}
        {yours && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0",
              COLUMN_TINT[column],
            )}
          />
        )}
        <p
          className={cn(
            "relative m-0 break-words text-xs leading-tight sm:text-[13px]",
            yours ? "font-semibold" : "font-medium",
          )}
        >
          <span className="sr-only">
            {`${yours ? copy.srYours : copy.srHackathon}, ${copy.categories[entry.category]}, ${copy.srTime(formatMinutes(entry.start), formatMinutes(entry.end))}: `}
          </span>
          {(mine || live) && (
            <span className="mr-1 inline-flex gap-1 align-middle">
              {live && (
                <DashboardTag className="bg-dashboard-action-primary px-1.5 py-0 leading-4 text-dashboard-text-inverse">
                  {scheduleCopy.now}
                </DashboardTag>
              )}
              {mine && (
                <DashboardTag className="bg-dashboard-bg-surface px-1.5 py-0 leading-4 text-dashboard-text-heavy">
                  {scheduleCopy.you}
                </DashboardTag>
              )}
            </span>
          )}
          {entry.title}
        </p>
        {location && (
          <p
            className={cn(
              "relative m-0 flex items-start gap-1 text-[11px] leading-tight sm:text-xs",
              yours && "text-dashboard-text-medium",
            )}
          >
            <MapPin aria-hidden className="mt-px size-3 shrink-0" />
            <span className="break-words">{location}</span>
          </p>
        )}
      </div>
    </li>
  );
}
