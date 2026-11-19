// After: wording on the organizer side (Help, Up next, Main contact, fix
// text) and B10 (Help's partial-session example). Test organizer.
import { open, wait, close, BASE, USERS, shotAfter } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1000);
const now = page.locator('[data-tour="org-now-next"]');
console.log("now/next:", (await now.innerText()).replace(/\n+/g, " / "));
await now.screenshot({ path: `docs/ship/walkthrough/after/o5-happening-now${tag}.png` });
await page.getByRole("button", { name: /^Test Sponsor,/ }).click();
await wait(page, 600);
const people = page.getByRole("list", { name: "People" }).first();
console.log("people:", (await people.innerText()).replace(/\n+/g, " / "));
console.log("fixes:", (await page.locator('[data-tour="coffee-fixes"], section').filter({ hasText: "Suggested fixes" }).first().innerText()).replace(/\n+/g, " / ").slice(0, 400));
await page.getByRole("button", { name: "Help" }).first().click();
await wait(page, 800);
const dlg = page.getByRole("dialog");
const h = await dlg.innerText();
console.log("help has Sun Life:", /Sun Life/.test(h), "| same word:", /means the same as your "Sent"/.test(h), "| walk rule:", /Walk to Ivey/.test(h));
await shotAfter(page, `o5-board-help${tag}`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
