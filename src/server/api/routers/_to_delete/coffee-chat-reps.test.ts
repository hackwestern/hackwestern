import { TRPCError } from "@trpc/server";
import { eq } from "drizzle-orm";
import { describe, expect, test } from "vitest";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { db } from "~/server/db";
import { sponsorJudgingSponsors } from "~/server/db/schema";

// T14: a sponsor sets their coffee chat rep count with their private UUID.
const caller = createCaller(createInnerTRPCContext({ session: null }));

async function makeSponsor(name: string) {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name })
    .returning();
  return row!;
}

async function repsOf(id: string) {
  const row = await db.query.sponsorJudgingSponsors.findFirst({
    where: eq(sponsorJudgingSponsors.id, id),
  });
  return row?.coffeeChatReps;
}

describe("sponsorPortal.setCoffeeChatReps", () => {
  test("sets only the sponsor whose UUID is given", async () => {
    const a = await makeSponsor("Reps Sponsor A");
    const b = await makeSponsor("Reps Sponsor B");

    await expect(
      caller.sponsorPortal.setCoffeeChatReps({ sponsor: a.id, reps: 4 }),
    ).resolves.toEqual({ reps: 4 });

    expect(await repsOf(a.id)).toBe(4);
    expect(await repsOf(b.id)).toBe(1);
    await expect(
      caller.sponsorPortal.getCoffeeChatReps({ sponsor: a.id }),
    ).resolves.toEqual({ reps: 4 });
  });

  test("another sponsor's UUID can't change it", async () => {
    const a = await makeSponsor("Reps Sponsor C");
    const b = await makeSponsor("Reps Sponsor D");

    await caller.sponsorPortal.setCoffeeChatReps({ sponsor: b.id, reps: 7 });

    expect(await repsOf(a.id)).toBe(1);
    expect(await repsOf(b.id)).toBe(7);
  });

  test("needs a UUID: names and junk are a 400", async () => {
    const a = await makeSponsor("Reps Sponsor E");
    for (const sponsor of [a.name, "not-a-uuid", ""]) {
      const error = await caller.sponsorPortal
        .setCoffeeChatReps({ sponsor, reps: 2 })
        .catch((e: unknown) => e);
      expect(error).toBeInstanceOf(TRPCError);
      expect((error as TRPCError).code).toBe("BAD_REQUEST");
    }
    expect(await repsOf(a.id)).toBe(1);
  });

  test("an unknown UUID is a 404", async () => {
    await expect(
      caller.sponsorPortal.setCoffeeChatReps({
        sponsor: "00000000-0000-4000-8000-000000000000",
        reps: 2,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("reps must be 1 to 10", async () => {
    const a = await makeSponsor("Reps Sponsor F");
    for (const reps of [0, 11, 2.5]) {
      await expect(
        caller.sponsorPortal.setCoffeeChatReps({ sponsor: a.id, reps }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(await repsOf(a.id)).toBe(1);
  });
});
