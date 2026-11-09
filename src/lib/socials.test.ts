import { describe, expect, it } from "vitest";
import {
  canBeMessaged,
  contactHref,
  formatPhone,
  normalizeContact,
  normalizeContacts,
} from "./socials";

const value = (...args: Parameters<typeof normalizeContact>) =>
  normalizeContact(...args).value;

describe("normalizeContact: every kind", () => {
  it("trims and drops invisible characters", () => {
    expect(value("github", "  maya​ ")).toBe("maya");
    expect(value("instagram", "﻿@maya.codes‍")).toBe("maya.codes");
    expect(value("discord", "⁠maya­")).toBe("maya");
  });

  it("never refuses a value for inner whitespace", () => {
    expect(value("github", "ma ya")).toBe("maya");
    expect(value("linkedin", " linkedin.com/in/ maya-p ")).toBe("maya-p");
    expect(value("phone", " 519 555 0142 ")).toBe("(519) 555-0142");
  });

  it("is empty for blank or invisible-only input", () => {
    expect(normalizeContact("github", "   ​ ")).toEqual({ value: "" });
    expect(normalizeContact("phone", undefined)).toEqual({ value: "" });
  });
});

describe("normalizeContact: LinkedIn", () => {
  it.each([
    ["linkedin.com/in/maya-p", "maya-p"],
    ["https://www.linkedin.com/in/maya-p/", "maya-p"],
    ["https://ca.linkedin.com/in/maya-p", "maya-p"],
    ["https://m.linkedin.com/in/maya-p/", "maya-p"],
    ["linkedin.com/in/maya-p/?utm_source=share&utm_medium=member", "maya-p"],
    ["https://www.linkedin.com/in/maya-p?originalSubdomain=ca", "maya-p"],
    ["@maya-p", "maya-p"],
    ["maya-p", "maya-p"],
    ["linkedin.com/in/jos%C3%A9-r", "josé-r"],
    ["jos%C3%A9-r", "josé-r"],
  ])("%s → %s", (raw, out) => {
    expect(normalizeContact("linkedin", raw)).toEqual({ value: out });
  });

  it("hints on a LinkedIn link that isn't a profile", () => {
    const r = normalizeContact("linkedin", "linkedin.com/company/acme");
    expect(r.value).toBe("linkedin.com/company/acme");
    expect(r.hint).toMatch(/linkedin\.com\/in/);
  });
});

describe("normalizeContact: GitHub", () => {
  it.each([
    ["github.com/maya", "maya"],
    ["https://github.com/maya/some-repo", "maya"],
    ["https://github.com/maya/some-repo/tree/main?tab=readme", "maya"],
    ["@maya", "maya"],
    ["maya", "maya"],
  ])("%s → %s", (raw, out) => {
    expect(normalizeContact("github", raw)).toEqual({ value: out });
  });
});

describe("normalizeContact: Instagram", () => {
  it.each([
    ["instagram.com/maya.codes/", "maya.codes"],
    ["https://www.instagram.com/maya.codes?igsh=MTd3bXN5", "maya.codes"],
    ["https://instagram.com/maya.codes/?igsh=abc&utm_source=qr", "maya.codes"],
    ["@maya.codes", "maya.codes"],
    ["maya.codes", "maya.codes"],
  ])("%s → %s", (raw, out) => {
    expect(normalizeContact("instagram", raw)).toEqual({ value: out });
  });

  it("hints on a post link", () => {
    const r = normalizeContact("instagram", "https://instagram.com/p/C1abc/");
    expect(r.value).toBe("https://instagram.com/p/C1abc/");
    expect(r.hint).toBeDefined();
  });
});

describe("normalizeContact: Discord", () => {
  it.each([
    ["@Maya.P", "maya.p"],
    ["MAYA_codes", "maya_codes"],
    [
      "maximilianna.josephine.wilberforce",
      "maximilianna.josephine.wilberforce",
    ],
  ])("%s → %s", (raw, out) => {
    expect(normalizeContact("discord", raw)).toEqual({ value: out });
  });

  it("asks to check a value that had spaces inside (a display name?)", () => {
    expect(normalizeContact("discord", "@ John Doe")).toEqual({
      value: "johndoe",
      note: "Check this is your Discord username, not your display name.",
    });
    expect(normalizeContact("discord", "  maya p  ").value).toBe("mayap");
    // Padding alone isn't a display name.
    expect(normalizeContact("discord", "  @maya  ")).toEqual({ value: "maya" });
  });

  it("still counts a display-name-looking value for readiness", () => {
    expect(canBeMessaged({ discord: "@ John Doe" })).toBe(true);
  });

  it("hints on a link instead of a username", () => {
    const r = normalizeContact("discord", "https://discord.com/users/123");
    expect(r.value).toBe("https://discord.com/users/123");
    expect(r.hint).toBeDefined();
  });
});

describe("normalizeContact: phone", () => {
  it.each([
    ["5195550142", "(519) 555-0142"],
    ["(519) 555-0142", "(519) 555-0142"],
    ["519.555.0142", "(519) 555-0142"],
    ["+1 519 555 0142", "+1 (519) 555-0142"],
    ["1-519-555-0142", "+1 (519) 555-0142"],
    ["+44 20 7946 0958", "+442079460958"],
  ])("%s → %s", (raw, out) => {
    expect(normalizeContact("phone", raw)).toEqual({ value: out });
  });

  it("keeps only digits and a leading +", () => {
    expect(formatPhone("tel: 519-555-0142 ext")).toBe("(519) 555-0142");
    expect(formatPhone("abc")).toBe("");
  });
});

describe("normalizeContact: a link for the wrong site", () => {
  it("keeps what they typed and hints, without guessing", () => {
    const r = normalizeContact("linkedin", "  https://github.com/maya ");
    expect(r.value).toBe("https://github.com/maya");
    expect(r.hint).toBe(
      "That looks like a GitHub link. Add your LinkedIn instead.",
    );
    expect(normalizeContact("github", "instagram.com/maya").hint).toMatch(
      /Instagram link/,
    );
    expect(normalizeContact("instagram", "https://example.com/maya").hint).toBe(
      "That link isn't from Instagram.",
    );
  });
});

describe("contactHref", () => {
  it("builds links from the cleaned handle", () => {
    expect(contactHref("linkedin", "josé-r")).toBe(
      "https://www.linkedin.com/in/jos%C3%A9-r",
    );
    expect(contactHref("github", "maya")).toBe("https://github.com/maya");
    expect(contactHref("instagram", "maya.codes")).toBe(
      "https://instagram.com/maya.codes",
    );
    expect(contactHref("phone", "+1 (519) 555-0142")).toBe("tel:+15195550142");
    expect(contactHref("discord", "maya")).toBeUndefined();
  });
});

describe("normalizeContacts", () => {
  it("cleans every value and drops empty ones", () => {
    expect(
      normalizeContacts({
        discord: "  @Maya ",
        github: "https://github.com/maya/repo",
        instagram: "   ",
      }),
    ).toEqual({ discord: "maya", github: "maya" });
  });
});

describe("canBeMessaged (readiness)", () => {
  it("counts a padded Discord handle", () => {
    expect(canBeMessaged({ discord: "  @maya  " })).toBe(true);
  });

  it("counts Instagram or a phone number", () => {
    expect(canBeMessaged({ instagram: "instagram.com/maya/" })).toBe(true);
    expect(canBeMessaged({ phone: " 519 555 0142 " })).toBe(true);
  });

  it("doesn't count GitHub, LinkedIn, blanks or a value with a hint", () => {
    expect(canBeMessaged({ github: "maya", linkedin: "maya" })).toBe(false);
    expect(canBeMessaged({ discord: " ​ " })).toBe(false);
    expect(canBeMessaged({ instagram: "https://github.com/maya" })).toBe(false);
  });
});
