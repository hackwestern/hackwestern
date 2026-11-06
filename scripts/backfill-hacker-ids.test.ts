import { describe, expect, test } from "vitest";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { applications } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { getOrCreateHackerId } from "~/server/api/utils/hacker-id";
import { findConfirmedWithoutHackerId } from "./backfill-hacker-ids";

const hackerWithStatus = async (status: "ACCEPTED" | "CONFIRMED") => {
  const { user } = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: user.id,
    status,
  });
  return user.id;
};

describe("findConfirmedWithoutHackerId", () => {
  test("only confirmed hackers still missing an ID", async () => {
    const confirmed = await hackerWithStatus("CONFIRMED");
    const accepted = await hackerWithStatus("ACCEPTED");
    const done = await hackerWithStatus("CONFIRMED");
    await getOrCreateHackerId(done);

    const ids = await findConfirmedWithoutHackerId();
    expect(ids).toContain(confirmed);
    expect(ids).not.toContain(accepted);
    expect(ids).not.toContain(done);
  });
});
