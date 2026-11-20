// Runs the whole judging flow and screenshots every step. From the repo root:
// node mocks/sponsor-judging-redesign-c-v1/capture.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.join(DIR, "index.html")).href;
const out = (n) => path.join(DIR, "screens", n + ".png");
const problems = [];
const fail = (m) => { problems.push(m); console.error("FAIL " + m); };

async function check(page, name) {
  const o = await page.evaluate(() => {
    const bad = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) bad.push("page scrolls sideways: " + document.documentElement.scrollWidth);
    document.querySelectorAll("#pane *, .top *, .sheet.on *, .actbar *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (el.matches(".sr") || cs.display === "none" || el.clientWidth === 0) return;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible") bad.push(`${el.tagName}.${el.className}: "${(el.textContent || "").trim().slice(0, 40)}"`);
      // text-bearing leaf wider than its parent box
      if (el.children.length === 0 && el.textContent.trim() && el.parentElement) {
        const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
        if (r.right > p.right + 2 && getComputedStyle(el.parentElement).overflow !== "visible") bad.push(`clipped ${el.tagName}: "${el.textContent.trim().slice(0, 40)}"`);
      }
    });
    // small tap targets
    document.querySelectorAll("#pane button, #pane a, .sheet.on button, .actbar button, .top a").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.width && (r.height < 43.5 || r.width < 43.5)) bad.push(`small target ${el.tagName} "${el.textContent.trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`);
    });
    return bad;
  });
  if (o.length) fail(`${name}: ${o.join(" | ")}`);
}
async function shot(page, name, { end = true } = {}) {
  await page.waitForTimeout(350);
  await check(page, name);
  await page.screenshot({ path: out(name) });
  if (end && (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 40)) && !(await page.locator(".sheet.on").count())) {
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    await page.screenshot({ path: out(name + "-end") });
    await page.evaluate((y) => scrollTo(0, y), y);
  }
}

const browser = await chromium.launch();

/* ---------- phone, 390x844: the whole flow by tapping ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail("page error (390): " + e.message));
  await page.goto(URL + "#locked");
  await page.waitForTimeout(600);
  await shot(page, "01-locked-390");

  await page.click('.mock a[href="#round-1"]');
  await shot(page, "02-round1-start-390", { end: false });

  // follow the route: mark the first stop visited, see the next one
  await page.click(".route .btn-p[data-vis]");
  await shot(page, "03-round1-visited-390", { end: false });

  // sort 6 teams to Shortlist and 2 to Maybe, by tapping "Move to…"
  const shortIds = ["d6f8b0c2f461", "a7c9e1f36578", "b2d4f6a81023", "f6b8d0e25467", "a1c3e5f70912", "c9e1a3b5879a"];
  const maybeIds = ["b8d0f2a47689", "c5e7a9b1e350"];
  let first = true;
  for (const [ids, to] of [[shortIds, "short"], [maybeIds, "maybe"]]) {
    for (const id of ids) {
      await page.click(`[data-score="${id}"][data-n="${to === "short" ? 8 : 5}"]`);
      await page.click(`[data-move="${id}"]`);
      await page.waitForTimeout(300);
      if (first) { await shot(page, "04-round1-move-sheet-390", { end: false }); first = false; }
      await page.click(`.sheet.on [data-to="${to}"]`);
      await page.waitForTimeout(150);
    }
  }
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, "05-round1-notseen-390");
  await page.click('[data-view="short"]');
  await shot(page, "06-round1-shortlist-col-390");
  await page.click('[data-view="maybe"]');
  await shot(page, "07-round1-maybe-col-390", { end: false });

  await page.click("[data-send]");
  await shot(page, "08-round1-send-confirm-390", { end: false });
  await page.click("[data-confirm-send]");
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => location.hash === "#waiting"))) fail("send did not go to #waiting");
  const sched = await page.locator("#pane .li").count();
  if (sched !== 6) fail(`waiting lists ${sched} teams, expected 6`);
  await shot(page, "09-waiting-390");

  await page.click("[data-open-r2]");
  await shot(page, "10-round2-empty-390");

  // rank: 4 via "Place…" on the presenters list, 1 via an empty stand
  const order = ["a1c3e5f70912", "f6b8d0e25467", "b2d4f6a81023", "d6f8b0c2f461"];
  for (let i = 0; i < order.length; i++) {
    await page.click(`.list [data-place="${order[i]}"]`);
    await page.waitForTimeout(300);
    if (i === 0) await shot(page, "11-round2-place-sheet-390", { end: false });
    await page.click(`.sheet.on [data-slot="${i}"]`);
    await page.waitForTimeout(150);
  }
  await page.click('[data-fill="4"]');
  await page.waitForTimeout(300);
  await shot(page, "12-round2-fill-sheet-390", { end: false });
  await page.click('.sheet.on [data-id="c9e1a3b5879a"]');
  await page.waitForTimeout(150);
  // swap 2nd and 3rd to prove distinct slots survive a swap
  await page.click('.list [data-place="b2d4f6a81023"]');
  await page.waitForTimeout(250);
  await page.click('.sheet.on [data-slot="1"]');
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, "13-round2-full-390");

  await page.click("[data-review]");
  await page.waitForTimeout(300);
  const lines = await page.locator("[data-final]").allTextContents();
  const want = [
    "1st place · Pocket Planner (a1c3e5f70912)",
    "2nd place · NestEgg (b2d4f6a81023)",
    "3rd place · Rent Radar (f6b8d0e25467)",
    "4th place · CareCost (d6f8b0c2f461)",
    "5th place · TaxTime (c9e1a3b5879a)",
  ];
  if (JSON.stringify(lines) !== JSON.stringify(want)) fail("review lines: " + JSON.stringify(lines));
  if (!lines.every((l) => /^(1st|2nd|3rd|4th|5th) place · .+ \([0-9a-f]{12}\)$/.test(l))) fail("review line format");
  if (new Set(lines.map((l) => l.match(/\((\w+)\)/)[1])).size !== 5) fail("review ids not distinct");
  if (!(await page.getByText("Sent to the Hack Western team and saved to the Sponsor Judging sheet.").count())) fail("review note missing");
  console.log("review:\n  " + lines.join("\n  "));
  await shot(page, "14-review-390");

  await page.click("[data-send-top]");
  await page.waitForTimeout(300);
  if (!(await page.evaluate(() => location.hash === "#sent"))) fail("send top 5 did not go to #sent");
  if (await page.locator("[data-place],[data-fill],[data-score],[data-move]").count()) fail("sent screen is not read-only");
  const sentLines = await page.locator("[data-final]").allTextContents();
  if (JSON.stringify(sentLines) !== JSON.stringify(want)) fail("sent lines differ");
  await shot(page, "15-sent-390");
  await ctx.close();
}

/* ---------- desktop, 1280x800: round 1 and round 2 with drag ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail("page error (1280): " + e.message));
  await page.goto(URL + "#round-1");
  await page.waitForTimeout(600);
  // drag 3 cards from Not seen to Shortlist and 1 to Maybe
  // (always the top card of Not seen, so source and target are both on screen)
  for (const col of ["short", "short", "short", "maybe"]) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator('[data-col="none"] [data-card] h3').first().dragTo(page.locator(`[data-col="${col}"] .colm-h`));
    await page.waitForTimeout(150);
  }
  const nShort = await page.locator('[data-col="short"] [data-card]').count();
  const nMaybe = await page.locator('[data-col="maybe"] [data-card]').count();
  if (nShort !== 3 || nMaybe !== 1) fail(`desktop drag: short=${nShort} maybe=${nMaybe}`);
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, "16-round1-1280", { end: false });

  await page.goto(URL + "#round-2");
  await page.reload();
  await page.waitForTimeout(600);
  const pres = await page.locator("[data-pool] [data-drag]").evaluateAll((els) => els.map((e) => e.dataset.drag));
  for (let i = 0; i < 4; i++) {
    await page.locator(`[data-pool] [data-drag="${pres[i]}"] .tx`).dragTo(page.locator(`[data-stand="${i}"] .plinth`));
    await page.waitForTimeout(150);
  }
  const filled = await page.locator("[data-stand] .slot:not(.empty-s)").count();
  if (filled !== 4) fail(`desktop podium drag filled ${filled}, expected 4`);
  await page.evaluate(() => scrollTo(0, 0));
  await shot(page, "17-round2-1280", { end: false });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `${problems.length} problem(s)` : "all checks passed: flow, review lines, no page errors, no sideways scroll, no clipped text, 44px targets");
process.exit(problems.length ? 1 : 0);
