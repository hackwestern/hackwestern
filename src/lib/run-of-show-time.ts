import {
  RUN_OF_SHOW_DAYS,
  type RunOfShowDay,
  type RunOfShowItem,
} from "~/lib/run-of-show";

/** Event dates (Eastern, UTC-5 in November). */
export const RUN_OF_SHOW_DATES: Record<RunOfShowDay, string> = {
  Friday: "2026-11-20",
  Saturday: "2026-11-21",
  Sunday: "2026-11-22",
};

/** Absolute time of a day + "HH:MM" ("24:00" = next midnight). */
export function runOfShowInstant(day: RunOfShowDay, time: string): Date {
  const [h, m] = time.split(":").map(Number) as [number, number];
  const midnight = new Date(`${RUN_OF_SHOW_DATES[day]}T00:00:00-05:00`);
  return new Date(midnight.getTime() + (h * 60 + m) * 60_000);
}

export function isHappeningNow(
  item: Pick<RunOfShowItem, "day" | "start" | "end">,
  now: Date,
): boolean {
  return (
    now >= runOfShowInstant(item.day, item.start) &&
    now < runOfShowInstant(item.day, item.end)
  );
}

/** The event day to open on: today during the event, else Friday/Sunday. */
export function defaultRunOfShowDay(now: Date): RunOfShowDay {
  for (const day of RUN_OF_SHOW_DAYS) {
    const start = runOfShowInstant(day, "00:00");
    const end = runOfShowInstant(day, "24:00");
    if (now >= start && now < end) return day;
  }
  return now > runOfShowInstant("Sunday", "24:00") ? "Sunday" : "Friday";
}
