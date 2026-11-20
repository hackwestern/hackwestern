import { describe, expect, test } from "vitest";

import type { RankedInterestRow } from "~/server/api/utils/hacker-interest";
import {
  candidatesFromInterestForm,
  type CandidateProfile,
} from "~/server/api/utils/sponsor-shortlist";

const ranked = (email: string, name: string, pick = 1): RankedInterestRow => ({
  email,
  name,
  resumeUrl: "drive.google.com/form-resume",
  extraLink: "https://portfolio.example.com",
  pick,
});

const profile = (
  userId: string,
  email: string,
  share: boolean | null,
): CandidateProfile => ({
  userId,
  email,
  hackerId: `hk-${userId}`,
  firstName: "Ada",
  lastName: "Lovelace",
  accountName: "Ada L",
  share,
  team: "Analytical Engines",
  resume: "https://files.example.com/app-resume.pdf",
  github: "github.com/ada",
  linkedIn: "https://linkedin.com/in/ada",
  devpost: "javascript:alert(1)",
});

describe("candidatesFromInterestForm", () => {
  test("maps each email to its user id, keeps the ranking order and numbers it", () => {
    const list = candidatesFromInterestForm(
      [
        ranked("b@x.ca", "Bee"),
        ranked("nobody@x.ca", "No Account"),
        ranked("a@x.ca", "Ay", 3),
      ],
      [profile("user-a", "a@x.ca", true), profile("user-b", "B@X.ca ", true)],
    );
    expect(list.map((h) => [h.userId, h.rank, h.pick])).toEqual([
      ["user-b", 1, 1],
      // The row with no admitted account is dropped; ranks close up.
      ["user-a", 2, 3],
    ]);
  });

  test("cuts to 40 after dropping rows with no admitted account", () => {
    const rows = Array.from({ length: 45 }, (_, i) =>
      ranked(`h${i}@x.ca`, `H${i}`),
    );
    // The top 5 aren't admitted (no profile comes back for them).
    const profiles = rows
      .slice(5)
      .map((r, i) => profile(`user-${i + 5}`, r.email, true));
    const list = candidatesFromInterestForm(rows, profiles);
    expect(list).toHaveLength(40);
    expect(list[0]).toMatchObject({ userId: "user-5", rank: 1 });
    expect(list[39]).toMatchObject({ userId: "user-44", rank: 40 });
  });

  test("full profile for hackers who agreed to share", () => {
    const [h] = candidatesFromInterestForm(
      [ranked("a@x.ca", "Form Name")],
      [profile("user-a", "a@x.ca", true)],
    );
    expect(h).toMatchObject({
      name: "Ada Lovelace",
      shared: true,
      hackerId: "hk-user-a",
      team: "Analytical Engines",
      // The form's resume (submitted for sponsors) wins over the application's.
      resume: "https://drive.google.com/form-resume",
      github: "https://github.com/ada",
      linkedIn: "https://linkedin.com/in/ada",
      // Unsafe links never reach an href.
      devpost: null,
      extraLink: "https://portfolio.example.com/",
    });
  });

  test("first name and form links only for hackers who didn't share", () => {
    for (const share of [false, null]) {
      const [h] = candidatesFromInterestForm(
        [ranked("a@x.ca", "Form Name")],
        [profile("user-a", "a@x.ca", share)],
      );
      expect(h).toEqual({
        userId: "user-a",
        rank: 1,
        pick: 1,
        hackerId: null,
        name: "Ada",
        shared: false,
        team: null,
        resume: "https://drive.google.com/form-resume",
        github: null,
        linkedIn: null,
        devpost: null,
        extraLink: "https://portfolio.example.com/",
      });
    }
  });

  test("never returns an email", () => {
    const list = candidatesFromInterestForm(
      [ranked("secret@x.ca", "S"), ranked("other@x.ca", "O")],
      [profile("u1", "secret@x.ca", true), profile("u2", "other@x.ca", false)],
    );
    expect(JSON.stringify(list)).not.toContain("@");
  });
});
