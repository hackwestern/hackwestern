import { and, asc, eq } from "drizzle-orm";
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

import { respondToCoffeeChat } from "~/server/api/utils/coffee-chat-respond";
import {
  deliverInviteNotices,
  invitesEnabled,
  reconcileInvitesAfterChange,
  resetInviteRoundThrottle,
  runDueInviteRounds,
  runInviteRound,
  sendRoundOneInvites,
} from "~/server/api/utils/coffee-chat-invites";
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
  getRunOfShow: () =>
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
}));

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
  await db
    .insert(users)
    .values({
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
    const { loadCoffeeChatNotices } = await import(
      "~/server/api/utils/coffee-chat-notify"
    );
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

  test("round 2 at 10:30: declines and expired seats pass on, 10-11 AM never refilled, drafts never touched", async () => {
    process.env.COFFEE_INVITES_ENABLED = "1";
    const before = await chatsOf(alpha.id);
    const h1 = before.find((c) => c.userId === ids.h1)!;
    const h5 = before.find((c) => c.userId === ids.h5)!;
    await respondToCoffeeChat(
      ids.h1!,
      { chatId: h1.id, answer: "decline" },
      at("08:00"),
      0,
    );
    await respondToCoffeeChat(
      ids.h5!,
      { chatId: h5.id, answer: "accept" },
      at("08:00"),
      0,
    );
    // A new interested hacker shows up Saturday morning.
    await interested(alpha.id, ["h9"]);

    vi.setSystemTime(at("10:30"));
    const out = await runDueInviteRounds(at("10:30"));
    expect(out.status).toBe("ran");
    const rows = await chatsOf(alpha.id);
    const round2 = rows.filter((c) => c.round === 2);
    // 11:30 (declined by h1) goes to h9 for 30 minutes. 11:45 (h2 let it
    // expire) has no one left; 11:15 / 13:xx expired too.
    expect(
      round2.map((c) => [
        c.slotTime,
        keyOf(c.userId),
        c.expiresAt?.toISOString(),
      ]),
    ).toEqual([["11:30", "h9", at("11:00").toISOString()]]);
    expect(
      rows
        .filter((c) => c.status === "expired")
        .map((c) => keyOf(c.userId))
        .sort(),
    ).toEqual(["h2", "h3", "h4", "h6"]);
    // Gamma was never sent: no invites, even though h9 etc. are interested.
    expect(await chatsOf(gamma.id)).toEqual([]);

    // Running again inside the same round changes nothing.
    resetInviteRoundThrottle();
    const again = await runDueInviteRounds(at("10:40"));
    expect(
      again.status === "ran" &&
        again.result.status === "ok" &&
        again.result.created,
    ).toEqual([]);

    // If h9 declines, the seat waits for round 3 (nobody is left, so it stays open).
    await respondToCoffeeChat(
      ids.h9!,
      { chatId: round2[0]!.id, answer: "decline" },
      at("10:45"),
      0,
    );
    resetInviteRoundThrottle();
    const r3 = await runDueInviteRounds(at("11:00"));
    expect(
      r3.status === "ran" && r3.result.status === "ok" && r3.result.created,
    ).toEqual([]);
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
  const rows = await db
    .select()
    .from(coffeeChats)
    .where(
      and(
        eq(coffeeChats.sponsorId, alpha.id),
        eq(coffeeChats.status, "pending"),
      ),
    );
  expect(rows).toEqual([]);
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

    const status = await organizer.coffeeChatInvites.status({
      sponsorId: alpha.id,
    });
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
      open: 0,
      room: "Rm 2241",
    });
    expect(a.chats[2]!.invites.map((i) => [i.name, i.status, i.round])).toEqual(
      [
        ["h1 Person", "declined", 1],
        ["h9 Person", "declined", 2],
      ],
    );
    expect(a.totals).toMatchObject({ seats: 6, accepted: 1 });
    // The kill switch is off here: Run now writes nothing.
    expect(await organizer.coffeeChatInvites.runRoundNow()).toMatchObject({
      status: "disabled",
      created: 0,
    });
  });
});
