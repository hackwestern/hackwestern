import { beforeEach, describe, expect, test, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import { sql } from "drizzle-orm";

const slack = vi.hoisted(() => ({
  postSponsorHelpRequest: vi.fn(),
  repingSponsorHelp: vi.fn(),
  markSponsorHelpMessage: vi.fn(),
}));

vi.mock("~/server/slack/sponsor-help", () => slack);

import { sponsorHelpCopy } from "~/content/sponsor-help";
import { TRACKED_HELP_ENABLED } from "~/lib/sponsor-help";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  sponsorHelpRequests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

// Tracked help as shipped: TRACKED_HELP_ENABLED is false, so nothing the
// sponsor's page calls can store a request or reach Slack.
const publicCaller = createCaller(createInnerTRPCContext({ session: null }));
const organizerCaller = createCaller(
  createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
);

let sponsorId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  await db.delete(sponsorHelpRequests).where(sql`true`);
  await db.delete(sponsorJudgingSponsors).where(sql`true`);
  const [s] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: "Scotiabank" })
    .returning();
  sponsorId = s!.id;
});

function expectNoSlack() {
  expect(slack.postSponsorHelpRequest).not.toHaveBeenCalled();
  expect(slack.repingSponsorHelp).not.toHaveBeenCalled();
  expect(slack.markSponsorHelpMessage).not.toHaveBeenCalled();
}

describe("tracked help switched off", () => {
  test("the flag ships off", () => {
    expect(TRACKED_HELP_ENABLED).toBe(false);
  });

  test("request is FORBIDDEN with the content message; nothing stored", async () => {
    const err = await publicCaller.sponsorHelp
      .request({
        sponsor: sponsorId,
        reason: "swag",
        repName: "Priya Shah",
        phone: "519-555-0123",
      })
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(TRPCError);
    expect((err as TRPCError).code).toBe("FORBIDDEN");
    expect((err as TRPCError).message).toBe(sponsorHelpCopy.trackedOff);
    expect(await db.query.sponsorHelpRequests.findMany()).toHaveLength(0);
    expectNoSlack();
  });

  test("status is null and never re-pings an old open request", async () => {
    const [row] = await db
      .insert(sponsorHelpRequests)
      .values({
        sponsorId,
        reason: "swag",
        repName: "Priya Shah",
        phone: "519-555-0123",
        slackChannel: "C123",
        slackTs: "111.222",
        createdAt: new Date(Date.now() - 20 * 60_000),
      })
      .returning();
    expect(
      await publicCaller.sponsorHelp.status({ sponsor: sponsorId }),
    ).toBeNull();
    const after = await db.query.sponsorHelpRequests.findFirst();
    expect(after?.pingCount).toBe(row!.pingCount);
    expectNoSlack();
  });

  test("cancel is a no-op", async () => {
    const [row] = await db
      .insert(sponsorHelpRequests)
      .values({
        sponsorId,
        reason: "tech",
        repName: "Priya Shah",
        phone: "519-555-0123",
        slackChannel: "C123",
        slackTs: "111.222",
      })
      .returning();
    expect(
      await publicCaller.sponsorHelp.cancel({ sponsor: sponsorId, id: row!.id }),
    ).toEqual({ ok: true });
    const after = await db.query.sponsorHelpRequests.findFirst();
    expect(after?.status).toBe("open");
    expectNoSlack();
  });

  test("organizer resolve doesn't touch Slack", async () => {
    const [row] = await db
      .insert(sponsorHelpRequests)
      .values({
        sponsorId,
        reason: "food",
        repName: "Priya Shah",
        phone: "519-555-0123",
        slackChannel: "C123",
        slackTs: "111.222",
      })
      .returning();
    await organizerCaller.sponsorHelp.resolve({ id: row!.id });
    expectNoSlack();
  });
});
