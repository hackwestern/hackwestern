import type {
  RunOfShowDay,
  RunOfShowItem,
  RunOfShowTask,
} from "~/lib/run-of-show";
import { RUN_OF_SHOW_DAYS } from "~/lib/run-of-show";
import { isHappeningNow, runOfShowInstant } from "~/lib/run-of-show-time";

/** A task only has a start; it counts as "on" for this long (as on the grid). */
export const TASK_MINUTES = 30;

export type HappeningNow = {
  /** "before" the first item starts, "during" the event, "after" the last ends. */
  phase: "before" | "during" | "after";
  /** Run-of-show items in progress (end exclusive), by start then title. */
  items: RunOfShowItem[];
  /** Team tasks in progress. Always empty unless `tasks` was passed. */
  tasks: RunOfShowTask[];
  /** The next item(s) to start (all that share the earliest start). */
  next: RunOfShowItem[];
  /** First item of the whole event, for the "before" phase. */
  firstStart: { day: RunOfShowDay; start: string } | null;
};

const startOf = (i: RunOfShowItem) =>
  runOfShowInstant(i.day, i.start).getTime();
const endOf = (i: RunOfShowItem) => runOfShowInstant(i.day, i.end).getTime();

const byStart = (a: RunOfShowItem, b: RunOfShowItem) =>
  startOf(a) - startOf(b) || a.title.localeCompare(b.title);

/** Same title and times (an item the sheet spreads over columns) once. */
function dedupe(items: RunOfShowItem[]): RunOfShowItem[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = `${i.day}|${i.start}|${i.end}|${i.title.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * What's on at `now`: items in progress, tasks in progress (organizer only:
 * pass `tasks`), what's next, and whether the event hasn't started or is over.
 * Pure: the caller owns the clock.
 */
export function happeningNow({
  items,
  tasks,
  now,
}: {
  items: readonly RunOfShowItem[];
  tasks?: readonly RunOfShowTask[];
  now: Date;
}): HappeningNow {
  const sorted = dedupe([...items].sort(byStart));
  const t = now.getTime();

  const first = sorted[0];
  const firstStart = first ? { day: first.day, start: first.start } : null;
  const lastEnd = sorted.reduce((m, i) => Math.max(m, endOf(i)), -Infinity);

  const phase: HappeningNow["phase"] =
    !first || t < startOf(first) ? "before" : t >= lastEnd ? "after" : "during";

  const on = sorted.filter((i) => isHappeningNow(i, now));
  const upcoming = sorted.filter((i) => startOf(i) > t);
  const nextStart = upcoming[0] ? startOf(upcoming[0]) : null;
  const next =
    nextStart === null ? [] : upcoming.filter((i) => startOf(i) === nextStart);

  const tasksOn = (tasks ?? [])
    .filter((k) => {
      const s = runOfShowInstant(k.day, k.start).getTime();
      return t >= s && t < s + TASK_MINUTES * 60_000;
    })
    .sort(
      (a, b) =>
        RUN_OF_SHOW_DAYS.indexOf(a.day) - RUN_OF_SHOW_DAYS.indexOf(b.day) ||
        a.start.localeCompare(b.start) ||
        a.task.localeCompare(b.task),
    );

  return { phase, items: on, tasks: tasksOn, next, firstStart };
}

/** The event day `now` falls on (Eastern), or null outside the event dates. */
export function eventDayAt(now: Date): RunOfShowDay | null {
  return (
    RUN_OF_SHOW_DAYS.find(
      (d) =>
        now >= runOfShowInstant(d, "00:00") &&
        now < runOfShowInstant(d, "24:00"),
    ) ?? null
  );
}

/** "HH:MM" Eastern at `now` (feed to formatClock). */
export function easternClock(now: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Toronto",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}
