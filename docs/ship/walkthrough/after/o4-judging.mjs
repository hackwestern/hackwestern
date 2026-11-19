// After: B9 (presentations that placed nothing) and B2 (no PCBWay chip under
// Presentations). Test organizer; only the Presentations section is shot.
import { open, wait, close, BASE, USERS } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=judging`, { waitUntil: "networkidle", timeout: 180000 });
await page.waitForSelector("#presentations-heading", { timeout: 180000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1500);
const sec = page.locator('section[aria-labelledby="presentations-heading"]');
const t = await sec.innerText();
console.log(t.replace(/\n+/g, " / ").slice(0, 900));
console.log("PCBWay chip:", /PCBWay/.test(t));
await sec.screenshot({ path: `docs/ship/walkthrough/after/o4-judging-presentations${tag}.png` });
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
