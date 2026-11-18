import { describe, expect, test } from "vitest";

import {
  buildPingLog,
  mentionLabel,
  reminderTarget,
  selectUpNext,
  type HelpPingRow,
  type ReminderRow,
} from "~/lib/task-pings";

const NOW = new Date("2026-11-21T12:00:00-05:00");
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-05:00`);

const reminder = (
  id: string,
  hhmm: string,
  over: Partial<ReminderRow> = {},
): ReminderRow => ({
  id,
  task: `Task ${id}`,
  owner: "[SPON] Noah",
  slackUserId: "UNOAH",
  postAt: at(hhmm),
  status: "scheduled",
  error: null,
  ...over,
});

const help = (
  id: string,
  hhmm: string,
  over: Partial<HelpPingRow> = {},
): HelpPingRow => ({
  id,
  sponsorName: "Acme",
  reason: "swag",
  createdAt: at(hhmm),
  postedToSlack: true,
  pingCount: 0,
  ...over,
});

describe("mentionLabel", () => {
  test("reads Slack mentions as people see them", () => {
    expect(mentionLabel("<!here>")).toBe("@here");
    expect(mentionLabel("<!channel>")).toBe("@channel");
    expect(mentionLabel("<!subteam^S1|@spon-team>")).toBe("@spon-team");
    expect(mentionLabel("<!subteam^S1>")).toBeNull();
    expect(mentionLabel("")).toBeNull();
    expect(mentionLabel(undefined)).toBeNull();
  });
});

describe("reminderTarget", () => {
  test("a DM is named after the parsed owner; no Slack user is the channel", () => {
    expect(reminderTarget({ owner: "[SPON] Noah", slackUserId: "U1" })).toEqual(
      { kind: "dm", name: "Noah" },
    );
    expect(reminderTarget({ owner: "All", slackUserId: null })).toEqual({
      kind: "channel",
    });
    // A saved email override on an unclear cell still DMs; show the cell.
    expect(
      reminderTarget({ owner: " Noah & Caroline ", slackUserId: "U1" }),
    ).toEqual({ kind: "dm", name: "Noah & Caroline" });
  });
});

describe("selectUpNext", () => {
  test("the next three scheduled pings, soonest first", () => {
    const rows = [
      reminder("d", "16:00"),
      reminder("past", "11:00"),
      reminder("a", "13:00", { slackUserId: null, owner: "All" }),
      reminder("failed", "13:30", { status: "failed" }),
      reminder("cancelled", "13:45", { status: "cancelled" }),
      reminder("b", "14:00"),
      reminder("c", "15:00"),
    ];
    expect(selectUpNext(rows, NOW)).toEqual([
      { id: "a", at: at("13:00"), task: "Task a", target: { kind: "channel" } },
      {
        id: "b",
        at: at("14:00"),
        task: "Task b",
        target: { kind: "dm", name: "Noah" },
      },
      {
        id: "c",
        at: at("15:00"),
        task: "Task c",
        target: { kind: "dm", name: "Noah" },
      },
    ]);
  });

  test("nothing waiting", () => {
    expect(selectUpNext([reminder("past", "11:00")], NOW)).toEqual([]);
  });
});

describe("buildPingLog", () => {
  test("past task pings and help pings, newest first; cancelled and future left out", () => {
    const { entries, hasMore } = buildPingLog(
      [
        reminder("t1", "09:00", { status: "sent-window-passed" }),
        reminder("t2", "11:00", {
          status: "failed",
          error: "restricted_action",
          slackUserId: null,
          owner: "",
        }),
        reminder("t3", "10:00", { status: "cancelled" }),
        reminder("future", "13:00"),
        reminder("t4", "11:30"), // time passed, not yet marked by a sync
      ],
      [
        help("h1", "10:30"),
        help("h2", "11:45", { postedToSlack: false, pingCount: 2 }),
      ],
      NOW,
    );
    expect(hasMore).toBe(false);
    expect(entries.map((e) => [e.kind, e.id, e.status])).toEqual([
      ["help", "h2", "not-posted"],
      ["task", "t4", "scheduled"],
      ["task", "t2", "failed"],
      ["help", "h1", "posted"],
      ["task", "t1", "scheduled"],
    ]);
    expect(entries[2]).toMatchObject({
      target: { kind: "channel" },
      error: "restricted_action",
    });
    expect(entries[0]).toMatchObject({ pingCount: 2, sponsorName: "Acme" });
  });

  test("caps at the limit and says there's more", () => {
    const rows = Array.from({ length: 5 }, (_, i) =>
      reminder(`t${i}`, `0${i + 1}:00`),
    );
    const { entries, hasMore } = buildPingLog(rows, [help("h", "06:00")], NOW, 3);
    expect(entries.map((e) => e.id)).toEqual(["h", "t4", "t3"]);
    expect(hasMore).toBe(true);
    expect(buildPingLog(rows, [], NOW, 5).hasMore).toBe(false);
  });
});
