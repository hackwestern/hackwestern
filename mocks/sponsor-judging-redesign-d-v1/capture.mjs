// Runs the whole judging flow, checks the score control, rubric, modes and multi-rep model,
// and screenshots every step. From the repo root:
// node mocks/sponsor-judging-redesign-d-v1/capture.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.join(DIR, "index.html")).href;
const out = (n) => path.join(DIR, "screens", n + ".png");
const problems = [];
const fail = (m) => { problems.push(m); console.error("FAIL " + m); };
const ok = (c, m) => { if (!c) fail(m); else console.log("ok   " + m); };

async function check(page, name) {
  const o = await page.evaluate(() => {
    const bad = [];
    if (document.documentElement.scrollWidth > innerWidth + 1) bad.push("page scrolls sideways: " + document.documentElement.scrollWidth);
    document.querySelectorAll("#pane *, .top *, .sheet.on *, .modal.on *").forEach((el) => {
      const cs = getComputedStyle(el);
      if (el.matches(".sr, .strip, .strip *") || cs.display === "none" || el.clientWidth === 0) return;
      if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible" && !el.matches(".mo-b")) bad.push(`${el.tagName}.${el.className}: "${(el.textContent || "").trim().slice(0, 40)}"`);
      if (el.children.length === 0 && el.textContent.trim() && el.parentElement) {
        const r = el.getBoundingClientRect(), p = el.parentElement.getBoundingClientRect();
        if (r.right > p.right + 2 && getComputedStyle(el.parentElement).overflow !== "visible") bad.push(`clipped ${el.tagName}: "${el.textContent.trim().slice(0, 40)}"`);
        if (r.right > innerWidth + 1) bad.push(`off screen ${el.tagName}: "${el.textContent.trim().slice(0, 40)}"`);
      }
    });
    return bad;
  });
  if (o.length) fail(`${name}: ${o.join(" | ")}`);
}
async function shot(page, name, { end = true } = {}) {
  await page.waitForTimeout(350);
  await check(page, name);
  await page.screenshot({ path: out(name) });
  if (end && (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 40)) && !(await page.locator(".sheet.on, .modal.on").count())) {
    const y = await page.evaluate(() => scrollY);
    await page.evaluate(() => scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(250);
    await page.screenshot({ path: out(name + "-end") });
    await page.evaluate((y) => scrollTo(0, y), y);
  }
}
const now = (page, sel = "[data-strip]") => page.locator(sel).first().getAttribute("aria-valuenow").then(Number);
const onHalf = (v) => v >= 1 && v <= 10 && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;

const browser = await chromium.launch();

/* ---------- phone, 390x844 ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail("page error (390): " + e.message));
  await page.goto(URL + "#locked");
  await page.waitForTimeout(600);
  await page.evaluate(() => { localStorage.clear(); });
  await page.reload();
  await page.waitForTimeout(500);
  await page.evaluate(() => { UI.live = false; }); // no surprise toasts until we test them
  await shot(page, "01-locked-390");

  // Who's judging?
  await page.click('.mock a[data-jump="r1"]');
  await page.waitForTimeout(300);
  ok(await page.getByText("Who's judging?").isVisible(), "picker shows before a name is picked");
  await shot(page, "02-whos-judging-390");
  await page.click('[data-me="Dana W."]');
  await page.waitForTimeout(300);
  ok(await page.locator("#pane").getByText("Judging as Dana W.").isVisible(), "shows Judging as Dana W.");
  ok((await page.locator('[data-scope="mine"]').textContent()).trim() === "Your 5", "split: Your 5");
  ok((await page.locator('[data-scope="all"]').textContent()).trim() === "Everyone's 18", "split: Everyone's 18");

  // Mode 3: quick pass (default)
  ok((await page.locator('[data-mode="quick"]').getAttribute("aria-pressed")) === "true", "Quick pass is the default mode");
  await shot(page, "03-quick-pass-390");
  await page.click('[data-tri="yes"]'); await page.waitForTimeout(300);
  await page.click('[data-tri="maybe"]'); await page.waitForTimeout(300);
  await page.click('[data-tri="no"]'); await page.waitForTimeout(300);
  // swipe right = Yes
  const card = await page.locator(".pc[data-swipe]").boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + 60);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(card.x + card.width / 2 + i * 18, card.y + 60);
  await page.mouse.up();
  await page.waitForTimeout(400);
  ok((await page.locator(".prog p").first().textContent()).includes("4 of 5"), "quick pass: 4 of 5 sorted after 3 taps + swipe");
  await page.click('[data-tri="yes"]'); await page.waitForTimeout(400);
  await shot(page, "04-quick-pass-done-390");
  ok(await page.getByText("Score your Yes and Maybe projects").isVisible(), "Score your Yes and Maybe button shows");

  // -> 5 at a time, filtered to Yes/Maybe
  await page.click('[data-ymgo="five"]'); await page.waitForTimeout(300);
  ok((await page.locator('[data-mode="five"]').getAttribute("aria-pressed")) === "true", "switched to 5 at a time");
  const nCards = await page.locator(".pc.mini").count();
  ok(nCards === 4, `5 at a time filtered to Yes+Maybe: ${nCards} cards`);
  await shot(page, "05-five-at-a-time-390");

  // Score control: steps of 0.5 between 1 and 10
  const strip = page.locator("[data-strip]").first();
  const pid = await strip.getAttribute("data-strip");
  ok((await strip.getAttribute("aria-valuetext")) === "Not scored yet", "score starts unscored");
  await page.locator(`[data-pm="1"][data-for="${pid}"]`).click();
  ok((await now(page)) === 6, "+ from untouched gives 6");
  await page.locator(`[data-pm="-1"][data-for="${pid}"]`).click();
  ok((await now(page)) === 5.5, "− gives 5.5");
  await strip.focus();
  await page.keyboard.press("End"); ok((await now(page)) === 10, "End = 10");
  await page.keyboard.press("ArrowRight"); ok((await now(page)) === 10, "can't go above 10");
  ok((await page.locator(`[data-pm="1"][data-for="${pid}"]`).getAttribute("aria-disabled")) === "true", "+ disabled at 10");
  await page.keyboard.press("Home"); ok((await now(page)) === 1, "Home = 1");
  await page.keyboard.press("ArrowLeft"); ok((await now(page)) === 1, "can't go below 1");
  const seen = [];
  for (let i = 0; i < 18; i++) { await page.keyboard.press("ArrowRight"); seen.push(await now(page)); }
  ok(seen.every((v, i) => v === 1.5 + i * 0.5), "ArrowRight walks 1.5, 2 ... 10: " + seen.join(","));
  ok((await page.locator(`[data-ctl="${pid}"] [data-out]`).textContent()).startsWith("10"), "big value shows 10");
  // tap a number
  await page.keyboard.press("Home");
  await page.waitForTimeout(500);
  const t = page.locator(`[data-strip="${pid}"] .tick[data-v="2"]`);
  await t.click(); ok((await now(page)) === 2, "tapping 2 on the strip sets 2");
  await page.waitForTimeout(500);
  // scroll the strip (horizontal wheel), value follows and stays on a half step
  const sb = await strip.boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2);
  await page.mouse.wheel(44 * 5, 0);
  await page.waitForTimeout(900);
  const vw = await now(page);
  ok(vw > 2 && onHalf(vw), "horizontal scroll moves the score to a half step: " + vw);
  const shownSnap = await page.evaluate((id) => { const s = document.querySelector(`[data-strip="${id}"]`); return Math.abs(s.scrollLeft / 44 - Math.round(s.scrollLeft / 44)) < 0.05; }, pid);
  ok(shownSnap, "strip snaps to a number");
  await shot(page, "06-score-control-390", { end: false });

  // Rubric modal opens and closes, returns to the same project
  const rb = page.locator(".pc.mini").nth(1).locator("[data-rubric]");
  const rpid = await rb.getAttribute("data-rubric");
  await rb.click(); await page.waitForTimeout(300);
  ok(await page.locator("#modal.on").isVisible(), "rubric modal opens");
  ok((await page.locator("#modal .crit").count()) === 4, "rubric has 4 criteria");
  ok(await page.locator("#modal").getByText("Innovation + Impact").isVisible(), "rubric uses the newest criteria");
  await shot(page, "07-rubric-modal-390", { end: false });
  await page.click("#modal .mo-f [data-moclose]"); await page.waitForTimeout(300);
  ok(!(await page.locator("#modal.on").count()), "rubric modal closes");
  ok(await page.evaluate((id) => document.activeElement?.dataset?.rubric === id, rpid), "focus returns to the same project's Rubric button");
  await rb.click(); await page.waitForTimeout(200); await page.keyboard.press("Escape"); await page.waitForTimeout(200);
  ok(!(await page.locator("#modal.on").count()), "Escape closes the rubric");

  // score the other three on this batch
  for (const [i, v] of [[1, 8], [2, 6.5], [3, 7]]) {
    const s = page.locator("[data-strip]").nth(i); await s.focus();
    await page.keyboard.press("Home"); for (let k = 0; k < (v - 1) * 2; k++) await page.keyboard.press("ArrowRight");
  }
  await shot(page, "08-five-scored-390");

  // Mode 1: one at a time, Save & next auto-advances
  await page.click('[data-ym="off"]'); await page.waitForTimeout(200);
  await page.click('[data-mode="one"]'); await page.waitForTimeout(300);
  const name1 = await page.locator(".pc .pc-name").textContent();
  ok((await page.locator(".prog p").first().textContent()).includes("4 of 5"), "one at a time: 4 of 5 scored");
  ok((await page.locator("[data-save1]").getAttribute("aria-disabled")) === "true", "Save disabled before a score");
  await shot(page, "09-one-at-a-time-390");
  await page.locator("[data-strip]").focus(); await page.keyboard.press("End"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  ok((await now(page)) === 9, "one at a time scored 9");
  ok((await page.locator("[data-save1]").textContent()).includes("Save 9"), "Save button shows the score");
  await page.click("[data-save1]"); await page.waitForTimeout(300);
  ok((await page.locator(".prog p").first().textContent()).includes("5 of 5"), "5 of 5 scored");
  await shot(page, "10-one-all-scored-390");

  // remembered on this device
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { UI.live = false; });
  ok(await page.locator("#pane").getByText("Judging as Dana W.").isVisible(), "name remembered after reload");
  ok((await page.locator('[data-mode="one"]').getAttribute("aria-pressed")) === "true", "mode remembered after reload");

  // Everyone's 18 + split off
  await page.click('[data-mode="five"]'); await page.waitForTimeout(200);
  await page.click('[data-scope="all"]'); await page.waitForTimeout(300);
  ok((await page.locator(".dots i").count()) === 4, "Everyone's 18 shows all projects (4 batches of 5)");
  await page.click('[data-batch="1"]'); await page.waitForTimeout(200);
  ok((await page.locator(".tag.own").count()) > 0, "others' projects marked with their name");
  await page.click('[data-batch="1"]'); await page.waitForTimeout(200);
  ok((await page.locator("[data-flag]").count()) > 0, "seeded disagreement flag shows (Priya 8.5 · Marcus 5)");
  const flagTxt = (await page.locator("[data-flag]").first().textContent()).trim();
  ok(/^\w+ [\d.]+ · \w+ [\d.]+: talk it through$/.test(flagTxt), "flag text: " + flagTxt);
  await shot(page, "11-everyone-18-390");
  await page.click("[data-split]"); await page.waitForTimeout(300);
  ok(!(await page.locator("[data-scope]").count()) && (await page.getByText("Everyone sees all 18 projects.").isVisible()), "split off: everyone sees all 18");
  await shot(page, "12-split-off-390", { end: false });
  await page.click("[data-split]"); await page.waitForTimeout(200);
  await page.click('[data-scope="mine"]'); await page.waitForTimeout(200);

  // Teammate scores live + disagreement on my score
  await page.click('[data-mode="one"]'); await page.waitForTimeout(200);
  // (scores live in memory, so after the reload this is my only score)
  const target = await page.locator(".pc[data-id]").getAttribute("data-id");
  await page.locator("[data-strip]").focus(); await page.keyboard.press("End"); await page.keyboard.press("ArrowLeft"); await page.keyboard.press("ArrowLeft");
  await page.evaluate(() => { UI.live = true; UI.tick = 0; UI.cross = 0; document.querySelector("#toast").classList.remove("on"); });
  await page.waitForSelector(`#toast.on`, { timeout: 12000 });
  const toastTxt = await page.locator("#toast").textContent();
  ok(/^(Leo|Priya|Marcus) scored .+ \d+(\.5)?$/.test(toastTxt), "live toast: " + toastTxt);
  await page.waitForTimeout(400);
  const f = page.locator(`[data-flag="${target}"]`).first();
  ok(await f.isVisible(), "disagreement flag on my 9");
  ok(/^Dana 9 · \w+ 5: talk it through$/.test((await f.textContent()).trim()), "flag reads " + (await f.textContent()).trim());
  await shot(page, "13-disagreement-live-390", { end: false });
  await page.evaluate(() => { UI.live = false; });

  // Shortlist suggested from averages, edit, send for the whole sponsor
  await page.evaluate(() => seedScores());
  await page.goto(URL + "#shortlist"); await page.waitForTimeout(400);
  await page.evaluate(() => { UI.live = false; });
  const n0 = await page.locator('.slrow[aria-pressed="true"]').count();
  ok(n0 >= 5 && n0 <= 10, `suggested shortlist has ${n0} (5-10)`);
  await shot(page, "14-shortlist-390");
  await page.locator('.slrow[aria-pressed="true"]').last().click(); await page.waitForTimeout(200);
  ok((await page.locator('.slrow[aria-pressed="true"]').count()) === n0 - 1, "shortlist editable (remove one)");
  await page.locator('.slrow[aria-pressed="false"]').first().click(); await page.waitForTimeout(200);
  ok((await page.locator('.slrow[aria-pressed="true"]').count()) === n0, "shortlist editable (add one)");
  await page.click("[data-send1]"); await page.waitForTimeout(400);
  ok((await page.locator("#sheet").textContent()).includes("whole team"), "confirm says it sends for the whole team");
  await shot(page, "15-send-confirm-390", { end: false });
  await page.click("[data-confirm1]"); await page.waitForTimeout(400);
  ok(page.url().endsWith("#waiting"), "sent -> presentations");
  await shot(page, "16-presentations-390");

  // Round 2 rank 1st-5th
  await page.click('.mock a[data-jump="r2"]'); await page.waitForTimeout(300);
  const pool = page.locator("[data-pick]");
  for (let i = 0; i < 5; i++) { await pool.nth(i).click(); await page.waitForTimeout(120); }
  await shot(page, "17-round2-ranked-390");
  await page.click("[data-toreview]"); await page.waitForTimeout(300);
  const lines = await page.locator("[data-line]").allTextContents();
  const re = /^(1st|2nd|3rd|4th|5th) place · .+ \(([0-9a-f]{12})\)$/;
  ok(lines.length === 5 && lines.every((l, i) => re.test(l.trim()) && l.trim().startsWith(["1st", "2nd", "3rd", "4th", "5th"][i])), "review lists 1st-5th with 12-hex team IDs");
  ok(new Set(lines.map((l) => l.match(re)?.[2])).size === 5, "5 distinct team IDs");
  await shot(page, "18-review-390");
  await page.click("[data-send2]"); await page.waitForTimeout(300);
  ok(page.url().endsWith("#sent") && (await page.locator("[data-line]").count()) === 5, "sent shows the 5 lines");
  ok(!(await page.locator("#pane input, #pane [data-pick]").count()), "sent is read-only");
  await shot(page, "19-sent-390");
  await ctx.close();
}

/* ---------- desktop, 1280x800: round 1 modes ---------- */
{
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => fail("page error (1280): " + e.message));
  await page.goto(URL + "#r1"); await page.waitForTimeout(500);
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem("hw13-sj-d-me", "Dana W."); });
  await page.reload(); await page.waitForTimeout(500);
  await page.evaluate(() => { UI.live = false; });
  await shot(page, "20-quick-pass-1280", { end: false });
  await page.click('[data-mode="five"]'); await page.waitForTimeout(300);
  // mouse-drag the strip
  await page.locator("[data-strip]").first().scrollIntoViewIfNeeded();
  const sb = await page.locator("[data-strip]").first().boundingBox();
  await page.mouse.move(sb.x + sb.width / 2, sb.y + sb.height / 2); await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(sb.x + sb.width / 2 - i * 11, sb.y + sb.height / 2);
  await page.mouse.up(); await page.waitForTimeout(700);
  const v = await now(page);
  ok(v > 5.5 && onHalf(v), "mouse drag on the strip sets a half-step score: " + v);
  await shot(page, "21-five-at-a-time-1280", { end: false });
  await page.click('[data-mode="one"]'); await page.waitForTimeout(300);
  await shot(page, "22-one-at-a-time-1280", { end: false });
  await page.locator("[data-rubric]").first().click(); await page.waitForTimeout(300);
  await shot(page, "23-rubric-1280", { end: false });
  await ctx.close();
}

await browser.close();
console.log(problems.length ? `\n${problems.length} problem(s)` : "\nall checks passed");
process.exit(problems.length ? 1 : 0);
