import { describe, expect, test, vi, beforeEach } from "vitest";
import { resolveMx } from "dns/promises";
import { validateSignupEmail, domainOf } from "~/server/email-validation";

describe("domainOf", () => {
  test("extracts the lowercased domain", () => {
    expect(domainOf("Someone@Example.COM")).toBe("example.com");
  });
});

describe("validateSignupEmail", () => {
  beforeEach(() => {
    // Default: domain resolves fine (has MX).
    vi.mocked(resolveMx).mockResolvedValue([
      { exchange: "mx.test", priority: 10 },
    ]);
  });

  test("accepts a well-formed address at a resolvable domain", async () => {
    expect(await validateSignupEmail("student@gmail.com")).toEqual({ ok: true });
  });

  test("rejects malformed addresses", async () => {
    for (const bad of [
      "notanemail",
      "no@domain",
      "@nolocal.com",
      "spaces in@example.com",
      "trailing@example.",
    ]) {
      expect((await validateSignupEmail(bad)).ok).toBe(false);
    }
  });

  test("rejects disposable domains", async () => {
    expect(await validateSignupEmail("throwaway@mailinator.com")).toEqual({
      ok: false,
      reason: expect.stringContaining("disposable"),
    });
  });

  test("rejects a domain that does not resolve (ENOTFOUND)", async () => {
    vi.mocked(resolveMx).mockRejectedValueOnce(
      Object.assign(new Error("not found"), { code: "ENOTFOUND" }),
    );
    expect(
      await validateSignupEmail("user@totallyfakedomain12345.com"),
    ).toEqual({ ok: false, reason: expect.stringContaining("doesn't exist") });
  });

  test("fails open when the domain exists but has no MX (ENODATA)", async () => {
    vi.mocked(resolveMx).mockRejectedValueOnce(
      Object.assign(new Error("no data"), { code: "ENODATA" }),
    );
    expect(await validateSignupEmail("user@a-record-only.com")).toEqual({
      ok: true,
    });
  });

  test("fails open on a transient DNS error", async () => {
    vi.mocked(resolveMx).mockRejectedValueOnce(
      Object.assign(new Error("timeout"), { code: "ETIMEOUT" }),
    );
    expect(await validateSignupEmail("student@university.edu")).toEqual({
      ok: true,
    });
  });
});
