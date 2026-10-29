import { describe, expect, it } from "vitest";
import {
  canShow,
  cardInput,
  cleanCard,
  displayName,
  schoolLabel,
  yearLabel,
} from "./team-finder";

const base = {
  needs: null,
  skills: [],
  firstHackathon: false,
  lookingFor: "a designer",
  idea: "",
  showSchool: true,
  showYear: true,
  contacts: {},
  shown: true,
};

describe("cardInput", () => {
  it("accepts a valid card and trims strings", () => {
    const r = cardInput.parse({ ...base, lookingFor: "  hi  " });
    expect(r.lookingFor).toBe("hi");
  });

  it.each([
    ["4 skills", { skills: ["Frontend", "Backend", "Design", "Mobile"] }],
    ["unknown skill", { skills: ["Cooking"] }],
    ["duplicate skills", { skills: ["Design", "Design"] }],
    ["needs 3", { needs: 3 }],
    ["101-char lookingFor", { lookingFor: "a".repeat(101) }],
  ])("rejects %s", (_name, patch) => {
    expect(cardInput.safeParse({ ...base, ...patch }).success).toBe(false);
  });
});

describe("cleanCard", () => {
  it("normalizes contacts and drops hinted ones", () => {
    const c = cleanCard(
      cardInput.parse({
        ...base,
        contacts: {
          discord: "  @Maya.P  ",
          linkedin: "https://www.linkedin.com/in/maya-p/?utm_source=x",
          instagram: "https://github.com/maya",
        },
      }),
    );
    expect(c.contacts.discord).toBe("maya.p");
    expect(c.contacts.linkedin).toBe("maya-p");
    expect(c.contacts.instagram).toBeNull();
  });

  it("turns an empty idea into null", () => {
    expect(
      cleanCard(cardInput.parse({ ...base, idea: "   " })).idea,
    ).toBeNull();
  });
});

describe("canShow", () => {
  it("is false without lookingFor", () => {
    expect(canShow({ lookingFor: "", contacts: { phone: "5195551234" } })).toBe(
      false,
    );
  });
  it("is false with only LinkedIn/GitHub", () => {
    expect(
      canShow({ lookingFor: "x", contacts: { linkedin: "a", github: "b" } }),
    ).toBe(false);
  });
  it("is true with lookingFor and a phone", () => {
    expect(
      canShow({ lookingFor: "x", contacts: { phone: "5195551234" } }),
    ).toBe(true);
  });
});

describe("labels", () => {
  it("formats names", () => {
    expect(displayName("John", "Doe")).toBe("John D.");
    expect(displayName("John", null)).toBe("John");
  });
  it("formats years", () => {
    expect(yearLabel("2nd")).toBe("2nd year");
    expect(yearLabel("5th+")).toBe("5th+ year");
    expect(yearLabel("Prefer not to answer")).toBeUndefined();
    expect(yearLabel("N/A")).toBeUndefined();
    expect(yearLabel(null)).toBeUndefined();
  });
  it("formats schools", () => {
    expect(schoolLabel("Other", "Fanshawe College")).toBe("Fanshawe College");
    expect(schoolLabel("Western", null)).toBe("Western");
    expect(schoolLabel(null, null)).toBeUndefined();
  });
});
