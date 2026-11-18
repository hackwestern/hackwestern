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
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import { judgingRoomsById } from "~/server/api/utils/sponsor-judging-board";
import { sendPresentationDm } from "~/server/slack/presentation-dm";
import { presentationDmMessage } from "~/server/slack/presentation-dm";
import { sendViaMailjet } from "~/server/mail-mailjet";
import { presentationEmail } from "~/server/api/utils/presentation-email";

let slackToken: string | undefined;
// Hoisted: the env mock reads it while modules load.
const mailjet = vi.hoisted(() => ({ configured: true }));
vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "SLACK_BOT_TOKEN") return slackToken;
        if (prop === "MAILJET_API_KEY" || prop === "MAILJET_SECRET_KEY")
          return mailjet.configured ? "test" : undefined;
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
// Mocked Mailjet, as in the coffee chat email tests: never a real send.
vi.mock("~/server/mail-mailjet", () => ({ sendViaMailjet: vi.fn() }));
const mail = vi.mocked(sendViaMailjet);
const mailOk = {
  data: { delivered: [], queued: [], bounced: [] },
  error: null,
};
const rooms = vi.mocked(judgingRoomsById);
const dm = vi.mocked(sendPresentationDm);

const anon = createCaller(createInnerTRPCContext({ session: null }));
let organizer: ReturnType<typeof createCaller>;

beforeEach(async () => {
  slackToken = undefined;
  mailjet.configured = true;
  mail.mockReset().mockResolvedValue(mailOk);
  rooms.mockReset().mockResolvedValue(new Map());
  dm.mockReset().mockResolvedValue("sent");
  await db.delete(sponsorPresentationNotices);
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

/** A signed-in hacker on `teamId`, with their caller. */
async function member(teamId: string) {
  const session = await mockSession(db);
  await db.update(users).set({ teamId }).where(eq(users.id, session.user.id));
  return {
    session,
    caller: createCaller(createInnerTRPCContext({ session })),
  };
}

/** One sponsor in `room` with one shortlisted team, scheduled. */
async function scheduledTeam(room = "Rm 2110") {
  const s = await sponsor();
  const t = await team();
  await send(s.id, [t]);
  rooms.mockResolvedValue(new Map([[s.id, room]]));
  await organizer.sponsorPresentations.schedule();
  return { s, t };
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
    expect(view.notices).toMatchObject({
      members: 1,
      reached: 1,
      notReached: [],
    });
    expect(view.notices.lastSentAt).not.toBeNull();
  });

  test("emails members not on Slack, once, and counts them reached", async () => {
    slackToken = "xoxb-test";
    dm.mockResolvedValue("not-found");
    const { s, t } = await scheduledTeam("Rm 2110");
    const hacker = await member(t);

    const res = await organizer.sponsorPresentations.notify();
    expect(res).toMatchObject({ sent: 0, emailed: 1, notOnSlack: [] });
    expect(mail).toHaveBeenCalledTimes(1);
    const [msg] = mail.mock.calls[0]!;
    expect(msg.to).toBe(hacker.session.user.email);
    expect(msg.text).toContain(`10:00 AM: ${s.name}, Rm 2110`);
    const [notice] = await db
      .select()
      .from(sponsorPresentationNotices)
      .where(eq(sponsorPresentationNotices.userId, hacker.session.user.id));
    expect(notice).toMatchObject({ status: "emailed" });
    expect(notice!.sentAt).not.toBeNull();

    const { notices } = await organizer.sponsorPresentations.overview();
    expect(notices).toMatchObject({ reached: 1, emailed: 1, notReached: [] });
    expect(await hacker.caller.sponsorPresentations.mine()).toHaveLength(1);

    // A retry never emails them twice.
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      emailed: 0,
      skipped: 1,
    });
    expect(mail).toHaveBeenCalledTimes(1);
  });

  test("a double click emails a member not on Slack once", async () => {
    slackToken = "xoxb-test";
    dm.mockResolvedValue("not-found");
    const { t } = await scheduledTeam();
    await member(t);
    mail.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve(mailOk), 50)),
    );
    const [a, b] = await Promise.all([
      organizer.sponsorPresentations.notify(),
      organizer.sponsorPresentations.notify(),
    ]);
    expect(a.emailed + b.emailed).toBe(1);
    expect(mail).toHaveBeenCalledTimes(1);
  });

  test("records failed when Mailjet isn't set up or rejects; retries send", async () => {
    slackToken = "xoxb-test";
    dm.mockResolvedValue("not-found");
    mailjet.configured = false;
    const { t } = await scheduledTeam();
    const hacker = await member(t);

    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      emailed: 0,
      failed: 1,
    });
    expect(mail).not.toHaveBeenCalled();
    let view = await organizer.sponsorPresentations.overview();
    expect(view.notices.notReached).toEqual([
      expect.objectContaining({
        userId: hacker.session.user.id,
        reason: "failed",
      }),
    ]);

    // Mailjet set up but rejecting: still failed.
    mailjet.configured = true;
    mail.mockResolvedValue({ data: null, error: { message: "nope" } });
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      failed: 1,
    });

    // Working again: the retry reaches them.
    mail.mockResolvedValue(mailOk);
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      emailed: 1,
    });
    view = await organizer.sponsorPresentations.overview();
    expect(view.notices.notReached).toEqual([]);
  });

  test("a second notify sends nothing; resend sends everyone again", async () => {
    slackToken = "xoxb-test";
    const { t } = await scheduledTeam();
    await member(t);
    await member(t);

    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      sent: 2,
      skipped: 0,
    });
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      sent: 0,
      skipped: 2,
    });
    expect(dm).toHaveBeenCalledTimes(2);

    expect(
      await organizer.sponsorPresentations.notify({ resend: true }),
    ).toMatchObject({ sent: 2, skipped: 0 });
    expect(dm).toHaveBeenCalledTimes(4);
  });

  test("a double click DMs each member once", async () => {
    slackToken = "xoxb-test";
    const { t } = await scheduledTeam();
    await member(t);
    dm.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve("sent"), 50)),
    );
    const [a, b] = await Promise.all([
      organizer.sponsorPresentations.notify(),
      organizer.sponsorPresentations.notify(),
    ]);
    expect(a.sent + b.sent).toBe(1);
    expect(dm).toHaveBeenCalledTimes(1);
  });

  test("a retry targets only members not reached", async () => {
    slackToken = "xoxb-test";
    const { t } = await scheduledTeam();
    const ok = await member(t);
    const missing = await member(t);
    const flaky = await member(t);
    dm.mockImplementation(async (_token, m) =>
      m.email === missing.session.user.email
        ? "not-found"
        : m.email === flaky.session.user.email
          ? "failed"
          : "sent",
    );
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      sent: 1,
      emailed: 1,
      failed: 1,
      notOnSlack: [],
    });
    // One member reached: the team's times are on /live for everyone.
    expect(await flaky.caller.sponsorPresentations.mine()).toHaveLength(1);
    const { notices } = await organizer.sponsorPresentations.overview();
    // The emailed member counts as reached; only the failed DM is left.
    expect(notices.reached).toBe(2);
    expect(
      Object.fromEntries(notices.notReached.map((m) => [m.userId, m.reason])),
    ).toEqual({ [flaky.session.user.id]: "failed" });
    // Per hacker: how each was reached, with the time for those reached.
    expect(
      Object.fromEntries(notices.hackers.map((h) => [h.userId, h.status])),
    ).toEqual({
      [ok.session.user.id]: "sent",
      [missing.session.user.id]: "emailed",
      [flaky.session.user.id]: "failed",
    });
    expect(
      notices.hackers.find((h) => h.userId === flaky.session.user.id)!.sentAt,
    ).toBeNull();
    expect(
      notices.hackers.find((h) => h.userId === ok.session.user.id)!.sentAt,
    ).toBeInstanceOf(Date);

    dm.mockClear();
    dm.mockResolvedValue("sent");
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      sent: 1,
      skipped: 2,
    });
    const retried = dm.mock.calls.map((c) => c[1].email);
    expect(retried).toEqual([flaky.session.user.email]);
    expect(mail).toHaveBeenCalledTimes(1);
  });
});

describe("sponsorPresentations.schedule and notices", () => {
  test("rescheduling keeps members notified when their times don't change", async () => {
    slackToken = "xoxb-test";
    const { s, t } = await scheduledTeam("Rm 2110");
    const hacker = await member(t);
    await organizer.sponsorPresentations.notify();

    // Same input: same times, nothing to tell anyone.
    expect(
      await organizer.sponsorPresentations.schedule({ dryRun: true }),
    ).toMatchObject({ changedTimes: 0 });
    await organizer.sponsorPresentations.schedule();
    expect(await hacker.caller.sponsorPresentations.mine()).toHaveLength(1);
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      sent: 0,
      skipped: 1,
    });

    // New room: the confirm step counts them, a dry run changes nothing.
    rooms.mockResolvedValue(new Map([[s.id, "Rm 3000"]]));
    expect(
      await organizer.sponsorPresentations.schedule({ dryRun: true }),
    ).toMatchObject({ changedTimes: 1 });
    expect(await hacker.caller.sponsorPresentations.mine()).toEqual([
      expect.objectContaining({ room: "Rm 2110" }),
    ]);

    // Stored: /live hides the new times until they're sent.
    await organizer.sponsorPresentations.schedule();
    expect(await hacker.caller.sponsorPresentations.mine()).toEqual([]);
    const { notices } = await organizer.sponsorPresentations.overview();
    expect(notices.notReached).toEqual([
      expect.objectContaining({ reason: "not-sent" }),
    ]);
    expect(await organizer.sponsorPresentations.notify()).toMatchObject({
      sent: 1,
    });
    expect(await hacker.caller.sponsorPresentations.mine()).toEqual([
      expect.objectContaining({ room: "Rm 3000" }),
    ]);
  });

  test("clamps a long sheet room to the column instead of failing", async () => {
    const s = await sponsor();
    const t = await team();
    await send(s.id, [t]);
    rooms.mockResolvedValue(new Map([[s.id, `  ${"Room ".repeat(30)}  `]]));
    await expect(
      organizer.sponsorPresentations.schedule(),
    ).resolves.toMatchObject({ placed: 1 });
    const [row] = await db.select().from(sponsorPresentations);
    expect(row!.room!.length).toBeLessThanOrEqual(64);
    expect(row!.room!.startsWith("Room Room")).toBe(true);
  });
});

describe("sponsorPresentations.setRound2", () => {
  test("organizers open and close round 2; opening needs a schedule", async () => {
    await expect(
      anon.sponsorPresentations.setRound2({ open: true }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    await organizer.sponsorPresentations.setRound2({ open: false });
    await expect(
      organizer.sponsorPresentations.setRound2({ open: true }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(
      (await organizer.sponsorPresentations.overview()).round2OpenedAt,
    ).toBeNull();

    await scheduledTeam();
    const opened = await organizer.sponsorPresentations.setRound2({
      open: true,
    });
    expect(opened.round2OpenedAt).toBeInstanceOf(Date);
    // Opening again keeps the first opened time.
    const again = await organizer.sponsorPresentations.setRound2({
      open: true,
    });
    expect(again.round2OpenedAt).toEqual(opened.round2OpenedAt);
    expect(
      (await organizer.sponsorPresentations.overview()).round2OpenedAt,
    ).toEqual(opened.round2OpenedAt);

    await organizer.sponsorPresentations.setRound2({ open: false });
    expect(
      (await organizer.sponsorPresentations.overview()).round2OpenedAt,
    ).toBeNull();
  });
});

describe("presentationEmail", () => {
  test("lists times in order, greets by first name, escapes the HTML", () => {
    const msg = presentationEmail({ name: "Ada Lovelace" }, "A<b>", [
      { sponsorName: "QNX", room: "Rm 2235", start: 620 },
      { sponsorName: "Scotia & Co", room: "Rm 2110", start: 600 },
    ]);
    expect(msg.subject).toContain("A<b>");
    expect(msg.text).toContain("Hi Ada,");
    expect(msg.text.indexOf("10:00 AM")).toBeLessThan(
      msg.text.indexOf("10:20 AM"),
    );
    expect(msg.html).toContain("A&lt;b&gt;");
    expect(msg.html).toContain("Scotia &amp; Co, Rm 2110");
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
