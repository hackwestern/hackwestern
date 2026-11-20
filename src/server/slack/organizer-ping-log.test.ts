import { describe, expect, test } from "vitest";
import { organizerRemindersCopy as copy } from "~/content/organizer-reminders";
import {
  BOT_STALE_MS,
  botHealth,
  isHeartbeatDm,
  pingRows,
  type ScheduledMessage,
} from "./organizer-ping-log";
import { ORGANIZER_HEARTBEAT_AFTER_MS } from "./organizer-load";

const NOW = Date.parse("2026-11-20T18:00:00Z");
const at = (minutes: number) => new Date(NOW + minutes * 60_000);
const queued = (postAt: Date, text: string, id = "m"): ScheduledMessage => ({
  id,
  channel_id: "D1",
  post_at: Math.floor(+postAt / 1000),
  // Slack stores emoji as :codes: and escapes &, <, >.
  text: text.replace("⏰", ":alarm_clock:").replace(/&/g, "&amp;"),
});

const doors = "⏰ Coming up: *Doors open*\nStarts: 6:15 PM";
const food = "⏰ Coming up: *Food & drinks*\nStarts: 7:00 PM";

describe("pingRows", () => {
  test("past pings are sent; future ones are queued only when Slack holds them", () => {
    const rows = pingRows(
      [
        { to: "Jasmine", postAt: at(-5), text: doors },
        { to: "Noah", postAt: at(30), text: food },
        { to: "Aniya", postAt: at(60), text: doors },
      ],
      [queued(at(30), food)],
      NOW,
    );
    expect(rows.map((r) => [r.to, r.status])).toEqual([
      ["Jasmine", "sent"],
      ["Noah", "queued"],
      ["Aniya", "notQueued"],
    ]);
    expect(rows[1]!.title).toBe("Coming up: Food & drinks");
  });

  test("two people with the same reminder each need their own queued copy", () => {
    const rows = pingRows(
      [
        { to: "Aniya", postAt: at(30), text: doors },
        { to: "Noah", postAt: at(30), text: doors },
      ],
      [queued(at(30), doors)],
      NOW,
    );
    expect(rows.map((r) => r.status)).toEqual(["queued", "notQueued"]);
  });

  test("ignores the heartbeat and other bots' queued messages", () => {
    const rows = pingRows(
      [{ to: "Noah", postAt: at(30), text: doors }],
      [
        queued(at(30), copy.slack.heartbeat("Fri 1:00 PM")),
        queued(at(30), "⏰ Post in 5 min: marketing"),
      ],
      NOW,
    );
    expect(rows[0]!.status).toBe("notQueued");
  });
});

describe("botHealth", () => {
  const heartbeat = (checkIn: Date) =>
    queued(
      new Date(+checkIn + ORGANIZER_HEARTBEAT_AFTER_MS),
      copy.slack.heartbeat("Fri 1:00 PM"),
    );

  test("recognizes the bot's own heartbeat DM", () => {
    expect(isHeartbeatDm(heartbeat(at(0)).text)).toBe(true);
    expect(isHeartbeatDm(doors)).toBe(false);
  });

  test("healthy when the last check-in is recent", () => {
    const health = botHealth([heartbeat(at(-1))], NOW);
    expect(health).toEqual({ lastCheckIn: at(-1), healthy: true });
  });

  test("down when the check-in is stale or missing", () => {
    expect(
      botHealth([heartbeat(new Date(NOW - BOT_STALE_MS - 1000))], NOW).healthy,
    ).toBe(false);
    expect(botHealth([], NOW)).toEqual({ lastCheckIn: null, healthy: false });
  });
});
