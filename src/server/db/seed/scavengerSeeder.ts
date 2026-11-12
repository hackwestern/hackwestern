import { scavengerHuntItems } from "~/server/db/schema";
import { type Seeder } from "./helpers";

// Codes must end in one of the suffixes the scanner groups by (see
// components/scan.tsx), and fit the 12 character `code` column. Every
// category gets at least one item so the whole picker can be tested.
const ITEMS = [
  // Meals
  { code: "brkfst_meal", points: 0, description: "Breakfast" },
  { code: "lunch_meal", points: 0, description: "Lunch" },
  { code: "dinner_meal", points: 0, description: "Dinner" },
  // Regular workshops
  { code: "intro_ws", points: 5, description: "Intro to Hacking workshop" },
  { code: "react_ws", points: 5, description: "React workshop" },
  // Sponsor workshops
  { code: "ai_sw", points: 10, description: "AI sponsor workshop" },
  { code: "google_sw", points: 10, description: "Cloud sponsor workshop" },
  // Non-winnable activities
  { code: "arcade_act", points: 5, description: "Arcade" },
  { code: "karaoke_act", points: 5, description: "Karaoke" },
  // Winnable activities: attendance and win
  { code: "pong_att", points: 5, description: "Pong tournament" },
  { code: "pong_win", points: 25, description: "Pong tournament winner" },
  { code: "cards_att", points: 5, description: "Card games" },
  { code: "cards_win", points: 25, description: "Card games winner" },
  // Bonus
  { code: "social_bonus", points: 15, description: "Posted on social media" },
] as const;

export class ScavengerHuntItemSeeder
  implements Seeder<typeof scavengerHuntItems>
{
  tableName = "ScavengerHuntItems";
  table = scavengerHuntItems;
  private next = 0;

  constructor(public numRows = ITEMS.length) {}

  createRandom() {
    const item = ITEMS[this.next % ITEMS.length]!;
    this.next += 1;
    return { ...item, deletedAt: null };
  }
}
