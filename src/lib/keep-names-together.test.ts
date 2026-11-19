import { describe, expect, test } from "vitest";
import { keepNamesTogether } from "~/lib/keep-names-together";

describe("keepNamesTogether", () => {
  test("joins the words of a known company name", () => {
    expect(keepNamesTogether("Canada Life Workshop")).toBe("Canada\u00A0Life Workshop");
  });
  test("joins an extra name, like the viewer's company", () => {
    expect(keepNamesTogether("Add each rep from Test Sponsor.", ["Test Sponsor"])).toBe(
      "Add each rep from Test\u00A0Sponsor.",
    );
  });
  test("leaves other text alone", () => {
    expect(keepNamesTogether("Lunch in the Grand Hall", [null])).toBe("Lunch in the Grand Hall");
  });
});
