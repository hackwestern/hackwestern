/**
 * Dev seed for the organizer coffee chat board (/internal/sponsors?tab=coffee).
 *
 *   DATABASE_URL=postgresql://...localhost.../hackwestern_spon SKIP_ENV_VALIDATION=1 \
 *     npx tsx src/server/db/seed/coffee-chat-sessions.ts
 *
 * Replaces the coffee chat preferences, reps, availability, placements and
 * room bookings with the organizer-coffee-v8 mock's demo data for the
 * registered local sponsors (Canada Life, Sun Life, StarTech, Scotiabank,
 * CSE submitted; Commure not), each rep with their own wanted chats.
 * Phones are fake 555-01xx numbers. One
 * "Mentors" booking holds Rm 2241 at 1-2, so Scotiabank's three reps (free
 * only at 1-2) can't all fit near the Sponsor Bay: the demo suggested fix.
 * Localhost only.
 */
import { inArray } from "drizzle-orm";
import { conn, db } from "..";
import {
  coffeeChatPlacements,
  coffeeChatPrefs,
  coffeeChatRepSessions,
  coffeeChatReps,
  coffeeChatRoomBookings,
  sponsorJudgingSponsors,
} from "../schema";

if (!process.env.DATABASE_URL?.includes("localhost")) {
  console.error("Seed script must only be run on localhost.");
  process.exit(1);
}

type Rep = { name: string; phone: string; chats: number; free: string[] };
type Seed = {
  name: string;
  prefs: { hackersPerChat: number; longerOneOnOne: boolean } | null;
  /** The first rep is the primary contact. */
  reps: Rep[];
};

const SEED: Seed[] = [
  {
    name: "Sun Life",
    prefs: { hackersPerChat: 3, longerOneOnOne: false },
    reps: [
      // 2-3 is inside Sun Life's workshop window: the scheduler ignores it.
      { name: "Dana W.", phone: "5195550101", chats: 4, free: ["10", "11", "14", "16"] },
      { name: "Jasmine L.", phone: "5195550102", chats: 4, free: ["11", "16"] },
      { name: "Kevin T.", phone: "5195550103", chats: 3, free: ["11", "16"] },
    ],
  },
  {
    name: "Canada Life",
    prefs: { hackersPerChat: 1, longerOneOnOne: false },
    reps: [
      { name: "Priya S.", phone: "5195550104", chats: 4, free: ["10", "11"] },
      { name: "Omar H.", phone: "5195550105", chats: 3, free: ["11", "15"] },
    ],
  },
  {
    name: "StarTech",
    prefs: { hackersPerChat: 1, longerOneOnOne: true },
    reps: [
      { name: "Lena M.", phone: "5195550106", chats: 4, free: ["11", "14"] },
      { name: "Raj P.", phone: "5195550107", chats: 3, free: ["14", "15", "16"] },
    ],
  },
  {
    name: "Scotiabank",
    prefs: { hackersPerChat: 2, longerOneOnOne: false },
    reps: [
      { name: "Marcus O.", phone: "5195550108", chats: 2, free: ["13"] },
      { name: "Aisha K.", phone: "5195550109", chats: 2, free: ["13"] },
      { name: "Ben C.", phone: "5195550110", chats: 2, free: ["13"] },
    ],
  },
  {
    name: "Commure",
    prefs: null,
    reps: [
      { name: "Alex F.", phone: "5195550113", chats: 1, free: [] },
      { name: "Nina P.", phone: "5195550114", chats: 1, free: [] },
    ],
  },
  {
    name: "CSE",
    prefs: { hackersPerChat: 5, longerOneOnOne: false },
    reps: [
      { name: "Chris D.", phone: "5195550115", chats: 6, free: ["11", "14", "15", "16"] },
      { name: "Mei Z.", phone: "5195550116", chats: 6, free: ["14", "15", "16"] },
      {
        name: "Alexandra Montgomery-Fitzgerald",
        phone: "5195550117",
        chats: 6,
        free: ["15", "16"],
      },
    ],
  },
];

const sponsors = await db
  .select({ id: sponsorJudgingSponsors.id, name: sponsorJudgingSponsors.name })
  .from(sponsorJudgingSponsors)
  .where(inArray(sponsorJudgingSponsors.name, SEED.map((s) => s.name)));
const idOf = new Map(sponsors.map((s) => [s.name, s.id]));
const missing = SEED.filter((s) => !idOf.has(s.name)).map((s) => s.name);
if (missing.length) console.warn(`Not registered locally, skipped: ${missing.join(", ")}`);

await db.transaction(async (tx) => {
  const ids = [...idOf.values()];
  // The board is shared, so clear it all: placements, then bookings.
  await tx.delete(coffeeChatPlacements);
  await tx.delete(coffeeChatRoomBookings);
  if (ids.length) {
    await tx.delete(coffeeChatReps).where(inArray(coffeeChatReps.sponsorId, ids));
    await tx.delete(coffeeChatPrefs).where(inArray(coffeeChatPrefs.sponsorId, ids));
  }
  const now = new Date();
  for (const s of SEED) {
    const sponsorId = idOf.get(s.name);
    if (!sponsorId) continue;
    if (s.prefs) {
      await tx.insert(coffeeChatPrefs).values({ sponsorId, ...s.prefs, submittedAt: now });
    }
    for (const [i, r] of s.reps.entries()) {
      const [row] = await tx
        .insert(coffeeChatReps)
        .values({ sponsorId, name: r.name, phone: r.phone, chatsWanted: r.chats, isPrimary: i === 0, position: i })
        .returning({ id: coffeeChatReps.id });
      if (row && r.free.length) {
        await tx
          .insert(coffeeChatRepSessions)
          .values(r.free.map((sessionId) => ({ repId: row.id, sessionId })));
      }
    }
  }
  await tx.insert(coffeeChatRoomBookings).values({
    sessionId: "13",
    room: "2241",
    label: "Mentors",
    note: "Resume reviews",
  });
});

console.log(`Seeded coffee chat sessions for ${idOf.size} sponsors.`);
await conn.end();
