import { beforeEach, describe, expect, test, vi } from "vitest";

const env = vi.hoisted(() => ({}) as Record<string, string | undefined>);
vi.mock("~/env", () => ({ env }));

import {
  resultsSheetCredentials,
  resultsSheetWritesEnabled,
} from "./results-sheet-client";

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
});

describe("resultsSheetCredentials", () => {
  test("uses the results sheet's own account when set", () => {
    Object.assign(env, {
      JUDGING_RESULTS_CLIENT_EMAIL: "results@x.iam",
      JUDGING_RESULTS_PRIVATE_KEY: '"line1\\nline2"',
      SPONSOR_SHEETS_CLIENT_EMAIL: "sponsor@x.iam",
      SPONSOR_SHEETS_PRIVATE_KEY: "sponsor-key",
    });
    expect(resultsSheetCredentials()).toEqual({
      email: "results@x.iam",
      key: "line1\nline2",
    });
  });

  test("falls back to the sponsor account before run-of-show", () => {
    Object.assign(env, {
      RUN_OF_SHOW_SHEETS_CLIENT_EMAIL: "ros@x.iam",
      RUN_OF_SHOW_SHEETS_PRIVATE_KEY: "ros-key",
      SPONSOR_SHEETS_CLIENT_EMAIL: "sponsor@x.iam",
      SPONSOR_SHEETS_PRIVATE_KEY: "sponsor-key",
    });
    expect(resultsSheetCredentials().email).toBe("sponsor@x.iam");
  });

  test("uses the run-of-show account when it's the only one", () => {
    Object.assign(env, {
      RUN_OF_SHOW_SHEETS_CLIENT_EMAIL: "ros@x.iam",
      RUN_OF_SHOW_SHEETS_PRIVATE_KEY: "ros-key",
    });
    expect(resultsSheetCredentials()).toEqual({
      email: "ros@x.iam",
      key: "ros-key",
    });
  });

  test("throws when nothing is configured", () => {
    expect(() => resultsSheetCredentials()).toThrow(/not configured/);
  });
});

describe("resultsSheetWritesEnabled", () => {
  test("never in tests, even with the switch on", () => {
    env.JUDGING_RESULTS_SHEET_WRITES = "1";
    expect(resultsSheetWritesEnabled()).toBe(false);
  });
});
