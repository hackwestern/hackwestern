import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { inArray, like } from "drizzle-orm";
import { db } from "~/server/db";
import {
  applications,
  emailReminderSent,
  emailSubscribers,
  users,
} from "~/server/db/schema";
import {
  isTestEmail,
  maskEmail,
  renderReminder,
  selectRecipients,
} from "./send-incomplete-reminder";

describe("incomplete reminder helpers", () => {
  test("maskEmail keeps the first letter and the domain only", () => {
    expect(maskEmail("ada.lovelace@gmail.com")).toBe("a***@gmail.com");
  });

  test("isTestEmail catches test and throwaway addresses", () => {
    expect(isTestEmail("someone@example.com")).toBe(true);
    expect(isTestEmail("luka+test@gmail.com")).toBe(true);
    expect(isTestEmail("test1@uwo.ca")).toBe(true);
    expect(isTestEmail("contestant@uwo.ca")).toBe(false);
  });

  test("each reminder has its own subject and deadline line", () => {
    const one = renderReminder("reminder-1", "Ada");
    const two = renderReminder("reminder-2", null);
    expect(one.subject).not.toBe(two.subject);
    expect(one.html).toContain("Hi Ada,");
    expect(one.text).toContain("one week");
    expect(two.html).toContain("Hi there,");
    expect(two.text).toContain("tomorrow");
    expect(one.html).toContain("https://www.hackwestern.com/apply");
  });
});

// The selection query is the "right people, exactly once" guarantee.
describe("selectRecipients (DB integration)", () => {
  const PREFIX = "zz-remind-";
  const ids = (t: string) => `${PREFIX}${t}`;
  const cleanup = async () => {
    await db.delete(users).where(like(users.id, `${PREFIX}%`));
    await db
      .delete(emailSubscribers)
      .where(like(emailSubscribers.email, `${PREFIX}%`));
  };
  beforeEach(cleanup);
  afterEach(cleanup);

  async function seed(
    tag: string,
    status: "IN_PROGRESS" | "PENDING_REVIEW",
    opts: { type?: "hacker" | "organizer"; email?: string } = {},
  ) {
    await db.insert(users).values({
      id: ids(tag),
      email: opts.email ?? `${PREFIX}${tag}@gmail.com`,
      type: opts.type ?? "hacker",
    });
    await db.insert(applications).values({
      userId: ids(tag),
      status,
      firstName: tag,
      githubLink: "",
      linkedInLink: "",
      devpostLink: "",
    });
  }

  test("picks in-progress hackers only, once per reminder", async () => {
    await seed("inprogress", "IN_PROGRESS");
    await seed("submitted", "PENDING_REVIEW");
    await seed("organizer", "IN_PROGRESS", { type: "organizer" });
    await seed("throwaway", "IN_PROGRESS", { email: `${PREFIX}x@example.com` });
    await seed("already", "IN_PROGRESS");
    await seed("bounced", "IN_PROGRESS");
    await db
      .insert(emailReminderSent)
      .values({ userId: ids("already"), kind: "reminder-1" });
    await db.insert(emailSubscribers).values({
      email: `${PREFIX}bounced@gmail.com`,
      source: "hw13",
      unsubscribeToken: `${PREFIX}tok`,
      bouncedAt: new Date(),
    });

    const ours = (rs: { userId: string }[]) =>
      rs
        .map((r) => r.userId)
        .filter((id) => id.startsWith(PREFIX))
        .sort();

    expect(ours(await selectRecipients("reminder-1"))).toEqual([
      ids("inprogress"),
    ]);
    // reminder-2 is a separate send, so "already" (sent reminder-1) gets it.
    expect(ours(await selectRecipients("reminder-2"))).toEqual(
      [ids("already"), ids("inprogress")].sort(),
    );
  });

  test("--only targets one address whatever its status", async () => {
    await seed("submitted", "PENDING_REVIEW");
    const rs = await selectRecipients(
      "reminder-1",
      `${PREFIX}submitted@gmail.com`,
    );
    expect(rs.map((r) => r.userId)).toEqual([ids("submitted")]);
    expect(rs[0]?.name).toBe("submitted");
  });

  test("deleting a user removes their sent-log rows", async () => {
    await seed("gone", "IN_PROGRESS");
    await db
      .insert(emailReminderSent)
      .values({ userId: ids("gone"), kind: "reminder-1" });
    await db.delete(users).where(inArray(users.id, [ids("gone")]));
    const left = await db
      .select()
      .from(emailReminderSent)
      .where(like(emailReminderSent.userId, `${PREFIX}%`));
    expect(left).toEqual([]);
  });
});
