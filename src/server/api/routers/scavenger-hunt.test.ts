import { afterEach, beforeEach, describe, expect, test } from "vitest";
import { db } from "~/server/db";
import { inArray } from "drizzle-orm";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockSession } from "~/server/auth";
import { scavengerHuntItems, scavengerHuntScans } from "~/server/db/schema";

const session = await mockSession(db);
const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

let testItem: { id: number; code: string; points: number };

describe("scavenger.scan", async () => {
  beforeEach(async () => {
    await db.delete(scavengerHuntScans).where(
      inArray(
        scavengerHuntScans.itemId,
        [testItem?.id].filter((v): v is number => !!v),
      ),
    );

    await db
      .delete(scavengerHuntItems)
      .where(inArray(scavengerHuntItems.code, ["TESTCODE123", "TESTCODE456"]));

    const [item] = await db
      .insert(scavengerHuntItems)
      .values({
        code: "TESTCODE123",
        description: "Test Item",
        points: 10,
      })
      .returning();

    if (!item) throw new Error("Failed to insert test scavenger hunt item");
    testItem = item;
  });

  afterEach(async () => {
    await db
      .delete(scavengerHuntScans)
      .where(inArray(scavengerHuntScans.userId, [session.user.id]));

    await db
      .delete(scavengerHuntItems)
      .where(inArray(scavengerHuntItems.code, ["TESTCODE123", "TESTCODE456"]));
  });

  test("throws an error if the item was not found", () => {
    return expect(
      caller.scavenger.scan({
        userId: session.user.id,
        itemCode: "FAKECODE",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("throws an error if the item was already scanned by a user", async () => {
    const input = { userId: session.user.id, itemCode: testItem.code };

    await caller.scavenger.scan(input);

    await expect(caller.scavenger.scan(input)).rejects.toMatchObject({
      code: "CONFLICT",
    });
  });

  test("successfully scans a valid item", async () => {
    const input = { userId: session.user.id, itemCode: testItem.code };
    const result = await caller.scavenger.scan(input);

    expect(result).toMatchObject({
      userId: session.user.id,
      itemId: testItem.id,
    });
  });

  test("allows scanning multiple distinct items", async () => {
    const [item2] = await db
      .insert(scavengerHuntItems)
      .values({
        code: "TESTCODE456",
        description: "Second Test Item",
        points: 20,
      })
      .returning();
    if (!item2) throw new Error("Failed to insert second test item");

    await caller.scavenger.scan({
      userId: session.user.id,
      itemCode: testItem.code,
    });

    const result = await caller.scavenger.scan({
      userId: session.user.id,
      itemCode: item2.code,
    });

    expect(result).toMatchObject({
      userId: session.user.id,
      itemId: item2.id,
    });

    await db
      .delete(scavengerHuntScans)
      .where(inArray(scavengerHuntScans.itemId, [item2.id]));

    await db
      .delete(scavengerHuntItems)
      .where(inArray(scavengerHuntItems.code, ["TESTCODE456"]));
  });

  test("scanning is tied to the user — another user can scan the same item", async () => {
    const otherSession = await mockSession(db);
    const otherCtx = createInnerTRPCContext({ session: otherSession });
    const otherCaller = createCaller(otherCtx);

    await caller.scavenger.scan({
      userId: session.user.id,
      itemCode: testItem.code,
    });

    const result = await otherCaller.scavenger.scan({
      userId: otherSession.user.id,
      itemCode: testItem.code,
    });

    expect(result).toMatchObject({
      userId: otherSession.user.id,
      itemId: testItem.id,
    });

    await db
      .delete(scavengerHuntScans)
      .where(inArray(scavengerHuntScans.userId, [otherSession.user.id]));
  });
});
