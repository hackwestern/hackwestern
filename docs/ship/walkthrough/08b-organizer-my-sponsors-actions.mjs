// Organizer · My sponsors actions as the local Noah login user (walkthrough-noah).
// Sheet writes are off (SHEET_WRITES unset), so pills must not write the sheet.
import { open, shot, wait, close, BASE, sql } from "./lib.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const email = sql(`select email from "user" where id='walkthrough-noah'`).trim();
const { page, context } = await open(W, { sub: "walkthrough-noah", name: "Noah", email });
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 2500);
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
const panel = page.getByRole("tabpanel").filter({ hasText: "People" }).first();
const live = async () => (await page.locator('[role="status"], [aria-live]').allInnerTexts()).filter((s) => s.trim()).join(" / ");

say("Copy Priya's phone. EXPECT icon flips to 'Copied'");
const copy = page.locator('button[aria-label^="Copy "]').first();
console.log("copy label:", await copy.getAttribute("aria-label"));
await copy.click();
await wait(page, 300);
console.log("after:", await copy.getAttribute("aria-label"), "| live:", await live());
console.log("clipboard is 555:", /555/.test(await page.evaluate(() => navigator.clipboard.readText().catch(() => ""))));

say("Tap Arrival pill 'Not arrived'. EXPECT it advances and notes 'Not written (sheet writes off)'");
await page.getByRole("button", { name: /Not arrived/ }).first().click();
await wait(page, 2500);
const t = await page.locator("body").innerText();
console.log("arrival line:", t.split("\n").filter((l) => /Arrival|Checked in|Not written|sheet/i.test(l)).slice(0, 6).join(" / "));
console.log("live:", await live());
await shot(page, `08-organizer-mysponsors-arrival${tag}`, { full: false });

say("Tap Coffee chat workshop pill. EXPECT 'At CC workshop' saved + 'Not written (sheet writes off)'");
const cc = page.getByRole("button", { name: /Not attended/ }).first();
console.log("cc pill disabled:", await cc.isDisabled().catch(() => "n/a"));
await cc.click().catch((e) => console.log("cc click failed:", e.message.split("\n")[0]));
await wait(page, 2500);
const t2 = await page.locator("body").innerText();
console.log("cc line:", t2.split("\n").filter((l) => /workshop|Attended|Not written|sheet/i.test(l)).slice(0, 8).join(" / "));
console.log("live:", await live());
await shot(page, `08-organizer-mysponsors-cc-workshop${tag}`, { full: false });

say("Switch to All sponsors (?list=all)");
await page.getByRole("button", { name: "All sponsors" }).or(page.getByRole("radio", { name: "All sponsors" })).first().click();
await wait(page, 1500);
console.log("url:", page.url());
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
