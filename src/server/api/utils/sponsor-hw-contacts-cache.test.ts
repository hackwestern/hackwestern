import { beforeEach, describe, expect, test, vi } from "vitest";
import type * as SponsorSheets from "~/server/api/utils/sponsor-sheets";

const sheet = vi.hoisted(() => ({ get: vi.fn() }));

// Never hit the real sheet: HW Contacts reads go to this fake.
vi.mock("~/server/api/utils/sponsor-sheets", async (importOriginal) => ({
  ...(await importOriginal<typeof SponsorSheets>()),
  getSheetsClient: vi.fn(() =>
    Promise.resolve({ spreadsheets: { values: { get: sheet.get } } }),
  ),
  getSpreadsheetId: () => "fake",
}));

import {
  createLastGoodLoader,
  fetchHwContactPhones,
  fetchHwContacts,
  HW_CONTACTS_CACHE_MS,
  hwContactPhonesCache,
  hwContactsCache,
} from "./sponsor-hw-contacts";

const rows = [
  ["Name", "Phone", "Login email"],
  ["Test Person", "519-555-0100", "test@example.test"],
];

beforeEach(() => {
  sheet.get.mockReset();
  hwContactsCache.clear();
  hwContactPhonesCache.clear();
});

describe("createLastGoodLoader", () => {
  test("reuses a read for the TTL, then reads again", async () => {
    let t = 0;
    const load = vi.fn().mockResolvedValue("a");
    const loader = createLastGoodLoader("x", load, 90_000, () => t);
    expect(await loader.get()).toEqual({ value: "a", stale: false });
    t = 89_000;
    await loader.get();
    expect(load).toHaveBeenCalledTimes(1);
    t = 90_000;
    await loader.get();
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("a failed read keeps the last good value, and waits a TTL to retry", async () => {
    let t = 0;
    const load = vi
      .fn()
      .mockResolvedValueOnce("good")
      .mockRejectedValue(new Error("sheet down"));
    const loader = createLastGoodLoader("x", load, 90_000, () => t);
    await loader.get();
    t = 100_000;
    expect(await loader.get()).toEqual({ value: "good", stale: true });
    t = 150_000;
    expect(await loader.get()).toEqual({ value: "good", stale: true });
    expect(load).toHaveBeenCalledTimes(2);
  });

  test("null when no read has ever worked", async () => {
    const load = vi.fn().mockRejectedValue(new Error("sheet down"));
    const loader = createLastGoodLoader("x", load, 90_000, () => 0);
    expect(await loader.get()).toBeNull();
  });
});

describe("HW Contacts reads", () => {
  test("fetchHwContacts reads the sheet once per TTL", async () => {
    sheet.get.mockResolvedValue({ data: { values: rows } });
    expect(HW_CONTACTS_CACHE_MS).toBe(90_000);
    const first = await fetchHwContacts();
    const second = await fetchHwContacts();
    expect(first?.value[0]?.loginEmail).toBe("test@example.test");
    expect(second).toEqual(first);
    expect(sheet.get).toHaveBeenCalledTimes(1);
  });

  test("fetchHwContacts is null (not empty) when the tab can't be read", async () => {
    sheet.get.mockRejectedValue(new Error("403"));
    expect(await fetchHwContacts()).toBeNull();
  });

  test("fetchHwContactPhones reads once and keeps the map", async () => {
    sheet.get.mockResolvedValue({ data: { values: rows } });
    const a = await fetchHwContactPhones();
    const b = await fetchHwContactPhones();
    expect(a.get("test person")).toBe("519-555-0100");
    expect(b).toBe(a);
    expect(sheet.get).toHaveBeenCalledTimes(1);
  });

  test("fetchHwContactPhones is an empty map when never read", async () => {
    sheet.get.mockRejectedValue(new Error("403"));
    expect((await fetchHwContactPhones()).size).toBe(0);
  });
});
