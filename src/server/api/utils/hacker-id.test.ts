import { describe, expect, test, vi } from "vitest";
import { eq } from "drizzle-orm";
import type * as Crypto from "crypto";

import { db } from "~/server/db";
import { mockSession } from "~/server/auth";
import { users } from "~/server/db/schema";
import {
  ADJECTIVES,
  ANIMALS,
  THINGS,
  generateHackerId,
  getOrCreateHackerId,
  looksLikeHackerId,
  normalizeHackerId,
  resolveScannedUserId,
} from "./hacker-id";

// Lets a test force the next random picks; otherwise real randomness.
const forcedPicks: number[] = [];
vi.mock("crypto", async (importOriginal) => {
  const original = await importOriginal<typeof Crypto>();
  return {
    ...original,
    randomInt: (max: number) => forcedPicks.shift() ?? original.randomInt(max),
  };
});

describe("word lists", () => {
  test("letters only, no word in two lists, at least 100 each", () => {
    const all = [...ADJECTIVES, ...ANIMALS, ...THINGS];
    expect(all.every((w) => /^[a-z]+$/.test(w))).toBe(true);
    expect(new Set(all).size).toBe(all.length);
    for (const list of [ADJECTIVES, ANIMALS, THINGS]) {
      expect(list.length).toBeGreaterThanOrEqual(100);
    }
  });
});

describe("generateHackerId", () => {
  test("adjective-animal-thing, in that order", () => {
    const [a, b, c] = generateHackerId().split("-");
    expect(ADJECTIVES).toContain(a);
    expect(ANIMALS).toContain(b);
    expect(THINGS).toContain(c);
  });
});

describe("normalizeHackerId / looksLikeHackerId", () => {
  test("accepts any case and separator", () => {
    expect(normalizeHackerId("  Brave Otter_Kite ")).toBe("brave-otter-kite");
    expect(looksLikeHackerId("brave-otter-kite")).toBe(true);
    expect(looksLikeHackerId("Brave Otter_Kite")).toBe(true);
  });

  test("a UUID user.id never looks like a hacker ID", () => {
    expect(looksLikeHackerId("3f2a9c1e-5b7d-4e8a-9c21-7d4e5f6a8b90")).toBe(
      false,
    );
    expect(looksLikeHackerId("brave-otter")).toBe(false);
  });
});

describe("getOrCreateHackerId", () => {
  test("creates once, then returns the same ID", async () => {
    const { user } = await mockSession(db);
    const first = await getOrCreateHackerId(user.id);
    expect(await getOrCreateHackerId(user.id)).toBe(first);

    const row = await db.query.users.findFirst({
      where: eq(users.id, user.id),
    });
    expect(row?.hackerId).toBe(first);
  });

  test("retries when the generated ID is taken", async () => {
    const taken = await mockSession(db);
    const fresh = await mockSession(db);
    await db
      .update(users)
      .set({ hackerId: "bold-alpaca-anchor" })
      .where(eq(users.id, taken.user.id));

    // First attempt collides (index 0 of each list), second gets index 1.
    forcedPicks.push(0, 0, 0, 1, 1, 1);
    expect(await getOrCreateHackerId(fresh.user.id)).toBe("brave-badger-apple");
  });

  test("throws for an unknown user", async () => {
    await expect(getOrCreateHackerId("no-such-user")).rejects.toThrow();
  });
});

describe("resolveScannedUserId", () => {
  test("maps a hacker ID (any case or separator) to user.id", async () => {
    const { user } = await mockSession(db);
    const hackerId = await getOrCreateHackerId(user.id);
    expect(await resolveScannedUserId(hackerId)).toBe(user.id);
    expect(
      await resolveScannedUserId(hackerId.toUpperCase().replace(/-/g, " ")),
    ).toBe(user.id);
  });

  test("passes a user.id or an unknown ID through unchanged", async () => {
    const { user } = await mockSession(db);
    expect(await resolveScannedUserId(user.id)).toBe(user.id);
    expect(await resolveScannedUserId("calm-yak-zipper")).toBe(
      "calm-yak-zipper",
    );
  });
});
