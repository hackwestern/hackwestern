// Hand-off 2: organizer schedules -> sponsor sees it. Test Sponsor's Chats home
// from the sponsor side. The "device" keeps its storage in a state file
// (outside the repo) so "Organizers moved …" can be compared with what this
// device saw before. Usage: node h2-sponsor-sees.mjs <label> [fresh]
import { getBrowser, snap, say, wait, close, BASE, SPONSORS, clean, PRIVATE } from "./lib-final.mjs";
import path from "node:path";
import fs from "node:fs";

const label = process.argv[2] || "now";
const fresh = process.argv[3] === "fresh";
const W = Number(process.argv[4] || 1280);
const tag = W === 1280 ? "" : "-390";
const state = path.join(PRIVATE, `sponsor-device-${W}.json`);
fs.mkdirSync(PRIVATE, { recursive: true });
const b = await getBrowser();
const context = await b.newContext({
  viewport: { width: W, height: W < 600 ? 844 : 900 },
  ...(!fresh && fs.existsSync(state) ? { storageState: state } : {}),
});
const page = await context.newPage();
page.errors = [];
page.on("pageerror", (e) => page.errors.push(e.message));
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 2500);
const main = page.locator("#sponsor-main");
say(`Sponsor side (${label}, ${fresh ? "fresh device" : "same device"}, ${W}px)`);
const t = clean(await main.innerText());
console.log(t.slice(0, 2600));
await snap(page, `h2-sponsor-${label}${tag}`, { full: true });
await context.storageState({ path: state });
console.log("errors:", page.errors.slice(0, 5));
await close();
