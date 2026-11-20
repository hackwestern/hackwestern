import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { db } from "~/server/db";
import { syncMarketingReminders } from "./marketing-notifications";
import {
  planMarketingReminders,
  readMarketingTasks,
} from "./marketing-schedule";

const tasks = readMarketingTasks(
  readFileSync("context/HW13_Notification_Schedule.csv", "utf8"),
);

test("plans all 82 tasks, with the first Slack reminder at Friday 10:55 AM Eastern", () => {
  const plan = planMarketingReminders(tasks);
  expect(plan).toHaveLength(66);
  expect(plan.flatMap((item) => item.taskIds)).toHaveLength(82);
  expect(plan[0]).toMatchObject({
    recipientName: "Allison",
    postAt: new Date("2026-11-20T15:55:00Z"),
    taskIds: ["1"],
  });
  expect(plan[0]?.text).toContain("⏰ Post in 5 min: 11:00 AM");
  expect(plan[0]?.text).toContain(
    "📸 Next story: 5:00 PM · Grand Hall · Registration (Welcome)",
  );
  expect(plan.find((row) => row.taskIds.includes("59"))).toMatchObject({
    recipientName: "Brittney",
    postAt: new Date("2026-11-22T00:55:00Z"),
  });
  expect(plan.find((row) => row.taskIds.includes("59"))?.text).not.toContain(
    "Next message",
  );
  expect(
    plan.some((row) => row.text.includes("Next message: Sun 7:00 AM")),
  ).toBe(true);
  const mixed = plan.find((row) => row.text.startsWith("⏰ Due in 5 min"));
  expect(mixed?.text).toMatch(/📣 Slack message[\s\S]+📸 Story/);
  expect(mixed?.text).toContain("\x60\x60\x60");
  expect(
    planMarketingReminders(tasks, new Set(["1"])).flatMap((row) => row.taskIds),
  ).not.toContain("1");
});

test("reconciles edits and pause without queueing duplicate DMs", async () => {
  const [first] = planMarketingReminders(tasks);
  if (!first) throw new Error("Expected a first reminder");
  const row = { ...first, slackUserId: "UALLISON", routeKey: "live:UALLISON" };
  const calls: { method: string; args: URLSearchParams }[] = [];
  const mockedSlack: typeof fetch = async (url, init) => {
    const method = String(url).split("/").pop()!;
    calls.push({ method, args: new URLSearchParams(String(init?.body)) });
    return Response.json({
      ok: true,
      channel: { id: "DALLISON" },
      scheduled_message_id: `Q${calls.length}`,
    });
  };
  const sync = (rows: (typeof row)[]) =>
    syncMarketingReminders(db, "mock-token", rows, mockedSlack, () =>
      Date.parse("2026-11-20T14:00:00Z"),
    );

  expect(await sync([row])).toMatchObject({ scheduled: 1, issues: [] });
  expect(calls[1]?.args.get("post_at")).toBe(
    String(Date.parse("2026-11-20T15:55:00Z") / 1000),
  );
  expect(await sync([row])).toMatchObject({
    kept: 1,
    scheduled: 0,
    issues: [],
  });
  expect(await sync([{ ...row, text: "Edited reminder" }])).toMatchObject({
    cancelled: 1,
    scheduled: 1,
    issues: [],
  });
  expect(await sync([])).toMatchObject({
    cancelled: 1,
    scheduled: 0,
    issues: [],
  });
  expect(calls.map((call) => call.method)).toEqual([
    "conversations.open",
    "chat.scheduleMessage",
    "chat.deleteScheduledMessage",
    "conversations.open",
    "chat.scheduleMessage",
    "chat.deleteScheduledMessage",
  ]);
});
