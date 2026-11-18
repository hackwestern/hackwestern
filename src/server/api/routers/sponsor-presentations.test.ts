import { beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type * as Env from "~/env";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { sendPresentationDm } from "~/server/slack/presentation-dm";
import { presentationDmMessage } from "~/server/slack/presentation-dm";

let slackToken: string | undefined;
vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "SLACK_BOT_TOKEN") return slackToken;
        return target[prop];
      },
    }),
  };
});

// Rooms come from the sheets; Slack is the network.
vi.mock("~/server/api/utils/sponsor-judging-board", () => ({
  judgingRoomsById: vi.fn(),
}));
vi.mock("~/server/slack/presentation-dm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/slack/presentation-dm")>()),
  sendPresentationDm: vi.fn(),
}));
const rooms = vi.mocked(judgingRoomsById);
const dm = vi.mocked(sendPresentationDm);

const anon = createCaller(createInnerTRPCContext({ session: null }));
let organizer: ReturnType<typeof createCaller>;

beforeEach(async () => {
  slackToken = undefined;
  rooms.mockReset().mockResolvedValue(new Map());
  dm.mockReset().mockResolvedValue("sent");
  await db.delete(sponsorPresentations);
  await db.delete(sponsorShortlistSends);
  organizer = createCaller(
    createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
  );
});

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Sponsor ${faker.string.alphanumeric(10)}` })
    .returning();
  return row!;
}

async function team() {
  const id = faker.string.alphanumeric(12);
  await db.insert(teams).values({
    id,
    name: `Team ${faker.string.alphanumeric(8)}`,
    joinCode: faker.string.alphanumeric(6),
    submissionStatus: "submitted",
    tracks: ["General"],
  });
  return id;
}

async function send(sponsorId: string, teamIds: string[]) {
  await db.insert(sponsorShortlistSends).values({ sponsorId, teamIds });
}

describe("sponsorPresentations.schedule", () => {
  test("organizers only", async () => {
    await expect(anon.sponsorPresentations.schedule()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(hacker.sponsorPresentations.schedule()).rejects.toBeTruthy();
  });

  test("refuses with no shortlist sent", async () => {
    await expect(
      organizer.sponsorPresentations.schedule(),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("schedules every sent team, flags no-room sponsors, and replaces on rerun", async () => {
    const a = await sponsor();
    const b = await sponsor();
    const shared = await team();
    const other = await team();
    await send(a.id, [shared, other]);
    await send(b.id, [shared]);
    rooms.mockResolvedValue(new Map([[a.id, "Rm 2110"]]));

    const res = await organizer.sponsorPresentations.schedule();
    expect(res).toMatchObject({ placed: 2, unplaced: 1 });

    const view = await organizer.sponsorPresentations.overview();
    expect(view.slots.map((s) => s.room)).toEqual(["Rm 2110", "Rm 2110"]);
    expect(view.unplaced).toEqual([
      expect.objectContaining({
        sponsorId: b.id,
        teamId: shared,
        reason: "no-room",
      }),
    ]);
    expect(view.sponsors.find((s) => s.sponsorId === a.id)).toMatchObject({
      sentCount: 2,
      sentAfterSchedule: false,
    });

    // B gets a room: the rerun places the shared team in both, 10+ apart.
    rooms.mockResolvedValue(
      new Map([
        [a.id, "Rm 2110"],
        [b.id, "Rm 2230"],
      ]),
    );
    await organizer.sponsorPresentations.schedule();
    const again = await organizer.sponsorPresentations.overview();
    expect(again.unplaced).toEqual([]);
    const starts = again.slots
      .filter((s) => s.teamId === shared)
      .map((s) => s.start)
      .sort((x, y) => x - y);
    expect(starts).toHaveLength(2);
    expect(starts[1]! - starts[0]!).toBeGreaterThanOrEqual(10);
    const rows = await db.select().from(sponsorPresentations);
    expect(rows).toHaveLength(3);
  });
});

describe("sponsorPresentations.notify", () => {
  test("fails clearly when Slack isn't configured", async () => {
    await expect(organizer.sponsorPresentations.notify()).rejects.toMatchObject(
      {
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("SLACK_BOT_TOKEN"),
      },
    );
    expect(dm).not.toHaveBeenCalled();
  });

  test("DMs each member, marks reached teams, and shows times on /live", async () => {
    slackToken = "xoxb-test";
    const s = await sponsor();
    const t = await team();
    const hackerSession = await mockSession(db);
    await db
      .update(users)
      .set({ teamId: t })
      .where(eq(users.id, hackerSession.user.id));
    await send(s.id, [t]);
    rooms.mockResolvedValue(new Map([[s.id, "Rm 2235"]]));
    await organizer.sponsorPresentations.schedule();

    const hacker = createCaller(
      createInnerTRPCContext({ session: hackerSession }),
    );
    // Not notified yet: nothing on /live.
    expect(await hacker.sponsorPresentations.mine()).toEqual([]);

    const res = await organizer.sponsorPresentations.notify();
    expect(res).toMatchObject({ sent: 1, failed: 0, notOnSlack: [] });
    expect(dm).toHaveBeenCalledWith(
      "xoxb-test",
      expect.objectContaining({ email: hackerSession.user.email }),
      expect.any(String),
      [{ sponsorName: s.name, room: "Rm 2235", start: 600 }],
    );
    expect(await hacker.sponsorPresentations.mine()).toEqual([
      { sponsorName: s.name, room: "Rm 2235", start: 600 },
    ]);
    const view = await organizer.sponsorPresentations.overview();
    expect(view.notifiedAt).not.toBeNull();
  });

  test("lists members not on Slack and doesn't mark their team", async () => {
    slackToken = "xoxb-test";
    dm.mockResolvedValue("not-found");
    const s = await sponsor();
    const t = await team();
    const member = await mockSession(db);
    await db
      .update(users)
      .set({ teamId: t })
      .where(eq(users.id, member.user.id));
    await send(s.id, [t]);
    rooms.mockResolvedValue(new Map([[s.id, "Rm 2110"]]));
    await organizer.sponsorPresentations.schedule();

    const res = await organizer.sponsorPresentations.notify();
    expect(res.sent).toBe(0);
    expect(res.notOnSlack).toHaveLength(1);
    expect((await organizer.sponsorPresentations.overview()).notifiedAt).toBe(
      null,
    );
  });
});

describe("presentationDmMessage", () => {
  test("lists times in order and escapes names", () => {
    const msg = presentationDmMessage("A<b>", [
      { sponsorName: "QNX", room: "Rm 2235", start: 620 },
      { sponsorName: "Scotia & Co", room: "Rm 2110", start: 600 },
    ]);
    const text = (msg.blocks[0] as { text: { text: string } }).text.text;
    expect(text).toContain("A&lt;b&gt;");
    expect(text.indexOf("10:00 AM")).toBeLessThan(text.indexOf("10:20 AM"));
    expect(text).toContain("Scotia &amp; Co, Rm 2110");
  });
});
