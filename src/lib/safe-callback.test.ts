import { describe, expect, it } from "vitest";
import { safeCallbackPath } from "./safe-callback";

describe("safeCallbackPath", () => {
  it("keeps paths on this site", () => {
    expect(safeCallbackPath("/rsvp")).toBe("/rsvp");
    expect(safeCallbackPath("/rsvp?celebrate=1")).toBe("/rsvp?celebrate=1");
  });

  it("refuses anything that could leave the site", () => {
    for (const raw of [
      "https://evil.com",
      "//evil.com",
      "/\\evil.com",
      "evil.com",
      "javascript:alert(1)",
      "/rsvp\n",
      "",
      undefined,
      ["/rsvp"],
    ]) {
      expect(safeCallbackPath(raw)).toBeNull();
    }
  });
});
