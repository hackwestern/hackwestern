import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { SPONSOR_PRIZE_TRACKS } from "~/content/sponsor-prize-tracks";

const fetchSheetSponsors = vi.fn();
vi.mock("~/server/api/utils/sponsor-sheets", () => ({
  fetchSheetSponsors: () => fetchSheetSponsors() as unknown,
}));

const { clearPrizeTrackCache, prizeTrackSponsors } = await import(
  "~/server/api/utils/sponsor-prize-track-sheet"
);

// Fake sponsors only.
describe("prizeTrackSponsors", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    fetchSheetSponsors.mockReset();
    clearPrizeTrackCache();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  test("a failed read caches the built-in list for 60 s", async () => {
    fetchSheetSponsors.mockRejectedValue(new Error("sheet down"));
    await expect(prizeTrackSponsors()).resolves.toEqual(SPONSOR_PRIZE_TRACKS);
    await expect(prizeTrackSponsors()).resolves.toEqual(SPONSOR_PRIZE_TRACKS);
    expect(fetchSheetSponsors).toHaveBeenCalledTimes(1);
    expect(console.warn).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(59_000);
    await prizeTrackSponsors();
    expect(fetchSheetSponsors).toHaveBeenCalledTimes(1);

    // After a minute it tries the sheet again, and a good read wins.
    vi.advanceTimersByTime(2_000);
    fetchSheetSponsors.mockResolvedValue([
      { name: "Acme", hasPrizeTrack: true },
      { name: "Globex", hasPrizeTrack: false },
    ]);
    await expect(prizeTrackSponsors()).resolves.toEqual(["Acme"]);
    expect(fetchSheetSponsors).toHaveBeenCalledTimes(2);
  });

  test("a missing checkbox column is cached as a failure too", async () => {
    fetchSheetSponsors.mockResolvedValue([
      { name: "Acme", hasPrizeTrack: null },
    ]);
    await expect(prizeTrackSponsors()).resolves.toEqual(SPONSOR_PRIZE_TRACKS);
    await prizeTrackSponsors();
    expect(fetchSheetSponsors).toHaveBeenCalledTimes(1);
  });
});
