import { beforeEach, describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";

import { parseOwners, type OpsTask } from "~/lib/ops-run-of-show";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import {
  flaggedOwners,
  getOpsOverview,
  parseTeamRoster,
  pingText,
  planOpsPings,
  resetOpsEmailCache,
  START_LEAD_MS,
  syncOpsPings,
  type OpsSheet,
  type OwnerContext,
} from "~/server/api/utils/ops-pings";
import { db } from "~/server/db";
import { opsPings, taskReminderSync, users } from "~/server/db/schema";
import { resetSlackOrganizersCache } from "~/server/slack/organizers";

// Saturday noon, Eastern. Tasks below are later the same day.
const NOW = new Date("2026-11-21T12:00:00-05:00");
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-05:00`);

function task(p: Partial<OpsTask> & { title: string; owner: string; start: string }): OpsTask {
  return {
    cell: p.cell ?? "B10",
    column: "Food",
    day: "Saturday",
    end: null,
    endSource: null,
    location: "Rm 1110",
    blurb: null,
    ...p,
    ownerText: p.owner,
    owners: parseOwners(p.owner),
  };
}

const sheetOf = (tasks: OpsTask[], sponRoster: string[] | null = ["Noah", "Caroline"]): OpsSheet => ({
  parsed: { tasks, issues: [], foundHeader: true },
  sponRoster,
  readAt: NOW.toISOString(),
});

// Slack people: organizers carry the [ORGANIZER] tag; hackers don't.
const MEMBERS = [
  { id: "U-JX", profile: { real_name: "[ORGANIZER] Jessica Xing" } },
  { id: "U-JW", profile: { real_name: "[ORGANIZER] Jessica Wang" } },
  { id: "U-NOAH", profile: { real_name: "[ORGANIZER] Noah Medland" } },
  { id: "U-CAR", profile: { real_name: "[ORGANIZER] Caroline Ge" } },
  { id: "U-EMILY", profile: { real_name: "[ORGANIZER] Emily Liu" } },
  { id: "U-SARA", profile: { real_name: "[ORGANIZER] Sara Kim" } },
  // Sarah Lieng is an organizer whose Slack name has no tag yet.
  { id: "U-SARAH", profile: { real_name: "Sarah Lieng" } },
  // A hacker who shares an organizer's name.
  { id: "U-HACKER", profile: { real_name: "Brittney Chong" } },
  { id: "U-BOT", is_bot: true, profile: { real_name: "[ORGANIZER] Bot" } },
];

type Call = { method: string; args: URLSearchParams };

/** A mocked Slack API. Nothing reaches Slack. */
function mockSlack(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let n = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).replace("https://slack.com/api/", "");
    const args = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ method, args });
    const defaults: Record<string, unknown> = {
      "users.list": { ok: true, members: MEMBERS },
      "users.lookupByEmail":
        args.get("email") === "brittney@hw.ca"
          ? { ok: true, user: { id: "U-BRIT" } }
          : { ok: false, error: "users_not_found" },
      "conversations.open": { ok: true, channel: { id: `D-${args.get("users")}` } },
      "chat.scheduleMessage": {
        ok: true,
        scheduled_message_id: `Q${++n}`,
        channel: args.get("channel"),
      },
      "chat.deleteScheduledMessage": { ok: true },
    };
    const body = answers[method] ?? defaults[method] ?? { ok: false };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return {
    fetch: fn as unknown as typeof fetch,
    calls,
    methods: () => calls.map((c) => c.method),
    scheduled: () => calls.filter((c) => c.method === "chat.scheduleMessage"),
    reset: () => calls.splice(0),
  };
}

beforeEach(async () => {
  await db.delete(opsPings).where(sql`true`);
  await db.delete(users).where(sql`true`);
  await db.delete(taskReminderSync).where(sql`true`);
  resetSlackOrganizersCache();
  resetOpsEmailCache();
});

const SLACK_ORGANIZERS = [
  { id: "U-JX", name: "Jessica Xing" },
  { id: "U-JW", name: "Jessica Wang" },
  { id: "U-NOAH", name: "Noah Medland" },
  { id: "U-CAR", name: "Caroline Ge" },
  { id: "U-ALI", name: "Alex Li" },
  { id: "U-AXU", name: "Alex Xu" },
  { id: "U-JG", name: "Jasmine Gu" },
  { id: "U-LL", name: "Lucian Lavric" },
  { id: "U-LW", name: "Lillian Wei" },
  { id: "U-SARA", name: "Sara Kim" },
];

const ctx = (over: Partial<OwnerContext> = {}): OwnerContext => ({
  slack: SLACK_ORGANIZERS,
  app: [],
  lookupEmail: null,
  sponRoster: ["Noah", "Caroline"],
  ...over,
});

describe("planOpsPings", () => {
  test("start ping 10 minutes before the start, end ping at the end", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Lunch", owner: "Jess", start: "13:00", end: "14:00" })]),
      ctx(),
      NOW,
    );
    expect(START_LEAD_MS).toBe(10 * 60_000);
    expect(plan.desired.map((d) => [d.kind, d.slackUserId, d.postAt.toISOString()])).toEqual([
      ["start", "U-JX", at("12:50").toISOString()],
      ["end", "U-JX", at("14:00").toISOString()],
    ]);
  });

  test("no end in the sheet: start ping only", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Lunch", owner: "Jess", start: "13:00" })]),
      ctx(),
      NOW,
    );
    expect(plan.desired.map((d) => d.kind)).toEqual(["start"]);
  });

  test("Everyone pings nobody; ALL OF SPON DMs the spon team, once each", async () => {
    const plan = await planOpsPings(
      sheetOf([
        task({ title: "Setup", owner: "Everyone", start: "13:00" }),
        task({ title: "Spon Intro", owner: "ALL OF SPON, Noah, Jess", start: "14:00" }),
      ]),
      ctx(),
      NOW,
    );
    expect(plan.tasks[0]!.recipients).toEqual([]);
    expect(plan.tasks[0]!.owners).toEqual([{ token: "Everyone", kind: "everyone" }]);
    expect(plan.tasks[1]!.recipients.map((r) => r.slackUserId)).toEqual(["U-NOAH", "U-CAR", "U-JX"]);
    expect(plan.desired.filter((d) => d.task === "Spon Intro")).toHaveLength(3);
  });

  test("the spon list unreadable: ALL OF SPON pings nobody and is flagged", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Sponsor Bay", owner: "ALL OF SPON", start: "13:00" })]),
      ctx({ sponRoster: null }),
      NOW,
    );
    expect(plan.tasks[0]!.owners).toEqual([
      { token: "ALL OF SPON", kind: "group", group: "spon", members: null },
    ]);
    expect(plan.desired).toEqual([]);
  });

  test("ambiguous and unmatched names are never DMed", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Cup Stacking", owner: "Alex, Anson Holia, All judges", start: "13:00" })]),
      ctx(),
      NOW,
    );
    expect(plan.tasks[0]!.owners).toEqual([
      { token: "Alex", kind: "person", status: "ambiguous", candidates: ["Alex Li", "Alex Xu"] },
      { token: "Anson Holia", kind: "person", status: "no-match" },
      { token: "All judges", kind: "person", status: "no-match" },
    ]);
    expect(plan.desired).toEqual([]);
  });

  test("aliases: Jess is Jessica Xing, Jessica is Jessica Wang, Lillian is Lillian Wei", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Cup Stacking", owner: "Jess, Jessica, Lillian", start: "13:00" })]),
      ctx(),
      NOW,
    );
    expect(
      plan.tasks[0]!.owners.map((o) => (o.kind === "person" && o.status === "matched" ? [o.token, o.name, o.via] : o)),
    ).toEqual([
      ["Jess", "Jessica Xing", "alias"],
      ["Jessica", "Jessica Wang", "alias"],
      ["Lillian", "Lillian Wei", "alias"],
    ]);
    expect(plan.tasks[0]!.recipients.map((r) => r.slackUserId)).toEqual(["U-JX", "U-JW", "U-LW"]);
  });

  test("WEB is a group: Jasmine Gu and Lucian Lavric each get a DM", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Cheat Check", owner: "Pranav Varma (lead), WEB", start: "13:00" })]),
      ctx(),
      NOW,
    );
    expect(plan.tasks[0]!.owners[1]).toMatchObject({
      token: "WEB",
      kind: "group",
      group: "team",
      members: [
        { token: "Jasmine Gu", status: "matched", slackUserId: "U-JG" },
        { token: "Lucian Lavric", status: "matched", slackUserId: "U-LL" },
      ],
    });
    expect(plan.tasks[0]!.recipients.map((r) => r.slackUserId)).toEqual(["U-JG", "U-LL"]);
  });

  test("a close Slack spelling loses to an organizer account with the exact name", async () => {
    const app = [{ id: "a-sarah", name: "Sarah Lieng", email: "sarah@hw.ca" }];
    // Sarah's own Slack account (no tag) is someone other than tagged "Sara".
    const plan = await planOpsPings(
      sheetOf([task({ title: "Photobooth", owner: "Sarah", start: "13:00" })]),
      ctx({ app, lookupEmail: async () => "U-SARAH" }),
      NOW,
    );
    expect(plan.tasks[0]!.owners).toEqual([
      { token: "Sarah", kind: "person", status: "ambiguous", candidates: ["Sara Kim", "Sarah Lieng"] },
    ]);
    expect(plan.desired).toEqual([]);

    // No Slack account found for Sarah's email: still not Sara's DM.
    const unknown = await planOpsPings(
      sheetOf([task({ title: "Photobooth", owner: "Sarah", start: "13:00" })]),
      ctx({ app, lookupEmail: async () => null }),
      NOW,
    );
    expect(unknown.desired).toEqual([]);

    // The account's email is the tagged Sara's: same person, so it's a match.
    const same = await planOpsPings(
      sheetOf([task({ title: "Photobooth", owner: "Sarah", start: "13:00" })]),
      ctx({ app, lookupEmail: async () => "U-SARA" }),
      NOW,
    );
    expect(same.tasks[0]!.owners[0]).toMatchObject({ status: "matched", slackUserId: "U-SARA", via: "close" });
  });

  test("a close spelling with no organizer account to check against is matched and flagged", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Photobooth", owner: "Sarah", start: "13:00" })]),
      ctx(),
      NOW,
    );
    expect(plan.tasks[0]!.owners[0]).toMatchObject({ status: "matched", name: "Sara Kim", via: "close" });
    expect(flaggedOwners(plan.tasks[0]!.owners)).toBe(1);
  });

  test("fallback: an organizer account in the app, then Slack by its email", async () => {
    const lookupEmail = vi.fn(async (email: string) =>
      email === "brittney@hw.ca" ? "U-BRIT" : null,
    );
    const plan = await planOpsPings(
      sheetOf([task({ title: "Therapy Dogs", owner: "Brittney, Aleeza", start: "13:00" })]),
      ctx({
        app: [
          { id: "a1", name: "Brittney Chong", email: "brittney@hw.ca" },
          { id: "a2", name: "Aleeza Khan", email: "aleeza@hw.ca" },
        ],
        lookupEmail,
      }),
      NOW,
    );
    expect(plan.tasks[0]!.owners).toEqual([
      { token: "Brittney", kind: "person", status: "matched", name: "Brittney Chong", slackUserId: "U-BRIT", via: "email" },
      { token: "Aleeza", kind: "person", status: "no-slack", name: "Aleeza Khan" },
    ]);
    expect(plan.desired.map((d) => d.slackUserId)).toEqual(["U-BRIT"]);
  });

  test("past pings are left out", async () => {
    const plan = await planOpsPings(
      sheetOf([task({ title: "Breakfast", owner: "Jess", start: "08:00", end: "12:30" })]),
      ctx(),
      NOW,
    );
    expect(plan.desired.map((d) => d.kind)).toEqual(["end"]);
  });
});

describe("pingText", () => {
  test("the start DM says what, when, where and who; text is escaped", () => {
    const t = task({
      title: "Snacks <& drinks>",
      owner: "Emily Liu, Jess",
      start: "13:00",
      end: "14:00",
      location: "Rm 1110",
      blurb: "Bring the wagon",
    });
    expect(pingText(t, "start")).toBe(
      [
        "⏰ *Starting soon: Snacks &lt;&amp; drinks&gt;*",
        "*When:* 1:00 PM – 2:00 PM",
        "*Where:* Rm 1110",
        "*What:* Bring the wagon",
        "*Owners:* Emily Liu, Jess",
      ].join("\n"),
    );
    expect(pingText(t, "end")).toBe(
      "✅ *Time to wrap up: Snacks &lt;&amp; drinks&gt;* (ends 2:00 PM)\n*Where:* Rm 1110\nWrap up and hand off anything still open.",
    );
  });
});

describe("syncOpsPings", () => {
  const TASKS = [
    task({ title: "Lunch", owner: "Emily Liu, Jess", start: "13:00", end: "14:00" }),
    task({ title: "Setup", owner: "Everyone", start: "13:30" }),
  ];

  test("no Slack token: nothing happens, with a clear reason", async () => {
    const slack = mockSlack();
    expect(await syncOpsPings(NOW, { token: "", fetch: slack.fetch, readSheet: async () => sheetOf(TASKS) })).toEqual({
      ok: false,
      reason: "no-token",
    });
    expect(slack.calls).toEqual([]);
  });

  test("schedules DMs only (never a channel post), and a re-run changes nothing", async () => {
    const slack = mockSlack();
    const deps = { token: "xoxb-test", fetch: slack.fetch, readSheet: async () => sheetOf(TASKS) };
    const first = await syncOpsPings(NOW, deps);
    expect(first).toMatchObject({ ok: true, created: 4, scheduled: 4, cancelled: 0, failed: 0 });
    const channels = slack.scheduled().map((c) => c.args.get("channel"));
    expect(new Set(channels)).toEqual(new Set(["D-U-EMILY", "D-U-JX"]));
    expect(slack.scheduled()[0]!.args.get("post_at")).toBe(String(at("12:50").getTime() / 1000));

    slack.reset();
    const second = await syncOpsPings(NOW, deps);
    expect(second).toMatchObject({ ok: true, created: 0, cancelled: 0, scheduled: 4 });
    expect(slack.methods()).toEqual(["users.list"]);
  });

  test("a changed task replaces its pings; a removed task's pings are deleted", async () => {
    const slack = mockSlack();
    await syncOpsPings(NOW, { token: "xoxb-test", fetch: slack.fetch, readSheet: async () => sheetOf(TASKS) });
    slack.reset();

    const moved = [task({ title: "Lunch", owner: "Emily Liu, Jess", start: "13:00", end: "14:00", location: "Rm 2230" })];
    const res = await syncOpsPings(NOW, { token: "xoxb-test", fetch: slack.fetch, readSheet: async () => sheetOf(moved) });
    expect(res).toMatchObject({ ok: true, created: 4, cancelled: 4, scheduled: 4 });
    expect(slack.methods().filter((m) => m === "chat.deleteScheduledMessage")).toHaveLength(4);

    slack.reset();
    const gone = await syncOpsPings(NOW, { token: "xoxb-test", fetch: slack.fetch, readSheet: async () => sheetOf([]) });
    expect(gone).toMatchObject({ ok: true, created: 0, cancelled: 4, scheduled: 0 });
  });

  test("Slack's organizer list fails: nothing is cancelled or scheduled", async () => {
    const ok = mockSlack();
    await syncOpsPings(NOW, { token: "xoxb-test", fetch: ok.fetch, readSheet: async () => sheetOf(TASKS) });
    resetSlackOrganizersCache();
    const down = mockSlack({ "users.list": { ok: false, error: "missing_scope" } });
    const res = await syncOpsPings(NOW, { token: "xoxb-test", fetch: down.fetch, readSheet: async () => sheetOf([]) });
    expect(res).toEqual({ ok: false, reason: "slack-error" });
    expect(down.methods()).toEqual(["users.list"]);
    const rows = await db.select().from(opsPings);
    expect(rows.every((r) => r.status === "scheduled")).toBe(true);
  });

  test("a hacker named like an organizer is never DMed", async () => {
    const slack = mockSlack();
    const res = await syncOpsPings(NOW, {
      token: "xoxb-test",
      fetch: slack.fetch,
      readSheet: async () => sheetOf([task({ title: "Judging", owner: "Brittney Chong", start: "13:00" })]),
    });
    expect(res).toMatchObject({ ok: true, created: 0 });
    expect(slack.scheduled()).toEqual([]);
  });

  test("a run that stops halfway, then a re-run, schedules each ping once", async () => {
    const slack = mockSlack();
    const live = new Set<string>();
    const tracking = (async (url: string | URL | Request, init?: RequestInit) => {
      const res = await slack.fetch(url, init);
      const method = String(url).replace("https://slack.com/api/", "");
      const args = new URLSearchParams(String(init?.body ?? ""));
      const body = (await res.clone().json()) as { scheduled_message_id?: string };
      if (method === "chat.scheduleMessage" && body.scheduled_message_id) live.add(body.scheduled_message_id);
      if (method === "chat.deleteScheduledMessage") live.delete(args.get("scheduled_message_id")!);
      return res;
    }) as typeof fetch;
    const deps = { token: "xoxb-test", fetch: tracking, readSheet: async () => sheetOf(TASKS) };

    // The database fails on the second ping row: the run stops there.
    const insert = db.insert.bind(db);
    let rows = 0;
    const spy = vi.spyOn(db, "insert").mockImplementation(((table: unknown) => {
      if (table === opsPings && ++rows === 2) throw new Error("database went away");
      return insert(table as typeof opsPings);
    }) as typeof db.insert);
    expect(await syncOpsPings(NOW, deps)).toEqual({ ok: false, reason: "error" });
    spy.mockRestore();
    // The one Slack took but we couldn't record was taken back out of Slack.
    expect(live.size).toBe(1);
    expect(await db.select().from(opsPings)).toHaveLength(1);

    const again = await syncOpsPings(NOW, deps);
    expect(again).toMatchObject({ ok: true, created: 3, scheduled: 4 });
    expect(live.size).toBe(4);
    const saved = await db.select().from(opsPings);
    expect(new Set(saved.map((r) => r.pingKey)).size).toBe(4);
    expect(saved.every((r) => r.status === "scheduled")).toBe(true);
  });

  test("one run at a time: a second run while one holds the lock is busy", async () => {
    const slack = mockSlack();
    const deps = { token: "xoxb-test", fetch: slack.fetch, readSheet: async () => sheetOf(TASKS) };
    const lockAt = new Date();
    await db.insert(taskReminderSync).values({ id: "ops-pings", lastAttemptAt: lockAt });
    expect(await syncOpsPings(NOW, { ...deps, clock: () => new Date(lockAt.getTime() + 30_000) })).toEqual({
      ok: false,
      reason: "busy",
    });
    expect(slack.scheduled()).toEqual([]);
    // A lock left by a run that crashed goes stale after 2 minutes.
    const res = await syncOpsPings(NOW, { ...deps, clock: () => new Date(lockAt.getTime() + 3 * 60_000) });
    expect(res).toMatchObject({ ok: true, created: 4 });
    const [lock] = await db.select().from(taskReminderSync);
    expect(lock!.lastAttemptAt).toBeNull();
  });

  test("Sara (tagged) never gets Sarah's DM when Sarah's account is someone else on Slack", async () => {
    await db.insert(users).values({ id: "a-sarah", email: "sarah@hw.ca", name: "Sarah Lieng", type: "organizer" });
    const slack = mockSlack({ "users.lookupByEmail": { ok: true, user: { id: "U-SARAH" } } });
    const res = await syncOpsPings(NOW, {
      token: "xoxb-test",
      fetch: slack.fetch,
      readSheet: async () => sheetOf([task({ title: "Photobooth", owner: "Sarah", start: "13:00" })]),
    });
    expect(res).toMatchObject({ ok: true, created: 0 });
    expect(slack.scheduled()).toEqual([]);
  });

  test("a sheet read failure changes nothing", async () => {
    const slack = mockSlack();
    const res = await syncOpsPings(NOW, {
      token: "xoxb-test",
      fetch: slack.fetch,
      readSheet: async () => {
        throw new Error("boom");
      },
    });
    expect(res).toEqual({ ok: false, reason: "sheet-error" });
    expect(slack.calls).toEqual([]);
  });
});

describe("getOpsOverview", () => {
  test("delivery status per owner after a sync", async () => {
    const slack = mockSlack();
    const deps = {
      token: "xoxb-test",
      fetch: slack.fetch,
      readSheet: async () =>
        sheetOf([
          task({ title: "Lunch", owner: "Jess, Alex", start: "13:00", end: "14:00" }),
          task({ title: "Breakfast", owner: "Emily Liu", start: "08:00" }),
        ]),
    };
    const before = await getOpsOverview(NOW, deps);
    if (!before.ok) throw new Error("expected ok");
    expect(before.tasks[1]!.pings[0]!.deliveries).toEqual([
      { name: "Jessica Xing", slackUserId: "U-JX", status: "pending", error: null },
    ]);
    expect(before.flagged).toBe(1); // "Alex" is ambiguous

    await syncOpsPings(NOW, deps);
    const after = await getOpsOverview(NOW, deps);
    if (!after.ok) throw new Error("expected ok");
    expect(after.slack).toBe("connected");
    expect(after.tasks.map((t) => t.title)).toEqual(["Breakfast", "Lunch"]);
    expect(after.tasks[0]!.pings[0]!.deliveries[0]!.status).toBe("passed");
    expect(after.tasks[1]!.pings.map((p) => p.deliveries[0]!.status)).toEqual(["scheduled", "scheduled"]);
  });

  test("without a Slack token, owners match organizer accounts and nothing calls Slack", async () => {
    await db.insert(users).values({ id: "u1", email: "jessica.xing@hw.ca", name: "Jessica Xing", type: "organizer" });
    await db.insert(users).values({ id: "u2", email: "hacker@hw.ca", name: "Emily Liu", type: "hacker" });
    const slack = mockSlack();
    const res = await getOpsOverview(NOW, {
      token: "",
      fetch: slack.fetch,
      readSheet: async () => sheetOf([task({ title: "Lunch", owner: "Jess, Emily Liu", start: "13:00" })]),
    });
    if (!res.ok) throw new Error("expected ok");
    expect(res.slack).toBe("no-token");
    expect(res.tasks[0]!.owners).toEqual([
      { token: "Jess", kind: "person", status: "matched", name: "Jessica Xing", slackUserId: null, via: "alias" },
      // A hacker account never counts as an organizer.
      { token: "Emily Liu", kind: "person", status: "no-match" },
    ]);
    expect(slack.calls).toEqual([]);
  });

  test("the sheet isn't set up", async () => {
    const { OpsSheetNotConfiguredError } = await import("~/server/api/utils/ops-pings");
    const res = await getOpsOverview(NOW, {
      token: "",
      readSheet: async () => {
        throw new OpsSheetNotConfiguredError();
      },
    });
    expect(res).toMatchObject({ ok: false, reason: "not-configured" });
  });
});

test("parseTeamRoster reads names under Team Member", () => {
  expect(
    parseTeamRoster([
      ["Team Member", "Sponsors", "Friday"],
      ["Noah", "CSE, Canada Life, QNX", "", "Breaks = 160 mins"],
      ["Caroline", "Scotiabank, Manulife"],
      ["Daniel"],
      ["Aniya"],
      ["Alice", "Accenture, Commure"],
      [],
    ]),
  ).toEqual(["Noah", "Caroline", "Daniel", "Aniya", "Alice"]);
  expect(parseTeamRoster([["Something else"]])).toBeNull();
});

describe("opsPings router", () => {
  const publicCaller = createCaller(createInnerTRPCContext({ session: null }));
  test("rejects a logged-out caller", async () => {
    await expect(publicCaller.opsPings.overview()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await expect(publicCaller.opsPings.sync()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});
