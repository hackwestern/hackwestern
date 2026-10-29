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
    expect(two.text).toContain("close Sunday");
    // Goes out at 11:59 PM the night before and is read on the day, so no "tomorrow".
    expect(two.text).not.toContain("tomorrow");
    expect(one.html).toContain("https://www.hackwestern.com/apply");
  });

  test("the RSVP reminder links to the RSVP page with its own copy", () => {
    const r = renderReminder("rsvp-reminder", "Ada");
    expect(r.subject).toContain("RSVP");
    expect(r.html).toContain("Hi Ada,");
    expect(r.html).toContain("https://www.hackwestern.com/rsvp");
    expect(r.html).not.toContain("https://www.hackwestern.com/apply");
    expect(r.text).toContain("Friday, November 6 at 11:59 PM ET");
    expect(r.text).not.toContain("started your");
  });

  test("the team finder email links to the team finder with its own copy", () => {
    const r = renderReminder("team-matching", "Ada");
    expect(r.subject).toBe("Find your Hack Western 13 team");
    expect(r.html).toContain("Hi Ada,");
    expect(r.html).toContain("https://www.hackwestern.com/team-finder");
    expect(r.html).toContain("Make your card");
    expect(r.html).not.toContain("https://www.hackwestern.com/rsvp");
    expect(r.text).toContain("November 20 to 22");
    expect(r.text).toContain("https://www.hackwestern.com/team-finder");
    expect(r.text).toContain("up to 4 people");
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
    status:
      | "IN_PROGRESS"
      | "PENDING_REVIEW"
      | "ACCEPTED"
      | "CONFIRMED"
      | "DECLINED",
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

  test("rsvp-reminder picks accepted hackers who haven't RSVP'd", async () => {
    await seed("accepted", "ACCEPTED");
    await seed("confirmed", "CONFIRMED");
    await seed("declined", "DECLINED");
    await seed("inprogress", "IN_PROGRESS");
    await seed("reminded", "ACCEPTED");
    await db
      .insert(emailReminderSent)
      .values({ userId: ids("reminded"), kind: "rsvp-reminder" });

    const rs = await selectRecipients("rsvp-reminder");
    expect(
      rs
        .map((r) => r.userId)
        .filter((id) => id.startsWith(PREFIX))
        .sort(),
    ).toEqual([ids("accepted")]);
  });

  test("team-matching picks confirmed hackers only", async () => {
    await seed("confirmed", "CONFIRMED");
    await seed("accepted", "ACCEPTED");
    await seed("declined", "DECLINED");
    await seed("organizer", "CONFIRMED", { type: "organizer" });
    await seed("sent", "CONFIRMED");
    await db
      .insert(emailReminderSent)
      .values({ userId: ids("sent"), kind: "team-matching" });

    const rs = await selectRecipients("team-matching");
    expect(
      rs
        .map((r) => r.userId)
        .filter((id) => id.startsWith(PREFIX))
        .sort(),
    ).toEqual([ids("confirmed")]);
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
