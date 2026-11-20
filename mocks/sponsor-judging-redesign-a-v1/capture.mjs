// Runs the whole judging flow and screenshots every step. From the repo root:
// node mocks/sponsor-judging-redesign-a-v1/capture.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.join(DIR, "index.html")).href;
const out = (n) => path.join(DIR, "screens", n + ".png");
const problems = [];
const assert = (ok, msg) => { if (!ok) problems.push("ASSERT " + msg); };

async function check(page, name) {
  const o = await page.evaluate(() => {
    const bad = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) bad.push("page scrolls sideways: " + document.documentElement.scrollWidth);
    document.querySelectorAll("#pane *, .top *, .sheet.on *, .bbar *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (el.matches(".sr") || cs.display === "none" || !el.clientWidth) return;
      if (el.scrollWidth > el.clientWidth + 1 && (cs.overflow !== "visible" || el.matches("button,a,.btn")))
        bad.push(`${el.tagName}.${el.className}: "${(el.textContent || "").trim().slice(0, 40)}"`);
      // text sticking out of a button or chip
      if (el.matches("button,a") && el.children.length === 0 && el.scrollWidth > el.clientWidth + 1) bad.push("clipped " + el.textContent);
    });
    return bad;
  });
  if (o.length) problems.push(`${name}: ${[...new Set(o)].join(" | ")}`);
}
async function shot(page, name, full = true) {
  await page.waitForTimeout(350);
  await check(page, name);
  await page.screenshot({ path: out(name), fullPage: full });
}

const browser = await chromium.launch();

// ---------- phone: the whole flow ----------
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: false });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") problems.push("console: " + m.text()); });
  await page.goto(URL + "#locked");
  await page.waitForTimeout(600);
  await shot(page, "01-locked-390");

  await page.click('[data-jump="r1"]');
  await shot(page, "02-r1-card-390", false);

  // card 1: score 4, shortlist with the button
  await page.click('[data-sc][data-v="4"]');
  await page.click('[data-d="short"]');
  await page.waitForTimeout(300);
  // card 2: shortlist with a swipe right (mouse drag on the tagline)
  const tag = await page.locator(".pc .pc-tag").boundingBox();
  await page.mouse.move(tag.x + 40, tag.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(tag.x + 40 + i * 18, tag.y + 12);
  await page.screenshot({ path: out("03-r1-swiping-390") });
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert((await page.locator(".cnt1 b").textContent()).startsWith("2 of 10"), "swipe right shortlists (count 2)");
  // card 3: skip by swipe left
  const tag2 = await page.locator(".pc .pc-tag").boundingBox();
  await page.mouse.move(tag2.x + 200, tag2.y + 10);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(tag2.x + 200 - i * 18, tag2.y + 12);
  await page.mouse.up();
  await page.waitForTimeout(350);
  assert((await page.locator(".lastline").textContent()).includes("Skipped"), "swipe left skips");
  // undo the skip, then shortlist it instead
  await page.click("[data-undo]");
  await page.waitForTimeout(200);
  assert((await page.locator(".pc-name").textContent()).trim() === "SplitSense", "undo returns to the same card");
  await page.click('[data-sc][data-v="5"]');
  await page.click('[data-d="short"]');
  await page.waitForTimeout(300);
  await page.click('[data-d="maybe"]');
  await page.waitForTimeout(300);
  await page.click('[data-sc][data-v="3"]');
  await page.click('[data-d="short"]');
  await page.waitForTimeout(300);
  await shot(page, "04-r1-counter-390", false);
  assert((await page.locator(".cnt1 b").textContent()).startsWith("4 of 10"), "counter says 4 of 10");
  for (const d of ["skip", "short", "skip", "short"]) { await page.click(`[data-d="${d}"]`); await page.waitForTimeout(280); }

  // review: change your mind on the maybe
  await page.click('a[href="#r1-review"]');
  await shot(page, "05-r1-review-390");
  await page.click('[data-set="d4f6b8c03245"][data-to="short"]'); // Benefits Buddy maybe -> shortlist
  await page.click("[data-open='a1c3e5f70912']");
  await shot(page, "06-r1-review-card-sheet-390", false);
  await page.click("[data-close]");
  await page.click("[data-send1]");
  await shot(page, "07-r1-send-confirm-390", false);
  const nShort = await page.locator(".sheet .li").count();
  assert(nShort >= 5 && nShort <= 10, "shortlist 5 to 10, got " + nShort);
  await page.click("[data-confirm1]");
  await shot(page, "08-waiting-390");
  assert((await page.locator(".ev").count()) === nShort, "every shortlisted team has a time");

  await page.click('.mock [data-jump="r2"] >> nth=0');
  await shot(page, "09-r2-empty-390");
  const picks = page.locator("[data-pick]");
  for (let i = 0; i < 5; i++) await picks.nth(i).click();
  await page.click("[data-runo]"); // undo the 5th
  assert((await page.locator(".slot.filled").count()) === 4, "round 2 undo removes the last pick");
  await picks.nth(5).click();
  // drag 1st to 3rd
  const before = await page.locator(".slot.filled .tx b").allTextContents();
  await page.locator('#slots').scrollIntoViewIfNeeded();
  await page.evaluate(() => scrollTo(0, 0));
  const h = await page.locator('[data-handle="0"]').boundingBox();
  await page.mouse.move(h.x + 22, h.y + 22);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(h.x + 22, h.y + 22 + i * 15.2);
  await page.mouse.up();
  await page.waitForTimeout(300);
  const after = await page.locator(".slot.filled .tx b").allTextContents();
  assert(after[2] === before[0] && after[0] === before[1], `drag 1st to 3rd: ${before} -> ${after}`);
  await shot(page, "10-r2-ranked-390");

  await page.click("[data-toreview]");
  await shot(page, "11-review-390");
  const lines = (await page.locator("#sendlist li").allTextContents()).map((s) => s.replace(/\s+/g, " ").trim());
  const ords = ["1st", "2nd", "3rd", "4th", "5th"];
  assert(lines.length === 5, "review lists 5 lines, got " + lines.length);
  lines.forEach((l, i) => assert(new RegExp(`^${ords[i]} place · .+ \\([0-9a-f]{12}\\)$`).test(l), "line format: " + l));
  assert((await page.textContent("#pane")).includes("Sent to the Hack Western team and saved to the Sponsor Judging sheet."), "sheet note");
  console.log("Review lines:\n  " + lines.join("\n  "));
  await page.click("[data-send2]");
  await shot(page, "12-sent-390");
  assert((await page.locator("#sendlist li").count()) === 5 && (await page.locator("#pane button").count()) === 0, "sent is read-only");
  await ctx.close();
}

// ---------- desktop: round 1 and round 2 ----------
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => problems.push("pageerror@1280: " + e.message));
  await page.goto(URL + "#r1");
  await page.waitForTimeout(600);
  for (const d of ["short", "skip", "short", "maybe"]) { await page.click(`[data-d="${d}"]`); await page.waitForTimeout(260); }
  await shot(page, "13-r1-1280", false);
  await page.click('[data-jump="r2"]');
  const picks = page.locator("[data-pick]");
  for (let i = 0; i < 3; i++) await picks.nth(i).click();
  await shot(page, "14-r2-1280", false);
  await ctx.close();
}
await browser.close();
console.log(problems.length ? "PROBLEMS:\n" + problems.join("\n") : "OK: flow passed, no page errors, no sideways scroll, no clipped text");
process.exit(problems.length ? 1 : 0);
