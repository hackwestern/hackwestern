// Sponsor · Review & submit (Test Sponsor), then the Chats home after submit.
import { open, shot, text, wait, close, BASE, SPONSORS } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(W);
const main = page.locator("#sponsor-main");
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=3`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
say("Step 3 opened. EXPECT: 'Everything checks out.', summary 'Groups of 3 · 30 min · up to 6 chats · up to 18 hackers', 'Organizers call <name> at <phone>.'");
await text(page, "#sponsor-main", 3000);
await shot(page, `04-sponsor-review-step3${tag}`);
say("EXPECT: Submit preferences -> 'Preferences submitted'; status 'Submitted, waiting for organizers to schedule'; Shortlist unlocks");
await main.getByRole("button", { name: /^Submit/ }).click();
await wait(page, 2500);
await text(page, "#sponsor-main", 3000);
await shot(page, `04-sponsor-review-submitted${tag}`);
console.log("url:", page.url());
say("Chats home after submit");
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle" });
await wait(page, 1500);
await text(page, "#sponsor-main", 3000);
await shot(page, `04-sponsor-chats-home-submitted${tag}`);
console.log("errors:", page.errors.slice(0, 5));
await close();
