import { describe, expect, test } from "vitest";
import {
  buildRoster,
  parseShiftList,
  planUnit,
  readMessages,
  readPeople,
  type Planned,
  type Unit,
} from "./auto-ping-schedule";
import {
  FREEZE_MS,
  messageStatus,
  planLines,
  queueGrid,
  readQueue,
  reconcile,
  sentNext,
  textHash,
  type QueueRow,
  type SlackPort,
} from "./auto-ping-sync";

const NOW = Date.parse("2026-11-20T18:00:00Z"); // Fri 1:00 PM Toronto
const MIN = 60_000;

/** A fake Slack: a directory of emails and a list of held messages. */
function fakeSlack(directory: Record<string, string>) {
  const held = new Map<
    string,
    { channel: string; postAt: number; text: string }
  >();
  const posted: { channel: string; text: string }[] = [];
  const calls: string[] = [];
  let n = 0;
  const slack: SlackPort = {
    lookup: async (email) => {
      calls.push(`lookup ${email}`);
      return directory[email] ?? null;
    },
    openDm: async (user) => `D${user}`,
    schedule: async (channel, postAt, text) => {
      const id = `Q${++n}`;
      calls.push(`schedule ${id}`);
      held.set(id, { channel, postAt, text });
      return id;
    },
    post: async (channel, text) => {
      calls.push("post");
      posted.push({ channel, text });
    },
    cancel: async (_channel, id) => {
      calls.push(`cancel ${id}`);
      return held.delete(id) ? "ok" : "gone";
    },
  };
  return { slack, held, posted, calls };
}

function planned(over: Partial<Planned> & { key: string }): Planned {
  const postAt = over.postAt ?? new Date(NOW + 60 * MIN);
  return {
    kind: "reminder",
    template: "Shift reminder: second shift",
    email: "ann@example.com",
    name: "Ann Lee",
    role: "Mentor",
    rows: [2],
    deadline: postAt,
    text: "⏰ Shift #2 starts in 15 min",
    missing: null,
    ...over,
    postAt,
  };
}

const sync = (plan: Planned[], queue: QueueRow[], slack: SlackPort, at = NOW) =>
  reconcile({ planned: plan, queue, slack, now: () => at });

describe("reconcile", () => {
  test("schedules new messages, then leaves them alone (and logs nothing)", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const plan = [planned({ key: "ann@example.com|reminder-2" })];
    const first = await sync(plan, [], fake.slack);
    expect(first.counts.scheduled).toBe(1);
    expect(first.events.map((e) => e.result)).toEqual([
      "Scheduled for Fri 2:00 PM",
    ]);
    expect(first.queue[0]).toMatchObject({
      status: "scheduled",
      channel: "DU1",
      messageId: "Q1",
    });

    const second = await sync(plan, first.queue, fake.slack);
    expect(second.counts).toMatchObject({
      kept: 1,
      scheduled: 0,
      cancelled: 0,
    });
    expect(second.events).toEqual([]);
    expect(fake.calls.filter((c) => c.startsWith("lookup"))).toHaveLength(1);
  });

  test("a changed text or time is cancelled and rescheduled", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const key = "ann@example.com|reminder-2";
    const { queue } = await sync([planned({ key })], [], fake.slack);
    const edited = await sync(
      [planned({ key, text: "New text" })],
      queue,
      fake.slack,
    );
    expect(fake.calls).toContain("cancel Q1");
    expect(edited.events.map((e) => e.result)).toEqual([
      "Rescheduled for Fri 2:00 PM",
    ]);
    const moved = await sync(
      [planned({ key, text: "New text", postAt: new Date(NOW + 90 * MIN) })],
      edited.queue,
      fake.slack,
    );
    expect(moved.events.map((e) => e.result)).toEqual([
      "Rescheduled for Fri 2:30 PM",
    ]);
    expect([...fake.held.values()]).toHaveLength(1);
  });

  test("a message no longer wanted (or the bot turned off) is cancelled", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const { queue } = await sync(
      [planned({ key: "ann@example.com|reminder-2" })],
      [],
      fake.slack,
    );
    const off = await sync([], queue, fake.slack);
    expect(off.counts.cancelled).toBe(1);
    expect(off.events.map((e) => e.result)).toEqual(["Cancelled"]);
    expect(off.queue[0]?.status).toBe("cancelled");
    expect(fake.held.size).toBe(0);
  });

  test("never touches a message within 2 minutes of sending", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const postAt = new Date(NOW + 30 * MIN);
    const { queue } = await sync(
      [planned({ key: "ann@example.com|reminder-2", postAt })],
      [],
      fake.slack,
    );
    const late = await sync([], queue, fake.slack, +postAt - FREEZE_MS + 1000);
    expect(late.counts.cancelled).toBe(0);
    expect(fake.held.size).toBe(1);
  });

  test("a scheduled message whose time passed is marked sent, once", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const plan = [planned({ key: "ann@example.com|reminder-2" })];
    const { queue } = await sync(plan, [], fake.slack);
    const after = await sync(plan, queue, fake.slack, NOW + 61 * MIN);
    expect(after.events.map((e) => e.result)).toEqual(["Sent"]);
    const again = await sync(plan, after.queue, fake.slack, NOW + 66 * MIN);
    expect(again.events).toEqual([]);
  });

  test("a blank fill-in holds the message: logged once, queued once filled", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const key = "ann@example.com|checkin";
    const held = planned({
      key,
      kind: "checkin",
      text: null,
      missing: "{mentor_channel}",
    });
    const first = await sync([held], [], fake.slack);
    expect(first.events.map((e) => e.result)).toEqual([
      "Held: {mentor_channel} is blank",
    ]);
    const second = await sync([held], first.queue, fake.slack);
    expect(second.events).toEqual([]);
    const filled = await sync(
      [planned({ key, kind: "checkin" })],
      second.queue,
      fake.slack,
    );
    expect(filled.events.map((e) => e.result)).toEqual([
      "Scheduled for Fri 2:00 PM",
    ]);
  });

  test("a queued message whose fill-in is cleared is cancelled and held", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const key = "ann@example.com|checkin";
    const { queue } = await sync([planned({ key })], [], fake.slack);
    const cleared = await sync(
      [planned({ key, text: null, missing: "{mentor_channel}" })],
      queue,
      fake.slack,
    );
    expect(fake.held.size).toBe(0);
    expect(cleared.events.map((e) => e.result)).toEqual([
      "Held: {mentor_channel} is blank",
    ]);
  });

  test("not on Slack: logged once, looked up again every sync, queued when they join", async () => {
    const fake = fakeSlack({});
    const checkinAt = new Date(NOW - 10 * MIN); // already passed
    const plan = [
      planned({
        key: "ann@example.com|checkin",
        kind: "checkin",
        template: "Check-in: Mentor",
        postAt: checkinAt,
        deadline: new Date(NOW + 5 * 60 * MIN), // first stretch ends later
      }),
      planned({
        key: "ann@example.com|after-1",
        kind: "after",
        postAt: new Date(NOW - 5 * MIN),
      }),
      planned({ key: "ann@example.com|reminder-2" }),
    ];
    const first = await sync(plan, [], fake.slack);
    expect(first.events.map((e) => e.result)).toEqual(["Not on Slack"]);
    const second = await sync(plan, first.queue, fake.slack);
    expect(second.events).toEqual([]);
    expect(fake.calls.filter((c) => c.startsWith("lookup"))).toHaveLength(2);

    // They join Slack with that exact email.
    const directory = { "ann@example.com": "U9" };
    const joined = fakeSlack(directory);
    const third = await sync(plan, second.queue, joined.slack);
    expect(third.events.map((e) => e.result)).toEqual([
      "Sent late",
      "Scheduled for Fri 2:00 PM",
    ]);
    expect(joined.posted).toHaveLength(1); // the past After-a-shift is skipped
    expect(third.queue.some((r) => r.status === "not-on-slack")).toBe(false);
  });

  test("the Queue round-trips through the sheet", async () => {
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const { queue } = await sync(
      [planned({ key: "ann@example.com|reminder-2" })],
      [],
      fake.slack,
    );
    expect(readQueue(queueGrid(queue))).toEqual(queue);
    expect(queue[0]?.hash).toBe(textHash("⏰ Shift #2 starts in 15 min"));
  });
});

describe("Planned messages tab and Sent / next", () => {
  const messages = readMessages([
    ["Message", "Template"],
    ["Check-in: Mentor", "Hi {first_name}, ping {poc} in {mentor_channel}"],
    ["Shift reminder: last shift", "Last one, {first_name}"],
    ["After a shift", "Wrap! Next: {next_shift}"],
    ["Last day", "Morning {first_name}: {this_shift}"],
    ["Final thank you: Mentor", "{hackers} hackers, thanks {first_name}"],
    ["Check-in: Judge", "Hi {first_name}, judges are in {judge_channel}"],
    ["Final thank you: Judge", "{hackers} hackers, thanks {first_name}"],
    ["{mentor_channel}", "C0CEZUSAVH6"],
    ["{judge_channel}", "C0CDZB3DQ2X"],
    ["{hackers}", ""],
  ]);
  const header = [
    "Role",
    "Full name",
    "Email",
    "Shift",
    "POC",
    "Personal note",
    "Send?",
    "Preview",
    "",
    "Check before sending",
    "Email override",
  ];
  const roster = buildRoster(
    readPeople([
      header,
      [
        "Judge",
        "Ann Lee",
        "ann@example.com",
        "Sat 9am-3pm, Sun 9am-1pm",
        "@Jess Xing",
        "",
        "TRUE",
      ],
      [
        "Judge",
        "Bo Chan",
        "bo@example.com",
        "Sun 9am-1pm",
        "@Emily Liu",
        "",
        "FALSE",
      ],
      ["Judge", "Cy Diaz", "", "Sun 9am-1pm", "@Jess Xing", "", "TRUE"],
    ]),
    [],
  );
  const lines = planLines(roster, messages, {
    queue: [],
    nowMs: NOW,
    enabled: true,
  });

  test("every message for every person, ticked or not, sorted by person then time", () => {
    expect(lines.map((l) => `${l.name} · ${l.message} · ${l.status}`)).toEqual([
      "Ann Lee · Check-in: Judge · Not queued yet (next sync)",
      "Ann Lee · After a shift · Not queued yet (next sync)",
      "Ann Lee · Last day · Not queued yet (next sync)",
      "Ann Lee · Shift reminder: last shift · Not queued yet (next sync)",
      "Ann Lee · Final thank you: Judge · Held: {hackers} is blank",
      "Bo Chan · Check-in: Judge · Not ticked (Send? off)",
      "Bo Chan · Final thank you: Judge · Not ticked (Send? off)",
      "Cy Diaz · Check-in: Judge · No email",
      "Cy Diaz · Final thank you: Judge · No email",
    ]);
  });

  test("text is what Slack gets, with mentions and channels readable", () => {
    const unit: Unit = {
      email: "ann@example.com",
      name: "Ann Lee",
      firstName: "Ann",
      role: "Mentor",
      rows: [],
      shifts: parseShiftList("Sat 9am-3pm", "Mentor").shifts,
      poc: "@Emily Liu",
      note: "",
    };
    const [checkin] = planUnit(unit, messages);
    expect(checkin?.text).toBe("Hi Ann, ping <@U0CHE5NL5H7> in <#C0CEZUSAVH6>");
    const mentor = buildRoster(
      readPeople([
        header,
        ["Mentor", "Ann Lee", "ann@example.com", "", "@Emily Liu", "", "TRUE"],
      ]),
      [],
    );
    // Not on a schedule, so "Not on the schedule anymore": no lines but a reason.
    expect(
      planLines(mentor, messages, { queue: [], nowMs: NOW, enabled: true }),
    ).toEqual([]);
  });

  test("status: Slack's record wins, then why it won't go", () => {
    const p = planned({ key: "ann@example.com|reminder-2" });
    const ctx = {
      queue: [] as QueueRow[],
      nowMs: NOW,
      enabled: true,
      gate: null,
    };
    const row = (status: QueueRow["status"], key = p.key): QueueRow => ({
      key,
      role: "Mentor",
      name: "Ann Lee",
      email: "ann@example.com",
      message: p.template,
      channel: "D1",
      messageId: "Q1",
      postAt: p.postAt.toISOString(),
      hash: "",
      status,
      updated: "",
    });
    expect(messageStatus(p, { ...ctx, queue: [row("sent")] })).toBe("Sent");
    expect(messageStatus(p, { ...ctx, queue: [row("scheduled")] })).toBe(
      "Queued",
    );
    expect(
      messageStatus(p, {
        ...ctx,
        queue: [row("not-on-slack", "ann@example.com|slack")],
      }),
    ).toBe("Not on Slack");
    expect(messageStatus(p, { ...ctx, gate: "Not ticked (Send? off)" })).toBe(
      "Not ticked (Send? off)",
    );
    expect(messageStatus({ ...p, text: null, missing: "{hackers}" }, ctx)).toBe(
      "Held: {hackers} is blank",
    );
    expect(messageStatus(p, { ...ctx, nowMs: NOW + 2 * 60 * MIN })).toBe(
      "Past",
    );
    expect(messageStatus(p, { ...ctx, enabled: false })).toBe("Bot paused");
  });

  test("Sent / next: one line per person", async () => {
    const ann = roster[0]!;
    const fake = fakeSlack({ "ann@example.com": "U1" });
    const plan = [
      planned({
        key: "ann@example.com|reminder-2",
        postAt: new Date(NOW - 10 * MIN),
      }),
      planned({ key: "ann@example.com|after-1", template: "After a shift" }),
    ];
    const { queue } = await sync(plan, [], fake.slack, NOW - 20 * MIN);
    const sentOne = queue.map((r) =>
      r.key.endsWith("reminder-2") ? { ...r, status: "sent" as const } : r,
    );
    const ctx = { queue: sentOne, planned: plan, nowMs: NOW, enabled: true };
    expect(sentNext(ann, ctx)).toBe(
      "1 sent · next: After a shift, Fri 2:00 PM",
    );
    expect(sentNext(roster[1]!, ctx)).toBe("Not ticked");
    expect(sentNext(roster[2]!, ctx)).toBe("No email");
    expect(
      sentNext(ann, {
        ...ctx,
        queue: sentOne.map((r) => ({ ...r, status: "sent" as const })),
      }),
    ).toBe("All sent");
    expect(
      sentNext(ann, {
        ...ctx,
        queue: [],
        planned: [planned({ key: "x", text: null, missing: "{projects}" })],
      }),
    ).toBe("Held: {projects} is blank");
  });
});
