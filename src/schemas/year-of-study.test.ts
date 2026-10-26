import { describe, expect, test } from "vitest";
import {
  applicationSaveSchema,
  isValidYearOfStudy,
  YEAR_OF_STUDY_OPTIONS,
} from "./application";

describe("year of study", () => {
  test("only real years can be picked and submitted", () => {
    expect(YEAR_OF_STUDY_OPTIONS).toEqual(["1st", "2nd", "3rd", "4th", "5th+"]);
    for (const year of YEAR_OF_STUDY_OPTIONS)
      expect(isValidYearOfStudy(year)).toBe(true);
  });

  test("N/A, prefer not to answer and blank are not a year", () => {
    expect(isValidYearOfStudy("N/A")).toBe(false);
    expect(isValidYearOfStudy("Prefer not to answer")).toBe(false);
    expect(isValidYearOfStudy(null)).toBe(false);
    expect(isValidYearOfStudy(undefined)).toBe(false);
  });
});

// application.save upserts every key it gets, so anything only the server
// writes has to be dropped before it reaches the resolver.
describe("application save", () => {
  test("drops status and the enrollment attestation from client input", () => {
    const input = applicationSaveSchema.parse({
      firstName: "Ada",
      status: "CONFIRMED",
      enrollmentConfirmedAt: new Date(),
    });
    expect(input).not.toHaveProperty("status");
    expect(input).not.toHaveProperty("enrollmentConfirmedAt");
    expect(input).toHaveProperty("firstName", "Ada");
  });
});
