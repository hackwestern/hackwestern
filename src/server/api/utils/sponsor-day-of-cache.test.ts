import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  createDayOfCache,
  parseSponsorDayOfRows,
  sponsorInfoFromDayOf,
  type SponsorDayOfTab,
} from "~/server/api/utils/sponsor-sheets";

// The organizer board "un-updated" itself (Jazz, 2026-11-20): a status tap
// showed, flipped back to the old value, then came right a minute later.
// These pin down the server half: after a write, this instance's shared
// Sponsor Day-Of copy must hold the written value, whatever reads were
// already on their way.

const tab = (status: string): SponsorDayOfTab =>
  parseSponsorDayOfRows("Sponsor Day-Of", [
    ["Sponsor Name", "Status"],
    ["Acme", status],
  ])!;
const statusOf = (dayOf: SponsorDayOfTab | null) =>
  sponsorInfoFromDayOf(dayOf!)!.get("acme")!.status;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((r) => (resolve = r));
  return { promise, resolve };
}

describe("Sponsor Day-Of shared copy and writes", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-21T10:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  test("after a write, the next read returns the written value without asking Google", async () => {
    const cache = createDayOfCache(60_000);
    await cache.read("id", async () => tab("Not arrived"));
    cache.remember("id", tab("Checked in"));
    const load = vi.fn(async () => tab("Not arrived"));
    expect(statusOf(await cache.read("id", load))).toBe("Checked in");
    expect(load).not.toHaveBeenCalled();
  });

  test("a read already in flight when the write lands can't put the old rows back", async () => {
    const cache = createDayOfCache(60_000);
    // A 30 s poll starts reading; Google answers after the write.
    const slow = deferred<SponsorDayOfTab>();
    const poll = cache.read("id", () => slow.promise);
    cache.remember("id", tab("Checked in"));
    // The board refetches right after the write, while the poll is out.
    const refetch = cache.read("id", async () => tab("Checked in"));
    slow.resolve(tab("Not arrived"));
    // The poll itself started before the write: it may answer old.
    expect(statusOf(await poll)).toBe("Not arrived");
    expect(statusOf(await refetch)).toBe("Checked in");
    // And for the rest of the minute, every read still says the new value.
    vi.advanceTimersByTime(30_000);
    expect(
      statusOf(await cache.read("id", async () => tab("Not arrived"))),
    ).toBe("Checked in");
  });

  test("clear (a write without a value) also drops a read already on its way", async () => {
    const cache = createDayOfCache(60_000);
    const slow = deferred<SponsorDayOfTab>();
    const poll = cache.read("id", () => slow.promise);
    cache.clear();
    slow.resolve(tab("Not arrived"));
    await poll;
    expect(
      statusOf(await cache.read("id", async () => tab("Checked in"))),
    ).toBe("Checked in");
  });

  test("the copy still expires: a minute later the sheet is read again", async () => {
    const cache = createDayOfCache(60_000);
    cache.remember("id", tab("Checked in"));
    vi.advanceTimersByTime(60_001);
    const load = vi.fn(async () => tab("Left"));
    expect(statusOf(await cache.read("id", load))).toBe("Left");
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("a refused read still falls back to the last good copy", async () => {
    const cache = createDayOfCache(60_000);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    cache.remember("id", tab("Checked in"));
    vi.advanceTimersByTime(60_001);
    const value = await cache.read("id", () =>
      Promise.reject(new Error("Quota exceeded")),
    );
    expect(statusOf(value)).toBe("Checked in");
    warn.mockRestore();
  });
});
