// Hand-off: the sponsor opens the portal fresh (new device, hours later) and
// we read what they see. Usage: node 11-handoff-sponsor-sees.mjs <label> [sponsorKey] [width]
import { open, shot, text, wait, close, BASE, SPONSORS } from "./lib.mjs";

const [label = "now", key = "test", w = "1280"] = process.argv.slice(2);
const W = Number(w);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W);
const base = `${BASE}/sponsors/${SPONSORS[key]}/coffee-chats`;
await page.goto(base, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 2000);
await text(page, "#sponsor-main", 5000);
await shot(page, `${label}${tag}`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
