import { afterEach, describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import { notifyCoffeeChat } from "~/server/api/utils/coffee-chat-notify";
import type { CoffeeChatNotice } from "~/server/api/utils/coffee-chat-notify";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";
import { sendCoffeeChatDm } from "~/server/slack/coffee-chat-dm";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      MAILJET_API_KEY: undefined,
      // Safe dummy so modules that read it at import load with no .env.
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
      MAILJET_SECRET_KEY: undefined,
      SLACK_BOT_TOKEN: "xoxb-test-token",
    },
  };
});

const CHAT: CoffeeChatNotice = {
  chatId: "11111111-1111-4111-8111-111111111111",
  sponsorName: "StarTech",
  hackerEmail: "sam@example.com",
  hackerSlackEmail: null,
  hackerFirstName: "Sam",
  admitted: true,
  slotTime: "10:15",
  durationMinutes: 15,
  room: "Rm 2241",
  status: "pending",
};

type Call = { method: string; args: URLSearchParams; auth: string };

/** A mocked Slack API: answers per method, records every call. */
function mockSlack(answers: Record<string, unknown> = {}) {
  const calls: Call[] = [];
  const defaults: Record<string, unknown> = {
    "users.lookupByEmail": { ok: true, user: { id: "U123" } },
    "conversations.open": { ok: true, channel: { id: "D456" } },
    "chat.postMessage": { ok: true, ts: "1.2" },
  };
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const method = String(url).replace("https://slack.com/api/", "");
    const headers = (init?.headers ?? {}) as Record<string, string>;
    calls.push({
      method,
      args: new URLSearchParams(String(init?.body ?? "")),
      auth: headers.Authorization ?? "",
    });
    const body = answers[method] ?? defaults[method] ?? { ok: false };
    return new Response(JSON.stringify(body), { status: 200 });
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("sendCoffeeChatDm (T22)", () => {
  test("looks up by email, opens a DM, posts Accept/Decline buttons", async () => {
    const slack = mockSlack();

    expect(
      await sendCoffeeChatDm(CHAT, { token: "xoxb-t", fetch: slack.fn }),
    ).toBe("sent");

    expect(slack.calls.map((c) => c.method)).toEqual([
      "users.lookupByEmail",
      "conversations.open",
      "chat.postMessage",
    ]);
    expect(slack.calls.every((c) => c.auth === "Bearer xoxb-t")).toBe(true);
    expect(slack.calls[0]!.args.get("email")).toBe("sam@example.com");
    expect(slack.calls[1]!.args.get("users")).toBe("U123");
    const post = slack.calls[2]!.args;
    expect(post.get("channel")).toBe("D456");
    const blocks = JSON.parse(post.get("blocks") ?? "[]") as {
      type: string;
      text?: { text: string };
      elements?: { action_id?: string; value?: string }[];
    }[];
    const details = blocks[0]!.text!.text;
    expect(details).toContain("StarTech");
    expect(details).toContain("10:15 AM");
    expect(details).toContain("Rm 2241");
    const buttons = blocks.find((b) => b.type === "actions")!.elements!;
    expect(buttons.map((b) => [b.action_id, b.value])).toEqual([
      ["coffee_chat_accept", CHAT.chatId],
      ["coffee_chat_decline", CHAT.chatId],
    ]);
  });

  test("no DM and no error when the token is missing", async () => {
    const slack = mockSlack();
    expect(
      await sendCoffeeChatDm(CHAT, { token: undefined, fetch: slack.fn }),
    ).toBe("skipped-no-token");
    expect(await sendCoffeeChatDm(CHAT, { token: "", fetch: slack.fn })).toBe(
      "skipped-no-token",
    );
    expect(slack.calls).toHaveLength(0);
  });

  test("no DM and no error when Slack has no account for the email", async () => {
    const slack = mockSlack({
      "users.lookupByEmail": { ok: false, error: "users_not_found" },
    });
    expect(
      await sendCoffeeChatDm(CHAT, { token: "xoxb-t", fetch: slack.fn }),
    ).toBe("not-found");
    expect(slack.calls.map((c) => c.method)).toEqual(["users.lookupByEmail"]);
  });

  test("no DM to a hacker who isn't admitted", async () => {
    const slack = mockSlack();
    expect(
      await sendCoffeeChatDm(
        { ...CHAT, admitted: false },
        { token: "xoxb-t", fetch: slack.fn },
      ),
    ).toBe("not-found");
    expect(slack.calls).toHaveLength(0);
  });

  test("other Slack errors come back as failed and are logged", async () => {
    const slack = mockSlack({
      "chat.postMessage": { ok: false, error: "channel_not_found" },
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    expect(
      await sendCoffeeChatDm(CHAT, { token: "xoxb-t", fetch: slack.fn }),
    ).toBe("failed");
    expect(log).toHaveBeenCalledWith(
      "coffee chat slack DM failed:",
      "Slack chat.postMessage failed: channel_not_found",
    );
    log.mockRestore();
  });

  test("says room TBA and escapes the sponsor name", async () => {
    const slack = mockSlack();
    await sendCoffeeChatDm(
      { ...CHAT, sponsorName: "A&B <Co>", room: null },
      { token: "xoxb-t", fetch: slack.fn },
    );
    const blocks = slack.calls[2]!.args.get("blocks") ?? "";
    expect(blocks).toContain("room TBA");
    expect(blocks).toContain("A&amp;B &lt;Co&gt;");
  });
});

describe("notifyCoffeeChat Slack channel", () => {
  async function makeChat() {
    const id = `dm-hacker-${Math.random().toString(36).slice(2)}`;
    const [sponsor] = await db
      .insert(sponsorJudgingSponsors)
      .values({ name: `DM Sponsor ${id}` })
      .returning();
    await db
      .insert(users)
      .values({ id, email: `${id}@example.com`, type: "hacker" });
    await db.insert(applications).values({
      userId: id,
      status: "CONFIRMED",
      firstName: "Sam",
      githubLink: "",
      linkedInLink: "",
      devpostLink: "",
      resumeLink: "",
    });
    const [chat] = await db
      .insert(coffeeChats)
      .values({
        sponsorId: sponsor!.id,
        userId: id,
        room: "Rm 2242",
        slotTime: "11:00",
      })
      .returning();
    return { chat: chat!, email: `${id}@example.com` };
  }

  test("one DM per offer, none for answers", async () => {
    const slack = mockSlack();
    vi.stubGlobal("fetch", slack.fn);
    const { chat, email } = await makeChat();

    // Timers frozen so the Slack timeout and the cap can never fire under
    // load; the mocked Slack answers at once, so nothing waits on the clock.
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    await notifyCoffeeChat("offered", { id: chat.id });
    for (const event of ["accepted", "declined"] as const) {
      await notifyCoffeeChat(event, { id: chat.id });
    }
    vi.useRealTimers();

    const posts = slack.calls.filter((c) => c.method === "chat.postMessage");
    expect(posts).toHaveLength(1);
    expect(slack.calls[0]!.args.get("email")).toBe(email);
  });
});
