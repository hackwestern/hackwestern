// Checks + screenshots. Run from the repo root: node mocks/organizer-judging-board-v1/verify.mjs
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIR = "mocks/organizer-judging-board-v1";
const URL0 = pathToFileURL(path.resolve(DIR, "index.html")).href;
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch();

async function noSideScroll(page, name) {
  const h = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(h <= 0, `${name}: no horizontal page scroll (${h})`);
}
const fixText = (page) => page.locator("#fixes .fx-p b").allTextContents();
const applyFix = async (page, prefix) => { await page.click(`[data-fixact^="${prefix}"]`); await page.waitForTimeout(80); };

for (const [w, h] of [[1280, 800], [390, 844]]) {
  const phone = w < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} console: ${m.text()}`); });
  const shot = async (n, full = false, sel = null) => {
    await page.evaluate((sel) => { document.getElementById("toast").hidden = true; if (sel) document.querySelector(sel)?.scrollIntoView({ block: "start" }); else scrollTo(0, 0); }, sel);
    await page.waitForTimeout(150);
    return page.screenshot({ path: `${DIR}/screens/${n}-${w}.png`, fullPage: full });
  };

  await page.goto(URL0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // fonts: Figtree only
  const fonts = await page.evaluate(() => [...new Set([...document.querySelectorAll("body *")].filter((e) => e.offsetParent && e.textContent.trim()).map((e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/"/g, "").trim()))]);
  ok(fonts.length === 1 && fonts[0] === "Figtree", `${w}: Figtree only (${fonts.join(", ")})`);

  // 1. start (seeded from the sheet)
  let fx = await fixText(page);
  ok(fx.includes("4 sponsors, 3 rooms"), `${w}: fix "4 sponsors, 3 rooms"`);
  ok(fx.includes("Sun Life has no room") && (await page.locator('[data-fix="room:sunlife"] .fx-sug').textContent()).includes("Put in Rm 2235"), `${w}: fix "Sun Life has no room" -> Put in Rm 2235`);
  ok(fx.includes("T-017 presents to QNX at 10:12 and Canada Life at 10:18 (needs 10 min)") && (await page.locator('[data-fix="clash:T-017"] .fx-sug').textContent()).includes("Swap T-017's QNX slot"), `${w}: fix T-017 clash -> Swap T-017's QNX slot`);
  ok(fx.includes("Sun Life hasn't sent its shortlist") && (await page.locator('[data-fix="list:sunlife"] .fx-sug').textContent()).includes("Text their lead (copy phone)"), `${w}: fix shortlist -> Text their lead`);
  const st0 = await page.locator("#spList .st").allTextContents();
  ok(st0.join() === "Room set,Room set,Needs a room,Shortlist not sent,Room set", `${w}: start chips (${st0.join(", ")})`);
  await noSideScroll(page, `${w} start`);
  await shot("01-start");
  await shot("01-start-full", true);

  // 2. tap the empty room -> assign form
  await page.click('.rmh[data-room="r2235"]');
  ok(await page.locator("[data-assign]").count() === 4, `${w}: empty room offers the 4 in-person sponsors`);
  await shot("02-assign-empty-room", false, "#roomsCard");
  await page.click("[data-close]");

  // 3. auto-assign: QNX (most teams) gets Rm 2235
  await page.click("#auto");
  const a = await page.evaluate(() => window.__board.state.assign);
  ok(a.qnx === "r2235" && a.scotia === "r2230" && a.canadalife === "r2110" && !a.sunlife, `${w}: auto-assign keeps sheet rooms, QNX -> 2235 (${JSON.stringify(a)})`);
  fx = await fixText(page);
  ok(!fx.includes("Sun Life has no room"), `${w}: no "Put in" fix when no room is free`);
  await noSideScroll(page, `${w} auto`);
  await shot("03-auto-assigned", false, "#h-fx");

  // 4. apply fixes
  await applyFix(page, "clash:T-017");
  const cl = await page.evaluate(() => window.__board.findClashes(window.__board.state.order, window.__board.SPONSORS).length);
  ok(cl === 0, `${w}: swap fix leaves no clashes`);
  await applyFix(page, "count");
  ok(await page.locator('.rmh:has-text("Rm 2240")').count() === 1, `${w}: Add a room fix adds Rm 2240`);
  ok((await page.locator('[data-fix="room:sunlife"] .fx-sug').textContent()).includes("Put in Rm 2240"), `${w}: Sun Life now offered Rm 2240`);
  await applyFix(page, "room:sunlife");
  await applyFix(page, "list:sunlife");
  ok(await page.locator("#fixes .fx").count() === 0, `${w}: all fixes applied`);
  ok((await page.locator('[data-sp="sunlife"] .flag.soft').textContent()).includes("Lead texted"), `${w}: Sun Life shows "Lead texted"`);
  await shot("04-fixes-applied", false, phone ? "#roomsCard" : null);

  // 5. schedule presentations
  await page.click("#schedule");
  ok(await page.locator("#notifiedMsg").count() === 1, `${w}: bar says teams notified`);
  await page.click('[data-open="scotia"]');
  await noSideScroll(page, `${w} sponsor open`);
  await shot("05-sponsor-open", false, '[data-sp="scotia"]');
  await page.click('[data-open="scotia"]');

  // 6. move a sponsor -> bar asks to schedule again
  await page.click('.rmh[data-room="r2235"]');
  ok(await page.locator("[data-moveto]").count() === 0, `${w}: no free room -> no move targets`);
  await page.click("#addRoomBtn");
  await page.fill("#arName", "Rm 3100");
  await page.fill("#arSeats", "12");
  await shot("06-add-room-form", false, phone ? "#detail" : null);
  await page.click('#addForm [type="submit"]');
  ok(await page.locator('.rmh:has-text("Rm 3100")').count() === 1, `${w}: Add a room form adds a row`);
  await page.click('.rmh[data-room="r2235"]');
  await page.click('[data-moveto]');
  ok(await page.locator("#schedule").count() === 1, `${w}: moving QNX asks to schedule again`);
  await shot("07-moved", false, phone ? "#roomsCard" : null);
  await page.click("#schedule");

  // 7. schedule view
  await page.click('[data-view="sch"]');
  await noSideScroll(page, `${w} schedule`);
  await shot("08-schedule", false, "#roomsCard");

  // 8. 10:30 AM
  await page.click('[data-time="630"]');
  const st2 = await page.locator("#spList .st").allTextContents();
  ok(st2.join() === "Judging,Judging,Judging,Shortlist not sent,Judging", `${w}: 10:30 judging, Sun Life still not sent (${st2.join(", ")})`);
  ok((await fixText(page)).includes("Canada Life has no reps judging yet"), `${w}: 10:30 no-reps-judging fix`);
  ok((await page.locator(".pill.p-sc").first().textContent()).startsWith("Scored by"), `${w}: scored-by pills`);
  await shot("09-1030-schedule", false, "#roomsCard");
  await page.click('[data-view="cal"]');
  await noSideScroll(page, `${w} 10:30 calendar`);
  await shot("10-1030-calendar", false, phone ? "#roomsCard" : null);

  // 9. 12:05 PM
  await page.click('[data-time="725"]');
  const st3 = await page.locator("#spList .st").allTextContents();
  ok(st3.filter((s) => s === "Top 5 in").length === 3, `${w}: 12:05 three Top 5 in (${st3.join(", ")})`);
  await page.click('[data-open="qnx"]');
  ok(await page.locator(".top5 li").count() === 5, `${w}: ranked top 5 shown`);
  await noSideScroll(page, `${w} 12:05`);
  await shot("11-1205", false, '[data-sp="qnx"]');

  // 10. variant: schedule first (fresh page)
  await page.goto(URL0);
  await page.waitForTimeout(200);
  await page.click('[data-layout="sch"]');
  const tabs = await page.locator("#seg button").allTextContents();
  ok(tabs.join() === "Schedule,Calendar" && (await page.locator(".sch").count()) === 1, `${w}: schedule-first variant (${tabs.join(", ")})`);
  await noSideScroll(page, `${w} schedule-first`);
  await shot("12-variant-schedule-first", false, phone ? "#roomsCard" : null);

  // help
  await page.click("#helpBtn");
  ok(await page.locator("#help").isVisible(), `${w}: help opens`);
  await page.keyboard.press("Escape");
  ok(!(await page.locator("#help").isVisible()), `${w}: Esc closes help`);
  await ctx.close();
}

ok(errors.length === 0, `no page errors ${errors.join(" | ")}`);
await browser.close();
console.log(fails ? `\n${fails} FAILED` : "\nALL PASS");
process.exit(fails ? 1 : 0);
