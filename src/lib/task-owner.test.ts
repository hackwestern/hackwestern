import { describe, expect, test } from "vitest";

import { parseTaskOwner } from "~/lib/task-owner";

describe("parseTaskOwner", () => {
  test.each([
    ["[SPON] Caroline", "Caroline"],
    ["Caroline", "Caroline"],
    ["Daniel", "Daniel"],
    ["Noah", "Noah"],
    ["  [WEB]   Noah  ", "Noah"],
    ["Jazz Gu", "Jazz Gu"],
    ["Noah, noah", "Noah"],
  ])("%j is one person: %j", (raw, name) => {
    expect(parseTaskOwner(raw)).toEqual({ kind: "person", name });
  });

  test.each([
    ["", "empty"],
    [null, "empty"],
    ["[SPON]", "empty"],
    [" + ", "empty"],
    ["All", "everyone"],
    ["[SPON] + [WEB] All", "everyone"],
    ["everyone", "everyone"],
    ["TEAM", "everyone"],
    ["Noah & All", "everyone"],
    ["Noah & Caroline", "several"],
    ["Noah, Caroline", "several"],
    ["Noah and Caroline", "several"],
    ["Noah / Caroline", "several"],
    [
      "Canada Life: Noah Manulife: Caroline QNX: Noah Scotiabank: Caroline Sunlife: Daniel",
      "per-company",
    ],
    ["QNX: Noah", "per-company"],
  ] as const)("%j has no clear owner (%s)", (raw, reason) => {
    expect(parseTaskOwner(raw)).toEqual({ kind: "none", reason });
  });
});
