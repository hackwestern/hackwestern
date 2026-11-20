import { describe, expect, test } from "vitest";

import { sponsorLogo } from "./sponsor-logos";

describe("sponsorLogo", () => {
  test("matches names loosely", () => {
    expect(sponsorLogo("Canada Life")).toBe("/shared/sponsors/canadalife.png");
    expect(sponsorLogo("Sun Life")).toBe("/shared/sponsors/sunlife.png");
    expect(sponsorLogo("StarTech.com")).toBe("/shared/sponsors/startech.svg");
    expect(sponsorLogo("CSE")).toBe("/shared/sponsors/cse-trimmed.png");
  });

  test("returns null for a sponsor without a logo", () => {
    expect(sponsorLogo("Test Sponsor")).toBeNull();
  });
});
