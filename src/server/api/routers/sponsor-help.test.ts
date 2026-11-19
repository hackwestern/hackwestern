import { beforeEach, describe, expect, test, vi } from "vitest";
import { TRPCError } from "@trpc/server";
import type * as SponsorSheets from "~/server/api/utils/sponsor-sheets";
import { eq, sql } from "drizzle-orm";

const slack = vi.hoisted(() => ({
  postSponsorHelpRequest: vi.fn(),
  repingSponsorHelp: vi.fn(),
  markSponsorHelpMessage: vi.fn(),
}));

vi.mock("~/server/slack/sponsor-help", () => slack);

// Tracked help is off for the event (TRACKED_HELP_ENABLED); these tests cover
// the kept flow, so force it on. sponsor-help-off.test.ts covers it off.
vi.mock("~/lib/sponsor-help", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/lib/sponsor-help")>()),
  TRACKED_HELP_ENABLED: true,
}));

// Never hit the real sponsor sheet for the booth location.
vi.mock("~/server/api/utils/sponsor-sheets", async (importOriginal) => {
  const original = await importOriginal<typeof SponsorSheets>();
  return {
    ...original,
    getSheetsClient: vi.fn().mockRejectedValue(new Error("no sheet in tests")),
  };
});

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  sponsorHelpRequests,
  sponsorJudgingSponsors,
} from "~/server/db/schema";

const publicCaller = createCaller(createInnerTRPCContext({ session: null }));
const organizerCaller = createCaller(
  createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
);
const hackerCaller = createCaller(
  createInnerTRPCContext({ session: await mockSession(db) }),
);

const contact = { repName: "Priya Shah", phone: "519-555-0123" };

let sponsorId: string;

beforeEach(async () => {
  vi.clearAllMocks();
  slack.postSponsorHelpRequest.mockResolvedValue({
    channel: "C123",
    ts: "111.222",
  });
  slack.repingSponsorHelp.mockResolvedValue(true);
  slack.markSponsorHelpMessage.mockResolvedValue(undefined);
  await db.delete(sponsorHelpRequests).where(sql`true`);
  await db.delete(sponsorJudgingSponsors).where(sql`true`);
  const [s] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: "Scotiabank" })
    .returning();
  sponsorId = s!.id;
});

async function codeOf(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    if (e instanceof TRPCError) return e.code;
    throw e;
  }
  return "OK";
}

async function ageRequest(id: string, minutes: number) {
  await db
    .update(sponsorHelpRequests)
    .set({ createdAt: new Date(Date.now() - minutes * 60_000) })
    .where(eq(sponsorHelpRequests.id, id));
}

describe("sponsorHelp.request", () => {
  test("bad UUID is a 400", async () => {
    expect(
      await codeOf(
        publicCaller.sponsorHelp.request({
          sponsor: "nope",
          ...contact,
          reason: "swag",
        }),
      ),
    ).toBe("BAD_REQUEST");
    expect(
      await codeOf(publicCaller.sponsorHelp.status({ sponsor: "nope" })),
    ).toBe("BAD_REQUEST");
  });

  test("unknown sponsor is NOT_FOUND", async () => {
    expect(
      await codeOf(
        publicCaller.sponsorHelp.request({
          sponsor: "00000000-0000-4000-8000-000000000000",
          ...contact,
          reason: "swag",
        }),
      ),
    ).toBe("NOT_FOUND");
  });

  test("creates an open request and posts it to Slack once", async () => {
    const view = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
      note: "  Out of shirts ",
    });
    expect(view.status).toBe("open");
    expect(view.note).toBe("Out of shirts");
    expect(slack.postSponsorHelpRequest).toHaveBeenCalledTimes(1);
    expect(slack.postSponsorHelpRequest).toHaveBeenCalledWith({
      sponsorName: "Scotiabank",
      reason: "swag",
      note: "Out of shirts",
      location: null,
      repName: "Priya Shah",
      phone: "519-555-0123",
      locationNote: null,
    });
    const row = await db.query.sponsorHelpRequests.findFirst();
    expect(row?.slackTs).toBe("111.222");
    expect(row?.slackChannel).toBe("C123");
  });

  test("stores the contact trimmed; status shows the rep", async () => {
    await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      reason: "tech",
      repName: "  Priya Shah ",
      phone: " +1 (519) 555-0123 ",
      locationNote: "  By the window ",
    });
    const row = await db.query.sponsorHelpRequests.findFirst();
    expect(row?.repName).toBe("Priya Shah");
    expect(row?.phone).toBe("+1 (519) 555-0123");
    expect(row?.locationNote).toBe("By the window");
    expect(slack.postSponsorHelpRequest).toHaveBeenCalledWith(
      expect.objectContaining({ locationNote: "By the window" }),
    );
    const view = await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(view?.repName).toBe("Priya Shah");
  });

  test("blank location note is stored as null", async () => {
    await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "tech",
      locationNote: "   ",
    });
    const row = await db.query.sponsorHelpRequests.findFirst();
    expect(row?.locationNote).toBeNull();
  });

  test.each([
    ["missing rep name", { repName: "" }],
    ["blank rep name", { repName: "   " }],
    ["rep name over 80", { repName: "a".repeat(81) }],
    ["missing phone", { phone: "" }],
    ["phone too short", { phone: "555-12" }],
    ["phone with letters", { phone: "519-555-CALL" }],
    ["phone with too few digits", { phone: "+1 (5) 5-- ..." }],
    ["phone over 25 chars", { phone: "1".repeat(26) }],
    ["location note over 120", { locationNote: "x".repeat(121) }],
  ])("rejects %s", async (_label, override) => {
    expect(
      await codeOf(
        publicCaller.sponsorHelp.request({
          sponsor: sponsorId,
          ...contact,
          reason: "swag",
          ...override,
        }),
      ),
    ).toBe("BAD_REQUEST");
    expect(slack.postSponsorHelpRequest).not.toHaveBeenCalled();
  });

  test.each(["519-555-0123", "+1 519 555 0123", "(519) 555.0123", "5550123"])(
    "accepts phone %s",
    async (phone) => {
      await expect(
        publicCaller.sponsorHelp.request({
          sponsor: sponsorId,
          ...contact,
          phone,
          reason: "swag",
        }),
      ).resolves.toMatchObject({ status: "open" });
    },
  );

  test("a second open request is rejected", async () => {
    await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    expect(
      await codeOf(
        publicCaller.sponsorHelp.request({
          sponsor: sponsorId,
          ...contact,
          reason: "food",
        }),
      ),
    ).toBe("CONFLICT");
    expect(slack.postSponsorHelpRequest).toHaveBeenCalledTimes(1);
  });

  test("works with Slack off (no post)", async () => {
    slack.postSponsorHelpRequest.mockResolvedValue(null);
    const view = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "tech",
    });
    expect(view.status).toBe("open");
    const row = await db.query.sponsorHelpRequests.findFirst();
    expect(row?.slackTs).toBeNull();
  });

  test("a new request is allowed after cancelling", async () => {
    const first = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    await publicCaller.sponsorHelp.cancel({ sponsor: sponsorId, id: first.id });
    expect(slack.markSponsorHelpMessage).toHaveBeenCalledWith(
      { channel: "C123", ts: "111.222" },
      expect.objectContaining({ sponsorName: "Scotiabank" }),
      { kind: "cancelled" },
    );
    expect(
      await codeOf(
        publicCaller.sponsorHelp.request({
          sponsor: sponsorId,
          ...contact,
          reason: "food",
        }),
      ),
    ).toBe("OK");
  });
});

describe("sponsorHelp.status", () => {
  test("null when there is no request", async () => {
    await expect(
      publicCaller.sponsorHelp.status({ sponsor: sponsorId }),
    ).resolves.toBeNull();
  });

  test("re-ping is sent once per step", async () => {
    const { id } = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });

    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(slack.repingSponsorHelp).not.toHaveBeenCalled();

    await ageRequest(id, 4);
    await Promise.all([
      publicCaller.sponsorHelp.status({ sponsor: sponsorId }),
      publicCaller.sponsorHelp.status({ sponsor: sponsorId }),
    ]);
    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(slack.repingSponsorHelp).toHaveBeenCalledTimes(1);
    expect(slack.repingSponsorHelp).toHaveBeenLastCalledWith(
      { channel: "C123", ts: "111.222" },
      1,
      expect.objectContaining({
        sponsorName: "Scotiabank",
        repName: "Priya Shah",
      }),
    );

    await ageRequest(id, 7);
    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(slack.repingSponsorHelp).toHaveBeenCalledTimes(2);
    expect(slack.repingSponsorHelp).toHaveBeenLastCalledWith(
      { channel: "C123", ts: "111.222" },
      2,
      expect.objectContaining({ phone: "519-555-0123" }),
    );

    await ageRequest(id, 30);
    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(slack.repingSponsorHelp).toHaveBeenCalledTimes(2);
  });

  test("a failed re-ping is retried on the next poll", async () => {
    const { id } = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    await ageRequest(id, 4);
    slack.repingSponsorHelp.mockResolvedValueOnce(false);
    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect((await db.query.sponsorHelpRequests.findFirst())?.pingCount).toBe(0);
    await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(slack.repingSponsorHelp).toHaveBeenCalledTimes(2);
    expect(slack.repingSponsorHelp).toHaveBeenLastCalledWith(
      { channel: "C123", ts: "111.222" },
      1,
      expect.objectContaining({
        sponsorName: "Scotiabank",
        repName: "Priya Shah",
      }),
    );
    expect((await db.query.sponsorHelpRequests.findFirst())?.pingCount).toBe(1);
  });

  test("no re-ping once claimed, and the claimer's name shows", async () => {
    const { id } = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    await db
      .update(sponsorHelpRequests)
      .set({ status: "claimed", claimedByName: "Jazz", claimedAt: new Date() })
      .where(eq(sponsorHelpRequests.id, id));
    await ageRequest(id, 10);
    const view = await publicCaller.sponsorHelp.status({ sponsor: sponsorId });
    expect(view?.status).toBe("claimed");
    expect(view?.claimedByName).toBe("Jazz");
    expect(slack.repingSponsorHelp).not.toHaveBeenCalled();
  });

  test("cancelled requests disappear; resolved ones show briefly", async () => {
    const { id } = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    await organizerCaller.sponsorHelp.resolve({ id });
    expect(
      (await publicCaller.sponsorHelp.status({ sponsor: sponsorId }))?.status,
    ).toBe("resolved");

    const second = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "food",
    });
    await publicCaller.sponsorHelp.cancel({
      sponsor: sponsorId,
      id: second.id,
    });
    await expect(
      publicCaller.sponsorHelp.status({ sponsor: sponsorId }),
    ).resolves.toBeNull();
  });
});

describe("sponsorHelp.cancel", () => {
  test("another sponsor can't cancel it", async () => {
    const { id } = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    const [other] = await db
      .insert(sponsorJudgingSponsors)
      .values({ name: "Commure" })
      .returning();
    expect(
      await codeOf(publicCaller.sponsorHelp.cancel({ sponsor: other!.id, id })),
    ).toBe("NOT_FOUND");
  });
});

describe("organizer procedures", () => {
  test("401 when logged out", async () => {
    expect(await codeOf(publicCaller.sponsorHelp.list())).toBe("UNAUTHORIZED");
    expect(
      await codeOf(
        publicCaller.sponsorHelp.resolve({
          id: "00000000-0000-4000-8000-000000000000",
        }),
      ),
    ).toBe("UNAUTHORIZED");
  });

  test("403 for hackers", async () => {
    expect(await codeOf(hackerCaller.sponsorHelp.list())).toBe("FORBIDDEN");
  });

  test("list shows live requests oldest first; resolve closes and edits Slack", async () => {
    const { id } = await publicCaller.sponsorHelp.request({
      sponsor: sponsorId,
      ...contact,
      reason: "swag",
    });
    const list = await organizerCaller.sponsorHelp.list();
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      id,
      sponsorName: "Scotiabank",
      status: "open",
      postedToSlack: true,
    });

    await organizerCaller.sponsorHelp.resolve({ id });
    expect(slack.markSponsorHelpMessage).toHaveBeenCalledWith(
      { channel: "C123", ts: "111.222" },
      expect.objectContaining({ sponsorName: "Scotiabank" }),
      { kind: "resolved" },
    );
    await expect(organizerCaller.sponsorHelp.list()).resolves.toHaveLength(0);
    expect(await codeOf(organizerCaller.sponsorHelp.resolve({ id }))).toBe(
      "NOT_FOUND",
    );
  });
});
