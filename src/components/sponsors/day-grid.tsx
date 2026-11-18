import { type ReactNode, useEffect, useId, useRef, useState } from "react";
import { CalendarX, Clock, MapPin, Users, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
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
import { bookingCounts } from "~/lib/schedule-bookings";
import {
  axisOffset,
  blockTextLayout,
  buildAxis,
  columnMinWidth,
  fluidColumnMinWidth,
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
// folded into one dashed row. On wide screens the columns share the width
// (busier columns get more), so a normal day needs no sideways scroll; on
// phones each lane keeps a readable width and the grid scrolls inside its
// own box (time column and headers pinned), never the page.
const SLOT_HEIGHT = GRID_SIZES.slot;
const GAP_HEIGHT = GRID_SIZES.gap;
const TIME_WIDTH = 64;
// On wide screens the Team tasks column stays pinned on the right, beside
// whatever part of the day the event columns are scrolled to.
const PINNED_TASKS =
  "lg:sticky lg:right-0 lg:border-l-2 lg:border-dashboard-border-default bg-dashboard-bg-surface";

// Column focus is gentle (Jazz, 2026-11-18): the focused column gets about
// 30% more width; the others keep their size and text, faded.
const FOCUS_GROWTH = 1.3;

const STORAGE_KEY = "hw-sponsor-schedule-show-hackathon";

// Hover styles use the [@media(hover:hover)]:hover: variant: only where
// there is a real pointer, so a tap on a phone doesn't leave a block stuck
// in its hover state.

/** Scroll behaviour that respects "reduce motion". */
function scrollBehavior(): ScrollBehavior {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
}

/** True at sm (640px) and up; true before mount so SSR matches desktop. */
function useIsWide(): boolean {
  const [wide, setWide] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const update = () => setWide(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return wide;
}

/** "Show hackathon events", remembered on this device. */
export function useShowHackathon(): [boolean, (show: boolean) => void] {
  // Off by default (Jazz, 2026-11-17): food and ceremonies show anyway.
  const [show, setShow] = useState(false);
  useEffect(() => {
    try {
      if (window.localStorage.getItem(STORAGE_KEY) === "1") setShow(true);
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
  hackathon: "bg-dashboard-schedule-blue",
  "sponsor-workshop": "bg-dashboard-schedule-pink",
  food: "bg-dashboard-schedule-blue",
  "spon-booth": "bg-dashboard-schedule-green",
  "coffee-chats": "bg-dashboard-schedule-orange",
  judging: "bg-dashboard-schedule-green",
  other: "bg-dashboard-schedule-blue",
  // Tasks keep their own amber (no tint drawn over it).
  tasks: "bg-dashboard-bg-task",
};

// Collapsed column headers show only this swatch (their name is in the
// button's label and tooltip), so nothing reads as a clipped word.
const COLUMN_SWATCH: Record<GridColumn, string> = {
  hackathon:
    "border border-dashed border-dashboard-border-control bg-dashboard-bg-inset",
  "sponsor-workshop": "bg-dashboard-schedule-pink",
  food: "bg-dashboard-schedule-blue",
  "spon-booth": "bg-dashboard-schedule-green",
  "coffee-chats": "bg-dashboard-schedule-orange",
  judging: "bg-dashboard-schedule-green",
  other: "bg-dashboard-schedule-blue",
  tasks: "border-l-4 border-dashboard-border-task bg-dashboard-bg-task",
};

// Main events, meals and the Sponsor Bay (a place itself) with no room just
// omit the location line.
const NO_ROOM_NEEDED = new Set<TimelineEntry["category"]>([
  "big-event",
  "food",
  "spon-booth",
]);

/**
 * The hide/show switch for hackathon events, sized for the schedule card's
 * header row. No legend: the column headers name each lane (Jazz,
 * 2026-11-18).
 */
export function HackathonToggle({
  showHackathon,
  onShowHackathonChange,
}: {
  showHackathon: boolean;
  onShowHackathonChange: (show: boolean) => void;
}) {
  const toggleId = useId();
  return (
    <label
      htmlFor={toggleId}
      className="flex min-h-11 cursor-pixel-hover items-center gap-1.5 text-sm font-medium text-dashboard-text-heavy sm:min-h-8"
    >
      <DashboardCheckbox
        id={toggleId}
        checked={showHackathon}
        onCheckedChange={(v) => onShowHackathonChange(v === true)}
      />
      {copy.showHackathon}
    </label>
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
  headerStart,
  headerEnd,
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
  /** Beside the day title, e.g. the day pills. */
  headerStart?: ReactNode;
  /** Right end of the header row, e.g. the hackathon events switch. */
  headerEnd?: ReactNode;
}) {
  const headingId = useId();
  const [selected, setSelected] = useState<TimelineEntry | null>(null);
  const [focusChoice, setFocusChoice] = useState<GridColumn | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const headers = useRef(new Map<GridColumn, HTMLButtonElement>());
  const scrolledToNow = useRef<string | null>(null);
  const wide = useIsWide();
  const date = Number(RUN_OF_SHOW_DATES[day].slice(8));
  const rows = buildAxis(entries);
  const columns = layoutGrid(entries);
  // A focused column that's gone (other day, hidden) means no focus.
  const focused = columns.some((c) => c.column === focusChoice)
    ? focusChoice
    : null;
  const slotHeight = SLOT_HEIGHT;
  const height = rows.reduce(
    (h, r) => h + (r.type === "slot" ? slotHeight : GAP_HEIGHT),
    0,
  );
  const y = (minute: number) =>
    axisOffset(rows, minute, slotHeight, GAP_HEIGHT) ?? 0;
  const nowMinute = minutesIntoDay(day, now);
  const nowY =
    nowMinute >= 0 && rows.length > 0
      ? axisOffset(rows, nowMinute, slotHeight, GAP_HEIGHT)
      : null;
  // Floors per column. Wide screens: fluid floors, so columns share the
  // width; phones: a readable width per lane (the grid scrolls sideways).
  const floor = (c: (typeof columns)[number]) =>
    wide
      ? fluidColumnMinWidth(c.entries)
      : columnMinWidth(
          c.entries,
          c.column === "tasks" ? GRID_SIZES.taskLane : GRID_SIZES.lane,
        );
  // Spare width goes to busier columns: one share per lane, less for an
  // empty column.
  const share = (c: (typeof columns)[number]) =>
    c.entries.length === 0
      ? 0.6
      : Math.max(1, ...c.entries.map((e) => e.lanes));
  const grow = (c: (typeof columns)[number]) =>
    c.column === focused ? FOCUS_GROWTH : 1;
  const widths = columns.map((c) => Math.round(floor(c) * grow(c)));
  const template = `${TIME_WIDTH}px ${columns
    .map((c, i) => `minmax(${widths[i]}px, ${share(c) * grow(c)}fr)`)
    .join(" ")}`;
  const minWidth = TIME_WIDTH + widths.reduce((a, b) => a + b, 0);
  const label = (column: GridColumn) => copy.columns[column];
  const toggleFocus = (column: GridColumn) =>
    setFocusChoice((current) => (current === column ? null : column));

  // Escape shows every column again (unless the details panel is open:
  // Escape closes that first).
  useEffect(() => {
    if (!focused || selected) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFocusChoice(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focused, selected]);

  // A focused column slides into view beside the time column; before, it
  // could open half hidden under it when the grid was scrolled sideways.
  useEffect(() => {
    const box = scroller.current;
    const header = focused ? headers.current.get(focused) : null;
    if (!box || !header) return;
    // Measured on screen (not offsetLeft, which depends on which ancestor
    // is positioned): how far the column starts past the time column.
    const delta =
      header.getBoundingClientRect().left -
      box.getBoundingClientRect().left -
      TIME_WIDTH;
    box.scrollTo({
      left: Math.max(0, box.scrollLeft + delta),
      behavior: scrollBehavior(),
    });
  }, [focused]);

  // Open on the current time: once per day shown, the grid scrolls (inside
  // its own box, never the page) so the now line sits near the top.
  const hasNow = nowY !== null;
  useEffect(() => {
    const box = scroller.current;
    if (!box || !hasNow || scrolledToNow.current === day) return;
    scrolledToNow.current = day;
    box.scrollTop = Math.max(0, (nowY ?? 0) - SLOT_HEIGHT);
    // Only when the day or "is today" changes, not every minute.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [day, hasNow]);

  const open = (entry: TimelineEntry, button: HTMLButtonElement) => {
    opener.current = button;
    setSelected(entry);
  };

  return (
    <section
      aria-labelledby={headingId}
      className="rounded-dashboard-lg bg-dashboard-bg-surface p-3 shadow-dashboard-card sm:p-5"
    >
      <div className="mb-3 flex min-h-11 flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
          <h2
            id={headingId}
            className="m-0 text-lg font-bold text-dashboard-text-heavy sm:text-2xl"
          >
            {copy.dayHeading(day, date)}
          </h2>
          {headerStart}
        </div>
        {headerEnd}
      </div>
      <div className="-mt-1 mb-3 flex flex-wrap items-center justify-end gap-2 empty:hidden">
        {focused ? (
          <DashboardButton
            variant="outline"
            className="h-11 motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.97]"
            onClick={() => setFocusChoice(null)}
          >
            {copy.focus.showAll}
          </DashboardButton>
        ) : (
          entries.length > 0 && (
            <p className="m-0 text-sm text-dashboard-text-light">
              {copy.focus.hint}
            </p>
          )
        )}
      </div>
      <p aria-live="polite" className="sr-only">
        {focused ? copy.focus.focused(label(focused)) : ""}
      </p>

      {entries.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-dashboard-lg bg-dashboard-bg-inset p-6 text-center">
          <CalendarX
            aria-hidden
            className="size-6 text-dashboard-text-light"
            strokeWidth={1.67}
          />
          <p className="m-0 text-base text-dashboard-text-medium">
            {emptyText}
          </p>
        </div>
      ) : (
        <div
          ref={scroller}
          role="region"
          aria-label={copy.gridLabel(day)}
          tabIndex={0}
          className="max-h-[80vh] overflow-auto overscroll-x-contain rounded-dashboard-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          <div style={{ minWidth }}>
            {/* Column headers, pinned while the grid scrolls. Each is a
                button that focuses its column (and unfocuses it again). */}
            <div
              className="sticky top-0 z-40 grid border-b-2 border-dashboard-border-default bg-dashboard-bg-surface"
              style={{ gridTemplateColumns: template }}
            >
              <span
                aria-hidden
                className="sticky left-0 z-10 flex items-end bg-dashboard-bg-surface pb-2 text-xs font-semibold uppercase tracking-wide text-dashboard-text-light"
              >
                {copy.timeHeader}
              </span>
              {columns.map(({ column }) => {
                const isFocused = focused === column;
                const muted = focused !== null && !isFocused;
                return (
                  <button
                    key={column}
                    ref={(el) => {
                      if (el) headers.current.set(column, el);
                      else headers.current.delete(column);
                    }}
                    type="button"
                    aria-pressed={isFocused}
                    aria-label={copy.focus.focusColumn(label(column))}
                    title={label(column)}
                    onClick={() => toggleFocus(column)}
                    className={cn(
                      "flex min-h-11 min-w-0 cursor-pointer items-end gap-1 py-2 text-left text-xs font-semibold uppercase leading-tight tracking-wide text-dashboard-text-medium",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary",
                      "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
                      muted ? "justify-center px-0" : "px-2",
                      column === "tasks" && !focused && PINNED_TASKS,
                      isFocused &&
                        "bg-dashboard-bg-highlight text-dashboard-text-active",
                    )}
                  >
                    {muted ? (
                      <span
                        aria-hidden
                        className={cn(
                          "mb-0.5 size-3 shrink-0 rounded-dashboard-xs",
                          COLUMN_SWATCH[column],
                        )}
                      />
                    ) : (
                      <>
                        {/* Wraps to a second line rather than clipping. */}
                        <span className="min-w-0 break-words">
                          {label(column)}
                        </span>
                        {isFocused && (
                          <X aria-hidden className="mb-px size-3.5 shrink-0" />
                        )}
                      </>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Keyed on day and focus: the blocks fade in after a change
                (short, ease-out, none with reduced motion) instead of
                snapping to the new layout. Headers aren't keyed, so a
                keyboard user keeps focus on the heading they pressed. */}
            <div
              key={`${day}-${focused ?? "all"}`}
              className="relative grid motion-safe:duration-200 motion-safe:ease-out motion-safe:animate-in motion-safe:fade-in-0"
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

              {columns.map(({ column, entries: laid }) => {
                const muted = focused !== null && focused !== column;
                return (
                  <ol
                    key={column}
                    aria-label={label(column)}
                    // Other columns stay readable and clickable, just faded.
                    className={cn(
                      "relative m-0 list-none border-l border-dashboard-border-subtle p-0 transition-opacity duration-150 motion-reduce:transition-none",
                      column === "tasks" &&
                        !focused &&
                        cn(PINNED_TASKS, "z-30"),
                      muted && "opacity-50",
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
                        expanded={focused === column}
                      />
                    ))}
                  </ol>
                );
              })}

              {/* Now line: a pill in the time column, a dot where the line
                  starts and the line across every column. */}
              {nowY !== null && (
                <div
                  aria-hidden
                  className="pointer-events-none absolute inset-x-0 z-[35] flex items-center"
                  style={{ top: nowY, transform: "translateY(-50%)" }}
                >
                  <span
                    className="sticky left-0 flex shrink-0 items-center bg-dashboard-bg-surface"
                    style={{ width: TIME_WIDTH }}
                  >
                    <span className="whitespace-nowrap rounded-dashboard-xs bg-dashboard-action-primary px-1 py-0.5 text-[11px] font-bold leading-tight text-dashboard-text-inverse">
                      {formatMinutes(Math.floor(nowMinute))}
                    </span>
                  </span>
                  <span className="-ml-1 size-2 shrink-0 rounded-full bg-dashboard-action-primary" />
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
  expanded = false,
}: {
  entry: LaidOutEntry;
  column: GridColumn;
  top: number;
  height: number;
  nowMinute: number;
  mode: GridMode;
  sponsorName?: string;
  onOpen: (entry: TimelineEntry, button: HTMLButtonElement) => void;
  /** Focused column: full text, nothing clipped; the block grows to fit. */
  expanded?: boolean;
}) {
  const isTask = entry.kind === "task";
  const booking = entry.booking ?? null;
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
    : booking
      ? (booking.room ?? scheduleCopy.noLocation)
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
  const counts = booking ? bookingCounts(booking) : null;
  const bookingLine = counts
    ? [
        copy.booking.hackers(counts.hackers),
        copy.booking.status(counts.accepted, counts.waiting),
      ]
        .filter(Boolean)
        .join(" · ")
    : null;
  const sponsors = entry.item?.sponsors ?? [];
  const srPrefix = isTask
    ? `${copy.srTask}, ${formatMinutes(entry.start)}: `
    : `${entry.kind === "hackathon" ? copy.srHackathon : mode === "organizer" ? copy.runOfShow : copy.srYours}, ${copy.categories[entry.category]}, ${copy.srTime(formatMinutes(entry.start), formatMinutes(entry.end))}: `;

  return (
    <li
      aria-current={live ? "time" : undefined}
      className={cn(
        "absolute p-1",
        strong ? "z-20" : "z-10",
        expanded && "focus-within:z-30 hover:z-30",
      )}
      style={{
        top,
        ...(expanded ? { minHeight: height } : { height }),
        left: `${(entry.lane / entry.lanes) * 100}%`,
        width: `${100 / entry.lanes}%`,
      }}
    >
      <button
        type="button"
        onClick={(e) => onOpen(entry, e.currentTarget)}
        aria-haspopup="dialog"
        className={cn(
          "relative flex w-full cursor-pointer flex-col items-stretch gap-0.5 rounded-dashboard-sm p-1.5 text-left",
          expanded ? "min-h-full" : "h-full overflow-hidden",
          // Press feedback everywhere; the lift only with a real pointer.
          "motion-safe:transition-[box-shadow,transform] motion-safe:duration-150 motion-safe:ease-out motion-safe:active:scale-[0.98]",
          "[@media(hover:hover)]:hover:shadow-dashboard-card motion-safe:[@media(hover:hover)]:hover:-translate-y-px",
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
        {strong && !isTask && (
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
            "relative m-0 break-words text-[13px] leading-4",
            !expanded && "overflow-hidden",
            strong ? "font-semibold" : "font-medium",
          )}
          style={
            expanded
              ? { whiteSpace: "pre-line" }
              : {
                  display: "-webkit-box",
                  WebkitBoxOrient: "vertical",
                  WebkitLineClamp: titleLines,
                }
          }
        >
          <span className="sr-only">{srPrefix}</span>
          {(mine || live) && (
            <span className="mr-1 inline-flex max-w-full flex-wrap gap-1 align-top">
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
        {expanded && (
          <span className="relative m-0 flex items-start gap-1 text-xs leading-4 text-dashboard-text-medium">
            <Clock aria-hidden className="mt-0.5 size-3 shrink-0" />
            <span>
              {isTask
                ? formatMinutes(entry.start)
                : copy.srTime(
                    formatMinutes(entry.start),
                    formatMinutes(entry.end),
                  )}
            </span>
          </span>
        )}
        {bookingLine && (expanded || layout.titleLines > 1) && (
          <span className="relative m-0 flex min-w-0 items-start gap-1 text-xs leading-4 text-dashboard-text-medium">
            <Users aria-hidden className="mt-0.5 size-3 shrink-0" />
            <span className={cn(!expanded && "truncate")}>{bookingLine}</span>
          </span>
        )}
        {expanded && !booking && sponsors.length > 0 && (
          <span className="relative m-0 flex items-start gap-1 text-xs leading-4 text-dashboard-text-medium">
            <Users aria-hidden className="mt-0.5 size-3 shrink-0" />
            <span className="break-words">{sponsors.join(", ")}</span>
          </span>
        )}
        {isTask ? (
          <span className="relative flex">
            <DashboardTag
              className={cn(
                "max-w-full px-1.5 py-0 leading-4",
                !expanded && "truncate",
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
          (expanded || layout.showLocation) && (
            <span
              className={cn(
                "relative m-0 flex min-w-0 items-start gap-1 text-xs leading-4",
                strong && "text-dashboard-text-medium",
              )}
            >
              <MapPin aria-hidden className="mt-0.5 size-3 shrink-0" />
              <span className={expanded ? "break-words" : "truncate"}>
                {location}
              </span>
            </span>
          )
        )}
        <span className="sr-only">{`. ${copy.openDetails}`}</span>
      </button>
    </li>
  );
}
