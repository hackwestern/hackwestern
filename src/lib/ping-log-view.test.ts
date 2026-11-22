import { describe, expect, test } from "vitest";

import { autoPingEntries, type PingEntry } from "~/lib/ping-log";
import {
  buildRows,
  chipCounts,
  filterRows,
  groupByBucket,
  healthSummary,
  matchesSearch,
  minutesAway,
  nextSort,
  reachMap,
  sortRows,
  sourcesOf,
  type PingFilter,
} from "~/lib/ping-log-view";

const NOW = +new Date("2026-11-21T12:00:00-05:00");
const at = (hhmm: string, day = 21) =>
  new Date(`2026-11-${day}T${hhmm}:00-05:00`);

const entry = (over: Partial<PingEntry> = {}): PingEntry => ({
  kind: "organizer",
  at: at("11:00"),
  to: "Noah",
  about: "Coming up: Doors open",
  status: "organizer.sent",
  tone: "ok",
  ...over,
});

const ENTRIES: PingEntry[] = [
  entry(),
  entry({
    at: at("12:30"),
    about: "Coming up: Lunch",
    status: "organizer.queued",
    tone: "waiting",
  }),
  entry({
    at: at("13:00"),
    to: "Zoë",
    about: "Coming up: Workshop setup",
    status: "organizer.notQueued",
    tone: "problem",
  }),
  entry({
    at: at("12:15"),
    to: "#Events",
    about: "Coming up: Lunch",
    status: "organizer.queued",
    tone: "waiting",
  }),
  entry({
    kind: "autoPing",
    at: at("09:00"),
    to: "Maya Chen",
    group: "Mentor",
    about: "Check-in: Mentor",
    status: "autoPing.sent",
  }),
  entry({
    kind: "coffee",
    at: at("21:00", 20),
    to: "Sam Lee",
    about: "Acme · 9:30 PM",
    status: "coffee.expired",
    tone: "problem",
  }),
  entry({
    kind: "task",
    at: at("14:00"),
    to: "[SPON] Noah",
    about: "Swag table",
    status: "scheduled.cancelled",
    tone: "done",
  }),
];
const rows = buildRows(ENTRIES, { now: NOW });
const filter = (over: Partial<PingFilter> = {}): PingFilter => ({
  search: "",
  view: "focus",
  source: "all",
  ...over,
});
const titles = (list: { to: string; about: string }[]) =>
  list.map((r) => `${r.to}: ${r.about}`);

describe("buildRows", () => {
  test("buckets by tone and time; cancelled is its own bucket", () => {
    expect(rows.map((r) => r.bucket)).toEqual([
      "sent",
      "upcoming",
      "problem",
      "upcoming",
      "sent",
      "problem",
      "off",
    ]);
  });

  test("ids are unique even for identical pings", () => {
    const twice = buildRows([entry(), entry()], { now: NOW });
    expect(new Set(twice.map((r) => r.id)).size).toBe(2);
  });

  test("a ping to someone unreachable is a problem, sent or not", () => {
    const reach = reachMap([
      { name: "Noah", reach: "noSlack" },
      { name: "Zoë", reach: "ok" },
    ]);
    const built = buildRows(ENTRIES.slice(0, 3), { now: NOW, reach });
    expect(built.map((r) => [r.status, r.bucket])).toEqual([
      ["organizer.missed.noSlack", "problem"],
      ["organizer.unreachable.noSlack", "problem"],
      ["organizer.notQueued", "problem"],
    ]);
  });
});

describe("sourcesOf", () => {
  test("team channels, DMs and Auto-Ping roles", () => {
    expect(sourcesOf(entry())).toEqual(["organizer"]);
    expect(sourcesOf(entry({ to: "#Events" }))).toEqual(["team"]);
    expect(
      sourcesOf(entry({ kind: "autoPing", group: "Mentor + Volunteer" })),
    ).toEqual(["mentor", "volunteer"]);
    expect(sourcesOf(entry({ kind: "autoPing", group: "Judge" }))).toEqual([
      "judge",
    ]);
    expect(sourcesOf(entry({ kind: "coffee" }))).toEqual(["coffee"]);
  });
});

describe("matchesSearch", () => {
  const find = (search: string) =>
    titles(rows.filter((r) => matchesSearch(r, search)));

  test("by person, ignoring case and accents", () => {
    expect(find("zoe")).toEqual(["Zoë: Coming up: Workshop setup"]);
    expect(find("  NOAH ")).toHaveLength(3);
  });

  test("by task title, and every word has to match", () => {
    expect(find("lunch")).toEqual([
      "Noah: Coming up: Lunch",
      "#Events: Coming up: Lunch",
    ]);
    expect(find("noah lunch")).toEqual(["Noah: Coming up: Lunch"]);
    expect(find("noah judging")).toEqual([]);
  });

  test("by role and by channel; the message body is left out", () => {
    expect(find("mentor")).toEqual(["Maya Chen: Check-in: Mentor"]);
    expect(find("#events")).toEqual(["#Events: Coming up: Lunch"]);
    const withBody = buildRows([entry({ detail: "Ask Zoe for the keys" })], {
      now: NOW,
    });
    expect(matchesSearch(withBody[0]!, "zoe")).toBe(false);
  });
});

describe("filterRows", () => {
  test("the default view is upcoming plus recent problems", () => {
    expect(titles(filterRows(rows, filter(), NOW))).toEqual([
      "Noah: Coming up: Lunch",
      "Zoë: Coming up: Workshop setup",
      "#Events: Coming up: Lunch",
    ]);
  });

  test("Problems keeps old ones the default view leaves out", () => {
    expect(titles(filterRows(rows, filter({ view: "problem" }), NOW))).toEqual([
      "Zoë: Coming up: Workshop setup",
      "Sam Lee: Acme · 9:30 PM",
    ]);
  });

  test("Sent, All, and a source", () => {
    expect(filterRows(rows, filter({ view: "sent" }), NOW)).toHaveLength(2);
    expect(filterRows(rows, filter({ view: "all" }), NOW)).toHaveLength(7);
    expect(
      titles(filterRows(rows, filter({ view: "all", source: "team" }), NOW)),
    ).toEqual(["#Events: Coming up: Lunch"]);
    expect(
      titles(filterRows(rows, filter({ view: "all", source: "mentor" }), NOW)),
    ).toEqual(["Maya Chen: Check-in: Mentor"]);
  });
});

describe("chipCounts", () => {
  test("each chip counts what it would show", () => {
    const counts = chipCounts(rows, filter(), NOW);
    expect(counts.views).toEqual({
      focus: 3,
      problem: 2,
      upcoming: 2,
      sent: 2,
      all: 7,
    });
    expect(counts.allSources).toBe(3);
    expect(counts.sources.organizer).toBe(2);
    expect(counts.sources.team).toBe(1);
    expect(counts.sources.coffee).toBe(0);
  });

  test("counts follow the search and the other chip row", () => {
    const counts = chipCounts(
      rows,
      filter({ search: "noah", view: "all", source: "organizer" }),
      NOW,
    );
    expect(counts.views).toEqual({
      focus: 1,
      problem: 0,
      upcoming: 1,
      sent: 1,
      all: 2,
    });
    expect(counts.sources.task).toBe(1);
    expect(counts.allSources).toBe(3);
  });
});

describe("sortRows", () => {
  test("default: problems, then upcoming soonest, then sent newest", () => {
    expect(titles(sortRows(rows, null, NOW))).toEqual([
      "Zoë: Coming up: Workshop setup",
      "Sam Lee: Acme · 9:30 PM",
      "#Events: Coming up: Lunch",
      "Noah: Coming up: Lunch",
      "Noah: Coming up: Doors open",
      "Maya Chen: Check-in: Mentor",
      "[SPON] Noah: Swag table",
    ]);
  });

  test("by time and status, both ways", () => {
    const times = (dir: "asc" | "desc") =>
      sortRows(rows, { key: "time", dir }, NOW).map((r) => +r.at);
    expect(times("asc")).toEqual([...times("asc")].sort((a, b) => a - b));
    expect(times("desc")).toEqual([...times("asc")].reverse());
    const byStatus = (dir: "asc" | "desc") =>
      sortRows(rows, { key: "status", dir }, NOW).map((r) => r.bucket);
    expect(byStatus("asc")[0]).toBe("problem");
    expect(byStatus("desc")[0]).toBe("off");
  });

  test("by person, A to Z and back, ignoring accents", () => {
    const people = buildRows(
      [entry({ to: "Zoë" }), entry({ to: "noah" }), entry({ to: "Ava" })],
      { now: NOW },
    );
    const names = (dir: "asc" | "desc") =>
      sortRows(people, { key: "to", dir }, NOW).map((r) => r.to);
    expect(names("asc")).toEqual(["Ava", "noah", "Zoë"]);
    expect(names("desc")).toEqual(["Zoë", "noah", "Ava"]);
  });

  test("leaves the list it was given in place", () => {
    const before = titles(rows);
    sortRows(rows, { key: "to", dir: "desc" }, NOW);
    expect(titles(rows)).toEqual(before);
  });
});

describe("nextSort", () => {
  test("press, flip, clear", () => {
    const first = nextSort(null, "time");
    expect(first).toEqual({ key: "time", dir: "desc" });
    const second = nextSort(first, "time");
    expect(second).toEqual({ key: "time", dir: "asc" });
    expect(nextSort(second, "time")).toBeNull();
    expect(nextSort(first, "to")).toEqual({ key: "to", dir: "asc" });
  });
});

describe("groupByBucket", () => {
  test("cuts the default order into sections", () => {
    expect(
      groupByBucket(sortRows(rows, null, NOW)).map((g) => [
        g.bucket,
        g.rows.length,
      ]),
    ).toEqual([
      ["problem", 2],
      ["upcoming", 2],
      ["sent", 2],
      ["off", 1],
    ]);
  });
});

describe("minutesAway", () => {
  test("ahead is positive, past is negative", () => {
    expect(minutesAway(at("12:15"), NOW)).toBe(15);
    expect(minutesAway(at("11:30"), NOW)).toBe(-30);
  });
});

describe("healthSummary", () => {
  test("counts people, not team channels", () => {
    const person = (name: string, over = {}) => ({
      name,
      reach: "ok" as const,
      received: 3,
      missed: 0,
      upcoming: 2,
      atRisk: 0,
      ...over,
    });
    const summary = healthSummary([
      person("Noah"),
      person("Zoë", { reach: "noSlack", missed: 2, atRisk: 1 }),
      person("#Events", { atRisk: 4 }),
    ]);
    expect(summary.people).toBe(2);
    expect(summary.unreachable.map((p) => p.name)).toEqual(["Zoë"]);
    expect(summary.missedTotal).toBe(2);
    expect(summary.atRisk).toBe(1);
  });
});

describe("autoPingEntries", () => {
  const row = (over = {}) => ({
    role: "Volunteer",
    name: "Ava Patel",
    email: "ava@example.com",
    message: "Shift reminder",
    postAt: "2026-11-21T18:00:00.000Z",
    hash: "abc",
    status: "scheduled",
    updated: "2026-11-21T15:00:00.000Z",
    ...over,
  });

  test("queued, sent, held and not on Slack", () => {
    const entries = autoPingEntries(
      [
        row(),
        row({ postAt: "2026-11-21T16:00:00.000Z" }),
        row({ status: "held", hash: "{hackers}" }),
        row({ status: "not-on-slack", message: "", postAt: "", name: "" }),
        row({ status: "cancelled" }),
      ],
      NOW,
    );
    expect(entries.map((e) => [e.status, e.tone])).toEqual([
      ["autoPing.scheduled", "waiting"],
      // Its time passed before the next bot pass marked it: it went out.
      ["autoPing.sent", "ok"],
      ["autoPing.held", "problem"],
      ["autoPing.not-on-slack", "problem"],
      ["autoPing.cancelled", "done"],
    ]);
    expect(entries[0]).toMatchObject({
      kind: "autoPing",
      to: "Ava Patel",
      group: "Volunteer",
      about: "Shift reminder",
    });
    expect(entries[2]!.detail).toBe("{hackers}");
    // No send time on a not-on-Slack row: dated by the last bot change.
    expect(entries[3]!.to).toBe("ava@example.com");
    expect(+entries[3]!.at).toBe(Date.parse("2026-11-21T15:00:00.000Z"));
  });
});
