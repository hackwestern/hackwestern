// "Now and next" on the organizer dashboard (decisions 2026-11-19, "Turn off
// task pings for now"): the run-of-show event on now and the next one, and
// the team task on now and the next one, each with its owner. No pings, no
// marking done. Pure: the caller owns the clock.

import { happeningNow, TASK_MINUTES } from "~/lib/happening-now";
import type {
  RunOfShowDay,
  RunOfShowItem,
  RunOfShowTask,
} from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";

export type NowAndNextTask = {
  day: RunOfShowDay;
  start: string;
  /** First line of the sheet's Task cell (the rest is detail). */
  title: string;
  /** The Owner cell on one line ("Noah, Caroline"); null when blank. */
  owner: string | null;
};

export type NowAndNext = {
  phase: "before" | "during" | "after";
  /** Events on now (several can share a time slot). */
  eventsNow: RunOfShowItem[];
  /** The next event(s) to start: all that share the earliest start. */
  eventsNext: RunOfShowItem[];
  /** Tasks started in the last TASK_MINUTES (same window as the grid). */
  tasksNow: NowAndNextTask[];
  /** The next task(s) to start: all that share the earliest start. */
  tasksNext: NowAndNextTask[];
};

const at = (t: { day: RunOfShowDay; start: string }) =>
  runOfShowInstant(t.day, t.start).getTime();

/** "Check in speakers:\nCanada Life…" -> "Check in speakers". */
function taskTitle(task: string): string {
  const line = task.split(/\n/).find((l) => l.trim()) ?? task;
  return line.trim().replace(/:$/, "");
}

/** Owner cell on one line: tags and blank lines dropped, names joined. */
export function ownerLine(owner: string | null): string | null {
  if (!owner) return null;
  const names = owner
    .replace(/\[[^\]]*\]/g, " ")
    .split(/\n+/)
    .map((l) => l.replace(/[ \t]+/g, " ").trim())
    .filter(Boolean);
  const seen = new Set<string>();
  const out = names.filter((n) => {
    const k = n.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return out.length ? out.join(", ") : null;
}

function asTask(t: RunOfShowTask): NowAndNextTask {
  return {
    day: t.day,
    start: t.start,
    title: taskTitle(t.task),
    owner: ownerLine(t.owner),
  };
}

export function nowAndNext({
  items,
  tasks,
  now,
}: {
  items: readonly RunOfShowItem[];
  tasks: readonly RunOfShowTask[];
  now: Date;
}): NowAndNext {
  const h = happeningNow({ items, tasks, now });
  const t = now.getTime();
  const sorted = [...tasks].sort(
    (a, b) => at(a) - at(b) || a.task.localeCompare(b.task),
  );
  const upcoming = sorted.filter((k) => at(k) > t);
  const nextAt = upcoming[0] ? at(upcoming[0]) : null;
  const tasksNext =
    nextAt === null ? [] : upcoming.filter((k) => at(k) === nextAt);
  // The latest task(s) still inside their window count as "now".
  const on = sorted.filter(
    (k) => t >= at(k) && t < at(k) + TASK_MINUTES * 60_000,
  );
  const lastAt = on.length ? at(on[on.length - 1]!) : null;
  return {
    phase: h.phase,
    eventsNow: h.items,
    eventsNext: h.next,
    tasksNow: on.filter((k) => at(k) === lastAt).map(asTask),
    tasksNext: tasksNext.map(asTask),
  };
}
