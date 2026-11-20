import { describe, expect, test } from "vitest";
import { isOrganizerDm, normalizeDm, syncOrganizerDms } from "./organizer-sync";

const NOW = Date.parse("2026-11-20T14:00:00Z");
const at = (iso: string) => new Date(iso);

/** A fake Slack that holds scheduled messages the way Slack stores them. */
function fakeSlack(
  initial: { id: string; channel_id: string; post_at: number; text: string }[],
) {
  const held = [...initial];
  const calls: string[] = [];
  let n = 0;
  const fetchImpl: typeof fetch = async (url, init) => {
    const method = String(url).split("/").pop()!;
    const args = new URLSearchParams(String(init?.body));
    calls.push(method);
    if (method === "chat.scheduledMessages.list")
      return Response.json({ ok: true, scheduled_messages: held });
    if (method === "conversations.open")
      return Response.json({
        ok: true,
        channel: { id: `D${args.get("users")}` },
      });
    if (method === "chat.scheduleMessage") {
      // Slack stores emoji as :codes: and escapes &.
      const text = args
        .get("text")!
        .replace("⏰", ":alarm_clock:")
        .replace(/&/g, "&amp;");
      held.push({
        id: `Q${++n}`,
        channel_id: args.get("channel")!,
        post_at: Number(args.get("post_at")),
        text,
      });
      return Response.json({ ok: true, scheduled_message_id: `Q${n}` });
    }
    if (method === "chat.deleteScheduledMessage") {
      held.splice(
        held.findIndex((m) => m.id === args.get("scheduled_message_id")),
        1,
      );
      return Response.json({ ok: true });
    }
    throw new Error(method);
  };
  return { fetchImpl, held, calls };
}

const dm = (user: string, iso: string, title = "Registration desk") => ({
  slackUserId: user,
  postAt: at(iso),
  text: `⏰ In 15 min (4:45 PM): *${title} & co*\n> Location: Rm 1110`,
});

describe("syncOrganizerDms", () => {
  test("Slack's stored text matches what we sent", () => {
    expect(
      normalizeDm(
        ":alarm_clock: In 15 min (7:00 PM): *A &amp; B*\n:busts_in_silhouette: With: Al",
      ),
    ).toBe(normalizeDm("⏰ In 15 min (7:00 PM): *A & B*\n👥 With: Al"));
  });

  test("only organizer DMs count; marketing and rehearsals are left alone", () => {
    expect(isOrganizerDm(":alarm_clock: In 15 min (7:00 PM): *x*")).toBe(true);
    expect(
      isOrganizerDm(
        "[TEST for Ann · Fri 1:45 PM]\n⏰ In 15 min (2:00 PM): *x*",
      ),
    ).toBe(true);
    expect(isOrganizerDm(":alarm_clock: Post in 5 min: 11:00 AM")).toBe(false);
    expect(
      isOrganizerDm(
        "[TEST for Ann · Fri 1:45 PM] (rehearsal)\n⏰ In 15 min (2:00 PM): *x*",
      ),
    ).toBe(false);
  });

  test("queues once, keeps it, moves it when the owner changes, cancels on empty", async () => {
    const marketing = {
      id: "M1",
      channel_id: "DUALLISON",
      post_at: NOW / 1000 + 3600,
      text: ":alarm_clock: Post in 5 min: 11:00 AM",
    };
    const slack = fakeSlack([marketing]);
    const sync = (rows: ReturnType<typeof dm>[]) =>
      syncOrganizerDms("t", rows, {
        fetchImpl: slack.fetchImpl,
        now: () => NOW,
        sleep: async () => undefined,
      });

    expect(await sync([dm("UANN", "2026-11-20T21:30:00Z")])).toMatchObject({
      scheduled: 1,
      kept: 0,
      cancelled: 0,
    });
    expect(await sync([dm("UANN", "2026-11-20T21:30:00Z")])).toMatchObject({
      scheduled: 0,
      kept: 1,
      cancelled: 0,
    });
    // Owner changed in the sheet: Ann's DM goes, Bob's comes.
    expect(await sync([dm("UBOB", "2026-11-20T21:30:00Z")])).toMatchObject({
      scheduled: 1,
      kept: 0,
      cancelled: 1,
    });
    expect(slack.held.map((m) => m.channel_id).sort()).toEqual([
      "DUALLISON",
      "DUBOB",
    ]);
    expect(await sync([])).toMatchObject({ cancelled: 1 });
    // Marketing's DM was never touched.
    expect(slack.held).toEqual([marketing]);
  });

  test("DMs in their last 2 minutes are never touched or re-queued", async () => {
    const soon = {
      id: "S1",
      channel_id: "DUANN",
      post_at: NOW / 1000 + 60,
      text: ":alarm_clock: In 15 min (old): *x*",
    };
    const slack = fakeSlack([soon]);
    const result = await syncOrganizerDms(
      "t",
      [dm("UANN", new Date(NOW + 60_000).toISOString())],
      {
        fetchImpl: slack.fetchImpl,
        now: () => NOW,
      },
    );
    expect(result).toMatchObject({ scheduled: 0, cancelled: 0 });
    expect(slack.held).toEqual([soon]);
  });

  test("a rate limit is waited out, not fatal", async () => {
    const slack = fakeSlack([]);
    let limited = false;
    const fetchImpl: typeof fetch = async (url, init) => {
      if (!limited && String(url).endsWith("chat.scheduleMessage")) {
        limited = true;
        return new Response("", {
          status: 429,
          headers: { "Retry-After": "1" },
        });
      }
      return slack.fetchImpl(url, init);
    };
    const waits: number[] = [];
    const result = await syncOrganizerDms(
      "t",
      [dm("UANN", "2026-11-20T21:30:00Z")],
      {
        fetchImpl,
        now: () => NOW,
        sleep: async (ms) => void waits.push(ms),
      },
    );
    expect(result).toMatchObject({ scheduled: 1, issues: [] });
    expect(waits).toEqual([1000]);
  });

  test("a dry run counts changes but never schedules or cancels", async () => {
    const stale = {
      id: "Q0",
      channel_id: "DUBOB",
      post_at: Date.parse("2026-11-20T20:00:00Z") / 1000,
      text: ":alarm_clock: In 15 min (3:00 PM): *Old task*",
    };
    const slack = fakeSlack([stale]);
    const result = await syncOrganizerDms(
      "t",
      [dm("UANN", "2026-11-20T21:30:00Z")],
      { fetchImpl: slack.fetchImpl, now: () => NOW, dryRun: true },
    );
    expect(result).toMatchObject({ scheduled: 1, cancelled: 1, kept: 0 });
    expect(slack.held).toEqual([stale]);
    expect(slack.calls).not.toContain("chat.scheduleMessage");
    expect(slack.calls).not.toContain("chat.deleteScheduledMessage");
  });
});
