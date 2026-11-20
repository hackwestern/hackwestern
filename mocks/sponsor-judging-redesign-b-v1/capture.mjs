// Runs the whole judging flow and screenshots each step. From the repo root:
// node mocks/sponsor-judging-redesign-b-v1/capture.mjs
import { chromium } from "playwright";
import path from "node:path";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.join(DIR, "index.html")).href;
const out = (n) => path.join(DIR, "screens", n + ".png");
const problems = [];
const errors = [];

async function check(page, name) {
  const bad = await page.evaluate(() => {
    const b = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) b.push("page scrolls sideways: " + document.documentElement.scrollWidth);
    document.querySelectorAll("#pane *, #bar *, .top *, .sheet.on *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (el.matches(".sr, .sr *") || cs.display === "none" || el.clientWidth === 0) return;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible" && !el.matches("select, textarea"))
        b.push(`${el.tagName}.${el.className}: "${(el.textContent || "").trim().slice(0, 40)}"`);
      // single-line controls: text wider than the box
      if (el.matches("button, a.btn, a.chip") && el.scrollWidth > el.clientWidth + 2) b.push(`overflow ${el.tagName}: "${el.textContent.trim().slice(0, 40)}"`);
    });
    // tap targets under 44px
    document.querySelectorAll("#pane button, #pane a, #pane select, #bar button, #bar a, .sheet.on button").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && r.height && (r.height < 43.5 || r.width < 43.5)) b.push(`small target ${r.width.toFixed(0)}x${r.height.toFixed(0)}: "${el.textContent.trim().slice(0, 30)}"`);
    });
    return b;
  });
  if (bad.length) problems.push(`${name}: ${bad.join(" | ")}`);
}
async function shot(page, name, full = false) {
  await page.waitForTimeout(350);
  await check(page, name);
  await page.screenshot({ path: out(name), fullPage: full });
}

const browser = await chromium.launch();

// ---------- phone: whole flow ----------
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const page = await ctx.newPage();
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));

await page.goto(URL + "#locked");
await shot(page, "01-locked-390");
await shot(page, "01-locked-390-full", true);

await page.click('#pane a[href="#r1"]');
await shot(page, "02-round1-list-390");

// open a team and score it
await page.click('[data-open="e5a7c9d14356"]'); // Debt Dash
for (const [k, v] of [["impact", 4], ["tech", 4], ["pres", 5]]) await page.click(`[data-score="e5a7c9d14356"][data-k="${k}"][data-v="${v}"]`);
await page.fill("#n-e5a7c9d14356", "Fun pitch; avalanche vs snowball explainer was clear.");
await page.click('[data-short="e5a7c9d14356"]');
await page.locator("#row-e5a7c9d14356").scrollIntoViewIfNeeded();
await shot(page, "03-round1-expanded-390");

// shortlist 3 more to reach 6
for (const id of ["b2d4f6a81023", "c9e1a3b5879a", "f8b0d2e41683"]) {
  await page.click(`[data-open="${id}"]`);
  for (const k of ["impact", "tech", "pres"]) await page.click(`[data-score="${id}"][data-k="${k}"][data-v="4"]`);
  await page.click(`[data-short="${id}"]`);
}
await page.click(`[data-open="f8b0d2e41683"]`); // collapse
assert.equal((await page.textContent("#shortN")).trim(), "6 shortlisted");

await page.fill("#q", "plaid");
await shot(page, "04-round1-search-390");
await page.fill("#q", "");
await page.click('[data-filter="short"]');
await page.selectOption("#sort", "score");
await shot(page, "05-round1-shortlisted-sorted-390");
await page.click('[data-filter="unscored"]');
await shot(page, "06-round1-not-scored-390");
await page.click('[data-filter="all"]');

await page.click("[data-sendshort]");
await shot(page, "07-send-shortlist-confirm-390");
await page.click("[data-confirmshort]");
await page.waitForURL(/#waiting$/);
await page.waitForSelector(".pr");
assert.equal(await page.locator(".pr").count(), 6);
await shot(page, "08-waiting-presentations-390");
await shot(page, "08-waiting-presentations-390-full", true);

// round 2
await page.click('#pane a[href="#r2"]');
await shot(page, "09-round2-empty-390");
const order = ["d4f6b8c03245", "a1c3e5f70912", "e5a7c9d14356", "b2d4f6a81023", "f8b0d2e41683"];
for (let i = 0; i < 5; i++) {
  // a team already placed is disabled in other slots
  if (i > 0) assert.equal(await page.locator(`#s-${i} option[value="${order[0]}"]`).isDisabled(), true);
  await page.selectOption(`#s-${i}`, order[i]);
}
await shot(page, "10-round2-ranked-390");
await shot(page, "10-round2-ranked-390-full", true);

await page.click("[data-toreview]");
await page.waitForURL(/#review$/);
await page.waitForSelector("[data-line]");
const lines = (await page.locator("[data-line]").allTextContents()).map((s) => s.replace(/\s+/g, " ").trim());
const NAMES = { d4f6b8c03245: "Benefits Buddy", a1c3e5f70912: "Pocket Planner", e5a7c9d14356: "Debt Dash", b2d4f6a81023: "NestEgg", f8b0d2e41683: "Credit Climb" };
const want = order.map((id, i) => `${["1st", "2nd", "3rd", "4th", "5th"][i]} place · ${NAMES[id]} (${id})`);
assert.deepEqual(lines, want);
assert.match(await page.textContent("#pane"), /Sent to the Hack Western team and saved to the Sponsor Judging sheet\./);
await shot(page, "11-review-390");

await page.click("[data-sendfinal]");
await page.waitForURL(/#sent$/);
await page.waitForSelector(".stamp");
assert.equal(await page.locator("#pane select, #pane input, #pane textarea, [data-sendfinal]").count(), 0);
assert.deepEqual((await page.locator("[data-line]").allTextContents()).map((s) => s.replace(/\s+/g, " ").trim()), want);
await shot(page, "12-sent-390");
await ctx.close();

// ---------- desktop: round 1 and round 2 ----------
const dctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const d = await dctx.newPage();
d.on("pageerror", (e) => errors.push(e.message));
await d.goto(URL + "#r1");
await d.click('[data-open="a1c3e5f70912"]');
await shot(d, "13-round1-1280");
await d.goto(URL + "#r2");
await d.reload();
for (let i = 0; i < 3; i++) await d.selectOption(`#s-${i}`, { index: i + 1 });
await shot(d, "14-round2-1280");
await dctx.close();
await browser.close();

console.log("flow assertions passed: 6 shortlisted, 6 presentations, review lists 1st-5th with IDs, sent is read-only");
console.log(errors.length ? "PAGE ERRORS:\n" + errors.join("\n") : "no page errors");
console.log(problems.length ? "LAYOUT PROBLEMS:\n" + problems.join("\n") : "no horizontal scroll, clipped text or small targets");
