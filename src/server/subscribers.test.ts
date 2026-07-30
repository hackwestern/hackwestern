import { describe, expect, test } from "vitest";
import {
  normalizeEmail,
  isSchoolEmail,
  generateUnsubscribeToken,
  editionFromSource,
} from "./subscribers";

describe("normalizeEmail", () => {
  test("trims + lowercases", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
  });
  test("canonicalizes gmail dots and +tags", () => {
    expect(normalizeEmail("john.doe+hw@gmail.com")).toBe("johndoe@gmail.com");
    expect(normalizeEmail("JohnDoe@googlemail.com")).toBe("johndoe@googlemail.com");
  });
  test("leaves non-gmail local part intact", () => {
    expect(normalizeEmail("john.doe@outlook.com")).toBe("john.doe@outlook.com");
  });
});

describe("isSchoolEmail", () => {
  test.each([
    ["a@smith.edu", true],
    ["b@uwo.ca", true],
    ["c@mail.utoronto.ca", true],
    ["d@uwaterloo.ca", true],
    ["e@ox.ac.uk", true],
    ["f@gmail.com", false],
    ["g@autodesk.com", false],
  ])("%s -> %s", (email, expected) => {
    expect(isSchoolEmail(email)).toBe(expected);
  });
});

describe("generateUnsubscribeToken", () => {
  test("returns 40-char hex, unique per call", () => {
    const a = generateUnsubscribeToken();
    const b = generateUnsubscribeToken();
    expect(a).toMatch(/^[0-9a-f]{40}$/);
    expect(a).not.toBe(b);
  });
});

describe("editionFromSource", () => {
  test.each([
    ["hw11", "11"],
    ["hw12", "12"],
  ])("%s -> %s", (s, e) => expect(editionFromSource(s)).toBe(e));
});
