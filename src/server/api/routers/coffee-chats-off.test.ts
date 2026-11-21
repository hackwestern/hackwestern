import { beforeEach, describe, expect, test, vi } from "vitest";
import type * as SponsorSheets from "~/server/api/utils/sponsor-sheets";
import { faker } from "@faker-js/faker";

import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { applications, sponsorJudgingSponsors } from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { isOptedOut, sheetSaysChats } from "~/server/api/utils/coffee-chats-on";
import { loadBoardState } from "~/server/api/utils/coffee-chat-sessions-board";
import { stepsFor, type HomeContext } from "~/lib/sponsor-home";
import { showChats } from "~/lib/sponsor-chats";
import { applies } from "~/lib/organizer-home";

// Sponsors without coffee chats (decisions 2026-11-20): the Sponsor Day-Of
// checkbox (failing open) and the sponsor's own "not doing chats".

/** Sponsor Day-Of's "Coffee Chats & Interviews" ticks; null = unreadable. */
let ticked: Set<string> | null = null;
vi.mock("~/server/api/utils/sponsor-sheets", async (importOriginal) => ({
  ...(await importOriginal<typeof SponsorSheets>()),
  coffeeChatSponsorNames: () => Promise.resolve(ticked),
}));

const anon = createCaller(createInnerTRPCContext({ session: null }));
const organizer = async () =>
  createCaller(
    createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
  );

async function sponsor() {
  const name = `NoChats ${faker.string.alphanumeric(10)}`;
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name })
    .returning();
  return row!;
}

async function admittedHacker() {
  const session = await mockSession(db);
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: session.user.id,
    status: "CONFIRMED",
    agreeShareWithSponsors: true,
  });
  return session.user.id;
}

const code = (p: Promise<unknown>) =>
  p.then(
    () => null,
    (e: { code?: string; message: string }) => e,
  );

beforeEach(() => {
  ticked = null;
});

describe("coffee chats on or off: pure rules", () => {
  test("the checkbox fails open", () => {
    expect(sheetSaysChats(null, "Acme")).toBe(true);
    expect(sheetSaysChats(new Set(["acme"]), "ACME")).toBe(true);
    expect(sheetSaysChats(new Set(["other"]), "Acme")).toBe(false);
  });

  test("opted out = submitted with no chats", () => {
    expect(isOptedOut(new Date(), [0, 0])).toBe(true);
    expect(isOptedOut(new Date(), [])).toBe(true);
    expect(isOptedOut(new Date(), [0, 2])).toBe(false);
    expect(isOptedOut(null, [0])).toBe(false);
  });

  test("the portal shows chats while loading and to organizers", () => {
    expect(showChats(undefined)).toBe(true);
    expect(showChats({ hasCoffeeChats: false, viewerIsOrganizer: true })).toBe(
      true,
    );
    expect(showChats({ hasCoffeeChats: false, viewerIsOrganizer: false })).toBe(
      false,
    );
  });

  test("Up next without chats: no availability, shortlist or chat rows, no Scan buttons", () => {
    const ctx: HomeContext = {
      hasPrizeTrack: true,
      hasCoffeeChats: false,
      availabilitySent: false,
      shortlistSent: false,
      confirmed: false,
      chats: [],
      workshop: null,
      judgingRoom: null,
    };
    const all = [0, 1, 2].flatMap((d) => stepsFor(d as 0 | 1 | 2, ctx));
    const ids = all.map((s) => s.id);
    for (const gone of ["f1", "f7", "f8", "sp"])
      expect(ids).not.toContain(gone);
    expect(all.some((s) => s.action === "chats" || s.action === "scan")).toBe(
      false,
    );
    // The booth rows stay, without the scanning line.
    expect(all.find((s) => s.id === "f3")?.sub).toBeUndefined();
    // Judging stays for a prize track sponsor.
    expect(ids).toContain("u3");
  });
});

describe("checkbox not ticked", () => {
  test("getSponsorPortalInfo says no chats; an unreadable sheet says yes", async () => {
    const s = await sponsor();
    ticked = new Set(["someone else"]);
    const off = await anon.sponsorPortal.getSponsorPortalInfo({
      sponsor: s.id,
    });
    expect(off.hasCoffeeChats).toBe(false);
    expect(off.viewerIsOrganizer).toBe(false);
    ticked = null;
    const on = await anon.sponsorPortal.getSponsorPortalInfo({ sponsor: s.id });
    expect(on.hasCoffeeChats).toBe(true);
  });

  test("a sponsor's coffee chat writes are refused; an organizer's aren't", async () => {
    const s = await sponsor();
    ticked = new Set(["someone else"]);
    const hacker = await admittedHacker();
    for (const attempt of [
      anon.coffeeChatSetup.addRep({
        sponsor: s.id,
        name: "Dana",
        phone: "5195550001",
      }),
      anon.coffeeChatSetup.recordScan({ sponsor: s.id, userId: hacker }),
      anon.sponsorShortlist.add({ sponsor: s.id, userId: hacker }),
    ]) {
      const e = await code(attempt);
      expect(e?.code).toBe("FORBIDDEN");
      expect(e?.message).toContain("aren't part of your sponsorship");
    }
    const org = await organizer();
    await expect(
      org.coffeeChatSetup.addRep({
        sponsor: s.id,
        name: "Dana",
        phone: "5195550001",
      }),
    ).resolves.toBeDefined();
  });

  test("ticked: writes work as before", async () => {
    const s = await sponsor();
    ticked = new Set([s.name.toLowerCase()]);
    await expect(
      anon.coffeeChatSetup.addRep({
        sponsor: s.id,
        name: "Dana",
        phone: "5195550001",
      }),
    ).resolves.toBeDefined();
  });
});

describe("a sponsor who isn't doing chats (the break, and the fix)", () => {
  test("before: every rep at 0 chats can't be submitted, so the required step never finishes", async () => {
    const s = await sponsor();
    const rep = await anon.coffeeChatSetup.addRep({
      sponsor: s.id,
      name: "Dana",
      phone: "5195550001",
    });
    await anon.coffeeChatSetup.savePrefs({
      sponsor: s.id,
      hackersPerChat: 1,
      reps: [{ id: rep.id, chatsWanted: 0, free: [] }],
    });
    const e = await code(anon.coffeeChatSetup.submitPrefs({ sponsor: s.id }));
    // The exact dead end sponsors hit: still refused, by design, for a
    // real submit.
    expect(e?.code).toBe("BAD_REQUEST");
    expect(e?.message).toBe(
      "No rep has a chat at a time they're free. Tick a session or add chats.",
    );
    const info = await anon.sponsorPortal.getSponsorPortalInfo({
      sponsor: s.id,
    });
    expect(info.hasCoffeeChats).toBe(true);
  });

  test("after: optOut ends in a clean no-chats state, even with no team", async () => {
    const s = await sponsor();
    await anon.coffeeChatSetup.optOut({ sponsor: s.id });
    const info = await anon.sponsorPortal.getSponsorPortalInfo({
      sponsor: s.id,
    });
    expect(info.hasCoffeeChats).toBe(false);
    expect(info.chatsOptedOut).toBe(true);
    // Submitted once: the sponsor can't flip it back themselves.
    const e = await code(
      anon.coffeeChatSetup.addRep({
        sponsor: s.id,
        name: "Dana",
        phone: "5195550001",
      }),
    );
    expect(e?.code).toBe("FORBIDDEN");
  });

  test("optOut zeroes a half-built team's chats", async () => {
    const s = await sponsor();
    const rep = await anon.coffeeChatSetup.addRep({
      sponsor: s.id,
      name: "Dana",
      phone: "5195550001",
    });
    await anon.coffeeChatSetup.savePrefs({
      sponsor: s.id,
      hackersPerChat: 1,
      reps: [{ id: rep.id, chatsWanted: 3, free: ["10"] }],
    });
    await anon.coffeeChatSetup.optOut({ sponsor: s.id });
    const setup = await anon.coffeeChatSetup.get({ sponsor: s.id });
    expect(setup.reps.map((r) => r.chatsWanted)).toEqual([0]);
    expect(setup.submittedAt).not.toBeNull();
  });

  test("an organizer turns chats back on by adding chats", async () => {
    const s = await sponsor();
    const rep = await anon.coffeeChatSetup.addRep({
      sponsor: s.id,
      name: "Dana",
      phone: "5195550001",
    });
    await anon.coffeeChatSetup.optOut({ sponsor: s.id });
    const org = await organizer();
    await org.coffeeChatSetup.savePrefs({
      sponsor: s.id,
      hackersPerChat: 1,
      reps: [{ id: rep.id, chatsWanted: 2, free: ["10", "11"] }],
    });
    const info = await anon.sponsorPortal.getSponsorPortalInfo({
      sponsor: s.id,
    });
    expect(info.hasCoffeeChats).toBe(true);
    expect(info.chatsOptedOut).toBe(false);
  });

  test("the organizer board loads with an opted-out sponsor and gives them no chats", async () => {
    const s = await sponsor();
    await anon.coffeeChatSetup.addRep({
      sponsor: s.id,
      name: "Dana",
      phone: "5195550001",
    });
    await anon.coffeeChatSetup.optOut({ sponsor: s.id });
    const board = await loadBoardState();
    // Listed as "no chats" (not "not submitted"): nothing to schedule or
    // chase, and the scheduler gives them no placements.
    const row = board.sponsors.find((x) => x.id === s.id);
    expect(row?.status.kind).toBe("none");
    expect(board.placements.filter((p) => p.sponsorId === s.id)).toEqual([]);
  });

  test("unticked: off the coffee board and nothing to chase on My sponsors / Home", async () => {
    const off = await sponsor();
    const on = await sponsor();
    // Saved prefs used to put an unticked sponsor on the board anyway.
    await organizer().then((o) =>
      o.coffeeChatSetup.addRep({
        sponsor: off.id,
        name: "Dana",
        phone: "5195550001",
      }),
    );
    ticked = new Set([on.name.toLowerCase()]);
    const board = await loadBoardState();
    expect(board.sponsors.some((x) => x.id === off.id)).toBe(false);
    expect(board.sponsors.some((x) => x.id === on.id)).toBe(true);

    const mine = await (await organizer()).sponsorOrganizer.mySponsors();
    expect(mine.sponsors[off.id]?.chats).toBeUndefined();
    expect(mine.sponsors[on.id]?.chats?.prefsSubmittedAt).toBeNull();
  });

  test("Home: chat columns read — for a sponsor without chats", () => {
    const s = {
      name: "X",
      sponsorId: "x",
      status: null,
      atCcWorkshop: null,
      chats: undefined,
      blocks: [],
      sunday: undefined,
      missingRoom: false,
      workshops: [],
      prizeTrack: false,
      digital: false,
    };
    for (const col of [
      "availability",
      "shortlist",
      "chats",
      "invites",
    ] as const) {
      expect(applies(col, { ...s, noChats: true })).toBe(false);
    }
    expect(applies("availability", s)).toBe(true);
  });
});
