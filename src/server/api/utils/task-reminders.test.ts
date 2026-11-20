import { beforeEach, describe, expect, test, vi } from "vitest";
import { sql } from "drizzle-orm";

import type { RunOfShowItem, RunOfShowTask } from "~/lib/run-of-show";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import {
  AUTO_SYNC_THROTTLE_MS,
  diffReminders,
  getTaskPingActivity,
  getTaskReminderStatus,
  maybeAutoSyncTaskReminders,
  planTaskReminders,
  reminderText,
  resetAutoSyncThrottle,
  routeOwner,
  syncTaskReminders,
  taskKey,
  type StoredReminder,
} from "~/server/api/utils/task-reminders";
import { db } from "~/server/db";
import {
  taskOwnerContacts,
  taskReminders,
  taskReminderSync,
} from "~/server/db/schema";
import {
  resetSlackDirectoryCache,
  type SlackDirectoryUser,
} from "~/server/slack/directory";

// Saturday noon, Eastern. Tasks below are later the same day.
const NOW = new Date("2026-11-21T12:00:00-05:00");
const CHANNEL = "C-SPON-TEAM";

const task = (
  start: string,
  text: string,
  owner: string | null,
): RunOfShowTask => ({ day: "Saturday", start, task: text, owner });

const ITEMS: RunOfShowItem[] = [
  {
    id: "Saturday-14:00-big-event",
    day: "Saturday",
    start: "14:00",
    end: "15:00",
    column: "big-event",
    title: "Opening",
    location: "Rm 1230",
    sponsors: [],
  },
];

type Call = { method: string; args: URLSearchParams };

/** A mocked Slack API: answers per method, records every call. */
function mockSlack(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  let n = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).replace("https://slack.com/api/", "");
    const args = new URLSearchParams(String(init?.body ?? ""));
    calls.push({ method, args });
    const defaults: Record<string, unknown> = {
      "users.lookupByEmail": {
        ok: true,
        user: { id: `U-${args.get("email")}` },
      },
      "conversations.open": {
        ok: true,
        channel: { id: `D-${args.get("users")}` },
      },
      "chat.scheduleMessage": {
        ok: true,
        scheduled_message_id: `Q${++n}`,
        channel: args.get("channel"),
      },
      "chat.deleteScheduledMessage": { ok: true },
      "users.list": {
        ok: true,
        members: [
          {
            id: "UJAZZ",
            real_name: "Jazz Gu",
            profile: { first_name: "Jazz" },
          },
          { id: "UNOAH", real_name: "Noah Lee" },
        ],
      },
    };
    const body = answers[method] ?? defaults[method] ?? { ok: false };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return {
    fetch: fn as unknown as typeof fetch,
    calls,
    methods: () => calls.map((c) => c.method),
    reset: () => calls.splice(0),
  };
}

const sheet = (tasks: RunOfShowTask[]) => async () => ({
  tasks,
  items: ITEMS,
});

beforeEach(async () => {
  // Only this file uses these tables.
  await db.delete(taskReminders).where(sql`true`);
  await db.delete(taskOwnerContacts).where(sql`true`);
  await db.delete(taskReminderSync).where(sql`true`);
  resetAutoSyncThrottle();
  resetSlackDirectoryCache();
});

const DIRECTORY: SlackDirectoryUser[] = [
  { id: "UJAZZ", names: ["jazz", "jazz gu"] },
  { id: "UNOAH", names: ["noah", "noah lee"] },
  { id: "UDAN1", names: ["daniel", "daniel kim"] },
  { id: "UDAN2", names: ["daniel", "daniel wu"] },
];

describe("planTaskReminders", () => {
  const contacts = { directory: DIRECTORY };

  test("DMs a matched owner at the task's start time", () => {
    const plan = planTaskReminders(
      [task("14:00", "Open doors", " Jazz ")],
      ITEMS,
      contacts,
      NOW,
      CHANNEL,
    );
    expect(plan.desired).toHaveLength(1);
    const d = plan.desired[0]!;
    expect(d.target).toBe("dm");
    expect(d.slackUserId).toBe("UJAZZ");
    expect(d.postAt.toISOString()).toBe(
      new Date("2026-11-21T14:00:00-05:00").toISOString(),
    );
    expect(d.text).toBe("⏰ Now (2:00 PM): Open doors · Rm 1230");
  });

  test("no owner, no clear owner and unmatched owner go to the team channel", () => {
    const plan = planTaskReminders(
      [
        task("14:00", "Tape cables", null),
        task("15:00", "Lunch", "Sam"),
        task("16:00", "Booths", "[SPON] + [WEB] All"),
        task("17:00", "Swag", "Daniel"),
        task("18:00", "Dinner", "[SPON] Noah"),
      ],
      ITEMS,
      contacts,
      NOW,
      CHANNEL,
    );
    expect(
      plan.desired.map((d) => [d.task, d.target, d.channel, d.slackUserId]),
    ).toEqual([
      ["Tape cables", "channel", CHANNEL, null],
      ["Lunch", "channel", CHANNEL, null],
      ["Booths", "channel", CHANNEL, null],
      ["Swag", "channel", CHANNEL, null], // two Daniels on Slack
      ["Dinner", "dm", null, "UNOAH"],
    ]);
    expect(plan.desired[0]!.text).toBe(
      "<!here> ⏰ Now (2:00 PM): Tape cables · Rm 1230\nNo owner in the sheet, can someone grab this?",
    );
    expect(plan.desired[2]!.text).toBe(
      "<!here> ⏰ Now (4:00 PM): Booths\nOwner in the sheet: [SPON] + [WEB] All. No one person to DM, can someone grab this?",
    );
    expect(plan.noChannelTasks).toEqual([]);
  });

  test("channel text uses the configured mention and escapes sheet text", () => {
    const plan = planTaskReminders(
      [task("14:00", "<!channel> & go", "<!everyone> All")],
      ITEMS,
      contacts,
      NOW,
      CHANNEL,
      "<!subteam^S1>",
    );
    expect(plan.desired[0]!.text).toBe(
      "<!subteam^S1> ⏰ Now (2:00 PM): &lt;!channel&gt; &amp; go · Rm 1230\nOwner in the sheet: &lt;!everyone&gt; All. No one person to DM, can someone grab this?",
    );
    const quiet = planTaskReminders(
      [task("14:00", "Tape", null)],
      ITEMS,
      contacts,
      NOW,
      CHANNEL,
      "",
    );
    expect(quiet.desired[0]!.text.startsWith("⏰ Now")).toBe(true);
  });

  test("a saved email match overrides the directory", () => {
    expect(
      routeOwner("Daniel", {
        directory: DIRECTORY,
        contacts: [{ ownerKey: "daniel", slackUserId: "UDAN2" }],
      }),
    ).toEqual({ target: "dm", slackUserId: "UDAN2", name: "Daniel" });
    expect(routeOwner("Daniel", { directory: DIRECTORY })).toEqual({
      target: "channel",
      reason: "ambiguous",
    });
    expect(routeOwner("caroline", { directory: DIRECTORY })).toEqual({
      target: "channel",
      reason: "no-match",
    });
    expect(
      routeOwner("Canada Life: Noah Manulife: Caroline", {
        directory: DIRECTORY,
      }),
    ).toEqual({ target: "channel", reason: "per-company" });
  });

  test("without a team channel, unowned tasks are skipped and reported", () => {
    const plan = planTaskReminders(
      [task("14:00", "Tape cables", null), task("15:00", "Lunch", "Jazz")],
      ITEMS,
      contacts,
      NOW,
      null,
    );
    expect(plan.desired.map((d) => d.task)).toEqual(["Lunch"]);
    expect(plan.noChannelTasks.map((t) => t.task)).toEqual(["Tape cables"]);
  });

  test("past tasks are ignored; one starting within 90 s is too soon", () => {
    const plan = planTaskReminders(
      [
        task("11:00", "Past", "Jazz"),
        task("12:01", "Right now", "Jazz"),
        task("12:05", "Soon", "Jazz"),
      ],
      ITEMS,
      contacts,
      NOW,
      CHANNEL,
    );
    expect(plan.desired.map((d) => [d.task, d.tooSoon])).toEqual([
      ["Right now", true],
      ["Soon", false],
    ]);
  });

  test("escapes Slack control characters; omits an unclear location", () => {
    expect(reminderText(task("09:00", "A&B <x>", "Jazz"), ITEMS)).toBe(
      "⏰ Now (9:00 AM): A&amp;B &lt;x&gt;",
    );
  });
});

describe("diffReminders", () => {
  const desired = (start: string, text: string, user: string | null = "U1") => {
    const t = task(start, text, user ? "Jazz" : null);
    return planTaskReminders(
      [t],
      ITEMS,
      { contacts: [{ ownerKey: "jazz", slackUserId: user }] },
      NOW,
      CHANNEL,
    ).desired[0]!;
  };
  const stored = (
    d: ReturnType<typeof desired>,
    over: Partial<StoredReminder> = {},
  ): StoredReminder => ({
    id: `row-${d.taskKey.slice(0, 6)}`,
    taskKey: d.taskKey,
    slackUserId: d.slackUserId,
    postAt: d.postAt,
    status: "scheduled",
    slackChannel: "D1",
    scheduledMessageId: "Q1",
    routeKey: d.routeKey,
    ...over,
  });

  test("new tasks are created, unchanged kept, removed or changed cancelled", () => {
    const keep = desired("14:00", "Keep");
    const changedOld = desired("15:00", "Old text");
    const changedNew = desired("15:00", "New text");
    const removed = desired("16:00", "Removed");
    const added = desired("17:00", "Added");

    const diff = diffReminders(
      [stored(keep), stored(changedOld), stored(removed)],
      [keep, changedNew, added],
      NOW,
    );
    expect(diff.keep).toEqual([stored(keep).id]);
    expect(diff.cancel.map((r) => r.taskKey)).toEqual([
      changedOld.taskKey,
      removed.taskKey,
    ]);
    expect(diff.create.map((d) => d.task)).toEqual(["New text", "Added"]);
  });

  test("a new channel, mention or text reschedules; a pre-0047 row too", () => {
    const t = task("14:00", "Booths", "All");
    const plan = (channel: string, mention: string) =>
      planTaskReminders([t], ITEMS, {}, NOW, channel, mention).desired[0]!;
    const before = plan(CHANNEL, "<!here>");
    for (const after of [plan("C-OTHER", "<!here>"), plan(CHANNEL, "")]) {
      expect(after.taskKey).toBe(before.taskKey);
      const diff = diffReminders([stored(before)], [after], NOW);
      expect(diff.keep).toEqual([]);
      expect(diff.cancel).toHaveLength(1);
      expect(diff.create).toHaveLength(1);
    }
    expect(
      diffReminders([stored(before)], [plan(CHANNEL, "<!here>")], NOW).keep,
    ).toHaveLength(1);
    expect(
      diffReminders([stored(before, { routeKey: null })], [before], NOW).cancel,
    ).toHaveLength(1);
  });

  test("a new Slack user for the owner reschedules", () => {
    const before = desired("14:00", "Task", "U1");
    const after = desired("14:00", "Task", "U2");
    const diff = diffReminders([stored(before)], [after], NOW);
    expect(diff.cancel).toHaveLength(1);
    expect(diff.create).toHaveLength(1);
  });

  test("a passed reminder is marked sent; a failed one is retried in place", () => {
    const d = desired("14:00", "Task");
    const old = stored(d, {
      id: "passed",
      postAt: new Date(NOW.getTime() - 1000),
    });
    const failed = stored(d, { id: "failed", status: "failed" });
    const diff = diffReminders([old, failed], [d], NOW);
    expect(diff.passed).toEqual(["passed"]);
    expect(diff.create).toHaveLength(1);
    expect(diff.create[0]!.retryId).toBe("failed");
  });

  test("too-soon tasks are not created, but an existing one is kept", () => {
    const soon = desired("12:01", "Soon");
    expect(diffReminders([], [soon], NOW)).toMatchObject({
      create: [],
      tooSoon: [soon],
    });
    expect(diffReminders([stored(soon)], [soon], NOW)).toMatchObject({
      keep: [stored(soon).id],
      create: [],
      tooSoon: [],
    });
  });

  test("taskKey changes with any field", () => {
    const base = task("14:00", "Task", "Jazz");
    expect(taskKey(base)).toBe(taskKey({ ...base, owner: " jazz " }));
    expect(taskKey(base)).not.toBe(taskKey({ ...base, owner: "Sam" }));
    expect(taskKey(base)).not.toBe(taskKey({ ...base, start: "14:30" }));
  });
});

describe("syncTaskReminders", () => {
  async function matchJazz() {
    await db.insert(taskOwnerContacts).values({
      ownerKey: "jazz",
      ownerName: "Jazz",
      slackEmail: "jazz@example.com",
    });
  }

  test("skips silently with no Slack token", async () => {
    const slack = mockSlack();
    const result = await syncTaskReminders(NOW, {
      token: undefined,
      fetch: slack.fetch,
      readSheet: sheet([task("14:00", "Open doors", "Jazz")]),
    });
    expect(result).toEqual({ ok: false, reason: "no-token" });
    expect(slack.calls).toHaveLength(0);
  });

  test("schedules a DM for a matched owner and a channel post for the rest", async () => {
    await matchJazz();
    const slack = mockSlack();
    const tasks = [
      task("14:00", "Open doors", "Jazz"),
      task("15:00", "Lunch", "Sam"),
      task("16:00", "Tape cables", null),
      task("12:01", "Too soon", "Jazz"),
    ];
    const result = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: sheet(tasks),
    });
    expect(result).toMatchObject({
      ok: true,
      scheduled: 3,
      created: 3,
      tooSoon: 1,
      toChannel: 2,
    });
    expect(slack.methods()).toEqual([
      "users.lookupByEmail",
      "users.list",
      "conversations.open",
      "chat.scheduleMessage",
      "chat.scheduleMessage",
      "chat.scheduleMessage",
    ]);
    const posts = slack.calls.filter(
      (c) => c.method === "chat.scheduleMessage",
    );
    expect(posts.map((p) => p.args.get("channel"))).toEqual([
      "D-U-jazz@example.com",
      CHANNEL,
      CHANNEL,
    ]);
    expect(posts[0]!.args.get("post_at")).toBe(
      String(new Date("2026-11-21T14:00:00-05:00").getTime() / 1000),
    );
    expect(posts[1]!.args.get("text")).toContain("Owner in the sheet: Sam");

    // Running again with the same sheet changes nothing in Slack.
    slack.reset();
    const again = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: sheet(tasks),
    });
    expect(again).toMatchObject({
      ok: true,
      scheduled: 3,
      created: 0,
      cancelled: 0,
    });
    expect(slack.calls).toHaveLength(0);

    // Change one task and remove another: delete both, schedule the new one.
    slack.reset();
    const changed = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: sheet([task("14:30", "Open doors", "Jazz"), tasks[1]!]),
    });
    expect(changed).toMatchObject({
      ok: true,
      scheduled: 2,
      created: 1,
      cancelled: 2,
    });
    // The directory is cached, so users.list isn't called again.
    expect(slack.methods().sort()).toEqual([
      "chat.deleteScheduledMessage",
      "chat.deleteScheduledMessage",
      "chat.scheduleMessage",
      "conversations.open",
    ]);
    const rows = await db.select().from(taskReminders);
    expect(rows.filter((r) => r.status === "cancelled")).toHaveLength(2);
  });

  test("without a team channel, unowned tasks are skipped and the status says so", async () => {
    const slack = mockSlack();
    const read = sheet([task("14:00", "Tape cables", null)]);
    const result = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: null,
      readSheet: read,
    });
    expect(result).toMatchObject({ ok: true, created: 0, noChannelTasks: 1 });
    expect(slack.calls).toHaveLength(0);
    const status = await getTaskReminderStatus(NOW, {
      token: "xoxb-t",
      channel: null,
    });
    expect(status).toMatchObject({
      slackConnected: true,
      channelConfigured: false,
      nextPingAt: null,
      failed: 0,
    });
  });

  test("Slack errors are stored per reminder, shown as failures and retried", async () => {
    await matchJazz();
    const broken = mockSlack({
      "chat.scheduleMessage": { ok: false, error: "restricted_action" },
    });
    const read = sheet([task("14:00", "Open doors", "Jazz")]);
    const result = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: broken.fetch,
      channel: CHANNEL,
      readSheet: read,
    });
    expect(result).toMatchObject({ ok: true, failed: 1, scheduled: 0 });
    const status = await getTaskReminderStatus(NOW, {
      token: "xoxb-t",
      channel: CHANNEL,
    });
    expect(status).toMatchObject({ failed: 1, nextPingAt: null });

    const fixed = mockSlack();
    const retried = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: fixed.fetch,
      channel: CHANNEL,
      readSheet: read,
    });
    expect(retried).toMatchObject({ ok: true, created: 1, scheduled: 1 });
    expect(await db.select().from(taskReminders)).toHaveLength(1);
  });

  test("matches owners by name with no saved emails; status shows the next ping", async () => {
    const slack = mockSlack();
    const read = sheet([
      task("14:00", "Tape cables", null),
      task("15:00", "Open doors", "[SPON] Noah"),
    ]);
    const result = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: read,
    });
    expect(result).toMatchObject({ ok: true, created: 2, toChannel: 1 });
    const posts = slack.calls.filter(
      (c) => c.method === "chat.scheduleMessage",
    );
    expect(posts.map((p) => p.args.get("channel"))).toEqual([
      CHANNEL,
      "D-UNOAH",
    ]);
    const status = await getTaskReminderStatus(NOW, {
      token: "xoxb-t",
      channel: CHANNEL,
    });
    expect(status).toMatchObject({
      slackConnected: true,
      channelConfigured: true,
      nextPingAt: new Date("2026-11-21T14:00:00-05:00"),
      failed: 0,
    });
  });

  test("a failed delete holds the new message back until the old one is gone", async () => {
    const tasks = [task("14:00", "Booths", "All")];
    const opts = (fetch: typeof globalThis.fetch, mention: string) => ({
      token: "xoxb-t",
      fetch,
      channel: CHANNEL,
      mention,
      readSheet: sheet(tasks),
    });
    const first = mockSlack();
    await syncTaskReminders(NOW, opts(first.fetch, "<!here>"));

    // The mention changes, but Slack won't delete the old post.
    const stuck = mockSlack({
      "chat.deleteScheduledMessage": { ok: false, error: "internal_error" },
    });
    const held = await syncTaskReminders(NOW, opts(stuck.fetch, ""));
    expect(held).toMatchObject({ ok: true, created: 0, deferred: 1 });
    expect(stuck.methods()).toEqual(["chat.deleteScheduledMessage"]);
    const rows = await db.select().from(taskReminders);
    expect(rows.map((r) => r.status)).toEqual(["scheduled"]);

    // Next sync: the delete works, then the new post is scheduled.
    const fixed = mockSlack();
    const done = await syncTaskReminders(NOW, opts(fixed.fetch, ""));
    expect(done).toMatchObject({
      ok: true,
      created: 1,
      cancelled: 1,
      deferred: 0,
    });
    expect(fixed.methods()).toEqual([
      "chat.deleteScheduledMessage",
      "chat.scheduleMessage",
    ]);
    expect(fixed.calls[1]!.args.get("text")!.startsWith("⏰ Now")).toBe(true);
  });

  test("only no-owner tasks: the directory isn't fetched", async () => {
    const slack = mockSlack();
    await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: sheet([task("14:00", "Booths", "All")]),
    });
    expect(slack.methods()).toEqual(["chat.scheduleMessage"]);
  });

  test("a failed directory read stops the sync and keeps what's scheduled", async () => {
    const slack = mockSlack({
      "users.list": { ok: false, error: "missing_scope" },
    });
    const result = await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: sheet([task("14:00", "Open doors", "Noah")]),
    });
    expect(result).toEqual({ ok: false, reason: "error" });
    expect(slack.methods()).toEqual(["users.list"]);
  });
});

describe("getTaskPingActivity", () => {
  test("up next and the log come from the reminder rows", async () => {
    const slack = mockSlack();
    await syncTaskReminders(NOW, {
      token: "xoxb-t",
      fetch: slack.fetch,
      channel: CHANNEL,
      readSheet: sheet([
        task("14:00", "Tape cables", "All"),
        task("15:00", "Open doors", "Noah"),
      ]),
    });
    const before = await getTaskPingActivity(NOW);
    expect(before.upNext).toMatchObject([
      { task: "Tape cables", target: { kind: "channel" } },
      { task: "Open doors", target: { kind: "dm", name: "Noah" } },
    ]);
    expect(before.log.filter((e) => e.kind === "task")).toEqual([]);

    const later = new Date("2026-11-21T14:30:00-05:00");
    const after = await getTaskPingActivity(later);
    expect(after.upNext.map((p) => p.task)).toEqual(["Open doors"]);
    expect(
      after.log
        .filter((e) => e.kind === "task")
        .map((e) => [e.kind === "task" && e.task, e.status]),
    ).toEqual([["Tape cables", "scheduled"]]);
  });
});

describe("maybeAutoSyncTaskReminders (throttle)", () => {
  const snapshot = { tasks: [task("14:00", "Open doors", null)], items: ITEMS };

  test("runs, then waits 3 minutes, then skips while the tasks are unchanged", async () => {
    const slack = mockSlack();
    const opts = { token: "xoxb-t", fetch: slack.fetch, channel: CHANNEL };

    const first = await maybeAutoSyncTaskReminders(snapshot, {
      ...opts,
      now: NOW,
    });
    expect(first.status).toBe("started");
    expect(await first.run).toMatchObject({ ok: true, created: 1 });

    // Same instance, a minute later: in-memory throttle.
    const soon = new Date(NOW.getTime() + 60_000);
    expect(
      (await maybeAutoSyncTaskReminders(snapshot, { ...opts, now: soon }))
        .status,
    ).toBe("throttled");

    // Another instance (no memory), tasks changed, still inside 3 minutes:
    // the DB timestamp throttles it.
    resetAutoSyncThrottle();
    const changed = { ...snapshot, tasks: [task("15:00", "Other", null)] };
    expect(
      (await maybeAutoSyncTaskReminders(changed, { ...opts, now: soon }))
        .status,
    ).toBe("throttled");

    // Unchanged tasks, recently synced: nothing to do.
    resetAutoSyncThrottle();
    const later = new Date(NOW.getTime() + AUTO_SYNC_THROTTLE_MS + 1000);
    expect(
      (await maybeAutoSyncTaskReminders(snapshot, { ...opts, now: later }))
        .status,
    ).toBe("unchanged");

    // Changed tasks after the throttle window: runs again.
    const next = await maybeAutoSyncTaskReminders(changed, {
      ...opts,
      now: later,
    });
    expect(next.status).toBe("started");
    expect(await next.run).toMatchObject({
      ok: true,
      created: 1,
      cancelled: 1,
    });
  });

  test("does nothing without a Slack token", async () => {
    expect(
      (await maybeAutoSyncTaskReminders(snapshot, { token: undefined })).status,
    ).toBe("no-token");
  });
});

describe("taskReminders router", () => {
  const publicCaller = createCaller(createInnerTRPCContext({ session: null }));

  test("rejects a logged-out caller", async () => {
    await expect(publicCaller.taskReminders.status()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(publicCaller.taskReminders.activity()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    await expect(publicCaller.taskReminders.sync()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });
});
