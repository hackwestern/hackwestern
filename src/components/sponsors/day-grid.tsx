import { useEffect, useId, useRef, useState } from "react";
import { MapPin } from "lucide-react";
import { DashboardCheckbox } from "~/components/internals/dashboard-checkbox";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import {
  EventDetails,
  type GridMode,
} from "~/components/sponsors/event-details";
import { scheduleCopy } from "~/content/sponsor-schedule";
import {
  locationFor,
  type RunOfShowDay,
  type RunOfShowTask,
  type WorkshopInfo,
} from "~/lib/run-of-show";
import { RUN_OF_SHOW_DATES } from "~/lib/run-of-show-time";
import {
  axisOffset,
  blockTextLayout,
  buildAxis,
  columnMinWidth,
  formatMinutes,
  GRID_SIZES,
  layoutGrid,
  minutesIntoDay,
  type GridColumn,
  type LaidOutEntry,
  type TimelineEntry,
} from "~/lib/sponsor-timeline";
import { cn } from "~/lib/utils";

const copy = scheduleCopy.timeline;

// Same rhythm as the /live schedule grid: a fixed row per half hour (tall
// enough for two lines of title and a location), long empty stretches
// folded into one dashed row. Each column keeps a readable width per lane;
// on phones the grid scrolls inside its own box (time column and headers
// pinned), never the page.
const SLOT_HEIGHT = GRID_SIZES.slot;
const GAP_HEIGHT = GRID_SIZES.gap;
const TIME_WIDTH = 64;
// On wide screens the Team tasks column stays pinned on the right, beside
// whatever part of the day the event columns are scrolled to.
const PINNED_TASKS =
  "lg:sticky lg:right-0 lg:border-l-2 lg:border-dashboard-border-default bg-dashboard-bg-surface";

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

// Full-strength blocks are coloured by sheet column, like /live's blocks,
// in dashboard tints. Hackathon events are all one muted grey.
const COLUMN_TINT: Record<GridColumn, string> = {
  "big-event": "bg-dashboard-schedule-blue",
  "sponsor-workshop": "bg-dashboard-schedule-pink",
  food: "bg-dashboard-schedule-blue",
  "spon-booth": "bg-dashboard-schedule-green",
  "coffee-chats": "bg-dashboard-schedule-orange",
  other: "bg-dashboard-schedule-blue",
  tasks: "bg-dashboard-bg-highlight",
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
  mode = "sponsor",
}: {
  showHackathon: boolean;
  onShowHackathonChange: (show: boolean) => void;
  mode?: GridMode;
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
          {mode === "organizer" ? copy.runOfShow : copy.yours}
        </li>
        <li className="flex items-center gap-2">
          <span
            aria-hidden
            className="size-4 rounded-dashboard-xs border border-dashed border-dashboard-border-control bg-dashboard-bg-inset"
          />
          {copy.hackathon}
        </li>
        {mode === "organizer" && (
          <li className="flex items-center gap-2">
            <span
              aria-hidden
              className="size-4 rounded-dashboard-xs border-l-4 border-dashboard-border-task bg-dashboard-bg-task"
            />
            {copy.teamTask}
          </li>
        )}
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
// a block spanning its start to end, and a line at the current time. Every
// block opens a details panel with its full text.
//  - sponsor: the sponsor's items full strength with "You"/"Now" tags;
//    hackathon events greyed out.
//  - organizer: every run-of-show item full strength, /live events greyed
//    out, and a "Team tasks" column (task entries) on the right.
export function DayGrid({
  day,
  entries,
  now,
  mode = "sponsor",
  sponsorName,
  workshops = [],
  tasks = [],
  emptyText = scheduleCopy.emptyDay,
}: {
  day: RunOfShowDay;
  entries: readonly TimelineEntry[];
  now: Date;
  mode?: GridMode;
  /** Sponsor view: whose items get the "You" tag and their own room. */
  sponsorName?: string;
  /** Workshops-tab rows, for runners and descriptions in the details. */
  workshops?: readonly WorkshopInfo[];
  /** Organizer view: team tasks listed in an event's details. */
  tasks?: readonly RunOfShowTask[];
  emptyText?: string;
}) {
  const headingId = useId();
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
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
  const widths = columns.map((c) =>
    columnMinWidth(
      c.entries,
      c.column === "tasks" ? GRID_SIZES.taskLane : GRID_SIZES.lane,
    ),
  );
  const template = `${TIME_WIDTH}px ${widths.map((w) => `minmax(${w}px, 1fr)`).join(" ")}`;
  const minWidth = TIME_WIDTH + widths.reduce((a, b) => a + b, 0);

  const open = (entry: TimelineEntry, button: HTMLButtonElement) => {
    opener.current = button;
    setSelected(entry);
  };

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
          className="max-h-[80vh] overflow-auto overscroll-x-contain rounded-dashboard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          <div style={{ minWidth }}>
            {/* Column headers, pinned while the grid scrolls. */}
            <div
              aria-hidden
              className="sticky top-0 z-40 grid border-b-2 border-dashboard-border-default bg-dashboard-bg-surface"
              style={{ gridTemplateColumns: template }}
            >
              <span className="sticky left-0 z-10 bg-dashboard-bg-surface py-2 text-xs font-semibold uppercase tracking-wide text-dashboard-text-light">
                {copy.timeHeader}
              </span>
              {columns.map(({ column }) => (
                <span
                  key={column}
                  className={cn(
                    "px-1 py-2 text-center text-xs font-semibold uppercase leading-tight tracking-wide text-dashboard-text-medium",
                    column === "tasks" && PINNED_TASKS,
                  )}
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
                      className="absolute left-0 border-t border-dashboard-border-subtle pr-2 pt-1 text-xs leading-tight text-dashboard-text-light"
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
                  className={cn(
                    "relative m-0 list-none border-l border-dashboard-border-subtle p-0",
                    column === "tasks" && cn(PINNED_TASKS, "z-30"),
                  )}
                >
                  {laid.map((entry) => (
                    <GridBlock
                      key={entry.id}
                      entry={entry}
                      column={column}
                      top={y(entry.start)}
                      height={Math.max(
                        y(entry.end) - y(entry.start),
                        GRID_SIZES.minBlock,
                      )}
                      nowMinute={nowMinute}
                      mode={mode}
                      sponsorName={sponsorName}
                      onOpen={open}
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
                    <span className="rounded-dashboard-xs bg-dashboard-action-primary px-1.5 py-0.5 text-[11px] font-bold text-dashboard-text-inverse">
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

      <EventDetails
        entry={selected}
        day={day}
        mode={mode}
        sponsorName={sponsorName}
        workshops={workshops}
        tasks={tasks}
        entries={entries}
        onClose={() => setSelected(null)}
        onCloseAutoFocus={(event) => {
          // Back to the block that opened the panel (Radix only does this
          // for its own Trigger).
          event.preventDefault();
          opener.current?.focus();
        }}
      />
    </section>
  );
}

function GridBlock({
  entry,
  column,
  top,
  height,
  nowMinute,
  mode,
  sponsorName,
  onOpen,
}: {
  entry: LaidOutEntry;
  column: GridColumn;
  top: number;
  height: number;
  nowMinute: number;
  mode: GridMode;
  sponsorName?: string;
  onOpen: (entry: TimelineEntry, button: HTMLButtonElement) => void;
}) {
  const isTask = entry.kind === "task";
  const strong = entry.kind !== "hackathon";
  const live =
    entry.kind === "yours" && nowMinute >= entry.start && nowMinute < entry.end;
  const mine =
    mode === "sponsor" &&
    entry.kind === "yours" &&
    !!sponsorName &&
    (entry.item?.sponsors.includes(sponsorName) ?? false);
  const location = isTask
    ? null
    : entry.location
      ? mine && sponsorName
        ? locationFor(entry.location, sponsorName)
        : entry.location
      : entry.kind === "yours" && !NO_ROOM_NEEDED.has(entry.category)
        ? scheduleCopy.noLocation
        : null;
  // Tasks always show their owner chip; events show the location when
  // there's room for it under at least two lines of title.
  const layout = blockTextLayout(height, isTask || !!location);
  const titleLines = isTask
    ? Math.max(1, layout.titleLines - (layout.showLocation ? 0 : 1))
    : layout.titleLines;
  const owner = entry.task?.owner ?? null;
  const srPrefix = isTask
    ? `${copy.srTask}, ${formatMinutes(entry.start)}: `
    : `${entry.kind === "hackathon" ? copy.srHackathon : mode === "organizer" ? copy.runOfShow : copy.srYours}, ${copy.categories[entry.category]}, ${copy.srTime(formatMinutes(entry.start), formatMinutes(entry.end))}: `;

  return (
    <li
      aria-current={live ? "time" : undefined}
      className={cn("absolute p-1", strong ? "z-20" : "z-10")}
      style={{
        top,
        height,
        left: `${(entry.lane / entry.lanes) * 100}%`,
        width: `${100 / entry.lanes}%`,
      }}
    >
      <button
        type="button"
        onClick={(e) => onOpen(entry, e.currentTarget)}
        aria-haspopup="dialog"
        className={cn(
          "relative flex h-full w-full cursor-pointer flex-col items-stretch gap-0.5 overflow-hidden rounded-dashboard-sm p-1.5 text-left",
          "hover:shadow-dashboard-card motion-safe:transition-[box-shadow,transform] motion-safe:duration-150 motion-safe:ease-out motion-safe:hover:-translate-y-px",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
          isTask
            ? "border-l-4 border-dashboard-border-task bg-dashboard-bg-task text-dashboard-text-task shadow-dashboard-card"
            : strong
              ? cn(
                  "border-l-4 border-dashboard-action-primary bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card",
                  live && "ring-2 ring-dashboard-action-primary",
                )
              : "border border-dashed border-dashboard-border-control bg-dashboard-bg-inset text-dashboard-text-light",
        )}
      >
        {/* Tint over white so the block stays opaque over the rules. */}
        {strong && (
          <span
            aria-hidden
            className={cn(
              "pointer-events-none absolute inset-0",
              COLUMN_TINT[column],
            )}
          />
        )}
        <span
          className={cn(
            "relative m-0 overflow-hidden break-words text-[13px] leading-4",
            strong ? "font-semibold" : "font-medium",
          )}
          style={{
            display: "-webkit-box",
            WebkitBoxOrient: "vertical",
            WebkitLineClamp: titleLines,
          }}
        >
          <span className="sr-only">{srPrefix}</span>
          {(mine || live) && (
            <span className="mr-1 inline-flex gap-1 align-top">
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
        </span>
        {isTask ? (
          <span className="relative flex">
            <DashboardTag
              className={cn(
                "max-w-full truncate px-1.5 py-0 leading-4",
                owner
                  ? "bg-dashboard-bg-surface text-dashboard-text-heavy"
                  : "bg-dashboard-bg-inset text-dashboard-text-light",
              )}
            >
              {owner
                ? scheduleCopy.organizer.owner(owner)
                : scheduleCopy.organizer.unowned}
            </DashboardTag>
          </span>
        ) : (
          location &&
          layout.showLocation && (
            <span
              className={cn(
                "relative m-0 flex min-w-0 items-start gap-1 text-xs leading-4",
                strong && "text-dashboard-text-medium",
              )}
            >
              <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span className="truncate">{location}</span>
            </span>
          )
        )}
        <span className="sr-only">{`. ${copy.openDetails}`}</span>
      </button>
    </li>
  );
}
