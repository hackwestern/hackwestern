import { randomInt } from "crypto";
import { and, eq, isNull } from "drizzle-orm";

import { db } from "~/server/db";
import { users } from "~/server/db/schema";

/**
 * Public hacker IDs are three words, one from each list in order:
 * adjective-animal-thing (e.g. "brave-otter-kite"). Each word belongs to
 * exactly one list, so a parser can pick IDs out of free text by position.
 * About 1M combinations; only confirmed hackers get one.
 */
export const ADJECTIVES = [
  "bold", "brave", "breezy", "bright", "brisk", "bubbly", "calm", "cheery",
  "chill", "clever", "cool", "cosmic", "cozy", "crisp", "cuddly", "curious",
  "dapper", "daring", "dreamy", "eager", "epic", "fancy", "fearless", "fluffy",
  "fresh", "friendly", "frosty", "funky", "gentle", "giant", "glad", "gleaming",
  "golden", "grand", "groovy", "happy", "hardy", "hearty", "honest", "humble",
  "jazzy", "jolly", "keen", "kind", "lively", "lucky", "lunar", "magic",
  "mellow", "merry", "mighty", "misty", "modern", "nimble", "noble", "peppy",
  "perky", "plucky", "polar", "polite", "proud", "quick", "quiet", "radiant",
  "rapid", "ready", "regal", "royal", "rustic", "shiny", "silent", "silver",
  "sleek", "smart", "smooth", "snappy", "snowy", "solar", "sonic", "sparkly",
  "speedy", "spicy", "steady", "stormy", "sunny", "super", "swift", "tidy",
  "tiny", "trusty", "turbo", "upbeat", "valiant", "vivid", "warm", "wavy",
  "wild", "windy", "wise", "witty", "zany", "zesty", "zippy",
] as const;

export const ANIMALS = [
  "alpaca", "badger", "bear", "beaver", "bee", "bison", "bunny", "camel",
  "cheetah", "condor", "coyote", "crab", "crane", "cricket", "deer", "dingo",
  "dolphin", "duck", "eagle", "elk", "emu", "falcon", "ferret", "finch", "fox",
  "gazelle", "gecko", "giraffe", "goose", "gopher", "gull", "hamster", "hawk",
  "hedgehog", "heron", "hippo", "horse", "ibis", "iguana", "jaguar", "kestrel",
  "kiwi", "koala", "koi", "ladybug", "lark", "lemur", "leopard", "lion",
  "llama", "lobster", "lynx", "magpie", "mantis", "marmot", "meerkat", "mole",
  "mongoose", "moose", "moth", "mustang", "narwhal", "newt", "ocelot",
  "octopus", "orca", "osprey", "ostrich", "otter", "owl", "panda", "panther",
  "parrot", "pelican", "penguin", "pony", "puffin", "puma", "quail", "rabbit",
  "raccoon", "raven", "robin", "salmon", "seal", "shark", "sloth", "sparrow",
  "squid", "starling", "stork", "swan", "tapir", "tiger", "tortoise",
  "toucan", "trout", "turtle", "walrus", "wolf", "wombat", "wren", "yak",
  "zebra",
] as const;

export const THINGS = [
  "anchor", "apple", "arrow", "bagel", "balloon", "banjo", "basket", "beacon",
  "bell", "berry", "biscuit", "blanket", "boat", "bucket", "button", "cactus",
  "camera", "candle", "canoe", "castle", "cherry", "cloud", "comet", "compass",
  "cookie", "crayon", "crown", "cupcake", "dice", "donut", "drum", "feather",
  "fiddle", "flag", "flute", "gadget", "garden", "guitar", "hammer", "harbor",
  "helmet", "honey", "igloo", "island", "jacket", "jelly", "kettle", "kite",
  "ladder", "lantern", "lemon", "magnet", "mango", "maple", "marble", "meadow",
  "mitten", "moon", "muffin", "nacho", "noodle", "nugget", "oak", "orbit",
  "paddle", "pancake", "peach", "pebble", "pencil", "pepper", "piano",
  "pickle", "pillow", "pine", "planet", "pocket", "pretzel", "pumpkin",
  "puzzle", "quilt", "radar", "radio", "rainbow", "river", "robot", "rocket",
  "saddle", "sail", "scarf", "shell", "sled", "sock", "spoon", "sprout",
  "star", "sundae", "taco", "teapot", "tent", "ticket", "tide", "toast",
  "tower", "trumpet", "tuba", "tulip", "umbrella", "violin", "waffle",
  "wagon", "whistle", "window", "yarn", "zipper",
] as const;

// Three letter-only words split by dashes, spaces or underscores. A user.id
// (a UUID, so it has digits) never matches.
const SHAPE = /^[a-z]+[-_\s]+[a-z]+[-_\s]+[a-z]+$/i;

const pick = <T>(list: readonly T[]): T => list[randomInt(list.length)]!;

export function generateHackerId(): string {
  return `${pick(ADJECTIVES)}-${pick(ANIMALS)}-${pick(THINGS)}`;
}

/** "  Brave Otter_Kite " -> "brave-otter-kite". */
export function normalizeHackerId(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function looksLikeHackerId(raw: string): boolean {
  return SHAPE.test(raw.trim());
}

/** Postgres `unique_violation`, however the driver chose to surface it. */
function isUniqueViolation(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  if ((error as { code?: unknown }).code === "23505") return true;
  const cause = (error as { cause?: unknown }).cause;
  return !!cause && (cause as { code?: unknown }).code === "23505";
}

/**
 * Returns the user's hacker ID, creating one if they don't have it yet.
 * Never replaces an existing ID. Retries on the rare collision.
 */
export async function getOrCreateHackerId(userId: string): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { hackerId: true },
    });
    if (!user) throw new Error(`User ${userId} not found`);
    if (user.hackerId) return user.hackerId;

    try {
      const [row] = await db
        .update(users)
        .set({ hackerId: generateHackerId() })
        .where(and(eq(users.id, userId), isNull(users.hackerId)))
        .returning({ hackerId: users.hackerId });
      if (row?.hackerId) return row.hackerId;
      // Set concurrently by someone else: the next read returns it.
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;
    }
  }
  throw new Error(`Could not assign a hacker ID to user ${userId}`);
}

/**
 * Scanners pass whatever the QR held: the hacker ID on printed QRs, user.id on
 * the app's own QR. Returns the user.id for either, or the input unchanged
 * when nothing matches (callers keep their own not-found handling).
 */
export async function resolveScannedUserId(scanned: string): Promise<string> {
  if (!looksLikeHackerId(scanned)) return scanned;
  const user = await db.query.users.findFirst({
    where: eq(users.hackerId, normalizeHackerId(scanned)),
    columns: { id: true },
  });
  return user?.id ?? scanned;
}
