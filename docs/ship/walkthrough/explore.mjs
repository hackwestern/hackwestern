// Ad-hoc look at one page: node explore.mjs <path> [name] [width] [user]
// Prints visible text (real phones redacted) and the buttons, and saves a
// screenshot to the private folder unless a name is given.
import { open, shot, text, wait, close, BASE, USERS } from "./lib.mjs";

const [p, name, width = "1280", user] = process.argv.slice(2);
const { page } = await open(Number(width), user ? USERS[user] : null);
await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 2000);
await text(page, "#sponsor-main, main", 6000);
console.log("buttons:", (await page.getByRole("button").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" | "));
if (name) await shot(page, name);
else await shot(page, `explore-${Date.now()}`, { priv: true });
console.log("errors:", page.errors.slice(0, 5));
await close();
