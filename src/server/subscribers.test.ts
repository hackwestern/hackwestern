import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { like } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import * as contactsModule from "~/server/mailjet-contacts";
import { env } from "~/env";
import {
  normalizeEmail,
  normalizeAuthEmail,
  isSchoolEmail,
  generateUnsubscribeToken,
  editionFromSource,
  unsubscribeByToken,
} from "./subscribers";

// Never touch the real Mailjet contact list from a test.
const manageContactSpy = vi
  .spyOn(contactsModule, "manageContact")
  .mockResolvedValue({ ok: true });

describe("normalizeEmail", () => {
  test("trims + lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  test("canonicalizes gmail dots and +tags", () => {
    expect(normalizeEmail("john.doe+hw@gmail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("JohnDoe@googlemail.com")).toBe(
      "johndoe@googlemail.com",
    );
  });
  test("leaves non-gmail local part intact", () => {
    expect(normalizeEmail("john.doe@outlook.com")).toBe("john.doe@outlook.com");
  });
});

describe("normalizeAuthEmail", () => {
  test("trims and lowercases", () => {
    expect(normalizeAuthEmail("  Luka@UWO.ca ")).toBe("luka@uwo.ca");
  });

  // The deliberate difference from normalizeEmail: an auth identity keeps its
  // gmail dots and plus tags. Stripping them is right for a mailing list, wrong
  // for a login credential.
  test("does NOT strip gmail dots or plus tags", () => {
    expect(normalizeAuthEmail("A.rjun+hw@gmail.com")).toBe(
      "a.rjun+hw@gmail.com",
    );
    expect(normalizeEmail("A.rjun+hw@gmail.com")).toBe("arjun@gmail.com");
  });
});

describe("isSchoolEmail", () => {
  test.each([
    ["a@smith.edu", true],
    ["b@uwo.ca", true],
    ["c@mail.utoronto.ca", true],
    ["d@uwaterloo.ca", true],
    ["e@ox.ac.uk", true],
    ["f@gmail.com", false],
    ["g@autodesk.com", false],
  ])("%s -> %s", (email, expected) => {
    expect(isSchoolEmail(email)).toBe(expected);
  });
});

describe("generateUnsubscribeToken", () => {
  test("returns 40-char hex, unique per call", () => {
    const a = generateUnsubscribeToken();
    const b = generateUnsubscribeToken();
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(a).not.toBe(b);
  });
});

describe("editionFromSource", () => {
  test.each([
    ["hw11", "11"],
    ["hw12", "12"],
  ])("%s -> %s", (s, e) => expect(editionFromSource(s)).toBe(e));
});

describe("unsubscribeByToken (DB integration)", () => {
  const PREFIX = "zz-unsubtest-";
  const cleanup = () =>
    db
      .delete(emailSubscribers)
      .where(like(emailSubscribers.email, `${PREFIX}%`));

  beforeEach(async () => {
    manageContactSpy.mockClear();
    await cleanup();
  });
  afterEach(cleanup);

  test("sets unsubscribed_at, is idempotent, and returns false for unknown token", async () => {
    const token = generateUnsubscribeToken();
    await db.insert(emailSubscribers).values({
      email: `${PREFIX}a@gmail.com`,
      source: "hw12",
      unsubscribeToken: token,
    });

    // unknown token → false
    expect(await unsubscribeByToken("nope-" + token)).toBe(false);

    // first unsubscribe → true, flag now set
    expect(await unsubscribeByToken(token)).toBe(true);
    const row = await db.query.emailSubscribers.findFirst({
      where: (t, { eq }) => eq(t.unsubscribeToken, token),
      columns: { unsubscribedAt: true },
    });
    expect(row?.unsubscribedAt).toBeInstanceOf(Date);

    // idempotent: still true, timestamp unchanged (UPDATE only fires when NULL)
    const firstTs = row?.unsubscribedAt?.getTime();
    expect(await unsubscribeByToken(token)).toBe(true);
    const again = await db.query.emailSubscribers.findFirst({
      where: (t, { eq }) => eq(t.unsubscribeToken, token),
      columns: { unsubscribedAt: true },
    });
    expect(again?.unsubscribedAt?.getTime()).toBe(firstTs);
  });

  // Our unsubscribe link is our own, so Mailjet never observes the click. Without
  // this mirror the contact keeps IsUnsubscribed=false on the marketing list and
  // receives the next dashboard campaign — an opt-out honoured in one channel and
  // ignored in the other.
  test("mirrors the opt-out to the Mailjet list as `unsub`", async () => {
    const token = generateUnsubscribeToken();
    const email = `${PREFIX}mirror@gmail.com`;
    await db
      .insert(emailSubscribers)
      .values({ email, source: "hw12", unsubscribeToken: token });

    expect(await unsubscribeByToken(token)).toBe(true);

    expect(manageContactSpy).toHaveBeenCalledTimes(1);
    const [listId, sentEmail, , action] = manageContactSpy.mock.calls[0] ?? [];
    expect(listId).toBe(env.MAILJET_CONTACT_LIST_ID);
    expect(sentEmail).toBe(email);
    expect(action).toBe("unsub");
  });

  // Self-healing: if the mirror failed once, clicking again retries it. The DB
  // UPDATE is a no-op by then, so the already-unsubscribed branch must still fire.
  test("mirrors again on an already-unsubscribed token", async () => {
    const token = generateUnsubscribeToken();
    await db.insert(emailSubscribers).values({
      email: `${PREFIX}heal@gmail.com`,
      source: "hw12",
      unsubscribeToken: token,
      unsubscribedAt: new Date(),
    });

    expect(await unsubscribeByToken(token)).toBe(true);
    expect(manageContactSpy).toHaveBeenCalledTimes(1);
    expect(manageContactSpy.mock.calls[0]?.[3]).toBe("unsub");
  });

  // The DB write already honoured the request; a Mailjet outage must not turn a
  // successful unsubscribe into a 500 on the RFC 8058 one-click POST.
  test("still reports success when the Mailjet mirror fails", async () => {
    manageContactSpy.mockResolvedValueOnce({ ok: false, error: "boom" });
    const token = generateUnsubscribeToken();
    await db.insert(emailSubscribers).values({
      email: `${PREFIX}fail@gmail.com`,
      source: "hw12",
      unsubscribeToken: token,
    });

    expect(await unsubscribeByToken(token)).toBe(true);
    const row = await db.query.emailSubscribers.findFirst({
      where: (t, { eq }) => eq(t.unsubscribeToken, token),
      columns: { unsubscribedAt: true },
    });
    expect(row?.unsubscribedAt).toBeInstanceOf(Date);
  });
});
