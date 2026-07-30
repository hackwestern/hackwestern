import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { like } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import { generateUnsubscribeToken } from "~/server/subscribers";
import { unsubscribeUrl, renderFor, selectEligible } from "./send-campaign";

describe("send-campaign helpers", () => {
  test("unsubscribeUrl builds the /unsubscribe page link", () => {
    expect(unsubscribeUrl("tok123")).toContain("/unsubscribe?token=tok123");
    expect(unsubscribeUrl("tok123")).not.toContain("/api/unsubscribe");
  });

  test("renderFor sets subject, per-recipient footer, and one-click headers", () => {
    const r = renderFor({
      email: "p@gmail.com",
      source: "hw12",
      unsubscribeToken: "tok123",
    });
    expect(r.subject).toMatch(/Hack Western 13/i);
    expect(r.html).toContain("because you subscribed to Hack Western 12");
    expect(r.html).toContain("p@gmail.com");
    expect(r.headers["List-Unsubscribe"]).toContain("/api/unsubscribe?token=tok123");
    expect(r.headers["List-Unsubscribe-Post"]).toBe("List-Unsubscribe=One-Click");
  });
});

// Gap-2: the selection query is the single-send + suppression guarantee.
// Seed rows in every state and assert only the eligible ones are picked.
describe("selectEligible (DB integration)", () => {
  const PREFIX = "zz-seltest-";
  const START = new Date("2026-08-01T00:00:00Z");
  const cleanup = () =>
    db.delete(emailSubscribers).where(like(emailSubscribers.email, `${PREFIX}%`));

  beforeEach(cleanup);
  afterEach(cleanup);

  test("excludes unsubscribed, bounced, and already-sent-this-campaign", async () => {
    const mk = (tag: string, extra: Record<string, unknown>) => ({
      email: `${PREFIX}${tag}@gmail.com`,
      source: "hw12",
      unsubscribeToken: generateUnsubscribeToken(),
      ...extra,
    });
    await db.insert(emailSubscribers).values([
      mk("fresh", {}),
      mk("unsub", { unsubscribedAt: new Date() }),
      mk("bounced", { bouncedAt: new Date() }),
      mk("sent", { lastSentAt: new Date("2026-08-02T00:00:00Z") }), // >= START
      mk("prior", { lastSentAt: new Date("2026-07-01T00:00:00Z") }), // < START → eligible
    ]);

    const picked = (await selectEligible(100, START))
      .map((r) => r.email)
      .filter((e) => e.startsWith(PREFIX));

    expect(picked).toContain(`${PREFIX}fresh@gmail.com`);
    expect(picked).toContain(`${PREFIX}prior@gmail.com`);
    expect(picked).not.toContain(`${PREFIX}unsub@gmail.com`);
    expect(picked).not.toContain(`${PREFIX}bounced@gmail.com`);
    expect(picked).not.toContain(`${PREFIX}sent@gmail.com`);
  });
});
