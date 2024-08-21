import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import { createInnerTRPCContext } from "../trpc";
import { createCaller } from "../root";
import { assert, beforeEach, describe, expect, test } from "vitest";
import { preregistrations, reviews, applications } from "~/server/db/schema";
import { eq } from "drizzle-orm";
import { PreregistrationSeeder } from "~/server/db/seed/preregistrationSeeder";

const session = await mockSession(db);

const ctx = createInnerTRPCContext({ session });
const caller = createCaller(ctx);

const testPreregistration = new PreregistrationSeeder().createRandom();

describe("review.get", async () => {
    test("")
})