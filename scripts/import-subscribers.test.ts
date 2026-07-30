import { describe, expect, test } from "vitest";
import { buildSubscriberRows, DOMAIN_FIXES } from "./import-subscribers";

describe("buildSubscriberRows", () => {
  test("normalizes, dedups, hw12 wins on overlap", () => {
    const rows = buildSubscriberRows([
      { emails: ["A@gmail.com", "x@outlook.com"], source: "hw11" },
      { emails: ["a@gmail.com"], source: "hw12" }, // same person, newer
    ]);
    const a = rows.find((r) => r.email === "a@gmail.com");
    expect(a?.source).toBe("hw12");
    expect(rows).toHaveLength(2);
  });

  test("drops school + junk, keeps freemail", () => {
    const rows = buildSubscriberRows([
      { emails: ["stu@uwo.ca", "junk@t1.com", "ok@gmail.com"], source: "hw12" },
    ]);
    expect(rows.map((r) => r.email)).toEqual(["ok@gmail.com"]);
  });

  test("applies domain typo fixes", () => {
    expect(DOMAIN_FIXES["gmaill.com"]).toBe("gmail.com");
    const rows = buildSubscriberRows([
      { emails: ["typo@gmaill.com"], source: "hw11" },
    ]);
    expect(rows[0]?.email).toBe("typo@gmail.com");
  });

  test("drops emails in the exclude set (preregistration overlap)", () => {
    const rows = buildSubscriberRows(
      [{ emails: ["already@gmail.com", "fresh@gmail.com"], source: "hw12" }],
      new Set(["already@gmail.com"]),
    );
    expect(rows.map((r) => r.email)).toEqual(["fresh@gmail.com"]);
  });
});
