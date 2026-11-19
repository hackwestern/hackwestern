// Hand-off 1 + Organizer · Happening now + Read the coffee board.
// Fresh organizer context (test organizer, matches nobody in HW Contacts).
// Organizer pages can show real organizer names, so only scoped regions are
// saved and checked; the full text is printed with phones/emails scrubbed.
import { open, snap, read, say, wait, close, BASE, USERS, FINAL } from "./lib-final.mjs";
import path from "node:path";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 3000);
say("Sponsors tab (Happening now). EXPECT: 'Test Sponsor: 0 of 2 reps scheduled', Commure hasn't sent prefs, grouped; Now and next 'Up next'");
const t = await page.locator("main").innerText();
const i = t.indexOf("Needs attention");
console.log(t.slice(Math.max(0, i - 200), i + 2500).replace(/\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]?\d{4}/g, "[real phone]").replace(/\n{2,}/g, "\n"));
const sec = page.locator("section, div").filter({ has: page.getByText("Needs attention now") }).filter({ has: page.getByText(/Now and next/) }).last();
await sec.screenshot({ path: path.join(FINAL, `h1-happening-now${tag}.png`), mask: [page.getByText(/Noah Medland/)] });
console.log("[shot] h1-happening-now");
console.log("PCBWay mentioned:", /PCBWay/.test(t.slice(i, i + 2500)));

say("Follow 'Open coffee chats' for Test Sponsor. EXPECT board scrolled to its row, opened, focused");
const link = page.getByRole("link", { name: /Open coffee chats/ }).or(page.getByRole("button", { name: /Open coffee chats/ }));
console.log("open links:", await link.count());
const items = await page.locator("li").filter({ hasText: "Test Sponsor" }).filter({ has: link }).count();
console.log("Test Sponsor items with link:", items);
const tsLink = page.locator("li").filter({ hasText: "Test Sponsor" }).getByRole("link", { name: /Open coffee chats/ }).first();
await ((await tsLink.count()) ? tsLink : link.first()).click();
await page.waitForLoadState("networkidle");
await wait(page, 3000);
console.log("url:", page.url());
console.log("focused:", await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "").replace(/\s+/g, " ").slice(0, 120)));

say("Coffee board. EXPECT summary '6 sponsors submitted. Run Auto-schedule, then Noah sends … 1 sponsor still hasn't submitted.' (Test Sponsor makes 6); Test Sponsor 'Needs scheduling'; Since last time 'Test Sponsor submitted · <time>'");
const main = page.locator("main");
const bt = (await main.innerText()).replace(/\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]?\d{4}/g, "[real phone]").replace(/\n{2,}/g, "\n");
const j = bt.indexOf("Coffee chats");
console.log(bt.slice(0, 3500));
const band = page.locator('section[aria-labelledby="coffee-sponsors"]');
if (await band.count()) {
  await band.screenshot({ path: path.join(FINAL, `h1-board-rows${tag}.png`), mask: [page.getByText(/Noah Medland/), page.locator('a[href^="tel:"]').filter({ hasNotText: /555/ })] });
  console.log("[shot] h1-board-rows");
}
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
