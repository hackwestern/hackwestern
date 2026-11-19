import { describe, expect, test, vi } from "vitest";
import type * as Env from "~/env";

import { mirrorCoffeeChats } from "~/server/api/utils/coffee-chat-sheet-mirror";
import { sheetWritesEnabled } from "~/server/api/utils/run-of-show-sheet";
import { mirrorJudgingScores } from "~/server/api/utils/sponsor-judging-scores-mirror";
import { mirrorSponsorJudging } from "~/server/api/utils/sponsor-judging-sheet-mirror";
import { getSheetsClient } from "~/server/api/utils/sponsor-sheets";

// Even with production settings and SHEET_WRITES=1, a test never writes.
vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      NODE_ENV: "production",
      SHEET_WRITES: "1",
      RUN_OF_SHOW_SHEET: "sheet-id",
      RUN_OF_SHOW_SHEETS_CLIENT_EMAIL: "bot@example.iam.gserviceaccount.com",
      RUN_OF_SHOW_SHEETS_PRIVATE_KEY: "not-a-real-key",
    },
  };
});

const google = vi.hoisted(() => ({ scopes: [] as string[][] }));
vi.mock("googleapis", () => {
  class JWT {
    constructor(opts: { scopes: string[] }) {
      google.scopes.push(opts.scopes);
    }
    async authorize() {
      return undefined;
    }
  }
  return { google: { auth: { JWT }, sheets: () => ({}) } };
});

describe("sheet writes under Vitest", () => {
  test("are off whatever the env says", () => {
    expect(sheetWritesEnabled()).toBe(false);
  });

  test("getSheetsClient asks for the read-only scope", async () => {
    await getSheetsClient();
    expect(google.scopes.at(-1)).toEqual([
      "https://www.googleapis.com/auth/spreadsheets.readonly",
    ]);
  });

  test("every mirror writes nothing and says disabled", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const before = google.scopes.length;
    await expect(mirrorCoffeeChats()).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    await expect(mirrorSponsorJudging()).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    await expect(mirrorJudgingScores()).resolves.toEqual({
      ok: false,
      error: "disabled",
    });
    // No Google client was even created.
    expect(google.scopes.length).toBe(before);
  });
});
