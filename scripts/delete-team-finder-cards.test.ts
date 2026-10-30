import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { like } from "drizzle-orm";
import { db } from "~/server/db";
import { teamFinderCards, users } from "~/server/db/schema";
import * as photos from "~/server/storage/team-finder-photos";
import { RETENTION_DATE } from "~/lib/team-finder";
import {
  deleteAllCards,
  refuseBeforeRetention,
} from "./delete-team-finder-cards";

vi.mock("~/server/storage/team-finder-photos", () => ({
  photosConfigured: vi.fn(() => true),
  deletePhoto: vi.fn(async () => undefined),
}));

describe("delete team finder cards (DB integration)", () => {
  const PREFIX = "zz-retention-";
  const after = new Date(RETENTION_DATE.getTime() + 60_000);
  const before = new Date(RETENTION_DATE.getTime() - 1);
  const cleanup = async () => {
    await db.delete(users).where(like(users.id, `${PREFIX}%`));
  };
  beforeEach(async () => {
    await cleanup();
    vi.mocked(photos.photosConfigured).mockReturnValue(true);
    vi.mocked(photos.deletePhoto).mockClear();
  });
  afterEach(cleanup);

  async function seed(tag: string, photoKey: string | null) {
    await db.insert(users).values({
      id: `${PREFIX}${tag}`,
      email: `${PREFIX}${tag}@gmail.com`,
      type: "hacker",
    });
    await db
      .insert(teamFinderCards)
      .values({ userId: `${PREFIX}${tag}`, photoKey });
  }

  const seeded = (...tags: string[]) => tags.map((t) => `${PREFIX}${t}`);
  const remaining = async () =>
    (
      await db
        .select({ userId: teamFinderCards.userId })
        .from(teamFinderCards)
        .where(like(teamFinderCards.userId, `${PREFIX}%`))
    ).length;

  test("refuses before the retention date, even to apply", async () => {
    await seed("early", null);
    expect(() => refuseBeforeRetention(before)).toThrow("Refusing");
    await expect(deleteAllCards(before, seeded("early"))).rejects.toThrow(
      "Refusing",
    );
    expect(await remaining()).toBe(1);
  });

  test("deletes each photo (webp and jpg) then the rows", async () => {
    await seed("a", "team-finder/a.webp");
    await seed("b", "team-finder/b.jpg");
    await seed("c", null);
    const r = await deleteAllCards(after, seeded("a", "b", "c"));
    expect(r).toEqual({ cards: 3, photosDeleted: 2, photosSkipped: 0 });
    expect(photos.deletePhoto).toHaveBeenCalledTimes(2);
    expect(photos.deletePhoto).toHaveBeenCalledWith("team-finder/a.webp");
    expect(photos.deletePhoto).toHaveBeenCalledWith("team-finder/b.jpg");
    expect(await remaining()).toBe(0);
  });

  test("deletes rows and counts skipped photos when storage is off", async () => {
    vi.mocked(photos.photosConfigured).mockReturnValue(false);
    await seed("a", "team-finder/a.webp");
    const r = await deleteAllCards(after, seeded("a"));
    expect(photos.deletePhoto).not.toHaveBeenCalled();
    expect(r).toEqual({ cards: 1, photosDeleted: 0, photosSkipped: 1 });
    expect(await remaining()).toBe(0);
  });
});
