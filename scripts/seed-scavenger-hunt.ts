import { isNull } from "drizzle-orm";
import { db } from "~/server/db";
import { scavengerHuntItems, scavengerHuntRewards } from "~/server/db/schema";
import { HACKATHON_END, HACKATHON_START } from "~/lib/date";

// Adds the Hack Western 12 scavenger hunt tasks and prizes.
// Dry run unless --apply. Skips any task or prize whose name already exists,
// so it is safe to run again.
//
//   npx dotenv tsx scripts/seed-scavenger-hunt.ts [--apply]

type Item = Pick<
  typeof scavengerHuntItems.$inferInsert,
  "name" | "points" | "type" | "winPoints"
>;
type Reward = Pick<
  typeof scavengerHuntRewards.$inferInsert,
  "name" | "costPoints" | "quantity"
>;

const task = (name: string, points: number): Item => ({
  name,
  points,
  type: "bonus",
});

// Hackers get the attendance points for taking part and the win points for winning
const game = (name: string): Item => ({
  name,
  points: 10,
  type: "activity",
  winPoints: 50,
});

export const ITEMS: Item[] = [
  task("Take a hacking picture", 3),
  task("Snipe an organizer", 5),
  task("Take a picture with the Hack Western horse", 5),
  task("Grab a bubble tea at the Friday late night snack", 5),
  task("High five Andy Liu (OpenAI Campus Ambassador)", 10),
  task("Down 2 energy drinks", 10),
  task("Pet a therapy dog", 10),
  task("Pic at the Krillion/Puffer Party", 10),
  task("Photobooth strip with your team", 15),
  task("Summit the rock wall", 20),
  task("Call a bottle service on your friend", 50),
  task("Finish the spicy noodle challenge", 50),
  task("Find the golden egg", 75),
  game("Brawl Stars / Clash Royale Tournament"),
  game("Cup Stacking"),
  game("Geoguessr"),
  game("Puffer Party"),
  game("Typing Game"),
  game("Fitness Challenge"),
];

const prize = (
  name: string,
  costPoints: number,
  quantity: number | null = null,
): Reward => ({ name, costPoints, quantity });

export const REWARDS: Reward[] = [
  prize("Stickers", 5),
  prize("Canada Life Lanyard", 10),
  prize("HW11 Lanyard", 10),
  prize("Dora Hacks Clip", 10),
  prize("MLH Scrunchie", 15),
  prize("Canada Life Flashlight", 20),
  prize("Dora Hacks Socks", 30),
  prize("TD Mouse Pad", 30),
  prize("HW12 Notebook", 30),
  prize("Hack Western 8 T-shirt", 35),
  prize("Hack Western 11 T-shirt", 40),
  prize("HW12 Tote Bag / Drawstring Bag", 40),
  prize("Dora Hacks T-shirt", 50),
  prize("Dora Hacks Beanie", 50),
  prize("WEC Water Bottle", 60),
  prize("Bottle Service Your Friends", 75),
  prize("Uniqlo T-shirt", 75),
  prize("HW Beanie", 75),
  prize("Dora Hacks Stuffed Animal", 100),
  prize("HW12 Pit Vipers", 150),
  prize("Waterfront Portable Charger", 175),
  prize("RBC MagSafe Charger", 175),
  prize("Lego Flower Set", 200),
  prize("Keychron C3 Pro Keyboard", 250),
  prize("Signed Julian Laxman Photograph", 300),
];

/** Returns the tasks and prizes not in the database yet (names match without case). */
export async function findMissing(items = ITEMS, rewards = REWARDS) {
  const [existingItems, existingRewards] = await Promise.all([
    db
      .select({ name: scavengerHuntItems.name })
      .from(scavengerHuntItems)
      .where(isNull(scavengerHuntItems.deletedAt)),
    db.select({ name: scavengerHuntRewards.name }).from(scavengerHuntRewards),
  ]);
  const itemNames = new Set(existingItems.map((r) => r.name.toLowerCase()));
  const rewardNames = new Set(existingRewards.map((r) => r.name.toLowerCase()));
  return {
    items: items.filter((i) => !itemNames.has(i.name.toLowerCase())),
    rewards: rewards.filter((r) => !rewardNames.has(r.name.toLowerCase())),
  };
}

export async function seedScavengerHunt(items = ITEMS, rewards = REWARDS) {
  const missing = await findMissing(items, rewards);
  await db.transaction(async (tx) => {
    if (missing.items.length) {
      await tx.insert(scavengerHuntItems).values(
        missing.items.map((i) => ({
          ...i,
          startsAt: HACKATHON_START,
          endsAt: HACKATHON_END,
        })),
      );
    }
    if (missing.rewards.length) {
      await tx.insert(scavengerHuntRewards).values(missing.rewards);
    }
  });
  return { items: missing.items.length, rewards: missing.rewards.length };
}

async function main() {
  const APPLY = process.argv.includes("--apply");
  const missing = await findMissing();
  console.log(
    `${missing.items.length} task(s) and ${missing.rewards.length} prize(s) to add. Mode: ${APPLY ? "APPLY" : "DRY RUN"}.`,
  );
  for (const i of missing.items)
    console.log(
      `  task  ${i.points}${i.winPoints ? ` (win ${i.winPoints})` : ""}  ${i.name}`,
    );
  for (const r of missing.rewards)
    console.log(
      `  prize ${r.costPoints}  ${r.name} (qty ${r.quantity ?? "∞"})`,
    );
  if (!APPLY) return;

  const r = await seedScavengerHunt();
  console.log(`Done. Added ${r.items} task(s) and ${r.rewards} prize(s).`);
}

if (process.argv[1]?.includes("seed-scavenger-hunt")) {
  main()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
