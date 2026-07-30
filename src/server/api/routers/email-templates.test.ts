import { describe, expect, test } from "vitest";
import { campaignTemplate } from "./email-templates";

describe("campaignTemplate", () => {
  const html = campaignTemplate(
    "person@gmail.com",
    "12",
    "https://hackwestern.com/api/unsubscribe?token=abc",
  );
  test("includes per-recipient footer with email + edition", () => {
    expect(html).toContain("person@gmail.com");
    expect(html).toContain("because you signed up for Hack Western 12");
  });
  test("includes the unsubscribe link", () => {
    expect(html).toContain("https://hackwestern.com/api/unsubscribe?token=abc");
    expect(html.toLowerCase()).toContain(">unsubscribe<");
  });
  test("does not contain a postal address block", () => {
    expect(html).not.toMatch(/\bN6A\b/); // Western's postal code, sanity guard
  });
});
