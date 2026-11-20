import { asc, eq } from "drizzle-orm";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import { planInviteRound } from "~/lib/coffee-chat-invites";
import { respondToCoffeeChat } from "~/server/api/utils/coffee-chat-respond";
import {
  countUnnotifiedInvites,
  deliverInviteNotices,
  deliverUnnotifiedInvites,
  invitesDeliveryLive,
  invitesEnabled,
  kickDueInviteRounds,
  type InviteJob,
  previewDueInviteRound,
  reconcileInvitesAfterChange,
  resetInviteRoundThrottle,
  runDueInviteRounds,
  runInviteRound,
  sendRoundOneInvites,
} from "~/server/api/utils/coffee-chat-invites";
import { loadCoffeeChatNotices } from "~/server/api/utils/coffee-chat-notify";
import { getRunOfShow } from "~/server/api/utils/run-of-show-sheet";
import { db } from "~/server/db";
import {
  applications,
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

const { names, dm, offerEmail, changeEmail, mirror } = vi.hoisted(() => {
  const stamp = Date.now();
  return {
    names: {
      alpha: `Alpha${stamp}`,
      beta: `Beta${stamp}`,
      gamma: `Gamma${stamp}`,
    },
    dm: vi.fn(async () => "sent" as const),
    offerEmail: vi.fn(async () => true),
    changeEmail: vi.fn(async () => true),
    mirror: vi.fn(async () => ({ ok: false as const, error: "disabled" })),
  };
});

// The real planner; one test hides a booking from it to fake a race.
vi.mock("~/lib/coffee-chat-invites", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("~/lib/coffee-chat-invites")>();
  return { ...actual, planInviteRound: vi.fn(actual.planInviteRound) };
});

// Never reach Slack, Mailjet or the sheet from a test.
vi.mock("~/server/slack/coffee-chat-dm", async (importOriginal) => ({
  ...(await importOriginal<typeof import("~/server/slack/coffee-chat-dm")>()),
  sendCoffeeChatDm: dm,
}));
vi.mock("~/server/api/utils/coffee-chat-email", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/coffee-chat-email")
  >()),
  sendCoffeeChatOfferEmail: offerEmail,
  sendCoffeeChatChangeEmail: changeEmail,
}));
vi.mock("~/server/api/utils/coffee-chat-sheet-mirror", () => ({
  mirrorCoffeeChats: mirror,
}));
vi.mock("~/server/mail-mailjet", () => ({
  sendViaMailjet: vi.fn(async () => ({ error: null })),
}));
vi.mock("~/server/api/utils/coffee-chat-notify", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/coffee-chat-notify")
  >()),
  notifyCoffeeChat: vi.fn(async () => undefined),
}));

// Alpha's workshop setup starts 13:45: its 1-2 session only fits 1:00 and 1:15.
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/run-of-show-sheet")
  >()),
  sheetWritesEnabled: () => false,
  getRunOfShow: vi.fn(() =>
    Promise.resolve({
      readAt: "2026-11-20T12:00:00.000Z",
      items: [
        {
          id: "Saturday-13:45-sponsor-workshop",
          day: "Saturday",
          start: "13:45",
          end: "15:00",
          column: "sponsor-workshop",
          title: `${names.alpha} Workshop`,
          location: "Rm 2230",
          sponsors: [],
        },
      ],
      tasks: [],
      coffeeChats: [],
      ceremonies: [],
      workshops: [],
      availability: { people: [], slots: [] },
    }),
  ),
}));

// The real kick and delivery; the status test stops the kick once so no
// round runs behind it, and one test makes a delivery reject.
vi.mock("~/server/api/utils/coffee-chat-invites", async (importOriginal) => {
  const actual =
    await importOriginal<
      typeof import("~/server/api/utils/coffee-chat-invites")
    >();
  return {
    ...actual,
    kickDueInviteRounds: vi.fn(actual.kickDueInviteRounds),
    deliverInviteNotices: vi.fn(actual.deliverInviteNotices),
  };
});

const FRI_10PM = new Date("2026-11-20T22:00:00-05:00");
const at = (hhmm: string) => new Date(`2026-11-21T${hhmm}:00-05:00`);

const ids: Record<string, string> = {};
let n = 0;

async function hacker(
  key: string,
  opts: { share?: boolean; status?: "CONFIRMED" | "REJECTED" } = {},
) {
  const id = `inv-${key}-${++n}`;
  ids[key] = id;
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    name: `${key} Person`,
    type: "hacker",
  });
  await db.insert(applications).values({
    userId: id,
    status: opts.status ?? "CONFIRMED",
    firstName: key,
    lastName: "Person",
    githubLink: "https://github.com/x",
    linkedInLink: "https://linkedin.com/in/x",
    devpostLink: "https://devpost.com/x",
    resumeLink: "https://example.com/resume.pdf",
    agreeShareWithSponsors: opts.share ?? true,
  });
  return id;
}

async function sponsor(
  name: string,
  prefs: { hackersPerChat: number },
  rep: { chats: number },
  placements: { sessionId: string; room: string; status: "draft" | "sent" }[],
) {
  const [sp] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name })
    .returning();
  await db
    .insert(coffeeChatPrefs)
    .values({ sponsorId: sp!.id, ...prefs, submittedAt: new Date() });
  const [r] = await db
    .insert(coffeeChatReps)
    .values({
      sponsorId: sp!.id,
      name: `${name} Rep`,
      phone: "5195550199",
      chatsWanted: rep.chats,
      isPrimary: true,
    })
    .returning();
  const rows = await db
    .insert(coffeeChatPlacements)
    .values(
      placements.map((p) => ({
        repId: r!.id,
        ...p,
        sentAt: p.status === "sent" ? new Date() : null,
      })),
    )
    .returning();
  return { id: sp!.id, repId: r!.id, placements: rows };
}

async function interested(sponsorId: string, keys: string[], rank = 1) {
  for (const [i, key] of keys.entries()) {
    await db.insert(sponsorInterests).values({
      userId: ids[key]!,
      sponsorId,
      rank,
      updatedAt: new Date(Date.UTC(2026, 10, 1, 0, i)),
    });
  }
}

const chatsOf = (sponsorId: string) =>
  db
    .select()
    .from(coffeeChats)
    .where(eq(coffeeChats.sponsorId, sponsorId))
    .orderBy(asc(coffeeChats.slotTime), asc(coffeeChats.createdAt));
const keyOf = (userId: string) =>
  Object.entries(ids).find(([, v]) => v === userId)?.[0];

let alpha: Awaited<ReturnType<typeof sponsor>>;
let beta: Awaited<ReturnType<typeof sponsor>>;
let gamma: Awaited<ReturnType<typeof sponsor>>;

beforeAll(async () => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(FRI_10PM);
  // Alpha: 1-on-1s, 6 chats: 4 at 11-12, 2 at 1:00-1:30 (partial session).
  alpha = await sponsor(names.alpha, { hackersPerChat: 1 }, { chats: 6 }, [
    { sessionId: "11", room: "2241", status: "sent" },
    { sessionId: "13", room: "2241", status: "sent" },
  ]);
  // Beta: groups of 2 (30 min), 2 chats at 2-3 in Ivey.
  beta = await sponsor(names.beta, { hackersPerChat: 2 }, { chats: 2 }, [
    { sessionId: "14", room: "1348", status: "sent" },
  ]);
  // Gamma: scheduled but never sent.
  gamma = await sponsor(names.gamma, { hackersPerChat: 1 }, { chats: 4 }, [
    { sessionId: "15", room: "2242", status: "draft" },
  ]);
  for (const k of ["h1", "h2", "h3", "h4", "h5", "h6", "h9"]) await hacker(k);
  await hacker("h7", { share: false });
  await hacker("h8", { status: "REJECTED" });
  for (const k of ["g1", "g2", "g3", "g4"]) await hacker(k);
  await db
    .insert(sponsorScans)
    .values({ sponsorId: alpha.id, userId: ids.h5!, repName: "Rep" });
  // Not sharing: never invited even when scanned.
  await db
    .insert(sponsorScans)
    .values({ sponsorId: alpha.id, userId: ids.h7! });
  await db
    .insert(sponsorShortlists)
    .values({ sponsorId: alpha.id, userId: ids.h6! });
  await interested(alpha.id, ["h8", "h1", "h2", "h3", "h4"]);
  await interested(beta.id, ["g1", "g2", "g3", "g4"]);
  await interested(gamma.id, ["h1", "h2", "h3", "h4", "h9"], 2);
});

afterAll(() => {
  vi.useRealTimers();
  delete process.env.COFFEE_INVITES_ENABLED;
});

beforeEach(() => {
  resetInviteRoundThrottle();
  dm.mockClear();
  offerEmail.mockClear();
  changeEmail.mockClear();
});
afterEach(() => {
  delete process.env.COFFEE_INVITES_ENABLED;
});

describe("safety gate", () => {
  test("the kill switch is off in tests by default: nothing is written or sent", async () => {
    expect(invitesEnabled()).toBe(false);
    const r = await db.transaction((tx) =>
      sendRoundOneInvites(tx, { now: FRI_10PM }),
    );
    expect(r.status).toBe("disabled");
    vi.setSystemTime(at("10:30"));
    expect(await runDueInviteRounds(at("10:30"))).toEqual({
      status: "disabled",
    });
    expect(
      await deliverInviteNotices([{ event: "offered", notice: {} as never }]),
    ).toMatchObject({ skipped: 1 });
    vi.setSystemTime(FRI_10PM);
    expect(await db.select().from(coffeeChats)).toEqual([]);
    expect(dm).not.toHaveBeenCalled();
  });

  test("the timed job sends nothing when nothing is sent", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    // Only Gamma's draft would be in play.
    const r = await db.transaction((tx) =>
      runInviteRound(tx, { sponsorIds: [gamma.id], now: FRI_10PM }),
    );
    expect(r.status).toBe("nothingSent");
    vi.setSystemTime(at("10:30"));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "draft" })
      .where(eq(coffeeChatPlacements.status, "sent"));
    const out = await runDueInviteRounds(at("10:30"));
    expect(out.status).toBe("ran");
    expect(out.status === "ran" && out.result.status).toBe("nothingSent");
    await db
      .update(coffeeChatPlacements)
      .set({ status: "sent" })
      .where(eq(coffeeChatPlacements.repId, alpha.repId));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "sent" })
      .where(eq(coffeeChatPlacements.repId, beta.repId));
    vi.setSystemTime(FRI_10PM);
    expect(await db.select().from(coffeeChats)).toEqual([]);
    expect(dm).not.toHaveBeenCalled();
    expect(offerEmail).not.toHaveBeenCalled();
  });

  test("before round 2 the timed job is a no-op", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    expect(await runDueInviteRounds(FRI_10PM)).toEqual({ status: "notYet" });
  });
});

describe("round 1 (Send, Fri 10 PM)", () => {
  test("one invite per seat: scanned, shortlist, interested; partial session; answer by Sat 10 AM", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const r = await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [alpha.id], now: FRI_10PM }),
    );
    expect(r.status).toBe("ok");
    const rows = await chatsOf(alpha.id);
    expect(rows.map((c) => [c.slotTime, keyOf(c.userId), c.source])).toEqual([
      ["11:00", "h5", "scanned"],
      ["11:15", "h6", "shortlist"],
      ["11:30", "h1", "interested"],
      ["11:45", "h2", "interested"],
      ["13:00", "h3", "interested"],
      ["13:15", "h4", "interested"],
    ]);
    for (const c of rows) {
      expect(c).toMatchObject({
        status: "pending",
        round: 1,
        room: "Rm 2241",
        repName: `${names.alpha} Rep`,
        durationMinutes: 15,
      });
      expect(c.expiresAt).toEqual(at("10:00"));
      expect(c.placementId).not.toBeNull();
    }
    // Delivery: one Slack DM per invite, with the session details.
    const d = await deliverInviteNotices(r.jobs);
    expect(d).toMatchObject({ slack: 6, email: 0, failed: 0 });
    expect(dm).toHaveBeenCalledTimes(6);
    const first = (dm.mock.calls[0] as unknown as [Record<string, unknown>])[0];
    expect(first).toMatchObject({
      sponsorName: names.alpha,
      repName: `${names.alpha} Rep`,
      room: "Rm 2241",
      reconfirm: false,
    });
  });

  test("pressing Send again doesn't overbook", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const r = await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [alpha.id], now: FRI_10PM }),
    );
    expect(r.status === "ok" && r.created).toEqual([]);
    expect(await chatsOf(alpha.id)).toHaveLength(6);
  });

  test("email goes out only when the DM wasn't sent", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    dm.mockResolvedValueOnce("not-found" as never);
    const [row] = await chatsOf(alpha.id);
    // Sent already: unsend it so it can go out again.
    await db
      .update(coffeeChats)
      .set({ notifiedAt: null })
      .where(eq(coffeeChats.id, row!.id));
    const [notice] = await loadCoffeeChatNotices([row!.id]);
    const d = await deliverInviteNotices([
      { event: "offered", notice: notice! },
    ]);
    expect(d).toMatchObject({ slack: 0, email: 1 });
    expect(offerEmail).toHaveBeenCalledTimes(1);
  });
});

describe("changes after invites", () => {
  test("hackers per chat changes: accepted keep seats first, the rest reconfirm or are cancelled", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [beta.id], now: FRI_10PM }),
    );
    let rows = await chatsOf(beta.id);
    expect(
      rows.map((c) => [c.slotTime, keyOf(c.userId), c.durationMinutes]),
    ).toEqual([
      ["14:00", "g1", 30],
      ["14:00", "g2", 30],
      ["14:30", "g3", 30],
      ["14:30", "g4", 30],
    ]);
    // Ivey: last call 35 min before; round 1 still closes Sat 10 AM.
    expect(rows[0]!.room).toBe("Rm 1348");
    await respondToCoffeeChat(
      ids.g3!,
      { chatId: rows[2]!.id, answer: "accept" },
      FRI_10PM,
      0,
    );

    // Beta switches to 1-on-1s: two 15-min chats at 2:00 and 2:15.
    const r = await db.transaction(async (tx) => {
      await tx
        .update(coffeeChatPrefs)
        .set({ hackersPerChat: 1 })
        .where(eq(coffeeChatPrefs.sponsorId, beta.id));
      return reconcileInvitesAfterChange(tx, beta.id, {
        now: new Date("2026-11-20T22:30:00-05:00"),
      });
    });
    expect(r).toMatchObject({
      status: "ok",
      kept: 0,
      reconfirm: 2,
      cancelled: 2,
    });
    rows = await chatsOf(beta.id);
    const live = rows.filter((c) => c.status === "pending");
    // g3 accepted, so keeps a seat first; then one of the 2:00 pair (same
    // invite time) gets 2:15. The 2:30 group's other hacker loses out.
    expect(
      live.map((c) => [c.slotTime, keyOf(c.userId), c.durationMinutes]),
    ).toEqual([
      ["14:00", "g3", 15],
      ["14:15", expect.stringMatching(/^g[12]$/), 15],
    ]);
    const second = keyOf(live[1]!.userId);
    // g3 had accepted: back to pending, answer again by Sat 10 AM.
    expect(live[0]!.expiresAt).toEqual(at("10:00"));
    expect(
      rows
        .filter((c) => c.status === "cancelled")
        .map((c) => keyOf(c.userId))
        .sort(),
    ).toEqual([second === "g1" ? "g2" : "g1", "g4"]);
    expect(r.jobs.map((j) => j.event).sort()).toEqual([
      "cancelled",
      "cancelled",
      "reconfirm",
      "reconfirm",
    ]);
    await deliverInviteNotices(r.jobs);
    expect(
      dm.mock.calls.filter((c) => (c as unknown[])[2] === "cancelled"),
    ).toHaveLength(2);
    expect(
      dm.mock.calls.filter(
        (c) => ((c as unknown[])[0] as { reconfirm?: boolean }).reconfirm,
      ),
    ).toHaveLength(2);
  });

  test("a removed placement: reconcile before the delete, hackers still hear", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const placementId = beta.placements[0]!.id;
    const r = await db.transaction(async (tx) => {
      const out = await reconcileInvitesAfterChange(tx, beta.id, {
        now: new Date("2026-11-20T22:40:00-05:00"),
        removingPlacementIds: [placementId],
      });
      await tx
        .delete(coffeeChatPlacements)
        .where(eq(coffeeChatPlacements.id, placementId));
      return out;
    });
    expect(r).toMatchObject({ cancelled: 2, reconfirm: 0 });
    expect(await chatsOf(beta.id)).toEqual([]);
    expect(r.jobs.map((j) => [j.event, j.notice.sponsorName])).toEqual([
      ["cancelled", names.beta],
      ["cancelled", names.beta],
    ]);
  });
});

describe("Saturday rounds", () => {
  test("an invite can't be accepted after its round closes", async () => {
    const [row] = await chatsOf(alpha.id);
    await expect(
      respondToCoffeeChat(
        row!.userId,
        { chatId: row!.id, answer: "accept" },
        at("10:05"),
        0,
      ),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("round 2 at 10:00: declines and expired seats refill from the interest pool until no one is left; drafts never touched", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const before = await chatsOf(alpha.id);
    const h1 = before.find((c) => c.userId === ids.h1)!;
    const h5 = before.find((c) => c.userId === ids.h5)!;
    const liveOf = async () =>
      (await chatsOf(alpha.id))
        .filter((c) => c.status === "pending" || c.status === "accepted")
        .map((c) => [c.slotTime, keyOf(c.userId), c.source]);
    // h1 declines Saturday morning. Alpha's own line is used up (the rest
    // hold Alpha seats, h8 isn't admitted), so the seat goes to the interest
    // pool: g1 (Beta's list) is first by best rank, then time, then id.
    dm.mockClear();
    await respondToCoffeeChat(
      ids.h1!,
      { chatId: h1.id, answer: "decline" },
      at("08:00"),
      0,
    );
    const g1 = (await chatsOf(alpha.id)).find((c) => c.userId === ids.g1)!;
    expect(g1).toMatchObject({
      slotTime: "11:30",
      source: "anyone",
      status: "pending",
      round: 1,
      expiresAt: at("10:00"),
    });
    expect(dm).toHaveBeenCalledTimes(1);
    await respondToCoffeeChat(
      ids.h5!,
      { chatId: h5.id, answer: "accept" },
      at("08:00"),
      0,
    );
    // A new interested hacker shows up Saturday morning.
    await interested(alpha.id, ["h9"]);

    // Round 1 closes at 10:00 and round 2 opens at once (not 10:30).
    dm.mockClear();
    vi.setSystemTime(at("10:00"));
    const out = await runDueInviteRounds(at("10:00"));
    expect(out.status).toBe("ran");
    const rows = await chatsOf(alpha.id);
    const round2 = rows.filter((c) => c.round === 2);
    // h6, g1, h2, h3 and h4 let theirs expire, and aren't asked again. h9
    // (Alpha's own line) takes the earliest empty seat, 11:15; then the pool:
    // g2, g3, g4 (g1 is blocked). All answer by round 2's close, 10:30.
    // 1:15 is left: everyone left in the pool is blocked or holds an Alpha
    // seat.
    expect(
      round2.map((c) => [
        c.slotTime,
        keyOf(c.userId),
        c.source,
        c.expiresAt?.toISOString(),
      ]),
    ).toEqual([
      ["11:15", "h9", "interested", at("10:30").toISOString()],
      ["11:30", "g2", "anyone", at("10:30").toISOString()],
      ["11:45", "g3", "anyone", at("10:30").toISOString()],
      ["13:00", "g4", "anyone", at("10:30").toISOString()],
    ]);
    expect(
      out.status === "ran" &&
        out.result.status === "ok" &&
        out.result.unfilled.map((u) => u.open),
    ).toEqual([1]);
    // Delivered by the round's sweep.
    expect(dm).toHaveBeenCalledTimes(4);
    for (const c of round2) expect(c.notifiedAt).not.toBeNull();
    expect(
      rows
        .filter((c) => c.status === "expired")
        .map((c) => keyOf(c.userId))
        .sort(),
    ).toEqual(["g1", "h2", "h3", "h4", "h6"]);
    // Gamma was never sent: no invites, even though h9 etc. are interested.
    expect(await chatsOf(gamma.id)).toEqual([]);

    // Running again changes nothing: no one is left for the 1:15 seat.
    resetInviteRoundThrottle();
    const again = await runDueInviteRounds(at("10:10"));
    expect(
      again.status === "ran" &&
        again.result.status === "ok" && [
          again.result.created,
          again.result.unfilled.map((u) => u.open),
        ],
    ).toEqual([[], [1]]);

    // h9 declines: nobody is left (every pool hacker is blocked or holds an
    // Alpha seat), so the seat stays empty.
    await respondToCoffeeChat(
      ids.h9!,
      { chatId: round2[0]!.id, answer: "decline" },
      at("10:15"),
      0,
    );
    expect(await liveOf()).toEqual([
      ["11:00", "h5", "scanned"],
      ["11:30", "g2", "anyone"],
      ["11:45", "g3", "anyone"],
      ["13:00", "g4", "anyone"],
    ]);
    // Round 3: g2, g3 and g4 let theirs expire. Everyone in the pool has
    // now had an Alpha invite, so no one is invented: five seats stay empty.
    resetInviteRoundThrottle();
    const r3 = await runDueInviteRounds(at("10:30"));
    expect(
      r3.status === "ran" &&
        r3.result.status === "ok" && [
          r3.result.created,
          r3.result.unfilled.map((u) => u.open),
        ],
    ).toEqual([[], [1, 1, 1, 1, 1]]);
    expect(await liveOf()).toEqual([["11:00", "h5", "scanned"]]);
    vi.setSystemTime(FRI_10PM);
  });

  test("declines re-send at once, in a chain: scanned, shortlist, interested, each with the current round's answer-by", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    vi.setSystemTime(FRI_10PM);
    // One 1-on-1 seat at 3:00.
    const theta = await sponsor(
      `Theta${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 1 },
      [{ sessionId: "15", room: "2244", status: "sent" }],
    );
    for (const k of ["t1", "t2", "t3", "t4", "t5"]) await hacker(k);
    await db
      .insert(sponsorScans)
      .values({ sponsorId: theta.id, userId: ids.t1! });
    await db
      .insert(sponsorShortlists)
      .values({ sponsorId: theta.id, userId: ids.t2! });
    await interested(theta.id, ["t3", "t4", "t5"]);
    await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [theta.id], now: FRI_10PM }),
    );
    const live = async () =>
      (await chatsOf(theta.id))
        .filter((c) => c.status === "pending" || c.status === "accepted")
        .map((c) => [keyOf(c.userId), c.source, c.round, c.expiresAt]);
    expect(await live()).toEqual([["t1", "scanned", 1, at("10:00")]]);

    // Friday 11 PM: t1 declines. t2 (shortlist) is invited in the same
    // transaction, answer by Sat 10 AM (round 1), and hears right away.
    dm.mockClear();
    const fri = new Date("2026-11-20T23:00:00-05:00");
    vi.setSystemTime(fri);
    const t1 = (await chatsOf(theta.id))[0]!;
    await respondToCoffeeChat(
      ids.t1!,
      { chatId: t1.id, answer: "decline" },
      fri,
      2000,
    );
    expect(await live()).toEqual([["t2", "shortlist", 1, at("10:00")]]);
    expect(dm).toHaveBeenCalledTimes(1);
    expect(
      (dm.mock.calls[0] as unknown as [{ chatId: string }])[0].chatId,
    ).toBe((await chatsOf(theta.id)).find((c) => c.userId === ids.t2)!.id);

    // Sat 9:30, still round 1: t2 declines; t3 also answers by 10 AM.
    vi.setSystemTime(at("09:30"));
    const t2 = (await chatsOf(theta.id)).find((c) => c.userId === ids.t2)!;
    await respondToCoffeeChat(
      ids.t2!,
      { chatId: t2.id, answer: "decline" },
      at("09:30"),
      0,
    );
    expect(await live()).toEqual([["t3", "interested", 1, at("10:00")]]);

    // t3 accepts, then backs out at 10:40 (round 3): t4 gets 30 minutes.
    const t3 = (await chatsOf(theta.id)).find((c) => c.userId === ids.t3)!;
    await respondToCoffeeChat(
      ids.t3!,
      { chatId: t3.id, answer: "accept" },
      at("09:40"),
      0,
    );
    vi.setSystemTime(at("10:40"));
    await respondToCoffeeChat(
      ids.t3!,
      { chatId: t3.id, answer: "decline" },
      at("10:40"),
      0,
    );
    expect(await live()).toEqual([["t4", "interested", 3, at("11:10")]]);

    // t4 lets it expire: the next round (its expiry sweep) asks t5, with
    // 30 minutes from when it ran (round 4 closes 11:30).
    vi.setSystemTime(at("11:12"));
    resetInviteRoundThrottle();
    const out = await runDueInviteRounds(at("11:12"));
    expect(out.status).toBe("ran");
    expect(await live()).toEqual([["t5", "interested", 4, at("11:42")]]);

    // t5 declines: Theta's own line is used up, so the chain goes on into
    // the interest pool. g1 (Beta's list, best rank first, then time, then
    // id) is free at 3:00 and was never asked by Theta. Nobody who said no
    // to Theta is asked again.
    await respondToCoffeeChat(
      ids.t5!,
      {
        chatId: (await chatsOf(theta.id)).find((c) => c.userId === ids.t5)!.id,
        answer: "decline",
      },
      at("11:20"),
      0,
    );
    expect(await live()).toEqual([["g1", "anyone", 4, at("11:50")]]);
    const all = await chatsOf(theta.id);
    expect(all.map((c) => keyOf(c.userId))).toEqual([
      "t1",
      "t2",
      "t3",
      "t4",
      "t5",
      "g1",
    ]);
    // Clean up so later tests (and their counts) don't see Theta.
    await db.delete(coffeeChats).where(eq(coffeeChats.sponsorId, theta.id));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "draft" })
      .where(eq(coffeeChatPlacements.repId, theta.repId));
    vi.setSystemTime(FRI_10PM);
  });

  test("throttled within a minute", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    vi.setSystemTime(at("11:30"));
    expect((await runDueInviteRounds(at("11:30"))).status).toBe("ran");
    expect(await runDueInviteRounds(at("11:30"))).toEqual({
      status: "throttled",
    });
    vi.setSystemTime(FRI_10PM);
  });
});

test("expired rows are written back", async () => {
  // The last round ran at 11:30: no Alpha invite is still pending past its
  // answer-by. Pending ones left are pool invites with time to answer.
  const rows = await chatsOf(alpha.id);
  expect(
    rows.filter(
      (c) => c.status === "pending" && c.expiresAt! <= at("11:30"),
    ),
  ).toEqual([]);
  expect(
    rows
      .filter((c) => c.status === "pending")
      .every((c) => c.source === "anyone" && c.expiresAt! > at("11:30")),
  ).toBe(true);
  // The 11:12 round's pool invites: t3's 11:45 seat answered by its last
  // call (11:25) and was written back as expired; t4 and t5 still have time.
  expect(
    rows
      .filter((c) => c.round === 4)
      .map((c) => [c.slotTime, keyOf(c.userId), c.status]),
  ).toEqual([
    ["11:45", "t3", "expired"],
    ["13:00", "t4", "pending"],
    ["13:15", "t5", "pending"],
  ]);
});

describe("coffeeChatInvites router", () => {
  test("organizers see invite status per sponsor and chat; hackers can't", async () => {
    const { createCaller } = await import("~/server/api/root");
    const { createInnerTRPCContext } = await import("~/server/api/trpc");
    const { mockOrganizerSession, mockSession } = await import("~/server/auth");
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const someone = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(someone.coffeeChatInvites.status()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(someone.coffeeChatInvites.runRoundNow()).rejects.toMatchObject(
      { code: "FORBIDDEN" },
    );

    vi.setSystemTime(FRI_10PM);
    const statusOf = async () => {
      // No round or sweep behind the read: this test only reads.
      vi.mocked(kickDueInviteRounds).mockImplementationOnce(() => undefined);
      return organizer.coffeeChatInvites.status({ sponsorId: alpha.id });
    };
    const status = await statusOf();
    expect(status.enabled).toBe(false);
    expect(status.sponsors.map((s) => s.name)).toEqual([names.alpha]);
    const a = status.sponsors[0]!;
    expect(a.chats.map((c) => c.slotTime)).toEqual([
      "11:00",
      "11:15",
      "11:30",
      "11:45",
      "13:00",
      "13:15",
    ]);
    expect(a.chats[0]).toMatchObject({
      seats: 1,
      accepted: 1,
      filled: 1,
      unfilled: 0,
      room: "Rm 2241",
    });
    expect(a.chats[0]!.invites.map((i) => [i.name, i.status])).toEqual([
      ["h5 P.", "accepted"],
    ]);
    // Declined and expired invites aren't listed: they were replaced.
    expect(a.chats[1]!.invites).toEqual([]);
    expect(a.chats[2]!.invites).toEqual([]);
    expect(a.chats[3]!.invites).toEqual([]);
    // The 11:12 round gave 1:00 and 1:15 to the interest pool (Theta's t4
    // and t5): pool invites count like any other.
    expect(
      a.chats.slice(4).map((c) =>
        c.invites.map((i) => [i.name, i.status, i.source, i.round]),
      ),
    ).toEqual([
      [["t4 P.", "pending", "anyone", 4]],
      [["t5 P.", "pending", "anyone", 4]],
    ]);
    expect(a.chats[4]).toMatchObject({ filled: 1, accepted: 0, unfilled: 0 });
    // The kill switch is off: no round fills seats, so none is flagged.
    expect(a.chats[1]).toMatchObject({ filled: 0, unfilled: 0 });
    expect(a.totals).toEqual({
      seats: 6,
      accepted: 1,
      pending: 2,
      unfilled: 0,
    });

    // On (dry counts too): the seats no one could take are a board problem.
    process.env.COFFEE_INVITES_ENABLED = "dry";
    const on = (await statusOf()).sponsors[0]!;
    expect(on.chats[1]).toMatchObject({ filled: 0, unfilled: 1 });
    expect(on.chats.map((c) => c.unfilled)).toEqual([0, 1, 1, 1, 0, 0]);
    expect(on.totals.unfilled).toBe(3);
    // Sat 10:46: 11:15's last call (10:55) leaves under 10 minutes, so its
    // seat can't be offered any more and isn't flagged.
    vi.setSystemTime(at("10:46"));
    const late = (await statusOf()).sponsors[0]!;
    expect(late.chats.map((c) => c.unfilled)).toEqual([0, 0, 1, 1, 0, 0]);
    vi.setSystemTime(FRI_10PM);
    // The run of show unreadable: no round runs, so nothing is flagged.
    vi.mocked(getRunOfShow).mockRejectedValueOnce(new Error("sheet down"));
    expect(
      (await statusOf()).sponsors.every((s) => s.totals.unfilled === 0),
    ).toBe(true);
    delete process.env.COFFEE_INVITES_ENABLED;
    // The kill switch is off here: Run now writes nothing.
    expect(await organizer.coffeeChatInvites.runRoundNow()).toMatchObject({
      status: "disabled",
      created: 0,
    });
    // Importing the whole app router is slow on a busy machine.
  }, 30_000);
});

describe("delivery: each invite once, retried until it goes out", () => {
  let delta: Awaited<ReturnType<typeof sponsor>>;
  beforeAll(async () => {
    vi.setSystemTime(FRI_10PM);
    delta = await sponsor(
      `Delta${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 3 },
      [{ sessionId: "16", room: "2243", status: "sent" }],
    );
    for (const k of ["d1", "d2", "d3"]) await hacker(k);
    await interested(delta.id, ["d1", "d2", "d3"]);
  });

  test("the caller and a sweep at once, then again: each hacker hears once", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const r = await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [delta.id], now: FRI_10PM }),
    );
    expect(r.status === "ok" && r.created).toHaveLength(3);
    expect(await countUnnotifiedInvites(FRI_10PM)).toBe(3);
    const [a, b] = await Promise.all([
      deliverInviteNotices(r.jobs),
      deliverUnnotifiedInvites(FRI_10PM),
    ]);
    expect(a.slack + b.slack).toBe(3);
    expect(dm).toHaveBeenCalledTimes(3);
    expect(await deliverInviteNotices(r.jobs)).toMatchObject({
      slack: 0,
      skipped: 3,
    });
    expect(await deliverUnnotifiedInvites(FRI_10PM)).toMatchObject({
      slack: 0,
    });
    expect(dm).toHaveBeenCalledTimes(3);
    expect(await countUnnotifiedInvites(FRI_10PM)).toBe(0);
    for (const c of await chatsOf(delta.id)) {
      expect(c.notifiedAt).not.toBeNull();
    }
  });

  test("a failed DM gets no email and is released; the next sweep retries it", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const [row] = await chatsOf(delta.id);
    const notifiedAt = async () =>
      (await chatsOf(delta.id)).find((c) => c.id === row!.id)!.notifiedAt;
    await db
      .update(coffeeChats)
      .set({ notifiedAt: null })
      .where(eq(coffeeChats.id, row!.id));
    const [notice] = await loadCoffeeChatNotices([row!.id]);

    dm.mockResolvedValueOnce("failed" as never);
    expect(
      await deliverInviteNotices([{ event: "offered", notice: notice! }]),
    ).toMatchObject({ slack: 0, email: 0, failed: 1 });
    expect(offerEmail).not.toHaveBeenCalled();
    expect(await notifiedAt()).toBeNull();

    // Slack throws: released too.
    dm.mockRejectedValueOnce(new Error("slack down"));
    expect(await deliverUnnotifiedInvites(FRI_10PM)).toMatchObject({
      failed: 1,
    });
    expect(await notifiedAt()).toBeNull();

    // No Slack token and the email isn't sent: nothing went out, released.
    dm.mockResolvedValueOnce("skipped-no-token" as never);
    offerEmail.mockResolvedValueOnce(false);
    expect(await deliverUnnotifiedInvites(FRI_10PM)).toMatchObject({
      skipped: 1,
    });
    expect(offerEmail).toHaveBeenCalledTimes(1);
    expect(await notifiedAt()).toBeNull();

    expect(await deliverUnnotifiedInvites(FRI_10PM)).toMatchObject({
      slack: 1,
    });
    expect(await notifiedAt()).not.toBeNull();
  });

  test("an old-flow booking racing the round skips that seat, not the round", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const zeta = await sponsor(
      `Zeta${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 1 },
      [{ sessionId: "13", room: "1354", status: "sent" }],
    );
    for (const k of ["z1", "z2"]) await hacker(k);
    await interested(zeta.id, ["z1", "z2"]);
    // z1 books an old-flow chat at 1:00 with Delta…
    await db.insert(coffeeChats).values({
      sponsorId: delta.id,
      userId: ids.z1!,
      slotTime: "13:00",
      room: "Rm 2243",
    });
    // …committed after the round read the rows: the planner doesn't see it.
    const actual = await vi.importActual<
      typeof import("~/lib/coffee-chat-invites")
    >("~/lib/coffee-chat-invites");
    const plans = vi.mocked(planInviteRound);
    const callsBefore = plans.mock.calls.length;
    plans.mockImplementationOnce((input) =>
      actual.planInviteRound({
        ...input,
        busy: input.busy.filter((b) => b.userId !== ids.z1),
      }),
    );
    const r = await db.transaction((tx) =>
      runInviteRound(tx, { sponsorIds: [zeta.id], now: FRI_10PM }),
    );
    expect(r.status).toBe("ok");
    expect(plans.mock.calls.length - callsBefore).toBe(2);
    const rows = await chatsOf(zeta.id);
    expect(rows.map((c) => [c.slotTime, keyOf(c.userId), c.status])).toEqual([
      ["13:00", "z2", "pending"],
    ]);
    expect(r.status === "ok" && r.created).toEqual([rows[0]!.id]);
    // z1's own booking is untouched.
    expect(
      (await chatsOf(delta.id)).filter((c) => c.userId === ids.z1),
    ).toMatchObject([{ slotTime: "13:00", status: "pending" }]);
  });

  test("a round triggered late gives 30 minutes; the dry run writes nothing; nothing runs after the last chat", async () => {
    const eps = await sponsor(
      `Eps${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 1 },
      [{ sessionId: "15", room: "1352", status: "sent" }],
    );
    await hacker("e1");
    await interested(eps.id, ["e1"]);
    vi.setSystemTime(at("11:25"));

    // Dry run, kill switch off: counts only. Other sponsors' expired seats
    // refill from the interest pool in this round too, so it plans more
    // than Eps's one seat.
    const before = await db.select().from(coffeeChats);
    const preview = await previewDueInviteRound(at("11:25"));
    expect(preview).toMatchObject({ status: "ok", round: 4 });
    expect(preview.invites).toBeGreaterThan(1);
    expect(await db.select().from(coffeeChats)).toEqual(before);
    expect(dm).not.toHaveBeenCalled();

    // Round 4 (11:00-11:30) only ran at 11:25. It writes exactly what the
    // dry run counted.
    process.env.COFFEE_INVITES_ENABLED = "1";
    const out = await runDueInviteRounds(at("11:25"));
    expect(out.status).toBe("ran");
    expect(
      out.status === "ran" &&
        out.result.status === "ok" && {
          invites: out.result.created.length,
          unfilled: out.result.unfilled.reduce((n, u) => n + u.open, 0),
        },
    ).toEqual({ invites: preview.invites, unfilled: preview.unfilled });
    const rows = await chatsOf(eps.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      userId: ids.e1,
      source: "interested",
      round: 4,
      slotTime: "15:00",
      expiresAt: at("11:55"),
    });
    expect(rows[0]!.notifiedAt).not.toBeNull();
    // Every invite the round made was delivered by its sweep, once.
    expect(dm).toHaveBeenCalledTimes(preview.invites);

    // Past the day's last chat: no lock, no board read.
    resetInviteRoundThrottle();
    expect(await runDueInviteRounds(at("16:50"))).toEqual({ status: "over" });
    expect(await previewDueInviteRound(at("16:50"))).toMatchObject({
      status: "over",
    });
    vi.setSystemTime(FRI_10PM);
  });
});

describe("kill switch default", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test("on by default only on the Vercel production deploy", () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("VERCEL_ENV", "production");
    expect(invitesEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "preview");
    expect(invitesEnabled()).toBe(false);
    // A local `next start`: NODE_ENV production, not on Vercel.
    vi.stubEnv("VERCEL_ENV", "");
    vi.stubEnv("NODE_ENV", "production");
    expect(invitesEnabled()).toBe(false);
    // "1" forces on, "0" forces off.
    vi.stubEnv("COFFEE_INVITES_ENABLED", "1");
    expect(invitesEnabled()).toBe(true);
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("COFFEE_INVITES_ENABLED", "0");
    expect(invitesEnabled()).toBe(false);
  });

  test('"dry" plans and saves invites but never delivers them', async () => {
    vi.stubEnv("VITEST", "");
    vi.stubEnv("VERCEL_ENV", "production");
    vi.stubEnv("COFFEE_INVITES_ENABLED", "dry");
    expect(invitesEnabled()).toBe(true);
    expect(invitesDeliveryLive()).toBe(false);
    const r = await deliverInviteNotices([{} as InviteJob, {} as InviteJob]);
    expect(r).toEqual({ slack: 0, email: 0, failed: 0, skipped: 2 });
    vi.stubEnv("COFFEE_INVITES_ENABLED", "1");
    expect(invitesDeliveryLive()).toBe(true);
  });
});

/**
 * The SQL the app runs inside transactions while `fn` runs, in order. Every
 * transaction's session reads the logger from the db's shared options when
 * it starts, so swapping it in records them. The logger runs just before
 * each statement, so `onQuery` can also make one fail (a Postgres error).
 */
async function queriesDuring(
  fn: () => Promise<unknown>,
  onQuery: (query: string) => void = () => undefined,
): Promise<string[]> {
  const { session } = db as unknown as {
    session: { options: { logger?: unknown } };
  };
  const before = session.options.logger;
  const log: string[] = [];
  session.options.logger = {
    logQuery: (query: string) => {
      log.push(query);
      onQuery(query);
    },
  };
  try {
    await fn();
  } finally {
    session.options.logger = before;
  }
  return log;
}

const BOARD_LOCK = /pg_advisory_xact_lock\(4812026112\)/;
const SPONSOR_ROW_LOCK = /from "sponsor_judging_sponsor"[\s\S]*for update/;
const CHAT_ROW_LOCK = /from "coffee_chat"[\s\S]*for update/;
const firstOf = (log: string[], re: RegExp) => log.findIndex((q) => re.test(q));
/** An error as the Postgres driver throws it, with its SQLSTATE. */
const pgError = (code: string) =>
  Object.assign(new Error(`postgres error ${code}`), { code });

describe("lock order: board, sponsor, chat", () => {
  test("a decline, an organizer room move and a cancel all take the board lock first", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    vi.setSystemTime(FRI_10PM);
    const { createCaller } = await import("~/server/api/root");
    const { createInnerTRPCContext } = await import("~/server/api/trpc");
    const { mockOrganizerSession } = await import("~/server/auth");
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    // Two 1-on-1 seats at 3:00 and 3:15, both taken in round 1.
    const kappa = await sponsor(
      `Kappa${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 2 },
      [{ sessionId: "15", room: "2245", status: "sent" }],
    );
    for (const k of ["k1", "k2"]) {
      await hacker(k);
      await db
        .insert(sponsorScans)
        .values({ sponsorId: kappa.id, userId: ids[k]! });
    }
    await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [kappa.id], now: FRI_10PM }),
    );
    const chatOf = async (key: string) =>
      (await chatsOf(kappa.id)).find((c) => c.userId === ids[key])!;

    const decline = await queriesDuring(async () => {
      const k2 = await chatOf("k2");
      await respondToCoffeeChat(
        ids.k2!,
        { chatId: k2.id, answer: "decline" },
        FRI_10PM,
        0,
      );
    });
    expect(firstOf(decline, BOARD_LOCK)).toBeGreaterThanOrEqual(0);
    expect(firstOf(decline, BOARD_LOCK)).toBeLessThan(
      firstOf(decline, CHAT_ROW_LOCK),
    );

    const k1 = await chatOf("k1");
    for (const action of [
      () =>
        organizer.coffeeChatRequests.moveRoom({
          chatId: k1.id,
          room: "Rm 2243",
        }),
      () => organizer.coffeeChatRequests.cancel({ chatId: k1.id }),
    ]) {
      const log = await queriesDuring(action);
      const board = firstOf(log, BOARD_LOCK);
      expect(board).toBeGreaterThanOrEqual(0);
      expect(board).toBeLessThan(firstOf(log, SPONSOR_ROW_LOCK));
      expect(firstOf(log, SPONSOR_ROW_LOCK)).toBeLessThan(
        firstOf(log, CHAT_ROW_LOCK),
      );
    }
    expect((await chatOf("k1")).status).toBe("cancelled");

    await db.delete(coffeeChats).where(eq(coffeeChats.sponsorId, kappa.id));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "draft" })
      .where(eq(coffeeChatPlacements.repId, kappa.repId));
    // Importing the whole app router is slow on a busy machine.
  }, 30_000);

  test("a decline picked as a deadlock victim runs once more and still refills", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    vi.setSystemTime(FRI_10PM);
    const lambda = await sponsor(
      `Lambda${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 1 },
      [{ sessionId: "15", room: "2246", status: "sent" }],
    );
    for (const k of ["l1", "l2"]) await hacker(k);
    await db
      .insert(sponsorScans)
      .values({ sponsorId: lambda.id, userId: ids.l1! });
    await interested(lambda.id, ["l2"]);
    await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [lambda.id], now: FRI_10PM }),
    );
    const [l1] = await chatsOf(lambda.id);
    let deadlocks = 0;
    const log = await queriesDuring(
      () =>
        respondToCoffeeChat(
          ids.l1!,
          { chatId: l1!.id, answer: "decline" },
          FRI_10PM,
          0,
        ),
      (query) => {
        if (BOARD_LOCK.test(query) && deadlocks++ === 0) {
          throw pgError("40P01");
        }
      },
    );
    expect(log.filter((q) => BOARD_LOCK.test(q)).length).toBeGreaterThan(1);
    expect(
      (await chatsOf(lambda.id)).map((c) => [keyOf(c.userId), c.status]),
    ).toEqual([
      ["l1", "declined"],
      ["l2", "pending"],
    ]);

    await db.delete(coffeeChats).where(eq(coffeeChats.sponsorId, lambda.id));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "draft" })
      .where(eq(coffeeChatPlacements.repId, lambda.repId));
  });

  test("Slack's budget: a board lock held past 1.5 s saves the decline without the refill; the next round fills the seat", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    vi.setSystemTime(FRI_10PM);
    const mu = await sponsor(
      `Mu${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 1 },
      [{ sessionId: "15", room: "2247", status: "sent" }],
    );
    for (const k of ["m1", "m2"]) await hacker(k);
    await db.insert(sponsorScans).values({ sponsorId: mu.id, userId: ids.m1! });
    await interested(mu.id, ["m2"]);
    await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [mu.id], now: FRI_10PM }),
    );
    const [m1] = await chatsOf(mu.id);
    const statuses = async () =>
      (await chatsOf(mu.id)).map((c) => [keyOf(c.userId), c.status]);

    // Another writer holds the board lock: with lock_timeout set, Postgres
    // gives up on it with 55P03. PGlite runs one transaction at a time, so
    // the held lock is simulated at the board lock statement.
    const log = await queriesDuring(
      () =>
        respondToCoffeeChat(
          ids.m1!,
          { chatId: m1!.id, answer: "decline" },
          FRI_10PM,
          0,
          { boardLockTimeoutMs: 1500 },
        ),
      (query) => {
        if (BOARD_LOCK.test(query)) throw pgError("55P03");
      },
    );
    const timeout = log.findIndex((q) =>
      /set local lock_timeout = '1500ms'/.test(q),
    );
    expect(timeout).toBeGreaterThanOrEqual(0);
    expect(timeout).toBeLessThan(firstOf(log, BOARD_LOCK));
    // The second transaction takes the chat row only, without waiting.
    expect(log.some((q) => /for update nowait/.test(q))).toBe(true);
    expect(await statuses()).toEqual([["m1", "declined"]]);
    expect(dm).not.toHaveBeenCalled();

    // The next round offers the seat to m2.
    await db.transaction((tx) =>
      runInviteRound(tx, { sponsorIds: [mu.id], now: at("11:05") }),
    );
    expect(await statuses()).toEqual([
      ["m1", "declined"],
      ["m2", "pending"],
    ]);

    // Without the Slack budget (/live) there's no lock_timeout.
    const m2 = (await chatsOf(mu.id)).find((c) => c.userId === ids.m2)!;
    const live = await queriesDuring(() =>
      respondToCoffeeChat(
        ids.m2!,
        { chatId: m2.id, answer: "accept" },
        at("11:05"),
        0,
      ),
    );
    expect(live.some((q) => /lock_timeout/.test(q))).toBe(false);

    await db.delete(coffeeChats).where(eq(coffeeChats.sponsorId, mu.id));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "draft" })
      .where(eq(coffeeChatPlacements.repId, mu.repId));
    vi.setSystemTime(FRI_10PM);
  });

  test("a delivery that rejects after the commit doesn't fail the decline", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    vi.setSystemTime(FRI_10PM);
    const nu = await sponsor(
      `Nu${Date.now()}`,
      { hackersPerChat: 1 },
      { chats: 1 },
      [{ sessionId: "15", room: "2248", status: "sent" }],
    );
    for (const k of ["n1", "n2"]) await hacker(k);
    await db.insert(sponsorScans).values({ sponsorId: nu.id, userId: ids.n1! });
    await interested(nu.id, ["n2"]);
    await db.transaction((tx) =>
      sendRoundOneInvites(tx, { sponsorIds: [nu.id], now: FRI_10PM }),
    );
    const [n1] = await chatsOf(nu.id);
    vi.mocked(deliverInviteNotices).mockRejectedValueOnce(new Error("boom"));
    await expect(
      respondToCoffeeChat(
        ids.n1!,
        { chatId: n1!.id, answer: "decline" },
        FRI_10PM,
        1000,
      ),
    ).resolves.toMatchObject({ chatId: n1!.id, status: "declined" });
    expect(
      (await chatsOf(nu.id)).map((c) => [keyOf(c.userId), c.status]),
    ).toEqual([
      ["n1", "declined"],
      ["n2", "pending"],
    ]);

    await db.delete(coffeeChats).where(eq(coffeeChats.sponsorId, nu.id));
    await db
      .update(coffeeChatPlacements)
      .set({ status: "draft" })
      .where(eq(coffeeChatPlacements.repId, nu.repId));
  });
});
