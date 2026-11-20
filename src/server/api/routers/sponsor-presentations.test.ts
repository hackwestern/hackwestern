import { beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type * as Env from "~/env";

import { createCaller } from "~/server/api/root";
import { notifyPresentationTimes } from "~/server/api/routers/sponsor-presentations";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  sponsorJudgingRooms,
  sponsorJudgingSponsors,
  sponsorPresentationConfirms,
  sponsorPresentationNotices,
  sponsorPresentations,
  sponsorShortlistSends,
  teams,
  users,
} from "~/server/db/schema";
import {
  round2OpenedAt,
  setRound2Open,
} from "~/server/api/utils/sponsor-judging-settings";
import { mirrorSponsorJudgingSoon } from "~/server/api/utils/sponsor-judging-sheet-mirror";
import { sendPresentationDm } from "~/server/slack/presentation-dm";
import { presentationDmMessage } from "~/server/slack/presentation-dm";
import { sendViaMailjet } from "~/server/mail-mailjet";
import { presentationEmail } from "~/server/api/utils/presentation-email";
import { SHORTLIST_MAX } from "~/lib/sponsor-presentations";

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

// Notify teams waits until every board sponsor has a room. Sponsors from
// earlier tests stay in the database without one, so the check is faked
// here (empty = all set) and tested on its own below.
const roomless = vi.hoisted(() => vi.fn(async (): Promise<string[]> => []));
vi.mock("~/server/api/utils/judging-board-data", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/judging-board-data")
  >()),
  sponsorsWithoutRoom: roomless,
}));

// No sponsor judges remotely right now (TinyFish is in person since
// 2026-11-20), but the mechanism stays: a test-only list keeps it covered.
const TEST_REMOTE_SPONSOR = "TinyFish";
vi.mock("~/content/sponsor-prize-tracks", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/content/sponsor-prize-tracks")>()),
  REMOTE_JUDGING_SPONSORS: ["TinyFish"],
}));

// The Sponsor Judging tab mirror writes to Google Sheets; never here.
vi.mock("~/server/api/utils/sponsor-judging-sheet-mirror", () => ({
  mirrorSponsorJudging: vi.fn(async () => ({ ok: true, rows: 0 })),
  mirrorSponsorJudgingLater: vi.fn(),
  mirrorSponsorJudgingSoon: vi.fn(async () => undefined),
}));

// Rooms come from the sheets (faked by sheetRooms), with the Judging
// board's picks (sponsor_judging_room) on top, as in production; Slack is
// the network.
const sheetRooms = vi.hoisted(() =>
  vi.fn<
    (s: readonly { id: string; name: string }[]) => Promise<Map<string, string>>
  >(),
);
vi.mock("~/server/api/utils/sponsor-judging-board", async () => {
  const { db } = await import("~/server/db");
  const { sponsorJudgingRooms } = await import("~/server/db/schema");
  const { remoteJudgingRoom } = await import("~/lib/sponsor-prize-tracks");
  const withSource = async (
    sponsors: readonly { id: string; name: string }[],
  ) => {
    const out = new Map<string, { room: string; source: string }>();
    for (const [id, room] of (await sheetRooms(sponsors)) ?? new Map()) {
      out.set(id, { room, source: "sheet" });
    }
    for (const p of await db.select().from(sponsorJudgingRooms)) {
      out.set(p.sponsorId, { room: p.room, source: "board" });
    }
    for (const sp of sponsors) {
      const remote = remoteJudgingRoom(sp.name);
      if (remote) out.set(sp.id, { room: remote, source: "remote" });
    }
    return out;
  };
  return {
    judgingRoomsWithSource: withSource,
    judgingRoomsById: async (
      sponsors: readonly { id: string; name: string }[],
    ) =>
      new Map([...(await withSource(sponsors))].map(([k, v]) => [k, v.room])),
  };
});
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
const rooms = sheetRooms;
const dm = vi.mocked(sendPresentationDm);

const anon = createCaller(createInnerTRPCContext({ session: null }));
let organizer: ReturnType<typeof createCaller>;

beforeEach(async () => {
  slackToken = undefined;
  mailjet.configured = true;
  mail.mockReset().mockResolvedValue(mailOk);
  rooms.mockReset().mockResolvedValue(new Map());
  roomless.mockReset().mockResolvedValue([]);
  dm.mockReset().mockResolvedValue("sent");
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
  await db.delete(sponsorPresentationNotices);
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
  await db.delete(sponsorPresentations);
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
  await db.delete(sponsorShortlistSends);
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
  await db.delete(sponsorJudgingRooms);
  // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
  await db.delete(sponsorPresentationConfirms);
  organizer = createCaller(
    createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
  );
});

/** A sponsor with a prize track (the name contains "QNX"), or without. */
async function sponsor(prizeTrack = true) {
  const name = `${prizeTrack ? "QNX" : "Sponsor"} ${faker.string.alphanumeric(10)}`;
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name })
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

  test("an old send over the cap: the first SHORTLIST_MAX in shortlist order are scheduled, the rest flagged over-cap", async () => {
    const s = await sponsor();
    const ids: string[] = [];
    for (let i = 0; i < SHORTLIST_MAX + 2; i++) ids.push(await team());
    await send(s.id, ids);
    rooms.mockResolvedValue(new Map([[s.id, "Rm 2110"]]));

    const res = await organizer.sponsorPresentations.schedule();
    expect(res).toMatchObject({ placed: SHORTLIST_MAX, unplaced: 2 });
    const view = await organizer.sponsorPresentations.overview();
    expect(new Set(view.slots.map((x) => x.teamId))).toEqual(
      new Set(ids.slice(0, SHORTLIST_MAX)),
    );
    expect(
      view.unplaced.map((u) => ({ teamId: u.teamId, reason: u.reason })),
    ).toEqual(
      expect.arrayContaining(
        ids
          .slice(SHORTLIST_MAX)
          .map((teamId) => ({ teamId, reason: "over-cap" })),
      ),
    );
    expect(view.unplaced).toHaveLength(2);
  });

  test("schedules every sent team, even for a sponsor with no room yet, and replaces on rerun", async () => {
    const a = await sponsor();
    const b = await sponsor();
    const shared = await team();
    const other = await team();
    await send(a.id, [shared, other]);
    await send(b.id, [shared]);
    rooms.mockResolvedValue(new Map([[a.id, "Rm 2110"]]));

    // B has no room: its team still gets a time, with no room on it.
    const res = await organizer.sponsorPresentations.schedule();
    expect(res).toMatchObject({ placed: 3, unplaced: 0 });

    const view = await organizer.sponsorPresentations.overview();
    expect(
      view.slots.filter((s) => s.sponsorId === b.id).map((s) => s.room),
    ).toEqual([""]);
    expect(view.unplaced).toEqual([]);
    const bTime = view.slots.find((s) => s.sponsorId === b.id)!.start;
    expect(view.sponsors.find((s) => s.sponsorId === a.id)).toMatchObject({
      sentCount: 2,
      sentAfterSchedule: false,
    });

    // B gets a room: the rerun keeps B's time and fills in the room.
    rooms.mockResolvedValue(
      new Map([
        [a.id, "Rm 2110"],
        [b.id, "Rm 2230"],
      ]),
    );
    await organizer.sponsorPresentations.schedule();
    const again = await organizer.sponsorPresentations.overview();
    expect(again.unplaced).toEqual([]);
    expect(again.slots.find((s) => s.sponsorId === b.id)).toMatchObject({
      room: "Rm 2230",
      start: bTime,
    });
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

describe("sponsorPresentations prize track gate", () => {
  test("a sponsor without a prize track is never scheduled or listed", async () => {
    const track = await sponsor();
    const none = await sponsor(false);
    const t = await team();
    await send(track.id, [t]);
    await send(none.id, [t]);
    rooms.mockResolvedValue(
      new Map([
        [track.id, "Rm 2110"],
        [none.id, "Rm 2230"],
      ]),
    );

    const res = await organizer.sponsorPresentations.schedule();
    expect(res).toMatchObject({ placed: 1, unplaced: 0 });
    const rows = await db.select().from(sponsorPresentations);
    expect(rows.map((r) => r.sponsorId)).toEqual([track.id]);
    // Rooms are only looked up for track sponsors.
    expect(rooms.mock.calls[0]![0].map((s) => s.id)).not.toContain(none.id);

    const view = await organizer.sponsorPresentations.overview();
    const listed = view.sponsors.map((s) => s.sponsorId);
    expect(listed).toContain(track.id);
    expect(listed).not.toContain(none.id);
  });

  test("only non-track shortlists sent: nothing to schedule", async () => {
    const none = await sponsor(false);
    await send(none.id, [await team()]);
    await expect(
      organizer.sponsorPresentations.schedule(),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

describe("the Sponsor Judging tab", () => {
  test("scheduling and notifying rewrite the tab; a dry run doesn't", async () => {
    const soon = vi.mocked(mirrorSponsorJudgingSoon);
    soon.mockClear();
    const { t } = await scheduledTeam();
    expect(soon).toHaveBeenCalledTimes(1);
    await organizer.sponsorPresentations.schedule({ dryRun: true });
    expect(soon).toHaveBeenCalledTimes(1);
    await member(t);
    slackToken = "xoxb-test";
    await organizer.sponsorPresentations.notify();
    expect(soon).toHaveBeenCalledTimes(2);
  });

  test("opening and closing round 2 rewrite the tab (no manual sync)", async () => {
    await scheduledTeam();
    const soon = vi.mocked(mirrorSponsorJudgingSoon);
    soon.mockClear();
    await organizer.sponsorPresentations.setRound2({ open: true });
    expect(soon).toHaveBeenCalledTimes(1);
    await organizer.sponsorPresentations.setRound2({ open: false });
    expect(soon).toHaveBeenCalledTimes(2);
  });
});

describe("sponsorPresentations.notify", () => {
  test("is refused until every sponsor has a room", async () => {
    slackToken = "xoxb-test";
    await scheduledTeam();
    roomless.mockResolvedValueOnce(["Scotiabank"]);
    await expect(organizer.sponsorPresentations.notify()).rejects.toMatchObject(
      {
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("Scotiabank") as string,
      },
    );
    expect(dm).not.toHaveBeenCalled();
  });

  test("sponsorsWithoutRoom lists a board sponsor until it has a room", async () => {
    const { sponsorsWithoutRoom } = await vi.importActual<
      typeof import("~/server/api/utils/judging-board-data")
    >("~/server/api/utils/judging-board-data");
    const s = await sponsor();
    expect(await sponsorsWithoutRoom()).toContain(s.name);
    rooms.mockResolvedValue(new Map([[s.id, "Rm 2110"]]));
    expect(await sponsorsWithoutRoom()).not.toContain(s.name);
  });

  test("fails clearly when Slack isn't configured", async () => {
    await expect(organizer.sponsorPresentations.notify()).rejects.toMatchObject(
      {
        code: "PRECONDITION_FAILED",
        message: expect.stringContaining("SLACK_BOT_TOKEN") as string,
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
      undefined,
      // The Confirm button carries the team and the times it was sent.
      {
        teamId: expect.any(String) as string,
        key: expect.stringContaining("600|") as string,
      },
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

  test("one member confirming accepts for the team, until the times change", async () => {
    slackToken = "xoxb-test";
    const { s, t } = await scheduledTeam("Rm 2110");
    const a = await member(t);
    const b = await member(t);

    // Nothing to confirm before the team was told its times.
    await expect(a.caller.sponsorPresentations.confirm()).rejects.toMatchObject(
      { code: "CONFLICT" },
    );
    await organizer.sponsorPresentations.notify();
    await a.caller.sponsorPresentations.confirm();
    // Covers the whole team.
    expect(
      (await b.caller.sponsorPresentations.myConfirmation()).confirmedAt,
    ).not.toBeNull();

    // A room change gives new times: the team has to confirm again.
    rooms.mockResolvedValue(new Map([[s.id, "Rm 2230"]]));
    await organizer.sponsorPresentations.schedule();
    expect(
      (await b.caller.sponsorPresentations.myConfirmation()).confirmedAt,
    ).toBeNull();
  });

  test("a shortlist send tells only that sponsor's teams, every member, once", async () => {
    slackToken = "xoxb-test";
    const { t } = await scheduledTeam("Rm 2110");
    const other = await scheduledTeam("Rm 2235");
    const a = await member(t);
    const b = await member(t);
    await member(other.t);

    await notifyPresentationTimes({ teamIds: [t] });
    // Both members of the shortlisted team, nobody on the other team.
    expect(dm).toHaveBeenCalledTimes(2);
    const told = dm.mock.calls.map((c) => (c[1] as { email: string }).email);
    expect(told.sort()).toEqual(
      [a.session.user.email, b.session.user.email].sort(),
    );
    // On /live too, for each member.
    expect(await b.caller.sponsorPresentations.mine()).toHaveLength(1);
    // Sending again never messages them twice.
    await notifyPresentationTimes({ teamIds: [t] });
    expect(dm).toHaveBeenCalledTimes(2);
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
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message:
        "Schedule presentations before opening round 2. No team has a presentation slot yet.",
    });
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

describe("setRound2Open (the shared guard)", () => {
  test("refuses to open with nothing scheduled, or only unplaced teams", async () => {
    const message =
      "Schedule presentations before opening round 2. No team has a presentation slot yet.";
    await expect(setRound2Open(true)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message,
    });
    // A schedule where nothing fit (no room) still has no slot.
    const s = await sponsor();
    await db.insert(sponsorPresentations).values({
      sponsorId: s.id,
      teamId: await team(),
      room: null,
      startMinute: null,
    });
    await expect(setRound2Open(true)).rejects.toMatchObject({ message });
    expect(await round2OpenedAt()).toBeNull();
    // Closing always works.
    await expect(setRound2Open(false)).resolves.toBeNull();
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

describe("sponsorPresentations judging board", () => {
  async function named(name: string) {
    const [row] = await db
      .insert(sponsorJudgingSponsors)
      .values({ name: `${name} ${faker.string.alphanumeric(8)}` })
      .returning();
    return row!;
  }

  test("organizers only", async () => {
    await expect(anon.sponsorPresentations.board()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
  });

  test("sets a room, keeps the team's time and asks to tell them again", async () => {
    slackToken = "xoxb-test";
    const { s, t } = await scheduledTeam("Rm 2110");
    await member(t);
    await organizer.sponsorPresentations.notify();
    let board = await organizer.sponsorPresentations.board();
    expect(board.slots).toMatchObject([
      { teamId: t, room: "Rm 2110", start: 600, status: "waiting" },
    ]);
    expect(board.teamsNotTold).toBe(0);

    await organizer.sponsorPresentations.setRoom({
      sponsorId: s.id,
      room: "Rm 2230",
    });
    board = await organizer.sponsorPresentations.board();
    expect(board.sponsors.find((x) => x.sponsorId === s.id)).toMatchObject({
      room: "Rm 2230",
      roomSource: "board",
    });
    expect(board.slots).toMatchObject([
      { teamId: t, room: "Rm 2230", start: 600, status: "not-sent" },
    ]);
    expect(board.teamsNotTold).toBe(1);
  });

  test("refuses a taken room unless swapping", async () => {
    const a = await named("QNX");
    const b = await named("Scotiabank");
    rooms.mockResolvedValue(
      new Map([
        [a.id, "Rm 2235"],
        [b.id, "Rm 2110"],
      ]),
    );
    await expect(
      organizer.sponsorPresentations.setRoom({
        sponsorId: a.id,
        room: "rm 2110",
      }),
    ).rejects.toMatchObject({
      code: "CONFLICT",
      message: `Rm 2110 is ${b.name}'s. Pick another.`,
    });
    await organizer.sponsorPresentations.setRoom({
      sponsorId: a.id,
      room: "Rm 2110",
      swap: true,
    });
    const board = await organizer.sponsorPresentations.board();
    const roomOf = (id: string) =>
      board.sponsors.find((x) => x.sponsorId === id)?.room;
    expect(roomOf(a.id)).toBe("Rm 2110");
    expect(roomOf(b.id)).toBe("Rm 2235");
  });

  test("remote sponsors never present: no slots, no room", async () => {
    const remote = await named(TEST_REMOTE_SPONSOR);
    const t = await team();
    await send(remote.id, [t]);
    await expect(
      organizer.sponsorPresentations.schedule(),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const board = await organizer.sponsorPresentations.board();
    expect(board.slots).toEqual([]);
    expect(board.sponsors.find((x) => x.sponsorId === remote.id)).toMatchObject(
      { mode: "remote", teams: 1 },
    );
    await expect(
      organizer.sponsorPresentations.setRoom({
        sponsorId: remote.id,
        room: "Rm 2110",
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("the team modal shows check-in, times and status", async () => {
    const { t } = await scheduledTeam("Rm 2110");
    await member(t);
    const view = await organizer.sponsorPresentations.boardTeam({ teamId: t });
    expect(view).toMatchObject({
      teamId: t,
      status: "not-sent",
      presentsTo: [{ room: "Rm 2110", start: 600 }],
      checkedIn: false,
    });
    expect(view).not.toHaveProperty("scores");
    expect(view.members).toHaveLength(1);
    expect(view.members[0]!.checkedIn).toBe(false);
  });
});
