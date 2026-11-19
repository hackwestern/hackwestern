// Hand-off 3: the sponsor changed after invites -> an organizer arriving cold
// (fresh context, test organizer). Read-only.
import { open, say, wait, close, BASE, USERS, clean, FINAL } from "./lib-final.mjs";
import path from "node:path";

const { page } = await open(1280, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 3000);
let t = clean(await page.locator("main").innerText());
const i = t.indexOf("Needs attention");
say("Happening now");
console.log(t.slice(i, t.indexOf("Now and next", i)));
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle" });
await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1500);
t = clean(await page.locator("main").innerText());
const j = t.indexOf("Coffee chats\nSaturday");
say("Board: summary, since last time, rows, fixes");
console.log(t.slice(j, t.indexOf("Rooms\nRoom", j)));
const card = page.locator("section, div").filter({ has: page.getByText(/changed after invites/) }).filter({ has: page.getByRole("button", { name: /Auto-schedule|Re-run/ }) }).last();
await page.locator('section[aria-labelledby="coffee-sponsors"]').screenshot({ path: path.join(FINAL, "h3-board-rows.png") });
const fixes = page.locator("section, div").filter({ has: page.getByText("Suggested fixes", { exact: true }) }).last();
await fixes.screenshot({ path: path.join(FINAL, "h3-board-fixes.png"), mask: [page.locator('a[href^="tel:"]').filter({ hasNotText: /555/ })] });
console.log("[shot] h3-board-rows, h3-board-fixes");
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
