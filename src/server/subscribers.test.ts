import { describe, expect, test, beforeEach, afterEach } from "vitest";
import { like } from "drizzle-orm";
import { db } from "~/server/db";
import { emailSubscribers } from "~/server/db/schema";
import {
  normalizeEmail,
  isSchoolEmail,
  generateUnsubscribeToken,
  editionFromSource,
  unsubscribeByToken,
} from "./subscribers";

describe("normalizeEmail", () => {
  test("trims + lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  test("canonicalizes gmail dots and +tags", () => {
    expect(normalizeEmail("john.doe+hw@gmail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("JohnDoe@googlemail.com")).toBe("johndoe@googlemail.com");
  });
  test("leaves non-gmail local part intact", () => {
    expect(normalizeEmail("john.doe@outlook.com")).toBe("john.doe@outlook.com");
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
    db.delete(emailSubscribers).where(like(emailSubscribers.email, `${PREFIX}%`));

  beforeEach(cleanup);
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
});
