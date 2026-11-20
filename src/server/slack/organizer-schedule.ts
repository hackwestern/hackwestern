import { organizerRemindersCopy as copy } from "~/content/organizer-reminders";
import { escapeSlackText } from "./client";

/**
 * Organizer reminders from the HW13 Run of Show sheet ("Schedule View" tab).
 * Each task's owners get a Slack DM 15 minutes before the task's row time.
 * Pure parsing and planning; scripts/organizer-notifications.ts reads the
 * sheet and queues the DMs with syncMarketingReminders.
 */

export const ORGANIZER_LEAD_MINUTES = 15;
/** Every organizer reminder key starts with this (shared reminder table). */
export const ORGANIZER_KEY_PREFIX = "organizer:";

const DAY_DATES = {
  FRIDAY: "2026-11-20",
  SATURDAY: "2026-11-21",
  SUNDAY: "2026-11-22",
} as const;
type Day = keyof typeof DAY_DATES;
const DAYS = Object.keys(DAY_DATES) as Day[];

/** Other spellings the sheet uses for roster names. */
const NAME_ALIASES: Record<string, string> = {
  brittany: "Brittney",
  lucus: "Lucas",
  luca: "Luka",
  lucian: "Luka",
};
/**
 * Roster names that aren't the contact's first name, or that two contacts
 * share. Value: the contact's full name on the HW13 Contacts sheet.
 */
export const NICKNAMES: Record<string, string> = {
  Luka: "Lucian Lavric",
  // Slack shows Jessica Xing as "Jess Xing"; bare "Jessica" is Jessica Wang.
  Jess: "Jessica Xing",
  Jessica: "Jessica Wang",
};
/** Slack ids for people whose contact email isn't their Slack email. */
export const KNOWN_SLACK_IDS: Record<string, string> = {
  Lillian: "U0CHQ926BCL", // Slack account uses her uwo.ca email
};
/** Owner-line words that mean a whole team (Position column, minus "Lead"). */
const TEAM_WORDS: Record<string, string> = {
  spon: "Sponsorship",
  sponsorship: "Sponsorship",
  web: "Web",
  events: "Events",
  marketing: "Marketing",
  design: "Design",
};
const EVERYONE = /\b(everyone|all (available )?organizers)\b/i;
const OWNER_LINE =
  /^(owners?|dock crew|emcees|horses|crew|leads?)\s*:\s*(.*)$/i;
const ROLE_LINE = /^([A-Za-z]+)\s*:/;
const CLOCK = /^(\d{1,2}):(\d{2})\s*([AP]M)$/i;
const OVERNIGHT_LINE =
  /^(\d{1,2}):(\d{2})\s*[–-]\s*\d{1,2}:\d{2}\s*([AP]M)\s*:\s*(.+)$/i;
/** Same person, similar title, this close after: a repeated row, not a new task. */
const CONTINUATION_MS = 2 * 60 * 60_000;

export type OrganizerTask = {
  id: string;
  at: Date;
  title: string;
  details: string[];
  owners: string[];
  /** Whole teams the owner line names ("Spon"); their members are in owners. */
  teams: string[];
  everyone: boolean;
};
export type SkippedCell = { at: Date; title: string; reason: string };
export type UnrecognizedOwners = { at: Date; title: string; names: string[] };

function minutesOf(clock: string): number | null {
  const m = CLOCK.exec(clock.trim());
  if (!m) return null;
  const h = Number(m[1]) % 12;
  return (m[3]!.toUpperCase() === "PM" ? h + 12 : h) * 60 + Number(m[2]);
}

function instant(day: Day, minutes: number): Date {
  // November is EST (UTC-5) all weekend.
  return new Date(
    new Date(`${DAY_DATES[day]}T00:00:00-05:00`).getTime() + minutes * 60_000,
  );
}

function idFor(day: Day, minutes: number, column: string) {
  const hhmm =
    `${Math.floor(minutes / 60)}`.padStart(2, "0") +
    `${minutes % 60}`.padStart(2, "0");
  return `${day.slice(0, 3).toLowerCase()}-${hhmm}-${column}`;
}

/** An organizer from the HW13 Contacts sheet, under their run-of-show name. */
export type Person = {
  /** The name the run of show uses ("Luka"). */
  name: string;
  fullName: string;
  team: string;
  emails: string[];
};

/**
 * The Contacts sheet (Name, Position, Email columns), keyed to the run of
 * show's names: a roster name matches the one contact with that first name,
 * or the contact NICKNAMES names. A roster name two contacts share (and no
 * NICKNAMES entry) is left unmatched. Contacts not on the roster keep their
 * first name, so team pings still reach them.
 */
export function readContacts(
  grid: string[][],
  roster: string[],
  nicknames: Record<string, string> = NICKNAMES,
): { people: Person[]; unmatched: string[] } {
  const headerAt = grid.findIndex((row) => row[0]?.trim() === "Name");
  const header = grid[headerAt]?.map((cell) => cell.trim().toLowerCase());
  const col = (name: string) => header?.indexOf(name) ?? -1;
  if (!header || col("position") < 0 || col("email") < 0) {
    throw new Error("Contacts sheet needs Name, Position and Email columns");
  }
  const contacts = grid
    .slice(headerAt + 1)
    .map((row) => ({
      fullName: (row[0] ?? "").trim().replace(/\s+/g, " "),
      team: (row[col("position")] ?? "")
        .replace(/\blead\b/i, "")
        .replace(/^co-/i, "")
        .trim(),
      emails: (row[col("email")] ?? "")
        .split(/[\s/,]+/)
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)),
    }))
    .filter((contact) => contact.fullName);
  const first = (fullName: string) => fullName.split(" ")[0]!.toLowerCase();
  const people: Person[] = [];
  const unmatched: string[] = [];
  const claimed = new Set<string>();
  for (const name of roster) {
    const nickname = nicknames[name]?.toLowerCase();
    const matches = nickname
      ? contacts.filter((c) => c.fullName.toLowerCase() === nickname)
      : contacts.filter((c) => first(c.fullName) === name.toLowerCase());
    if (matches.length !== 1) {
      unmatched.push(name);
      continue;
    }
    claimed.add(matches[0]!.fullName);
    people.push({ name, ...matches[0]! });
  }
  for (const contact of contacts) {
    // Unmatched roster names can't borrow a contact; a shared first name
    // would DM the wrong person.
    if (claimed.has(contact.fullName)) continue;
    const name = contact.fullName.split(" ")[0]!;
    if (roster.includes(name)) continue;
    people.push({ name, ...contact });
  }
  return { people, unmatched };
}

type Directory = {
  roster: Map<string, string>;
  /** Who "Everyone" means: the run of show's roster, not every contact. */
  everyone: string[];
  fullNames: Map<string, string>;
  teams: Map<string, string[]>;
};

/** Roster names in free text ("Emily Liu, Spon" -> Emily + the Sponsorship team). */
function namesIn(text: string, dir: Directory) {
  const names = new Set<string>();
  const teams = new Set<string>();
  // Full names first, so "Jessica Wang" never falls back to a bare "Jessica".
  let rest = text;
  for (const [full, name] of dir.fullNames) {
    const pattern = new RegExp(`\\b${full.replace(/ /g, "\\s+")}\\b`, "gi");
    if (pattern.test(rest)) {
      names.add(name);
      rest = rest.replace(pattern, " ");
    }
  }
  // "Caroline (Spon track winners)": a bracketed note isn't a team owner.
  const outside = new Set(
    rest
      .replace(/\([^)]*\)/g, " ")
      .toLowerCase()
      .split(/[^a-z']+/),
  );
  for (const token of rest.split(/[^A-Za-z']+/)) {
    const key = token.toLowerCase();
    const name = dir.roster.get(key) ?? NAME_ALIASES[key];
    if (name && dir.roster.has(name.toLowerCase())) names.add(name);
    const team = TEAM_WORDS[key];
    if (team && dir.teams.has(team) && outside.has(key)) {
      teams.add(team);
      dir.teams.get(team)!.forEach((member) => names.add(member));
    }
  }
  return { names: [...names], teams: [...teams] };
}

/** One task cell: title (first line), owners, and the remaining lines. */
function parseCell(text: string, dir: Directory) {
  const [title = "", ...rest] = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const owners = new Set<string>();
  const teams = new Set<string>();
  const details: string[] = [];
  const unknown: string[] = [];
  const except = new Set<string>();
  let ownerText: string | null = null;
  let everyone = false;
  for (const line of rest) {
    const owner = OWNER_LINE.exec(line);
    if (owner) {
      ownerText = ownerText ? `${ownerText}, ${owner[2]}` : owner[2]!;
      // "Everyone except Sarina, Daniel": names after "except" are left out.
      const [included = "", excluded] = owner[2]!.split(/\bexcept\b/i);
      const found = namesIn(included, dir);
      found.names.forEach((n) => owners.add(n));
      found.teams.forEach((t) => teams.add(t));
      if (EVERYONE.test(included)) everyone = true;
      if (excluded) namesIn(excluded, dir).names.forEach((n) => except.add(n));
      // Each "a, b / c and d" part that names nobody gets no DM: report it.
      for (const part of owner[2]!
        .replace(/\([^)]*\)/g, " ")
        .split(/,|\/|&|\band\b/i)) {
        const clean = part.trim();
        if (!clean || EVERYONE.test(clean)) continue;
        const hit = namesIn(clean, dir);
        if (hit.names.length === 0 && hit.teams.length === 0) {
          unknown.push(clean);
        }
      }
      continue;
    }
    // "Jasmine: Run the judging platform" names an owner too.
    const role = ROLE_LINE.exec(line);
    const named = role ? dir.roster.get(role[1]!.toLowerCase()) : undefined;
    if (named) owners.add(named);
    details.push(line);
  }
  if (!ownerText && EVERYONE.test(text)) everyone = true;
  if (everyone) dir.everyone.forEach((name) => owners.add(name));
  except.forEach((name) => owners.delete(name));
  return {
    title,
    details,
    owners: [...owners],
    teams: [...teams],
    ownerText,
    unknown,
    everyone,
  };
}

/** Everyone named in the Schedule View's "Free" column. */
export function readRoster(grid: string[][]): string[] {
  const headerAt = grid.findIndex((row) => row[0]?.trim() === "Time");
  const freeColumn = grid[headerAt]?.findIndex(
    (cell) => cell.trim() === "Free",
  );
  if (freeColumn === undefined || freeColumn < 0) {
    throw new Error(
      'Run of show has no "Time" header row with a "Free" column',
    );
  }
  const roster = new Set<string>();
  for (const row of grid.slice(headerAt + 1)) {
    for (const name of (row[freeColumn] ?? "").split(",")) {
      const clean = name.trim();
      if (/^[A-Za-z]+$/.test(clean) && clean.toLowerCase() !== "none") {
        roster.add(clean);
      }
    }
  }
  if (roster.size === 0) throw new Error('No names in the "Free" column');
  return [...roster].sort();
}

/**
 * Tasks from the Schedule View grid. Days come from the FRIDAY/SATURDAY
 * header rows, or roll over when the time jumps back by hours (Sunday has
 * no header). `people` (from readContacts) adds full names and teams.
 */
export function readRunOfShow(
  grid: string[][],
  people: Person[] = [],
): {
  roster: string[];
  tasks: OrganizerTask[];
  skipped: SkippedCell[];
  /** Tasks that still go out, but name someone the bot can't place. */
  unrecognized: UnrecognizedOwners[];
} {
  const headerAt = grid.findIndex((row) => row[0]?.trim() === "Time");
  const header = grid[headerAt]!;
  const rosterList = readRoster(grid);
  const freeColumn = header.findIndex((cell) => cell.trim() === "Free");
  const eventColumns = header
    .map((cell, index) => ({ cell: cell.trim(), index }))
    .filter(({ cell, index }) => index > 0 && index < freeColumn && cell)
    .map(({ index }) => index);

  const roster = new Map(rosterList.map((name) => [name.toLowerCase(), name]));
  const teams = new Map<string, string[]>();
  for (const person of people) {
    roster.set(person.name.toLowerCase(), person.name);
    if (person.team) {
      teams.set(person.team, [...(teams.get(person.team) ?? []), person.name]);
    }
  }
  const dir: Directory = {
    roster,
    everyone: rosterList,
    teams,
    fullNames: new Map(
      people
        .filter((p) => p.fullName.includes(" "))
        .map((p) => [p.fullName.toLowerCase(), p.name]),
    ),
  };
  const tasks: OrganizerTask[] = [];
  const skipped: SkippedCell[] = [];
  const unrecognized: UnrecognizedOwners[] = [];
  let day: Day | null = null;
  let last: number | null = null;
  for (const row of grid.slice(headerAt + 1)) {
    const first = row[0]?.trim() ?? "";
    const heading = DAYS.find((d) => d === first.toUpperCase());
    if (heading) {
      day = heading;
      last = null;
      continue;
    }
    const minutes = minutesOf(first);
    if (minutes !== null && day) {
      if (last !== null && minutes < last - 6 * 60) {
        day = DAYS[DAYS.indexOf(day) + 1] ?? day;
      }
      last = minutes;
      for (const column of eventColumns) {
        const text = row[column]?.trim();
        if (!text) continue;
        const cell = parseCell(text, dir);
        const at = instant(day, minutes);
        if (cell.owners.length === 0) {
          // Banner rows ("HACKING STARTS") have no owner line; skip quietly.
          if (cell.ownerText !== null || cell.details.length > 0) {
            skipped.push({
              at,
              title: cell.title,
              reason:
                cell.ownerText === null
                  ? "no owner listed"
                  : `no organizer named in "${cell.ownerText}"`,
            });
          }
          continue;
        }
        if (cell.unknown.length) {
          unrecognized.push({ at, title: cell.title, names: cell.unknown });
        }
        tasks.push({
          id: idFor(day, minutes, `c${column}`),
          at,
          title: cell.title,
          details: cell.details,
          owners: cell.owners,
          teams: cell.teams,
          everyone: cell.everyone,
        });
      }
      continue;
    }
    // "Friday night to Saturday morning | Overnight coverage" notes.
    if (/overnight coverage/i.test(first)) {
      const target =
        DAYS.find((d) => new RegExp(`to ${d} morning`, "i").test(first)) ?? day;
      if (!target) continue;
      for (const line of first.split(/\r?\n/).map((l) => l.trim())) {
        const m = OVERNIGHT_LINE.exec(line);
        if (!m) continue;
        const start = minutesOf(`${m[1]}:${m[2]} ${m[3]}`)!;
        // "...then Holia takes over as backup from 4:00 to 5:00 AM": that
        // clause's people start at 4:00, not at the block's start.
        const byStart = new Map<number, Set<string>>();
        for (const clause of m[4]!.split(/[.;]|,\s*then\b/i)) {
          const from = /\bfrom (\d{1,2}):(\d{2})/i.exec(clause);
          const at = from
            ? (minutesOf(`${from[1]}:${from[2]} ${m[3]}`) ?? start)
            : start;
          const names = byStart.get(at) ?? new Set<string>();
          namesIn(clause, dir).names.forEach((n) => names.add(n));
          byStart.set(at, names);
        }
        const claimed = new Set<string>();
        for (const [at, names] of [...byStart].sort(([a], [b]) => b - a)) {
          // A later clause wins: Holia isn't also on at midnight.
          const owners = [...names].filter((n) => !claimed.has(n));
          owners.forEach((n) => claimed.add(n));
          if (owners.length === 0) continue;
          tasks.push({
            id: idFor(target, at, "overnight"),
            at: instant(target, at),
            title: "Overnight coverage",
            details: [line],
            owners,
            teams: [],
            everyone: false,
          });
        }
      }
    }
  }
  return { roster: rosterList, tasks, skipped, unrecognized };
}

const zone = "America/Toronto";
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: zone,
  hour: "numeric",
  minute: "2-digit",
  hour12: true,
});
const weekday = new Intl.DateTimeFormat("en-US", {
  timeZone: zone,
  weekday: "short",
});
const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: zone });

function when(date: Date, relativeTo: Date) {
  return dayKey.format(date) === dayKey.format(relativeTo)
    ? clock.format(date)
    : `${weekday.format(date)} ${clock.format(date)}`;
}

const normalTitle = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type OrganizerReminder = {
  reminderKey: string;
  recipientName: string;
  postAt: Date;
  taskIds: string[];
  text: string;
};

function formatReminder(
  name: string,
  group: OrganizerTask[],
  next: OrganizerTask | undefined,
  lead: number,
): string {
  const at = group[0]!.at;
  const time = clock.format(at);
  const lines = [
    group.length === 1
      ? copy.slack.header(lead, time, escapeSlackText(group[0]!.title))
      : copy.slack.headerMany(lead, time, group.length),
  ];
  for (const task of group) {
    if (group.length > 1)
      lines.push(copy.slack.item(escapeSlackText(task.title)));
    lines.push(...task.details.map((line) => `> ${escapeSlackText(line)}`));
    const others = task.owners.filter((owner) => owner !== name);
    if (task.everyone) lines.push(copy.slack.everyone);
    else if (task.teams.length)
      lines.push(
        copy.slack.withTeams(task.teams.join(" + "), others.join(", ")),
      );
    else if (others.length) lines.push(copy.slack.with(others.join(", ")));
  }
  lines.push(
    next
      ? copy.slack.next(when(next.at, at), escapeSlackText(next.title))
      : copy.slack.last,
  );
  return lines.join("\n");
}

/** Slack channels for teams; a task owned by the team is posted there too. */
export const TEAM_CHANNELS: Record<string, string> = {
  Events: "C0CKJGX7674",
  Web: "C0CKLJXB1SM",
};

export type TeamPost = {
  team: string;
  channel: string;
  postAt: Date;
  text: string;
};

/**
 * A channel post for each task whose owner line names a team with a channel
 * ("Owner: Pranav (lead), WEB"), `lead` minutes before, alongside the DMs.
 * A repeated row for the same task within two hours is posted once.
 */
export function planTeamPosts(
  tasks: OrganizerTask[],
  options: { lead?: number; channels?: Record<string, string> } = {},
): TeamPost[] {
  const lead = options.lead ?? ORGANIZER_LEAD_MINUTES;
  const channels = options.channels ?? TEAM_CHANNELS;
  const posts: TeamPost[] = [];
  const posted: { team: string; at: number; title: string }[] = [];
  for (const task of [...tasks].sort((a, b) => +a.at - +b.at)) {
    for (const team of task.teams) {
      const channel = channels[team];
      if (!channel) continue;
      const title = normalTitle(task.title);
      const repeat = posted.some(
        (p) =>
          p.team === team &&
          +task.at - p.at <= CONTINUATION_MS &&
          (title.startsWith(p.title) || p.title.startsWith(title)),
      );
      if (repeat) continue;
      posted.push({ team, at: +task.at, title });
      const lines = [
        copy.slack.header(
          lead,
          clock.format(task.at),
          escapeSlackText(task.title),
        ),
        ...task.details.map((line) => `> ${escapeSlackText(line)}`),
        copy.slack.teamLine(team, task.owners.join(", ")),
      ];
      posts.push({
        team,
        channel,
        postAt: new Date(+task.at - lead * 60_000),
        text: lines.join("\n"),
      });
    }
  }
  return posts;
}

/**
 * One DM per person per row time (tasks at the same time share a DM),
 * posted `lead` minutes before. A repeated row for the same task (same
 * person, a title that starts the same, within two hours) is dropped.
 */
export function planOrganizerReminders(
  tasks: OrganizerTask[],
  options: { skipNames?: ReadonlySet<string>; lead?: number } = {},
): OrganizerReminder[] {
  const lead = options.lead ?? ORGANIZER_LEAD_MINUTES;
  const skip = options.skipNames ?? new Set<string>();
  const sorted = [...tasks].sort((a, b) => +a.at - +b.at);
  const byPerson = new Map<string, OrganizerTask[]>();
  for (const task of sorted) {
    for (const owner of task.owners) {
      if (skip.has(owner.toLowerCase())) continue;
      const kept = byPerson.get(owner) ?? [];
      const title = normalTitle(task.title);
      const repeat = kept.some((earlier) => {
        const other = normalTitle(earlier.title);
        return (
          +task.at - +earlier.at <= CONTINUATION_MS &&
          (title.startsWith(other) || other.startsWith(title))
        );
      });
      if (!repeat) kept.push(task);
      byPerson.set(owner, kept);
    }
  }
  const reminders: OrganizerReminder[] = [];
  for (const [name, kept] of byPerson) {
    const times = [...new Set(kept.map((task) => +task.at))];
    for (const time of times) {
      const group = kept.filter((task) => +task.at === time);
      const at = new Date(time);
      reminders.push({
        reminderKey: `${ORGANIZER_KEY_PREFIX}${name}:${at.toISOString()}`,
        recipientName: name,
        postAt: new Date(time - lead * 60_000),
        taskIds: group.map((task) => `${name}/${task.id}`),
        text: formatReminder(
          name,
          group,
          kept.find((task) => +task.at > time),
          lead,
        ),
      });
    }
  }
  return reminders.sort(
    (a, b) =>
      +a.postAt - +b.postAt || a.recipientName.localeCompare(b.recipientName),
  );
}
