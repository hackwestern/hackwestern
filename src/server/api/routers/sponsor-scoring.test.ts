import { beforeEach, describe, expect, test, vi } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";
import type * as Env from "~/env";

import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  coffeeChatReps,
  sponsorJudgingSettings,
  sponsorJudgingSponsors,
  sponsorPresentations,
  sponsorTeamReviews,
  teams,
  users,
} from "~/server/db/schema";
import {
  fetchSponsorTrack,
  fetchSponsorTracks,
} from "~/server/api/utils/sponsor-judging-teams";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import { setRound2Open } from "~/server/api/utils/sponsor-judging-settings";
import { mirrorSponsorJudgingSoon } from "~/server/api/utils/sponsor-judging-sheet-mirror";
import {
  SHEET_RETRY_GAP_MS,
  resetSheetRetries,
} from "~/server/api/routers/sponsor-scoring";

// SPONSOR_JUDGING_CLOSES_AT, per test (unset = judging never closes).
let closesAt: string | undefined;
vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  const env = original.env as Record<string | symbol, unknown>;
  return {
    env: new Proxy(env, {
      get(target, prop) {
        if (prop === "SPONSOR_JUDGING_CLOSES_AT") return closesAt;
        return target[prop];
      },
    }),
  };
});

// The Sponsor Judging tab mirror writes to Google Sheets; never here.
vi.mock("~/server/api/utils/sponsor-judging-sheet-mirror", () => ({
  mirrorSponsorJudging: vi.fn(async () => ({ ok: true, rows: 0 })),
  mirrorSponsorJudgingLater: vi.fn(),
  mirrorSponsorJudgingSoon: vi.fn(async () => ({ ok: true, rows: 0 })),
}));

// The sheet is the only outside call: the sponsor's track. Team eligibility
// itself runs against the test database. Picks are stored in the DB and
// mirrored to the Sponsor Judging tab (mirrorSponsorJudgingSoon, mocked).
vi.mock("~/server/api/utils/sponsor-judging-teams", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("~/server/api/utils/sponsor-judging-teams")
  >()),
  fetchSponsorTrack: vi.fn(),
  fetchSponsorTracks: vi.fn(),
}));
const track = vi.mocked(fetchSponsorTrack);
const allTracks = vi.mocked(fetchSponsorTracks);
const mirrorSoon = vi.mocked(mirrorSponsorJudgingSoon);
const SYNCED = { ok: true as const, rows: 0 };
const DOWN = { ok: false as const, error: "sheets down" };

// Sponsors aren't logged in: their private UUID is the credential.
const anon = createCaller(createInnerTRPCContext({ session: null }));

beforeEach(async () => {
  closesAt = undefined;
  // Round 2 open unless a test closes it, so submit tests can submit.
  // Written directly: setRound2Open refuses while nothing is scheduled.
  await db
    .insert(sponsorJudgingSettings)
    .values({ id: 1, round2OpenedAt: new Date() })
    .onConflictDoUpdate({
      target: sponsorJudgingSettings.id,
      set: { round2OpenedAt: new Date() },
    });
  track.mockReset().mockResolvedValue(null);
  allTracks.mockReset().mockResolvedValue(new Map());
  mirrorSoon.mockReset().mockResolvedValue(SYNCED);
  resetSheetRetries();
});

const PAST = "2020-01-01T00:00:00Z";

/** A sponsor with a prize track (the name contains "QNX"), or without. */
async function sponsor(prizeTrack = true) {
  const name = `${prizeTrack ? "QNX" : "Sponsor"} ${faker.string.alphanumeric(10)}`;
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name })
    .returning();
  return row!;
}

async function team(
  status: "draft" | "submitted" | "late" = "submitted",
  tracks: ("General" | "Best Domain")[] = ["General"],
) {
  const id = faker.string.alphanumeric(12);
  await db.insert(teams).values({
    id,
    name: `Team ${faker.string.alphanumeric(8)}`,
    joinCode: faker.string.alphanumeric(6),
    submissionStatus: status,
    tracks,
    devpostUrl: `https://devpost.com/software/${id}`,
  });
  return id;
}

/** The ranked top a sponsor submits (5). */
const TOP = SPONSOR_FINAL_TOP;

/** `n` submitted teams in the default track. */
async function someTeams(n: number) {
  const ids: string[] = [];
  for (let i = 0; i < n; i++) ids.push(await team());
  return ids;
}

/**
 * TOP + 2 shortlisted teams. By default each also presented to the
 * sponsor (a placed slot), since round 2 ranks only teams that presented.
 */
async function shortlistTeams(sponsorId: string, { present = true } = {}) {
  const ids = [];
  for (let i = 0; i < TOP + 2; i++) {
    const id = await team();
    await anon.sponsorScoring.review({
      sponsor: sponsorId,
      teamId: id,
      shortlisted: true,
    });
    await anon.sponsorScoring.score({
      sponsor: sponsorId,
      teamId: id,
      judge: "Dana W.",
      halves: (10 - i) * 2,
    });
    ids.push(id);
  }
  if (present) {
    await db.insert(sponsorPresentations).values(
      ids.map((teamId, i) => ({
        sponsorId,
        teamId,
        room: "Rm 2235",
        startMinute: 600 + i * 5,
      })),
    );
  }
  return ids;
}

describe("sponsorScoring.get", () => {
  test("unknown sponsor is NOT_FOUND, bad id BAD_REQUEST", async () => {
    await expect(
      anon.sponsorScoring.get({ sponsor: faker.string.uuid() }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    await expect(
      anon.sponsorScoring.get({ sponsor: "nope" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("lists only submitted teams in the sponsor's track", async () => {
    const s = await sponsor();
    const inTrack = await team("late", ["Best Domain"]);
    const otherTrack = await team("submitted", ["General"]);
    const draft = await team("draft", ["Best Domain"]);
    track.mockResolvedValue("Best Domain");

    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    const ids = res.teams.map((t) => t.id);
    expect(ids).toContain(inTrack);
    expect(ids).not.toContain(otherTrack);
    expect(ids).not.toContain(draft);
    expect(res.finalTop).toBe(5);
    expect(res.final).toBeNull();
  });

  test("retries a sheet write that failed after the submission saved", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    mirrorSoon.mockResolvedValue(DOWN);
    await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ids.slice(0, TOP),
    });
    // Still down: the query succeeds and says so; the retry runs in the
    // background.
    mirrorSoon.mockClear();
    await expect(
      anon.sponsorScoring.get({ sponsor: s.id }),
    ).resolves.toMatchObject({ final: { sheetSynced: false } });
    await vi.waitFor(() => expect(mirrorSoon).toHaveBeenCalledTimes(1));

    // Back up, but the last retry was under a minute ago: no new write.
    mirrorSoon.mockReset().mockResolvedValue(SYNCED);
    await anon.sponsorScoring.get({ sponsor: s.id });
    expect(mirrorSoon).not.toHaveBeenCalled();

    // A minute later the next get retries; the one after reads the mark.
    const now = Date.now();
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(now + SHEET_RETRY_GAP_MS);
    try {
      await expect(
        anon.sponsorScoring.get({ sponsor: s.id }),
      ).resolves.toMatchObject({ final: { sheetSynced: false } });
      await vi.waitFor(() => expect(mirrorSoon).toHaveBeenCalledTimes(1));
      await vi.waitFor(async () =>
        expect(
          (await anon.sponsorScoring.get({ sponsor: s.id })).final,
        ).toMatchObject({ teamIds: ids.slice(0, TOP), sheetSynced: true }),
      );
    } finally {
      clock.mockRestore();
    }

    // Synced now: no more writes.
    mirrorSoon.mockClear();
    resetSheetRetries();
    await anon.sponsorScoring.get({ sponsor: s.id });
    expect(mirrorSoon).not.toHaveBeenCalled();
  });

  test("get doesn't wait on a slow sheet retry", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    mirrorSoon.mockResolvedValue(DOWN);
    await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ids.slice(0, TOP),
    });
    // A mirror that never settles: get still answers.
    mirrorSoon.mockReset().mockReturnValue(new Promise(() => undefined));
    await expect(
      anon.sponsorScoring.get({ sponsor: s.id }),
    ).resolves.toMatchObject({ final: { sheetSynced: false } });
    expect(mirrorSoon).toHaveBeenCalledTimes(1);
  });

  test("a submitted team that withdrew drops out of the ranking", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ids.slice(0, TOP),
    });
    await db
      .update(teams)
      .set({ submissionStatus: "draft" })
      .where(eq(teams.id, ids[TOP - 1]!));
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(res.final?.teamIds).toEqual(ids.slice(0, TOP - 1));
    expect(res.final?.ineligibleCount).toBe(1);
  });
});

describe("sponsorScoring.review", () => {
  test("shortlist toggles on and off without touching the scores", async () => {
    const s = await sponsor();
    const t = await team();
    await anon.sponsorScoring.score({
      sponsor: s.id,
      teamId: t,
      judge: "Dana W.",
      halves: 15,
    });
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        shortlisted: true,
      }),
    ).resolves.toMatchObject({ shortlisted: true });
    await anon.sponsorScoring.review({
      sponsor: s.id,
      teamId: t,
      shortlisted: false,
    });
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(res.reviews.find((r) => r.teamId === t)).toMatchObject({
      score: 7.5,
      shortlisted: false,
    });
  });

  test("notes are trimmed, blank clears, and capped", async () => {
    const s = await sponsor();
    const t = await team();
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: t, note: "  Neat " }),
    ).resolves.toMatchObject({ note: "Neat" });
    await expect(
      anon.sponsorScoring.review({ sponsor: s.id, teamId: t, note: "   " }),
    ).resolves.toMatchObject({ note: null });
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        note: "x".repeat(281),
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("can't review a draft team or one outside the track", async () => {
    const s = await sponsor();
    const draft = await team("draft");
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: draft,
        shortlisted: true,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const general = await team("submitted", ["General"]);
    track.mockResolvedValue("Best Domain");
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: general,
        shortlisted: true,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("refused once judging has closed", async () => {
    const s = await sponsor();
    const t = await team();
    closesAt = PAST;
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        shortlisted: true,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await anon.sponsorScoring.get({ sponsor: s.id })).open).toBe(false);
  });

  test("one sponsor's reviews never show for another", async () => {
    const a = await sponsor();
    const b = await sponsor();
    const t = await team();
    await anon.sponsorScoring.review({
      sponsor: a.id,
      teamId: t,
      shortlisted: true,
      note: "secret",
    });
    const res = await anon.sponsorScoring.get({ sponsor: b.id });
    expect(res.reviews.find((r) => r.teamId === t)).toBeUndefined();
    expect(JSON.stringify(res)).not.toContain("secret");
  });
});

describe("sponsorScoring.submit", () => {
  test("saves exactly five ranked teams and mirrors the sheet", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    const ranked = [...ids].reverse().slice(0, TOP);
    const res = await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ranked,
    });
    expect(res).toMatchObject({ teamIds: ranked, sheetSynced: true });
    expect(mirrorSoon).toHaveBeenCalled();
    const after = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(after.final).toMatchObject({ teamIds: ranked, sheetSynced: true });
  });

  test("refuses the wrong count, duplicates and unshortlisted teams", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    const extra = await team();
    const cases = [
      ids.slice(0, TOP - 1),
      [...ids.slice(0, TOP), extra],
      [ids[0]!, ...ids.slice(0, TOP - 1)],
      [...ids.slice(0, TOP - 1), extra],
    ];
    for (const teamIds of cases) {
      await expect(
        anon.sponsorScoring.submit({ sponsor: s.id, teamIds }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    expect(mirrorSoon).not.toHaveBeenCalled();
  });

  test("fewer than five presented: submit all of them", async () => {
    const s = await sponsor();
    const ids = await someTeams(3);
    await db.insert(sponsorPresentations).values(
      ids.map((teamId, i) => ({
        sponsorId: s.id,
        teamId,
        room: "Rm 2235",
        startMinute: 600 + i * 6,
      })),
    );
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids.slice(0, 2) }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Submit exactly 3 teams.",
    });
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids }),
    ).resolves.toMatchObject({ teamIds: ids });
  });

  test("another sponsor's shortlist doesn't count, and isn't touched", async () => {
    const a = await sponsor();
    const b = await sponsor();
    const aIds = await shortlistTeams(a.id);
    // B has no slot of their own, so round 2 is locked for them.
    await expect(
      anon.sponsorScoring.submit({
        sponsor: b.id,
        teamIds: aIds.slice(0, TOP),
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect((await anon.sponsorScoring.get({ sponsor: a.id })).final).toBeNull();
  });

  test("a team that stopped being eligible can't be submitted", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    track.mockResolvedValue("Best Domain");
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids.slice(0, TOP) }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("refused once judging has closed", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    closesAt = PAST;
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids.slice(0, TOP) }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(mirrorSoon).not.toHaveBeenCalled();
  });

  test("a slow sheet write does not mark a one-time submission incorrectly", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    const submitted = ids.slice(0, TOP);
    mirrorSoon.mockResolvedValue(DOWN);
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: submitted }),
    ).resolves.toMatchObject({ sheetSynced: false });
    expect(
      (await anon.sponsorScoring.get({ sponsor: s.id })).final,
    ).toMatchObject({ teamIds: submitted, sheetSynced: false });
  });

  test("still counts if the sheet write fails; resubmission is refused", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    mirrorSoon.mockResolvedValue(DOWN);
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids.slice(0, TOP) }),
    ).resolves.toMatchObject({ sheetSynced: false });
    expect(
      (await anon.sponsorScoring.get({ sponsor: s.id })).final,
    ).toMatchObject({ teamIds: ids.slice(0, TOP), sheetSynced: false });

    mirrorSoon.mockReset().mockResolvedValue(SYNCED);
    const reranked = [ids[2]!, ids[0]!, ids[1]!, ...ids.slice(3, TOP)];
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: reranked }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });
});

describe("sponsorScoring.overview", () => {
  test("organizers only", async () => {
    await expect(anon.sponsorScoring.overview()).rejects.toMatchObject({
      code: "UNAUTHORIZED",
    });
    const hacker = createCaller(
      createInnerTRPCContext({ session: await mockSession(db) }),
    );
    await expect(hacker.sponsorScoring.overview()).rejects.toBeTruthy();
  });

  test("shows each sponsor's ranking and tallies teams", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const a = await sponsor();
    const b = await sponsor();
    const ids = await shortlistTeams(a.id);
    await anon.sponsorScoring.submit({
      sponsor: a.id,
      teamIds: ids.slice(0, TOP),
    });
    await anon.sponsorScoring.score({
      sponsor: b.id,
      teamId: ids[0]!,
      judge: "Marcus O.",
      halves: 8,
    });
    const hacker = await mockSession(db);
    await db
      .update(users)
      .set({ teamId: ids[0]!, name: "Ada Lovelace" })
      .where(eq(users.id, hacker.user.id));

    const res = await organizer.sponsorScoring.overview();
    const sa = res.sponsors.find((s) => s.sponsorId === a.id)!;
    expect(sa).toMatchObject({ scored: TOP + 2, shortlisted: TOP + 2 });
    expect(sa.final?.teams.map((t) => t.teamId)).toEqual(ids.slice(0, TOP));
    expect(sa.final?.teams[0]).toMatchObject({ score: 10 });
    expect(sa.final?.teams[0]?.devpostUrl).toContain("devpost.com");
    // Final results list each team's hackers.
    expect(sa.final?.teams[0]?.members).toEqual([
      { userId: hacker.user.id, name: "Ada Lovelace", github: null },
    ]);
    expect(sa.final?.teams[1]?.members).toEqual([]);
    expect(res.sponsors.find((s) => s.sponsorId === b.id)).toMatchObject({
      scored: 1,
      shortlisted: 0,
      final: null,
    });
    const first = res.teams.find((t) => t.teamId === ids[0]);
    expect(first).toMatchObject({
      topSponsors: [a.name],
      averageScore: 7,
      scoreCount: 2,
      bestRank: 1,
    });
  });

  test("withdrawn teams leave the tallies but stay flagged in the ranking", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const a = await sponsor();
    const ids = await shortlistTeams(a.id);
    await anon.sponsorScoring.submit({
      sponsor: a.id,
      teamIds: ids.slice(0, TOP),
    });
    await db
      .update(teams)
      .set({ submissionStatus: "draft" })
      .where(eq(teams.id, ids[0]!));

    const res = await organizer.sponsorScoring.overview();
    const sa = res.sponsors.find((s) => s.sponsorId === a.id)!;
    expect(sa).toMatchObject({ scored: TOP + 1, shortlisted: TOP + 1 });
    expect(sa.final?.teams[0]).toMatchObject({
      teamId: ids[0],
      eligible: false,
    });
    expect(sa.final?.teams[1]).toMatchObject({ eligible: true });
    expect(res.teams.find((t) => t.teamId === ids[0])).toBeUndefined();
    expect(res.teams.find((t) => t.teamId === ids[1])).toMatchObject({
      bestRank: 1,
    });
  });

  test("counts sponsors whose submission isn't in the sheet", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const before = (await organizer.sponsorScoring.overview()).unsyncedCount;
    const a = await sponsor();
    const ids = await shortlistTeams(a.id);
    mirrorSoon.mockResolvedValue(DOWN);
    await anon.sponsorScoring.submit({
      sponsor: a.id,
      teamIds: ids.slice(0, TOP),
    });
    const res = await organizer.sponsorScoring.overview();
    expect(res.unsyncedCount).toBe(before + 1);
  });
});

describe("sponsorScoring.sendShortlist", () => {
  test("snapshots the shortlist once; later edits and resends are refused", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    const sent = await anon.sponsorScoring.sendShortlist({ sponsor: s.id });
    expect(sent.teamIds).toEqual([...ids].sort());

    await anon.sponsorScoring.review({
      sponsor: s.id,
      teamId: ids[0]!,
      shortlisted: false,
    });
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(res.round.shortlistSent?.teamIds).toEqual([...ids].sort());

    await expect(
      anon.sponsorScoring.sendShortlist({ sponsor: s.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  test("refuses an empty shortlist and a closed round", async () => {
    const s = await sponsor();
    await expect(
      anon.sponsorScoring.sendShortlist({ sponsor: s.id }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await shortlistTeams(s.id);
    closesAt = PAST;
    await expect(
      anon.sponsorScoring.sendShortlist({ sponsor: s.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("sponsorScoring round 2", () => {
  test("once scheduled, only teams that present can be ranked", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id, { present: false });
    const late = await team();
    try {
      // Five of the shortlist present; `late` is ranked but never presented.
      await db.insert(sponsorPresentations).values(
        ids.map((teamId, i) => ({
          sponsorId: s.id,
          teamId,
          room: "Rm 2110",
          startMinute: 600 + i * 5,
        })),
      );
      const res = await anon.sponsorScoring.get({ sponsor: s.id });
      expect(res.round.scheduledAt).not.toBeNull();
      expect(res.round.slots.map((x) => x.teamId)).toEqual(ids);

      await anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: late,
        shortlisted: true,
      });
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: [late, ...ids.slice(0, TOP - 1)],
        }),
      ).rejects.toMatchObject({
        code: "BAD_REQUEST",
        message: "Only teams that presented to you can be submitted.",
      });

      // A presenter that was un-shortlisted afterwards still counts.
      await anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: ids[0]!,
        shortlisted: false,
      });
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: ids.slice(0, TOP),
        }),
      ).resolves.toMatchObject({ teamIds: ids.slice(0, TOP) });
    } finally {
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
      await db.delete(sponsorPresentations);
    }
  });

  test("before organizers open round 2, the top 5 can't be submitted", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id, { present: false });
    try {
      await db.insert(sponsorPresentations).values(
        ids.map((teamId, i) => ({
          sponsorId: s.id,
          teamId,
          room: "Rm 2110",
          startMinute: 600 + i * 5,
        })),
      );
      await setRound2Open(false);
      const res = await anon.sponsorScoring.get({ sponsor: s.id });
      expect(res.round.round2Open).toBe(false);
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: ids.slice(0, TOP),
        }),
      ).rejects.toMatchObject({
        code: "FORBIDDEN",
        message: "Round 2 isn't open yet. It opens after presentations.",
      });

      await setRound2Open(true);
      expect(
        (await anon.sponsorScoring.get({ sponsor: s.id })).round.round2Open,
      ).toBe(true);
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: ids.slice(0, TOP),
        }),
      ).resolves.toMatchObject({ teamIds: ids.slice(0, TOP) });
    } finally {
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
      await db.delete(sponsorPresentations);
    }
  });

  // A schedule exists, but not for this sponsor: round 2 is locked for
  // them (no slot, no ranking; Jazz, 2026-11-18).
  async function scheduleFor(sponsorId: string, teamId: string) {
    await db.insert(sponsorPresentations).values({
      sponsorId,
      teamId,
      room: "Rm 2110",
      startMinute: 600,
    });
  }
  const noSlot = {
    code: "FORBIDDEN",
    message:
      "Round 2 is locked: no teams presented to you, so you can't rank a top 5.",
  };

  test("a sponsor with no slot (sent late, none fit) can't rank in round 2", async () => {
    const other = await sponsor();
    const s = await sponsor();
    const ids = await shortlistTeams(s.id, { present: false });
    try {
      await scheduleFor(other.id, await team());
      await anon.sponsorScoring.sendShortlist({ sponsor: s.id });
      // A sponsor without a room gets times now (2026-11-20), so take its
      // rows away to stand for teams that couldn't be placed.
      await db
        .delete(sponsorPresentations)
        .where(eq(sponsorPresentations.sponsorId, s.id));
      mirrorSoon.mockClear();
      const res = await anon.sponsorScoring.get({ sponsor: s.id });
      expect(res.round.scheduledAt).not.toBeNull();
      expect(res.round.slots).toEqual([]);
      expect(res.round.round2Open).toBe(true);
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: ids.slice(0, TOP),
        }),
      ).rejects.toMatchObject(noSlot);
      expect(mirrorSoon).not.toHaveBeenCalled();
      expect(
        (await anon.sponsorScoring.get({ sponsor: s.id })).final,
      ).toBeNull();
    } finally {
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
      await db.delete(sponsorPresentations);
    }
  });

  test("a sponsor with no room (rows, none placed) can't rank in round 2", async () => {
    const other = await sponsor();
    const s = await sponsor();
    const ids = await shortlistTeams(s.id, { present: false });
    try {
      await scheduleFor(other.id, await team());
      await db.insert(sponsorPresentations).values(
        ids.map((teamId) => ({
          sponsorId: s.id,
          teamId,
          room: null,
          startMinute: null,
        })),
      );
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: ids.slice(0, TOP),
        }),
      ).rejects.toMatchObject(noSlot);
    } finally {
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
      await db.delete(sponsorPresentations);
    }
  });

  test("while round 2 is closed it says closed, not no slot", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id, { present: false });
    await setRound2Open(false);
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids.slice(0, TOP) }),
    ).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "Round 2 isn't open yet. It opens after presentations.",
    });
  });

  test("re-sending after scheduling keeps round 2 on the slots they have", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id, { present: false });
    try {
      await db.insert(sponsorPresentations).values(
        ids.map((teamId, i) => ({
          sponsorId: s.id,
          teamId,
          room: "Rm 2110",
          startMinute: 600 + i * 6,
        })),
      );
      // A new team joins the shortlist and is re-sent well after
      // presentations (Sunday 1:40 PM, past even the overflow slots that
      // run after 11:48): the rebuild keeps every time and has no slot
      // left for it, so it hasn't presented.
      const added = await team();
      await anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: added,
        shortlisted: true,
      });
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date("2026-11-22T13:40:00-05:00"));
      try {
        await anon.sponsorScoring.sendShortlist({ sponsor: s.id });
      } finally {
        vi.useRealTimers();
      }
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: [added, ...ids.slice(0, TOP - 1)],
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
      await expect(
        anon.sponsorScoring.submit({
          sponsor: s.id,
          teamIds: ids.slice(0, TOP),
        }),
      ).resolves.toMatchObject({ teamIds: ids.slice(0, TOP) });
    } finally {
      // eslint-disable-next-line drizzle/enforce-delete-with-where -- test reset: empty the table
      await db.delete(sponsorPresentations);
    }
  });
});

describe("sponsorScoring prize track gate", () => {
  const noTrack = {
    code: "FORBIDDEN",
    message: "Judging is only for sponsors with a prize track.",
  };

  test("a sponsor without a prize track can't judge at all", async () => {
    const s = await sponsor(false);
    const t = await team();
    await expect(
      anon.sponsorScoring.get({ sponsor: s.id }),
    ).rejects.toMatchObject(noTrack);
    await expect(
      anon.sponsorScoring.review({
        sponsor: s.id,
        teamId: t,
        shortlisted: true,
      }),
    ).rejects.toMatchObject(noTrack);
    await expect(
      anon.sponsorScoring.sendShortlist({ sponsor: s.id }),
    ).rejects.toMatchObject(noTrack);
    await expect(
      anon.sponsorScoring.submit({
        sponsor: s.id,
        teamIds: Array<string>(TOP).fill(t),
      }),
    ).rejects.toMatchObject(noTrack);
    await expect(
      anon.sponsorJudging.listAllTeams({ sponsor: s.id }),
    ).rejects.toMatchObject(noTrack);
    await expect(
      anon.sponsorJudging.getChosenTeams({ sponsor: s.id }),
    ).rejects.toMatchObject(noTrack);
  });

  test("registered names match the track list loosely", async () => {
    for (const name of ["Sun Life Financial", "SCOTIABANK", "Tiny Fish"]) {
      const [row] = await db
        .insert(sponsorJudgingSponsors)
        .values({ name: `${name} ${faker.string.alphanumeric(6)}` })
        .returning();
      await expect(
        anon.sponsorScoring.get({ sponsor: row!.id }),
      ).resolves.toMatchObject({ sponsorName: row!.name });
    }
  });

  test("a digital sponsor's link can't read the roster or its top 5", async () => {
    // A DB row exists (submitDigital makes one); digital still decides.
    await db
      .insert(sponsorJudgingSponsors)
      .values({ name: "PCBWay" })
      .onConflictDoNothing({ target: sponsorJudgingSponsors.name });
    const row = await db.query.sponsorJudgingSponsors.findFirst({
      where: eq(sponsorJudgingSponsors.name, "PCBWay"),
    });
    const digital = {
      code: "FORBIDDEN",
      message:
        "Digital sponsors don't judge in the portal. Send your top 5 to your Hack Western contact.",
    };
    await expect(
      anon.sponsorJudging.listAllTeams({ sponsor: row!.id }),
    ).rejects.toMatchObject(digital);
    await expect(
      anon.sponsorJudging.getChosenTeams({ sponsor: row!.id }),
    ).rejects.toMatchObject(digital);
    await expect(
      anon.sponsorScoring.get({ sponsor: row!.id }),
    ).rejects.toMatchObject(digital);
    await expect(
      anon.sponsorScoring.sendShortlist({ sponsor: row!.id }),
    ).rejects.toMatchObject(digital);
    expect(track).not.toHaveBeenCalled();
  });

  test("the organizer overview lists only track sponsors", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const yes = await sponsor();
    const no = await sponsor(false);
    const res = await organizer.sponsorScoring.overview();
    const ids = res.sponsors.map((s) => s.sponsorId);
    expect(ids).toContain(yes.id);
    expect(ids).not.toContain(no.id);
  });
});

describe("sponsorScoring sheet mirror hooks", () => {
  test("sending a shortlist and submitting a top 5 rewrite the tab", async () => {
    const soon = vi.mocked(mirrorSponsorJudgingSoon);
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    soon.mockClear();
    await anon.sponsorScoring.sendShortlist({ sponsor: s.id });
    expect(soon).toHaveBeenCalledTimes(1);
    await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ids.slice(0, TOP),
    });
    expect(soon).toHaveBeenCalledTimes(2);
    // A refused submit changes nothing and doesn't write.
    await expect(
      anon.sponsorScoring.submit({
        sponsor: s.id,
        teamIds: ids.slice(0, TOP - 1),
      }),
    ).rejects.toBeTruthy();
    expect(soon).toHaveBeenCalledTimes(2);
  });
});

describe("sponsorScoring.score (several reps, half points)", () => {
  test("takes halves 2-20 only (1-10 in half points); null clears", async () => {
    const s = await sponsor();
    const t = await team();
    for (const halves of [1, 21, 0, 7.5]) {
      await expect(
        anon.sponsorScoring.score({
          sponsor: s.id,
          teamId: t,
          judge: "Dana W.",
          halves,
        }),
      ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    }
    await expect(
      anon.sponsorScoring.score({
        sponsor: s.id,
        teamId: t,
        judge: "Dana W.",
        halves: 17,
      }),
    ).resolves.toMatchObject({ score: 8.5, judge: "Dana W." });
    await anon.sponsorScoring.score({
      sponsor: s.id,
      teamId: t,
      judge: "Dana W.",
      halves: null,
    });
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(res.scores.filter((x) => x.teamId === t)).toEqual([]);
    expect(res.reviews.find((r) => r.teamId === t)?.score ?? null).toBeNull();
  });

  test("each rep's score is kept; the review score is the team average", async () => {
    const s = await sponsor();
    const t = await team();
    const give = (judge: string, halves: number) =>
      anon.sponsorScoring.score({ sponsor: s.id, teamId: t, judge, halves });
    await give("Dana W.", 18); // 9
    await give("Marcus O.", 10); // 5
    // Same rep, different case and spacing: replaces, not a third score.
    await give("  dana   w. ", 17); // 8.5
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    const mine = res.scores.filter((x) => x.teamId === t);
    expect(mine).toHaveLength(2);
    expect(mine).toContainEqual({ teamId: t, judge: "dana w.", score: 8.5 });
    expect(mine).toContainEqual({ teamId: t, judge: "Marcus O.", score: 5 });
    expect(res.reviews.find((r) => r.teamId === t)?.score).toBe(6.75);
    // The older one-score column follows the rounded average (organizer
    // day board counts).
    const [row] = await db
      .select()
      .from(sponsorTeamReviews)
      .where(eq(sponsorTeamReviews.teamId, t));
    expect(row?.score).toBe(7);
  });

  test("two quick saves from the same rep both succeed; the last one wins", async () => {
    const s = await sponsor();
    const t = await team();
    const give = (judge: string, halves: number) =>
      anon.sponsorScoring.score({ sponsor: s.id, teamId: t, judge, halves });
    const results = await Promise.allSettled([
      give("Dana W.", 14),
      give("Dana W.", 16),
      give("dana w.", 18),
    ]);
    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "fulfilled",
      "fulfilled",
    ]);
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    const mine = res.scores.filter((x) => x.teamId === t);
    expect(mine).toEqual([{ teamId: t, judge: "dana w.", score: 9 }]);
    expect(res.reviews.find((r) => r.teamId === t)?.score).toBe(9);
  });

  test("hidden zero-width characters don't make a second rep", async () => {
    const s = await sponsor();
    const t = await team();
    const give = (judge: string, halves: number) =>
      anon.sponsorScoring.score({ sponsor: s.id, teamId: t, judge, halves });
    await give("Dana W.", 18);
    await expect(give("​Dana‌ W.﻿", 12)).resolves.toMatchObject({
      judge: "Dana W.",
    });
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(res.scores.filter((x) => x.teamId === t)).toEqual([
      { teamId: t, judge: "Dana W.", score: 6 },
    ]);
    // A name that is only hidden characters isn't a name.
    await expect(give("​‍", 12)).rejects.toMatchObject({
      code: "BAD_REQUEST",
    });
  });

  test("lists the sponsor's reps for Who's judging?", async () => {
    const s = await sponsor();
    await db.insert(coffeeChatReps).values([
      { sponsorId: s.id, name: "Priya S.", phone: "1", position: 1 },
      { sponsorId: s.id, name: "Leo T.", phone: "2", position: 0 },
    ]);
    const res = await anon.sponsorScoring.get({ sponsor: s.id });
    expect(res.reps).toEqual(["Leo T.", "Priya S."]);
  });

  test("can't score a team outside the track, or after judging closes", async () => {
    const s = await sponsor();
    const draft = await team("draft");
    await expect(
      anon.sponsorScoring.score({
        sponsor: s.id,
        teamId: draft,
        judge: "Dana W.",
        halves: 10,
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const t = await team();
    closesAt = PAST;
    await expect(
      anon.sponsorScoring.score({
        sponsor: s.id,
        teamId: t,
        judge: "Dana W.",
        halves: 10,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  test("organizer overview shows who gave each finalist's score", async () => {
    const organizer = createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    await anon.sponsorScoring.score({
      sponsor: s.id,
      teamId: ids[0]!,
      judge: "Marcus O.",
      halves: 13,
    });
    await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ids.slice(0, TOP),
    });
    const res = await organizer.sponsorScoring.overview();
    const row = res.sponsors.find((x) => x.sponsorId === s.id)!;
    expect(row.judges).toBe(2);
    expect(row.final?.teams[0]).toMatchObject({
      score: 8.25,
      byJudge: [
        { judge: "Dana W.", score: 10 },
        { judge: "Marcus O.", score: 6.5 },
      ],
    });
  });
});

describe("sponsorScoring digital sponsors (top 5 by Devpost link)", () => {
  async function organizer() {
    return createCaller(
      createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
    );
  }

  test("organizers enter 1st-5th by Devpost link or team ID", async () => {
    const org = await organizer();
    const all = await someTeams(TOP);
    const [a, b, ...rest] = all;
    const res = await org.sponsorScoring.submitDigital({
      name: "PCBWay",
      links: [
        // Pasted without https, with www and a trailing slash.
        `www.devpost.com/software/${a}/`,
        `https://devpost.com/software/${b}?ref=x`,
        ...rest,
      ],
    });
    expect(res.teamIds).toEqual(all);
    expect(mirrorSoon).toHaveBeenCalled();
    const teamsRes = await org.sponsorScoring.digitalTeams({ name: "pcbway" });
    expect(teamsRes.final?.teamIds).toEqual(all);
    const overview = await org.sponsorScoring.overview();
    expect(overview.digital).toEqual(["PCBWay"]);
    const pcb = overview.sponsors.find((x) => x.name === "PCBWay")!;
    expect(pcb).toMatchObject({ digital: true });
    expect(pcb.final?.teams.map((t) => t.teamId)).toEqual(all);
  });

  test("refuses a link that matches no submitted team in the track", async () => {
    const org = await organizer();
    const ok = await someTeams(TOP - 1);
    const draft = await team("draft");
    await expect(
      org.sponsorScoring.submitDigital({
        name: "PCBWay",
        links: [...ok, `devpost.com/software/${draft}`],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(
      org.sponsorScoring.submitDigital({
        name: "PCBWay",
        links: [...ok, "devpost.com/software/nobody-built-this"],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    // Outside the sponsor's track.
    track.mockResolvedValue("Best Domain");
    const inTrack = await team("submitted", ["Best Domain"]);
    await expect(
      org.sponsorScoring.submitDigital({
        name: "PCBWay",
        links: [inTrack, ...ok],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("still works after judging closes (organizers enter it late)", async () => {
    const org = await organizer();
    const all = await someTeams(TOP);
    closesAt = PAST;
    await expect(
      org.sponsorScoring.submitDigital({ name: "PCBWay", links: all }),
    ).resolves.toMatchObject({ teamIds: all });
  });

  test("a link two teams share is refused as ambiguous; the team ID works", async () => {
    const org = await organizer();
    const all = await someTeams(TOP);
    const [a, b, ...rest] = all;
    const shared = `https://devpost.com/software/shared-${a}`;
    await db.update(teams).set({ devpostUrl: shared }).where(eq(teams.id, a!));
    await db.update(teams).set({ devpostUrl: shared }).where(eq(teams.id, b!));
    await expect(
      org.sponsorScoring.submitDigital({
        name: "PCBWay",
        links: [shared, b!, ...rest],
      }),
    ).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: `1st place: "${shared}" matches more than one team in this sponsor's track. Paste the team ID instead.`,
    });
    await expect(
      org.sponsorScoring.submitDigital({ name: "PCBWay", links: all }),
    ).resolves.toMatchObject({ teamIds: all });
  });

  test("refuses the same team twice and a sponsor without a prize track", async () => {
    const org = await organizer();
    const [a, ...rest] = await someTeams(TOP - 1);
    await expect(
      org.sponsorScoring.submitDigital({
        name: "PCBWay",
        links: [a!, `devpost.com/software/${a}`, ...rest],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const noTrack = await sponsor(false);
    await expect(
      org.sponsorScoring.submitDigital({
        name: noTrack.name,
        links: [a!, ...rest, a!],
      }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  test("organizers can replace an in-person sponsor's top 5 from its presenters", async () => {
    const org = await organizer();
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    await anon.sponsorScoring.submit({
      sponsor: s.id,
      teamIds: ids.slice(0, TOP),
    });
    const stranger = await team();
    await expect(
      org.sponsorScoring.submitDigital({
        name: s.name,
        links: [stranger, ...ids.slice(0, TOP - 1)],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
    const fixed = ids.slice(0, TOP).reverse();
    await expect(
      org.sponsorScoring.submitDigital({ name: s.name, links: fixed }),
    ).resolves.toMatchObject({ teamIds: fixed });
    expect(
      (await anon.sponsorScoring.get({ sponsor: s.id })).final,
    ).toMatchObject({ teamIds: fixed });

    // Two presenters: the top is those two.
    const few = await sponsor();
    const two = await someTeams(2);
    await db.insert(sponsorPresentations).values(
      two.map((teamId, i) => ({
        sponsorId: few.id,
        teamId,
        room: "Rm 2110",
        startMinute: 600 + i * 6,
      })),
    );
    expect(
      (await org.sponsorScoring.digitalTeams({ name: few.name })).top,
    ).toBe(2);
    await expect(
      org.sponsorScoring.submitDigital({ name: few.name, links: two }),
    ).resolves.toMatchObject({ teamIds: two });
  });

  test("organizers only; a digital sponsor's link can't judge in the portal", async () => {
    await expect(
      anon.sponsorScoring.submitDigital({
        name: "PCBWay",
        links: ["a", "b", "c", "d", "e"],
      }),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    const [row] = await db
      .insert(sponsorJudgingSponsors)
      .values({ name: `PCBWay ${faker.string.alphanumeric(6)}` })
      .returning();
    await expect(
      anon.sponsorScoring.get({ sponsor: row!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

describe("sponsorJudging.getChosenTeams (database, not the deleted Judging tab)", () => {
  test("returns the submitted top 5 from the DB, even when the sheet mirror failed", async () => {
    const s = await sponsor();
    const ids = await shortlistTeams(s.id);
    expect(
      await anon.sponsorJudging.getChosenTeams({ sponsor: s.id }),
    ).toMatchObject({ teamIds: [] });
    mirrorSoon.mockResolvedValue(DOWN);
    await expect(
      anon.sponsorScoring.submit({ sponsor: s.id, teamIds: ids.slice(0, TOP) }),
    ).resolves.toMatchObject({ sheetSynced: false });
    expect(
      await anon.sponsorJudging.getChosenTeams({ sponsor: s.id }),
    ).toMatchObject({ sponsorName: s.name, teamIds: ids.slice(0, TOP) });
  });
});
