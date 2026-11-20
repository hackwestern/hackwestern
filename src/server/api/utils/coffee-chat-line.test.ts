import { and, asc, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { runInviteRound } from "~/server/api/utils/coffee-chat-invites";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatLine,
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatReps,
  coffeeChats,
  sponsorInterests,
  sponsorJudgingSponsors,
  sponsorScans,
  sponsorShortlists,
  users,
} from "~/server/db/schema";

const { deliver, name } = vi.hoisted(() => ({
  name: `LineCo${Date.now()}`,
  deliver: vi.fn((_jobs: { event: string; notice: { chatId: string } }[]) =>
    Promise.resolve({ slack: 0, email: 0, failed: 0, skipped: 0 }),
  ),
}));

// Never reach Slack, email or the sheet from a test.
vi.mock("~/server/api/utils/coffee-chat-invites", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/coffee-chat-invites")>()),
  deliverInviteNotices: deliver,
}));
vi.mock("~/server/api/utils/coffee-chat-invites-sheet-mirror", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/coffee-chat-invites-sheet-mirror")>()),
  mirrorCoffeeInvitesLater: vi.fn(),
}));
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/api/utils/run-of-show-sheet")>()),
  sheetWritesEnabled: () => false,
  getRunOfShow: () =>
    Promise.resolve({
      readAt: "2026-11-20T12:00:00.000Z",
      items: [],
      tasks: [],
      coffeeChats: [],
      ceremonies: [],
      workshops: [],
      availability: { people: [], slots: [] },
    }),
}));

const FRI_10PM = new Date("2026-11-20T22:00:00-05:00");
const ids: Record<string, string> = {};
let n = 0;

async function hacker(key: string, opts: { share?: boolean } = {}) {
  const id = `line-${key}-${++n}-${Date.now()}`;
  ids[key] = id;
  await db.insert(users).values({ id, email: `${id}@example.com`, name: `${key} Person`, type: "hacker" });
  await db.insert(applications).values({
    userId: id,
    status: "CONFIRMED",
    firstName: key,
    lastName: "Person",
    githubLink: "https://github.com/x",
    linkedInLink: "https://linkedin.com/in/x",
    devpostLink: "https://devpost.com/x",
    resumeLink: "https://example.com/resume.pdf",
    agreeShareWithSponsors: opts.share ?? true,
  });
}

let sponsorId = "";
let placementId = "";
const organizerSession = await mockOrganizerSession(db);
const organizer = createCaller(createInnerTRPCContext({ session: organizerSession }));
const someone = createCaller(createInnerTRPCContext({ session: await mockSession(db) }));

const liveRows = () =>
  db
    .select()
    .from(coffeeChats)
    .where(eq(coffeeChats.sponsorId, sponsorId))
    .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt));
const seatOf = async (key: string) =>
  (await liveRows()).find((r) => r.userId === ids[key] && (r.status === "pending" || r.status === "accepted"));

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FRI_10PM);
  process.env.COFFEE_INVITES_ENABLED = "1";
  // Groups of 2 (30 min), 2 chats at 10-11: 10:00 and 10:30, 4 seats.
  const [sp] = await db.insert(sponsorJudgingSponsors).values({ name }).returning();
  sponsorId = sp!.id;
  await db.insert(coffeeChatPrefs).values({ sponsorId, hackersPerChat: 2, submittedAt: new Date() });
  const [rep] = await db
    .insert(coffeeChatReps)
    .values({ sponsorId, name: "Dana W.", phone: "5195550101", chatsWanted: 2, isPrimary: true })
    .returning();
  const [p] = await db
    .insert(coffeeChatPlacements)
    .values({ repId: rep!.id, sessionId: "10", room: "2241", status: "sent", sentAt: new Date() })
    .returning();
  placementId = p!.id;
  for (const k of ["a1", "a2", "a3", "a4", "b1", "b2", "d", "e", "f"]) await hacker(k);
  await hacker("c", { share: false });
  for (const k of ["a1", "a2", "a3", "a4"]) {
    await db.insert(sponsorScans).values({ sponsorId, userId: ids[k]! });
  }
  await db.insert(sponsorShortlists).values({ sponsorId, userId: ids.b1! });
  await db.insert(sponsorInterests).values({ sponsorId, userId: ids.b2!, rank: 1 });
  const round = await db.transaction((tx) => runInviteRound(tx, { sponsorIds: [sponsorId], now: FRI_10PM }));
  expect(round).toMatchObject({ status: "ok" });
});

afterAll(() => {
  delete process.env.COFFEE_INVITES_ENABLED;
  vi.useRealTimers();
});

describe("a sponsor's line (coffee board v12)", () => {
  test("organizers only", async () => {
    await expect(someone.coffeeChatInvites.line({ sponsorId })).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(someone.coffeeChatInvites.putFirst({ sponsorId, code: "x" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("the 4 booth hackers hold the seats; the line is the shortlist, then interested", async () => {
    expect((await liveRows()).map((r) => r.userId).sort()).toEqual(["a1", "a2", "a3", "a4"].map((k) => ids[k]).sort());
    const a1 = (await seatOf("a1"))!;
    const view = await organizer.coffeeChatInvites.line({ sponsorId, chatId: a1.id });
    expect(view.queue.map((q) => [q.name, q.source])).toEqual([
      ["b1 P.", "shortlist"],
      ["b2 P.", "interested"],
    ]);
    expect(view.next).toMatchObject({ name: "b1 P.", source: "shortlist" });
  });

  test("checking a hacker ID: unknown, not sharing, already invited or in line, or fine", async () => {
    const a1 = (await seatOf("a1"))!;
    const check = (code: string) => organizer.coffeeChatInvites.checkHacker({ sponsorId, code, chatId: a1.id });
    expect(await check("nobody-at-all")).toEqual({ ok: false, error: "No hacker with ID nobody-at-all." });
    expect(await check(ids.c!)).toEqual({ ok: false, error: "c P. didn't agree to share with sponsors, so they can't be invited." });
    expect(await check(ids.a2!)).toEqual({ ok: false, error: "a2 P. is already invited or in line." });
    expect(await check(ids.b2!)).toEqual({ ok: false, error: "b2 P. is already invited or in line." });
    expect(await check(ids.d!)).toEqual({ ok: true, name: "d P." });
  });

  test("Remove a hacker, next in line takes the seat; the removed one is told and never offered this sponsor again", async () => {
    const a1 = (await seatOf("a1"))!;
    deliver.mockClear();
    const out = await organizer.coffeeChatInvites.replace({ chatId: a1.id, pick: { kind: "next" } });
    expect(out).toEqual({ removed: "a1 P.", invited: "b1 P." });
    const rows = await liveRows();
    expect(rows.find((r) => r.id === a1.id)).toMatchObject({ status: "cancelled" });
    expect(await seatOf("b1")).toMatchObject({
      placementId,
      slotTime: a1.slotTime,
      durationMinutes: 30,
      status: "pending",
      source: "shortlist",
      round: 1,
      // The usual answer-by: round 1's, capped at the chat's last call (9:40).
      expiresAt: a1.expiresAt,
    });
    expect(deliver.mock.calls.flatMap((c) => c[0].map((j) => j.event)).sort()).toEqual(["cancelled", "offered"]);
    const [line] = await db
      .select()
      .from(coffeeChatLine)
      .where(and(eq(coffeeChatLine.sponsorId, sponsorId), eq(coffeeChatLine.userId, ids.a1!)));
    expect(line).toMatchObject({ kind: "removed", addedBy: organizerSession.user.id });
    expect(await organizer.coffeeChatInvites.checkHacker({ sponsorId, code: ids.a1! })).toEqual({
      ok: false,
      error: "a1 P. said no to this sponsor or was removed, so they aren't offered it again.",
    });
    // The seat count of the hour didn't change: 4 live invites.
    expect(rows.filter((r) => r.status === "pending" || r.status === "accepted")).toHaveLength(4);
  });

  test("Someone else by ID takes the seat as Added by organizer", async () => {
    const a2 = (await seatOf("a2"))!;
    const out = await organizer.coffeeChatInvites.replace({ chatId: a2.id, pick: { kind: "code", code: ids.d! } });
    expect(out).toEqual({ removed: "a2 P.", invited: "d P." });
    expect(await seatOf("d")).toMatchObject({ slotTime: a2.slotTime, source: "organizer", status: "pending" });
    // A bad pick is refused and nothing changes.
    const a3 = (await seatOf("a3"))!;
    await expect(
      organizer.coffeeChatInvites.replace({ chatId: a3.id, pick: { kind: "code", code: ids.b2! } }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "b2 P. is already invited or in line." });
    expect(await seatOf("a3")).toMatchObject({ id: a3.id });
  });

  test("Put someone first in line: newest first, ahead of the shortlist and interested; a freed seat goes to them", async () => {
    expect(await organizer.coffeeChatInvites.putFirst({ sponsorId, code: ids.e! })).toEqual({ name: "e P." });
    vi.setSystemTime(new Date(FRI_10PM.getTime() + 60_000));
    expect(await organizer.coffeeChatInvites.putFirst({ sponsorId, code: ids.f! })).toEqual({ name: "f P." });
    await expect(organizer.coffeeChatInvites.putFirst({ sponsorId, code: ids.f! })).rejects.toMatchObject({
      message: "f P. is already invited or in line.",
    });
    const view = await organizer.coffeeChatInvites.line({ sponsorId });
    expect(view.queue.map((q) => [q.name, q.source])).toEqual([
      ["f P.", "organizer"],
      ["e P.", "organizer"],
      ["b2 P.", "interested"],
    ]);
    // a3 says no: the seat goes to the newest organizer pick, never to a1.
    const a3 = (await seatOf("a3"))!;
    await db.update(coffeeChats).set({ status: "declined" }).where(eq(coffeeChats.id, a3.id));
    await db.transaction((tx) => runInviteRound(tx, { sponsorIds: [sponsorId], now: FRI_10PM }));
    expect(await seatOf("f")).toMatchObject({ slotTime: a3.slotTime, source: "organizer" });
    expect(await seatOf("a1")).toBeUndefined();
  });

  test("invites switched off: nobody can be invited", async () => {
    const b1 = (await seatOf("b1"))!;
    process.env.COFFEE_INVITES_ENABLED = "0";
    try {
      await expect(
        organizer.coffeeChatInvites.replace({ chatId: b1.id, pick: { kind: "next" } }),
      ).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    } finally {
      process.env.COFFEE_INVITES_ENABLED = "1";
    }
  });
});
