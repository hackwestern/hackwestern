// Pure helpers for the venue broadcast display (/broadcast) and its admin page.

export type BroadcastActivity = {
  id: string;
  title: string;
  location: string;
  start: Date;
  end: Date;
};

// The event weekend is all EST (clocks fell back Nov 1), so -05:00.
const EASTERN_OFFSET = "-05:00";
const EASTERN_OFFSET_MS = 5 * 60 * 60 * 1000;
const EVENT_DAYS: Record<string, string> = {
  Friday: "2026-11-20",
  Saturday: "2026-11-21",
  Sunday: "2026-11-22",
};
const SLOT_MS = 30 * 60 * 1000;
// The countdown already covers these, so they aren't shown as activities.
const HACKING_MARKER = /^hacking (begins|ends)/i;

type Merge = {
  startRowIndex: number;
  endRowIndex: number;
  startColumnIndex: number;
  endColumnIndex: number;
};

function slotTime(day: string, time: string): Date | null {
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(time);
  if (!match) return null;
  let hours = Number(match[1]) % 12;
  if (match[3]!.toUpperCase() === "PM") hours += 12;
  const hh = String(hours).padStart(2, "0");
  return new Date(`${day}T${hh}:${match[2]}:00${EASTERN_OFFSET}`);
}

function parseCell(text: string | undefined) {
  const lines = (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const title = lines[0];
  if (!title || /^location:/i.test(title) || HACKING_MARKER.test(title)) {
    return null;
  }
  const locationLine = lines.find((line) => /^location:/i.test(line));
  const location = locationLine?.replace(/^location:\s*/i, "") ?? "";
  return { title, location };
}

// Turns the Events schedule sheet (column A = time, B–J = tracks) into timed
// activities. A vertically merged cell is one activity spanning those slots;
// an unmerged cell is one 30-minute slot.
export function parseScheduleGrid(
  rows: string[][],
  merges: Merge[],
): BroadcastActivity[] {
  const slots: (Date | null)[] = [];
  let day: string | undefined;
  rows.forEach((row, r) => {
    const time = row[0]?.trim() ?? "";
    const label = row[1]?.trim() ?? "";
    const dayName = Object.keys(EVENT_DAYS).find((d) => label.startsWith(d));
    if (!time && dayName) day = EVENT_DAYS[dayName];
    slots[r] = day && time ? slotTime(day, time) : null;
  });

  const activities: BroadcastActivity[] = [];
  rows.forEach((row, r) => {
    const start = slots[r];
    if (!start) return;
    for (let c = 1; c < row.length; c++) {
      const cell = parseCell(row[c]);
      if (!cell) continue;
      const merge = merges.find(
        (m) => m.startRowIndex === r && m.startColumnIndex === c,
      );
      // Merges can run into a day or gap row, which has no time of its own.
      let last = merge ? merge.endRowIndex - 1 : r;
      while (last > r && !slots[last]) last--;
      const end = new Date(slots[last]!.getTime() + SLOT_MS);
      activities.push({ id: `${r}-${c}`, ...cell, start, end });
    }
  });
  return activities;
}

export function nowAndNext(activities: BroadcastActivity[], now: number) {
  const sorted = [...activities].sort(
    (a, b) =>
      a.start.getTime() - b.start.getTime() || a.title.localeCompare(b.title),
  );
  const current = sorted.filter(
    (a) => a.start.getTime() <= now && now < a.end.getTime(),
  );
  const upcoming = sorted.filter((a) => a.start.getTime() > now);
  const nextStart = upcoming[0]?.start.getTime();
  return {
    now: current,
    next: upcoming.filter((a) => a.start.getTime() === nextStart),
    done: !current.length && !upcoming.length,
  };
}

// Tied points share a rank and the following rank is skipped (1, 2, 2, 4).
export function rankLeaders<T extends { name: string; points: number }>(
  leaders: T[],
) {
  let rank = 0;
  let previous: number | undefined;
  return [...leaders]
    .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
    .map((leader, index) => {
      if (leader.points !== previous) rank = index + 1;
      previous = leader.points;
      return { ...leader, rank };
    });
}

// The name hackers gave on their application, then the account name. The
// display is public, so this never falls back to an email.
export function leaderName(
  accountName: string | null,
  firstName: string | null,
  lastName: string | null,
) {
  const applicationName = `${firstName ?? ""} ${lastName ?? ""}`.trim();
  // || on purpose: an empty name falls through too
  // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
  return applicationName || accountName?.trim() || "Hacker";
}

export function hackingPhase(
  start: Date | null,
  end: Date | null,
  now: number,
):
  | { phase: "unset" }
  | { phase: "before" | "during"; secondsLeft: number }
  | { phase: "after" } {
  if (!start || !end) return { phase: "unset" };
  const secondsUntil = (t: Date) => Math.ceil((t.getTime() - now) / 1000);
  if (now < start.getTime()) {
    return { phase: "before", secondsLeft: secondsUntil(start) };
  }
  if (now < end.getTime()) {
    return { phase: "during", secondsLeft: secondsUntil(end) };
  }
  return { phase: "after" };
}

// <input type="datetime-local"> values, read and written as Eastern time.
export function toEasternInput(date: Date | null) {
  if (!date) return "";
  return new Date(date.getTime() - EASTERN_OFFSET_MS)
    .toISOString()
    .slice(0, 16);
}

export function fromEasternInput(value: string) {
  return value ? new Date(`${value}:00${EASTERN_OFFSET}`) : null;
}
