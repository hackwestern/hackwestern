import { describe, expect, it, vi } from "vitest";

vi.mock("~/server/db", () => ({ db: {} }));

import {
  fetchAllChosenTeams,
  type SheetsClient,
} from "~/server/api/utils/sponsor-sheets";

function clientReturning(get: () => Promise<unknown>): SheetsClient {
  return {
    spreadsheets: { values: { get } },
  } as unknown as SheetsClient;
}

describe("fetchAllChosenTeams", () => {
  it("returns no picks when the Judging tab is gone", async () => {
    const sheets = clientReturning(() =>
      Promise.reject(
        Object.assign(new Error("Unable to parse range: Judging!A3:B"), {
          code: 400,
        }),
      ),
    );
    await expect(fetchAllChosenTeams(sheets, "id")).resolves.toEqual(new Map());
  });

  it("still throws other errors", async () => {
    const sheets = clientReturning(() =>
      Promise.reject(Object.assign(new Error("boom"), { code: 500 })),
    );
    await expect(fetchAllChosenTeams(sheets, "id")).rejects.toThrow("boom");
  });

  it("reads picks when the tab exists", async () => {
    const sheets = clientReturning(() =>
      Promise.resolve({ data: { values: [["Commure", "a1, b2"]] } }),
    );
    const picks = await fetchAllChosenTeams(sheets, "id");
    expect(picks.get("Commure")?.length).toBe(2);
  });
});
