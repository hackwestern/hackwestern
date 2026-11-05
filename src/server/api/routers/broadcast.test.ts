import { beforeEach, describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { applications, broadcastSettings, users } from "~/server/db/schema";
import { mockOrganizerSession, mockSession } from "~/server/auth";
import { ApplicationSeeder } from "~/server/db/seed/applicationSeeder";
import { UserSeeder } from "~/server/db/seed/userSeeder";

vi.mock("~/server/schedule-sheet", () => ({
  fetchScheduleSheet: vi.fn().mockResolvedValue({
    rowData: [
      { values: [{ formattedValue: "" }, { formattedValue: "Friday" }] },
      {
        values: [
          { formattedValue: "9:00 PM" },
          { formattedValue: "Team Formation\nLocation: Rm 2235" },
        ],
      },
    ],
    merges: [],
  }),
  cellText: (cell?: { formattedValue?: string }) => cell?.formattedValue ?? "",
}));

const publicCaller = createCaller(createInnerTRPCContext({ session: null }));
const hackerCaller = createCaller(
  createInnerTRPCContext({ session: await mockSession(db) }),
);
const organizerCaller = createCaller(
  createInnerTRPCContext({ session: await mockOrganizerSession(db) }),
);

const insertHacker = async (
  points: number,
  name: { account?: string; first?: string; last?: string } = {},
  type: "hacker" | "organizer" = "hacker",
) => {
  const user = {
    ...new UserSeeder().createRandom(),
    name: name.account ?? null,
    type,
    scavengerHuntEarned: points,
  };
  await db.insert(users).values(user);
  if (name.first) {
    await db.insert(applications).values({
      ...ApplicationSeeder.createRandomWithoutUser(),
      userId: user.id,
      firstName: name.first,
      lastName: name.last,
    });
  }
  return user;
};

describe("broadcast.display", () => {
  beforeEach(async () => {
    await db.delete(broadcastSettings).where(eq(broadcastSettings.id, 1));
  });

  test("works signed out, with defaults before an organizer saves", async () => {
    const display = await publicCaller.broadcast.display();
    expect(display.hackingStartsAt).toBeNull();
    expect(display.photoSeconds).toBe(8);
    expect(display.activities?.map((a) => a.title)).toEqual(["Team Formation"]);
  });

  test("leaderboard ranks hackers by points, never shows emails or organizers", async () => {
    const top = await insertHacker(900, { first: "Ada", last: "Lovelace" });
    const noName = await insertHacker(800);
    await insertHacker(950, { account: "Organizer" }, "organizer");

    const { leaders } = await publicCaller.broadcast.display();
    expect(leaders[0]).toEqual({ name: "Ada Lovelace", points: 900, rank: 1 });
    expect(leaders[1]).toEqual({ name: "Hacker", points: 800, rank: 2 });
    const names = leaders.map((l) => l.name);
    expect(names).not.toContain("Organizer");
    expect(names).not.toContain(top.email);
    expect(names).not.toContain(noName.email);
  });
});

describe("broadcast.updateSettings", () => {
  const start = new Date("2026-11-20T21:00:00-05:00");
  const end = new Date("2026-11-22T09:00:00-05:00");
  const settings = {
    hackingStartsAt: start,
    hackingEndsAt: end,
    photoSeconds: 10,
    videoSeconds: 30,
  };

  test("organizers save settings and the display picks them up", async () => {
    await organizerCaller.broadcast.updateSettings(settings);
    await organizerCaller.broadcast.updateSettings({
      ...settings,
      photoSeconds: 12,
    });

    const display = await publicCaller.broadcast.display();
    expect(display.hackingStartsAt).toEqual(start);
    expect(display.hackingEndsAt).toEqual(end);
    expect(display.photoSeconds).toBe(12);
    expect(await db.select().from(broadcastSettings)).toHaveLength(1);
  });

  test("hackers can't change settings", async () => {
    await expect(
      hackerCaller.broadcast.updateSettings(settings),
    ).rejects.toThrow();
  });

  test("hacking must end after it starts", async () => {
    await expect(
      organizerCaller.broadcast.updateSettings({
        ...settings,
        hackingEndsAt: start,
      }),
    ).rejects.toThrow("Hacking must end after it starts");
  });
});
