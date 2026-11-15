import { describe, expect, test, vi } from "vitest";

// The cache needs no env or Google login.
vi.mock("~/env", () => ({ env: {} }));

import { createCachedLoader, RUN_OF_SHOW_CACHE_MS } from "./run-of-show-sheet";

describe("createCachedLoader", () => {
  test("a second call within 60 s does not refetch", async () => {
    let clock = 0;
    const load = vi.fn().mockResolvedValue("sheet");
    const cache = createCachedLoader(load, RUN_OF_SHOW_CACHE_MS, () => clock);

    expect(await cache.get()).toBe("sheet");
    clock = 59_000;
    expect(await cache.get()).toBe("sheet");
    expect(load).toHaveBeenCalledTimes(1);

    clock = 61_000;
    await cache.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("concurrent callers share one in-flight read", async () => {
    let resolve!: (v: string) => void;
    const load = vi.fn(() => new Promise<string>((r) => (resolve = r)));
    const cache = createCachedLoader(load, RUN_OF_SHOW_CACHE_MS);

    const a = cache.get();
    const b = cache.get();
    resolve("sheet");
    expect(await Promise.all([a, b])).toEqual(["sheet", "sheet"]);
    expect(load).toHaveBeenCalledTimes(1);
  });

  test("a failed read is not cached", async () => {
    const load = vi
      .fn()
      .mockRejectedValueOnce(new Error("sheet down"))
      .mockResolvedValueOnce("sheet");
    const cache = createCachedLoader(load, RUN_OF_SHOW_CACHE_MS, () => 0);

    await expect(cache.get()).rejects.toThrow("sheet down");
    expect(await cache.get()).toBe("sheet");
    expect(load).toHaveBeenCalledTimes(2);
  });
});
