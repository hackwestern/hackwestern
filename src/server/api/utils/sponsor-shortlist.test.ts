import { describe, expect, test } from "vitest";
import { faker } from "@faker-js/faker";
import { eq } from "drizzle-orm";

import { COFFEE_CHAT_SHORTLIST_SIZE } from "~/lib/coffee-chat-requests";
import { mockSession } from "~/server/auth";
import { db } from "~/server/db";
import {
  applications,
  sponsorInterests,
  sponsorJudgingSponsors,
  teams,
  users,
} from "~/server/db/schema";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import {
  safeProfileUrl,
  sponsorShortlist,
} from "~/server/api/utils/sponsor-shortlist";

// Before the RSVP deadline, so ACCEPTED and CONFIRMED both count as admitted.
const NOW = new Date("2026-10-01T12:00:00Z").getTime();

async function sponsor() {
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name: `Sponsor ${faker.string.alphanumeric(10)}` })
    .returning({ id: sponsorJudgingSponsors.id });
  return row!.id;
}

async function hacker(
  opts: {
    share?: boolean;
    status?: "CONFIRMED" | "ACCEPTED" | "DECLINED";
    first?: string;
    team?: string;
  } = {},
) {
  const session = await mockSession(db);
  const id = session.user.id;
  await db.insert(applications).values({
    ...ApplicationSeeder.createRandomWithoutUser(),
    userId: id,
    status: opts.status ?? "CONFIRMED",
    agreeShareWithSponsors: opts.share ?? true,
    firstName: opts.first ?? faker.person.firstName(),
    lastName: "Tester",
    resumeLink: "https://files.example.com/resume.pdf",
    githubLink: "github.com/someone",
    linkedInLink: "https://linkedin.com/in/someone",
    devpostLink: "https://devpost.com/someone",
  });
  const hackerId = `hk-${faker.string.alphanumeric(12)}`;
  await db.update(users).set({ hackerId }).where(eq(users.id, id));
  if (opts.team) {
    const teamId = faker.string.alphanumeric(12);
    await db.insert(teams).values({
      id: teamId,
      name: opts.team,
      joinCode: faker.string.alphanumeric(6),
    });
    await db.update(users).set({ teamId }).where(eq(users.id, id));
  }
  return { id, hackerId };
}

const rank = (userId: string, sponsorId: string, r: number) =>
  db.insert(sponsorInterests).values({ userId, sponsorId, rank: r });

describe("sponsorShortlist", () => {
  test("excludes hackers who didn't agree to share with sponsors", async () => {
    const s = await sponsor();
    const yes = await hacker({ share: true });
    const no = await hacker({ share: false });
    await rank(yes.id, s, 2);
    await rank(no.id, s, 1);

    const list = await sponsorShortlist(s, { now: NOW });
    expect(list.map((h) => h.hackerId)).toEqual([yes.hackerId]);
  });

  test("excludes hackers who aren't admitted", async () => {
    const s = await sponsor();
    const ok = await hacker({ status: "ACCEPTED" });
    const out = await hacker({ status: "DECLINED" });
    await rank(ok.id, s, 1);
    await rank(out.id, s, 1);

    const list = await sponsorShortlist(s, { now: NOW });
    expect(list.map((h) => h.hackerId)).toEqual([ok.hackerId]);
  });

  test("only hackers who ranked this sponsor", async () => {
    const mine = await sponsor();
    const theirs = await sponsor();
    const a = await hacker();
    const b = await hacker();
    await rank(a.id, mine, 3);
    await rank(b.id, theirs, 1);

    const list = await sponsorShortlist(mine, { now: NOW });
    expect(list.map((h) => h.hackerId)).toEqual([a.hackerId]);
  });

  test("orders by the hacker's rank of the sponsor, top picks first", async () => {
    const s = await sponsor();
    const third = await hacker();
    const first = await hacker();
    const second = await hacker();
    await rank(third.id, s, 3);
    await rank(first.id, s, 1);
    await rank(second.id, s, 2);

    const list = await sponsorShortlist(s, { now: NOW });
    expect(list.map((h) => [h.hackerId, h.rank])).toEqual([
      [first.hackerId, 1],
      [second.hackerId, 2],
      [third.hackerId, 3],
    ]);
  });

  test(`caps at COFFEE_CHAT_SHORTLIST_SIZE (${COFFEE_CHAT_SHORTLIST_SIZE})`, async () => {
    const s = await sponsor();
    const count = COFFEE_CHAT_SHORTLIST_SIZE + 5;
    const all = [];
    for (let i = 0; i < count; i++) {
      const h = await hacker();
      // The last five ranked this sponsor first, so they must make the cut.
      await rank(h.id, s, i >= COFFEE_CHAT_SHORTLIST_SIZE ? 1 : 2);
      all.push(h);
    }
    const list = await sponsorShortlist(s, { now: NOW });
    expect(list).toHaveLength(COFFEE_CHAT_SHORTLIST_SIZE);
    expect(
      list
        .slice(0, 5)
        .map((h) => h.hackerId)
        .sort(),
    ).toEqual(
      all
        .slice(COFFEE_CHAT_SHORTLIST_SIZE)
        .map((h) => h.hackerId)
        .sort(),
    );
  });

  test("returns hackerId, name, team, resume, GitHub, LinkedIn, Devpost (no email)", async () => {
    const s = await sponsor();
    const h = await hacker({ first: "Alex", team: "Byte Club" });
    await rank(h.id, s, 1);

    const [row] = await sponsorShortlist(s, { now: NOW });
    expect(row).toEqual({
      userId: h.id,
      hackerId: h.hackerId,
      name: "Alex Tester",
      team: "Byte Club",
      rank: 1,
      resume: "https://files.example.com/resume.pdf",
      github: "https://github.com/someone",
      linkedIn: "https://linkedin.com/in/someone",
      devpost: "https://devpost.com/someone",
    });
    // Contact details never reach the sponsor.
    expect(JSON.stringify(row)).not.toContain("@");
  });

  test("a hacker with no team has team null", async () => {
    const s = await sponsor();
    const h = await hacker();
    await rank(h.id, s, 1);
    const [row] = await sponsorShortlist(s, { now: NOW });
    expect(row!.team).toBeNull();
  });
});

describe("safeProfileUrl", () => {
  test("adds https to a bare domain", () => {
    expect(safeProfileUrl("github.com/a")).toBe("https://github.com/a");
  });
  test("keeps http(s) links", () => {
    expect(safeProfileUrl(" http://x.dev/a ")).toBe("http://x.dev/a");
  });
  test("drops blank and non-web schemes", () => {
    expect(safeProfileUrl("")).toBeNull();
    expect(safeProfileUrl(null)).toBeNull();
    expect(safeProfileUrl("javascript:alert(1)")).toBeNull();
    expect(safeProfileUrl("mailto:a@b.c")).toBeNull();
  });
});
