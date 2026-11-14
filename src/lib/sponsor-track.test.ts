import { describe, expect, test } from "vitest";

import { trackEnum } from "~/server/db/schema";
import { TRACK_VALUES, normalizeSponsorTrack } from "~/lib/sponsor-track";

describe("normalizeSponsorTrack", () => {
  test("accepts every track value exactly", () => {
    for (const track of TRACK_VALUES) {
      expect(normalizeSponsorTrack(track)).toBe(track);
    }
  });

  test("case and whitespace insensitive", () => {
    expect(normalizeSponsorTrack("  best use of cohere ")).toBe(
      "Best Use of Cohere",
    );
    expect(normalizeSponsorTrack("GENERAL")).toBe("General");
  });

  test("strips invisible chars before matching", () => {
    expect(normalizeSponsorTrack("Best Domain\u202c")).toBe("Best Domain");
  });

  test("empty stays null", () => {
    expect(normalizeSponsorTrack(undefined)).toBeNull();
    expect(normalizeSponsorTrack("   ")).toBeNull();
    expect(normalizeSponsorTrack("")).toBeNull();
  });

  test("unrecognized values stay null (no partial matches)", () => {
    expect(normalizeSponsorTrack("Best Track")).toBeNull();
    expect(normalizeSponsorTrack("Cohere")).toBeNull();
  });
});

describe("TRACK_VALUES", () => {
  test("stays in step with the track pgEnum", () => {
    expect([...TRACK_VALUES].sort()).toEqual([...trackEnum.enumValues].sort());
  });
});
