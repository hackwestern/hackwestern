import { eq } from "drizzle-orm";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import type * as Env from "~/env";
import {
  NOTIFY_TIMEOUT_MS,
  notifyCoffeeChat,
} from "~/server/api/utils/coffee-chat-notify";
import { db } from "~/server/db";
import {
  applications,
  coffeeChats,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";
import { sendViaMailjet } from "~/server/mail-mailjet";
import { sendCoffeeChatDm } from "~/server/slack/coffee-chat-dm";

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      MAILJET_API_KEY: "test-key",
      MAILJET_SECRET_KEY: "test-secret",
      SLACK_BOT_TOKEN: undefined,
      // Safe dummy so modules that read it at import load with no .env.
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
    },
  };
});

// Mocked Mailjet, Slack DM and sheet mirror: never a real call.
vi.mock("~/server/mail-mailjet", () => ({
  sendViaMailjet: vi.fn(async () => ({
    data: { delivered: [], queued: [], bounced: [] },
    error: null,
  })),
}));
vi.mock("~/server/slack/coffee-chat-dm", () => ({
  sendCoffeeChatDm: vi.fn(async () => "sent"),
}));
vi.mock("~/server/api/utils/coffee-chat-sheet-mirror", () => ({
  mirrorCoffeeChats: vi.fn(async () => undefined),
}));

const send = vi.mocked(sendViaMailjet);
const dm = vi.mocked(sendCoffeeChatDm);

beforeEach(() => {
  send.mockClear();
  dm.mockReset();
});
afterEach(() => {
  vi.useRealTimers();
});

async function makeChat(
  status?: "pending" | "accepted" | "declined" | "cancelled",
) {
  const id = `fallback-hacker-${Math.random().toString(36).slice(2)}`;
  const [sponsor] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Fallback Sponsor ${id}` })
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
      room: "Rm 2241",
      slotTime: "10:15",
      ...(status ? { status } : {}),
    })
    .returning();
  return { chat: chat!, email: `${id}@example.com` };
}

describe("coffee chat offer: Slack first, email as fallback", () => {
  test("Slack sent: no email", async () => {
    dm.mockResolvedValue("sent");
    const { chat } = await makeChat();

    await notifyCoffeeChat("offered", { id: chat.id });

    expect(dm).toHaveBeenCalledTimes(1);
    expect(send).not.toHaveBeenCalled();
  });

  test.each(["not-found", "skipped-no-token", "failed"] as const)(
    "Slack %s: one email",
    async (result) => {
      dm.mockResolvedValue(result);
      const { chat, email } = await makeChat();

      await notifyCoffeeChat("offered", { id: chat.id });

      expect(send).toHaveBeenCalledTimes(1);
      expect(send.mock.calls[0]![0].to).toBe(email);
    },
  );

  test("other events send neither a DM nor an email", async () => {
    const { chat } = await makeChat();
    for (const event of ["accepted", "declined"] as const) {
      await notifyCoffeeChat(event, { id: chat.id });
    }
    expect(dm).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("Slack hanging: the email still goes out within the cap", async () => {
    let dmCalled!: () => void;
    const called = new Promise<void>((resolve) => (dmCalled = resolve));
    dm.mockImplementation(() => {
      dmCalled();
      return new Promise(() => undefined);
    });
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { chat } = await makeChat();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    let settledAt: number | null = null;

    const notified = notifyCoffeeChat("offered", { id: chat.id }).finally(
      () => (settledAt = Date.now()),
    );
    // The DB load runs on real I/O; the Slack timer starts once it's done.
    await called;
    const start = Date.now();
    for (let t = 0; settledAt === null && t < NOTIFY_TIMEOUT_MS * 3; t += 100) {
      await vi.advanceTimersByTimeAsync(100);
    }
    await notified;

    expect(send).toHaveBeenCalledTimes(1);
    expect(settledAt! - start).toBeLessThanOrEqual(NOTIFY_TIMEOUT_MS);
    log.mockRestore();
  });
});

describe("coffee chat cancelled or moved: Slack first, email as fallback", () => {
  test("cancel (the chat was pending or accepted), Slack sent: one DM, no email", async () => {
    dm.mockResolvedValue("sent");
    const { chat } = await makeChat("cancelled");
    await notifyCoffeeChat("cancelled", { id: chat.id });
    expect(dm).toHaveBeenCalledTimes(1);
    expect(dm.mock.calls[0]![2]).toBe("cancelled");
    expect(send).not.toHaveBeenCalled();
  });

  test("cancel, Slack not found: one email with the notice and /live link", async () => {
    dm.mockResolvedValue("not-found");
    const { chat, email } = await makeChat("cancelled");
    await notifyCoffeeChat("cancelled", { id: chat.id });
    expect(send).toHaveBeenCalledTimes(1);
    const mail = send.mock.calls[0]![0];
    expect(mail.to).toBe(email);
    expect(mail.text).toContain("was cancelled by the organizers.");
    expect(mail.text).toContain("https://www.hackwestern.com/live");
  });

  test("a chat that was declined is never announced as cancelled or moved", async () => {
    const { chat } = await makeChat("declined");
    await notifyCoffeeChat("cancelled", { id: chat.id });
    await notifyCoffeeChat("roomMoved", { id: chat.id });
    expect(dm).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
  });

  test("room move of two chats: two notices naming the new room", async () => {
    dm.mockResolvedValue("not-found");
    const first = await makeChat("pending");
    const second = await makeChat("accepted");
    for (const { chat } of [first, second]) {
      await db
        .update(coffeeChats)
        .set({ room: "Rm 9999" })
        .where(eq(coffeeChats.id, chat.id));
    }
    await Promise.all(
      [first, second].map(({ chat }) =>
        notifyCoffeeChat("roomMoved", { id: chat.id }),
      ),
    );
    expect(dm).toHaveBeenCalledTimes(2);
    expect(send).toHaveBeenCalledTimes(2);
    for (const [mail] of send.mock.calls) {
      expect(mail.text).toContain("is now in Rm 9999.");
    }
  });
});
