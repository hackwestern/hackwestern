/**
 * The sponsor team's availability, read from the "SPON TEAM AVAILABILITY"
 * and "SPON TEAM NECESSARY SHIFTS" blocks on the RUN OF SHOW tab (parsed in
 * src/server/api/utils/spon-availability-parse.ts). Organizer-only: never
 * sent to the sponsor portal.
 *
 * Times are minutes into the calendar day (Eastern), 0-1440. An overnight
 * window ("Saturday 11PM-2AM") is split across the two days it touches.
 */
import type { RunOfShowDay } from "~/lib/run-of-show";

export type MinuteRange = { start: number; end: number };

export type DayRanges = Record<RunOfShowDay, MinuteRange[]>;

/** Sheet text kept as written: free notes, or times we couldn't read. */
export type AvailabilityNote = {
  /** null: applies to the whole event (shown on every day). */
  day: RunOfShowDay | null;
  text: string;
};

export type SponOrganizer = {
  name: string;
  /** "All day", "After 2:30PM", ... from the availability block. */
  available: DayRanges;
  /** On-site shifts (SHIFT column). */
  shifts: DayRanges;
  /** Remote on-call windows (ON-CALL column). */
  onCall: DayRanges;
  /** "stepping out 11PM-12AM friday": not available, even if free. */
  away: DayRanges;
  notes: AvailabilityNote[];
};

export type SponAvailability = {
  organizers: SponOrganizer[];
  /** Windows everyone must be there ("everyone: friday 4PM-7PM"). */
  required: DayRanges;
  /** Notes not tied to one person. */
  notes: AvailabilityNote[];
};

export const DAY_MINUTES = 24 * 60;

export function emptyDayRanges(): DayRanges {
  return { Friday: [], Saturday: [], Sunday: [] };
}

export function emptyAvailability(): SponAvailability {
  return { organizers: [], required: emptyDayRanges(), notes: [] };
}

/** Sorted, overlapping and touching ranges merged. */
export function unionRanges(ranges: readonly MinuteRange[]): MinuteRange[] {
  const sorted = ranges
    .filter((r) => r.end > r.start)
    .map((r) => ({ ...r }))
    .sort((a, b) => a.start - b.start);
  const out: MinuteRange[] = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    if (last && r.start <= last.end) last.end = Math.max(last.end, r.end);
    else out.push(r);
  }
  return out;
}

/** `ranges` with every part covered by `minus` cut out. */
export function subtractRanges(
  ranges: readonly MinuteRange[],
  minus: readonly MinuteRange[],
): MinuteRange[] {
  let out = unionRanges(ranges);
  for (const cut of unionRanges(minus)) {
    out = out.flatMap((r) => {
      if (cut.end <= r.start || cut.start >= r.end) return [r];
      const parts: MinuteRange[] = [];
      if (cut.start > r.start) parts.push({ start: r.start, end: cut.start });
      if (cut.end < r.end) parts.push({ start: cut.end, end: r.end });
      return parts;
    });
  }
  return out;
}

/** Ranges trimmed to [from, to); empty ones dropped. */
export function clipRanges(
  ranges: readonly MinuteRange[],
  from: number,
  to: number,
): MinuteRange[] {
  return ranges
    .map((r) => ({ start: Math.max(r.start, from), end: Math.min(r.end, to) }))
    .filter((r) => r.end > r.start);
}

/**
 * When a person is on site: free or on shift, minus time away and minus
 * their on-call windows (on call is remote, so it wins over "All day").
 */
export function presentRanges(
  organizer: SponOrganizer,
  day: RunOfShowDay,
): MinuteRange[] {
  return subtractRanges(
    [...organizer.available[day], ...organizer.shifts[day]],
    [...organizer.away[day], ...organizer.onCall[day]],
  );
}

/** Notes for one day: that day's plus the whole-event ones. */
export function notesForDay(
  notes: readonly AvailabilityNote[],
  day: RunOfShowDay,
): string[] {
  return notes.filter((n) => n.day === null || n.day === day).map((n) => n.text);
}

const covers = (ranges: readonly MinuteRange[], minute: number) =>
  ranges.some((r) => minute >= r.start && minute < r.end);

/** A stretch of the day where the same people are around. */
export type AvailabilitySegment = MinuteRange & {
  present: string[];
  onCall: string[];
};

/**
 * Who is around across [from, to): consecutive stretches with the same
 * people on site (present) and on call, in sheet order. Stretches with no
 * one at all are kept, so gaps show.
 */
export function availabilitySegments(
  organizers: readonly SponOrganizer[],
  day: RunOfShowDay,
  from: number,
  to: number,
): AvailabilitySegment[] {
  if (to <= from || organizers.length === 0) return [];
  const people = organizers.map((o) => ({
    name: o.name,
    present: presentRanges(o, day),
    onCall: subtractRanges(o.onCall[day], o.away[day]),
  }));
  const cuts = new Set([from, to]);
  for (const p of people) {
    for (const r of [...p.present, ...p.onCall]) {
      if (r.start > from && r.start < to) cuts.add(r.start);
      if (r.end > from && r.end < to) cuts.add(r.end);
    }
  }
  const points = [...cuts].sort((a, b) => a - b);
  const segments: AvailabilitySegment[] = [];
  for (let i = 0; i + 1 < points.length; i++) {
    const start = points[i]!;
    const end = points[i + 1]!;
    const present = people.filter((p) => covers(p.present, start)).map((p) => p.name);
    const onCall = people.filter((p) => covers(p.onCall, start)).map((p) => p.name);
    const last = segments[segments.length - 1];
    if (
      last &&
      last.present.join("\n") === present.join("\n") &&
      last.onCall.join("\n") === onCall.join("\n")
    ) {
      last.end = end;
    } else {
      segments.push({ start, end, present, onCall });
    }
  }
  return segments;
}

/**
 * Short labels for chips: two letters of a one-word name ("Noah" -> "No",
 * so Alice and Aniya stay apart), initials of a longer one ("Mary Ann" ->
 * "MA"). Still-equal labels get one more letter.
 */
export function shortNames(names: readonly string[]): Map<string, string> {
  const base = (name: string, extra: number) => {
    const words = name.trim().split(/\s+/).filter(Boolean);
    const first = words[0] ?? "";
    if (words.length > 1) {
      return words.map((w) => w.charAt(0).toUpperCase()).join("") + first.slice(1, 1 + extra);
    }
    return first.charAt(0).toUpperCase() + first.slice(1, 2 + extra);
  };
  const out = new Map<string, string>();
  for (const name of names) {
    let extra = 0;
    let label = base(name, extra);
    while ([...out.values()].includes(label) && extra < name.length) {
      extra += 1;
      label = base(name, extra);
    }
    out.set(name, label);
  }
  return out;
}

/**
 * The span of the day the availability timetable shows, in whole hours:
 * the run of show's own hours, stretched to fit every window that starts or
 * ends inside the day ("All day" alone doesn't stretch it). The whole day
 * when there's nothing to go on.
 */
export function availabilityWindow(
  availability: SponAvailability,
  day: RunOfShowDay,
  itemSpans: readonly MinuteRange[],
): MinuteRange {
  const edges: number[] = [];
  for (const r of itemSpans) edges.push(r.start, r.end);
  const all = [
    ...availability.required[day],
    ...availability.organizers.flatMap((o) => [
      ...o.available[day],
      ...o.shifts[day],
      ...o.onCall[day],
      ...o.away[day],
    ]),
  ];
  for (const r of all) {
    if (r.start > 0) edges.push(r.start);
    if (r.end < DAY_MINUTES) edges.push(r.end);
  }
  if (edges.length === 0) return { start: 0, end: DAY_MINUTES };
  const start = Math.floor(Math.min(...edges) / 60) * 60;
  const end = Math.ceil(Math.max(...edges) / 60) * 60;
  return end > start ? { start, end } : { start: 0, end: DAY_MINUTES };
}
