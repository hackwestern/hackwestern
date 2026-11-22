import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { db } from "~/server/db";
import { accounts, judges, users } from "~/server/db/schema";
import {
  addListedJudges,
  parseJudgeEmails,
} from "~/server/judging/external-judges";

async function account(opts: {
  verified: boolean;
  oauth?: boolean;
  type?: "hacker" | "organizer";
}) {
  const id = faker.string.uuid();
  // Stored emails are canonical (lowercase), as auth writes them.
  const email =
    `judge-${faker.string.alphanumeric(10)}@example.com`.toLowerCase();
  await db.insert(users).values({
    id,
    name: faker.person.fullName(),
    email,
    emailVerified: opts.verified ? new Date() : null,
    type: opts.type ?? "hacker",
  });
  if (opts.oauth) {
    await db.insert(accounts).values({
      userId: id,
      type: "oauth",
      provider: "google",
      providerAccountId: faker.string.numeric(12),
    });
  }
  return { id, email };
}

describe("parseJudgeEmails", () => {
  test("splits on commas and whitespace, lowercases and dedupes", () => {
    expect(parseJudgeEmails(" A@x.com,b@x.com\nB@X.com  ")).toEqual([
      "a@x.com",
      "b@x.com",
    ]);
    expect(parseJudgeEmails(undefined)).toEqual([]);
  });
});

describe("addListedJudges", () => {
  test("adds proven accounts as general judges and waits on the rest", async () => {
    const verified = await account({ verified: true });
    const google = await account({ verified: false, oauth: true });
    const unproven = await account({ verified: false });
    const organizer = await account({ verified: true, type: "organizer" });
    const missing =
      `nobody-${faker.string.alphanumeric(8)}@example.com`.toLowerCase();
    const emails = [verified, google, unproven, organizer]
      .map((a) => a.email.toUpperCase())
      .concat(missing);

    const result = await addListedJudges(parseJudgeEmails(emails.join(",")));
    expect(new Set(result.added)).toEqual(
      new Set([verified.email, google.email, organizer.email]),
    );
    expect(new Set(result.waiting)).toEqual(new Set([unproven.email, missing]));

    const row = await db.query.judges.findFirst({
      where: eq(judges.id, google.id),
    });
    expect(row?.type).toBe("organizer");
    const hacker = await db.query.users.findFirst({
      where: eq(users.id, google.id),
    });
    expect(hacker?.type).toBe("judge");
    const org = await db.query.users.findFirst({
      where: eq(users.id, organizer.id),
    });
    expect(org?.type).toBe("organizer");

    // Running again adds nobody new.
    const again = await addListedJudges(parseJudgeEmails(emails.join(",")));
    expect(again.added).toEqual([]);
  });
});
