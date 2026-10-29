import { describe, expect, test, beforeEach, afterEach, vi } from "vitest";
import { like } from "drizzle-orm";
import { db } from "~/server/db";
import { teamFinderCards, users } from "~/server/db/schema";
import * as photos from "~/server/storage/team-finder-photos";
import {
  RETENTION_DATE,
  countCards,
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

  test("refuses before the retention date, even to apply", async () => {
    await seed("early", null);
    expect(() => refuseBeforeRetention(before)).toThrow("Refusing");
    await expect(deleteAllCards(before)).rejects.toThrow("Refusing");
    expect(await countCards()).toBeGreaterThanOrEqual(1);
  });

  test("deletes each photo (webp and jpg) then all rows", async () => {
    await seed("a", "team-finder/u1/a.webp");
    await seed("b", "team-finder/u2/b.jpg");
    await seed("c", null);
    const r = await deleteAllCards(after);
    expect(r.photosDeleted).toBeGreaterThanOrEqual(2);
    expect(photos.deletePhoto).toHaveBeenCalledWith("team-finder/u1/a.webp");
    expect(photos.deletePhoto).toHaveBeenCalledWith("team-finder/u2/b.jpg");
    expect(await countCards()).toBe(0);
  });

  test("deletes rows and counts skipped photos when storage is off", async () => {
    vi.mocked(photos.photosConfigured).mockReturnValue(false);
    await seed("a", "team-finder/u1/a.webp");
    const r = await deleteAllCards(after);
    expect(photos.deletePhoto).not.toHaveBeenCalled();
    expect(r.photosSkipped).toBeGreaterThanOrEqual(1);
    expect(await countCards()).toBe(0);
  });
});
