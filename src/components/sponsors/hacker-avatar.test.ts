import { describe, expect, it } from "vitest";
import { githubUsername, initialsOf } from "./hacker-avatar";

describe("githubUsername", () => {
  it.each([
    ["https://github.com/octocat", "octocat"],
    ["https://www.github.com/octo-cat/", "octo-cat"],
    ["http://github.com/octocat?tab=repositories", "octocat"],
    ["github.com/octocat/hello-world", "octocat"],
    ["  GitHub.com/Octocat  ", "Octocat"],
    ["@octocat", "octocat"],
    ["octocat", "octocat"],
    ["a".repeat(39), "a".repeat(39)],
  ])("reads %s", (input, expected) => {
    expect(githubUsername(input)).toBe(expected);
  });

  it.each([
    null,
    undefined,
    "",
    "   ",
    "a".repeat(40),
    "https://evil.example.com/octocat",
    "https://github.com.evil.example/octocat",
    "https://evil.example/?u=github.com/octocat",
    "https://user:pass@github.com/octocat",
    "https://github.com:8443/octocat",
    "javascript:alert(1)",
    "ftp://github.com/octocat",
    "https://github.com/",
    "https://github.com/oct_ocat",
    "https://github.com/%2e%2e",
    "octo cat",
    "octo.cat",
  ])("rejects %s", (input) => {
    expect(githubUsername(input)).toBeNull();
  });
});

describe("initialsOf", () => {
  it("takes the first and last word", () => {
    expect(initialsOf("Maximiliana Alexandria Featherstonehaugh")).toBe("MF");
  });
  it("handles one word, accents, emoji and blanks", () => {
    expect(initialsOf("li")).toBe("L");
    expect(initialsOf("zoë ångström")).toBe("ZÅ");
    expect(initialsOf("🦊 Fox")).toBe("🦊F");
    expect(initialsOf("  ")).toBe("");
    expect(initialsOf(null)).toBe("");
  });
});
