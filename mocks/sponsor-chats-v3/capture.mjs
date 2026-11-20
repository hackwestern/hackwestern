// Checks + screenshots for the sponsor-chats-v3 mock. Run from the repo root:
// node mocks/sponsor-chats-v3/capture.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const BASE = pathToFileURL(path.join(DIR, "index.html")).href;
const SHOTS = path.join(DIR, "screens");
fs.mkdirSync(SHOTS, { recursive: true });

const results = [];
const check = (name, ok, extra = "") => results.push([ok ? "PASS" : "FAIL", name, ok ? "" : extra]);
const browser = await chromium.launch();
const pageErrors = [];
const shots = [];

async function open(w, h, stage, hash = "chats", { prize = true } = {}) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, hasTouch: w < 768, isMobile: w < 768 });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(`${stage}#${hash}@${w}: ${e.message}`));
  await page.goto(`${BASE}?stage=${stage}${prize ? "" : "&prize=0"}#${hash}`);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(200);
  return { ctx, page };
}

// no sideways page scroll, no clipped text, no Pix32, company names on one line, every tap target at least 44 x 44
async function layout(page, label) {
  const r = await page.evaluate(() => {
    const out = [];
    if (document.documentElement.scrollWidth > window.innerWidth + 1) out.push(`page scrolls sideways (${document.documentElement.scrollWidth}px)`);
    for (const el of document.querySelectorAll("#pane *, .mscrim.on *")) {
      if (el.closest(".sr,[hidden],.cal-scroll") || !el.childNodes.length) continue;
      if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) continue;
      const cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden") continue;
      if (el.scrollWidth > el.clientWidth + 1 && cs.overflow !== "visible" && el.clientWidth > 0) out.push(`clipped: "${el.textContent.trim().slice(0, 40)}"`);
    }
    if ([...document.querySelectorAll("*")].some((e) => /Pix32/.test(getComputedStyle(e).fontFamily))) out.push("Pix32 used");
    for (const c of document.querySelectorAll(".co")) { if (c.getClientRects().length > 1) out.push(`company name wraps: "${c.textContent}"`); }
    const modal = document.querySelector(".mscrim.on");
    const scope = modal ? [modal] : [document.querySelector(".app")];
    for (const root of scope) for (const el of root.querySelectorAll("a[href],button,input,select,textarea,[role=checkbox]")) {
      if (el.disabled || el.closest(".sr,.mock,[hidden]")) continue;
      const rects = el.getClientRects(); if (!rects.length) continue;
      const b = el.getBoundingClientRect(); if (!b.width || !b.height) continue;
      if (getComputedStyle(el).visibility === "hidden") continue;
      if (b.width < 43.5 || b.height < 43.5) out.push(`small target ${Math.round(b.width)}x${Math.round(b.height)}: "${(el.getAttribute("aria-label") || el.textContent || el.id).trim().slice(0, 30)}"`);
    }
    return out;
  });
  check(`layout ${label}`, !r.length, r.slice(0, 5).join("; "));
}
async function shot(page, name, full = true) {
  await page.waitForTimeout(150);
  await layout(page, name);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: full });
  shots.push(name);
}
const T = (page, sel) => page.innerText(sel);
const vis = (page, sel) => page.locator(sel).first().isVisible();

for (const [w, h, tag] of [[390, 844, "390"], [1280, 800, "1280"]]) {
  const desk = w >= 768;
  // ---- the four stages
  for (const st of ["new", "prefs", "short", "conf"]) {
    const { ctx, page } = await open(w, h, st);
    const steps = await page.evaluate(() => [...document.querySelectorAll("#steps > li:not(.arr)")].map((l) => l.className));
    const want = { new: ["cur", "lock"], prefs: ["done", "cur"], short: ["done", "done"], conf: ["done", "done"] }[st];
    check(`[${tag} ${st}] 2-step line: ${want.join(" / ")}`, JSON.stringify(steps) === JSON.stringify(want), JSON.stringify(steps));
    check(`[${tag} ${st}] title is Coffee chats`, (await T(page, desk ? ".desk-h h1" : ".m-hi")).trim() === "Coffee chats");
    const sb = await page.locator("#scanTop").boundingBox();
    if (desk) check(`[${tag} ${st}] Scan a hacker sits top right of the page header`, !!sb && sb.y < 120 && sb.x + sb.width > w - 120 && sb.height >= 52, JSON.stringify(sb));
    else check(`[${tag} ${st}] no in-page Scan button on phones (it's the centre tab)`, !sb);
    const txt = await T(page, "#pane");
    if (st === "new") {
      check(`[${tag} new] one card, Send availability + Start`, (await page.locator("#pane section.card").count()) === 1 && (await T(page, "#suH")).trim() === "Send availability" && (await T(page, "#startSetup")).trim() === "Start");
      check(`[${tag} new] step 2 greyed: Unlocks after step 1`, txt.includes("Unlocks after step 1"));
    }
    if (st === "prefs") {
      check(`[${tag} prefs] preferences shrink to one line with Change`, (await T(page, "#dlPrefs")).replace(/\s+/g, " ").includes("Availability sent · Change") && (await page.locator("#availRO, #availGrid").count()) === 0);
      check(`[${tag} prefs] shortlist card: optional, Start shortlist, met-first note, seats`, txt.includes("Pick hackers you'd like to meet (optional)") && txt.includes("People you met at your booth are invited first") && /17\s*seats/.test(txt) && (await T(page, "#startShort")).trim() === "Start shortlist", txt.slice(0, 300));
    }
    if (st === "short") {
      check(`[${tag} short] Shortlist sent (6) · Edit + 10 PM line`, (await T(page, "#dlShort")).replace(/\s+/g, " ").includes("Shortlist sent (6) · Edit") && txt.includes("We'll confirm your chat times by 10 PM tonight."));
    }
    if (st === "conf") {
      const c = await page.evaluate(() => MOCK.liveCounts());
      check(`[${tag} conf] top line: N hackers confirmed · N waiting`, (await T(page, "#sumLine")).replace(/\s+/g, " ").includes(`${c.conf} hackers confirmed · ${c.off} waiting`), await T(page, "#sumLine"));
      check(`[${tag} conf] calendar: reps x sessions, rooms with building`, (await page.locator("[data-calrow]").count()) === 4 && txt.includes("Main building") && txt.includes("Ivey, 15 min walk"));
      check(`[${tag} conf] hackers only Accepted / Waiting (no declined, no open seats)`, txt.includes("Accepted") && txt.includes("Waiting") && (await page.locator(".sdot.st-confirmed").count()) > 1 && !/Declined|open seat|Offered/i.test(txt));
      check(`[${tag} conf] preferences and shortlist hidden; one quiet link`, !txt.includes("Availability sent") && !txt.includes("Shortlist sent") && (await T(page, "#changeAsk")).trim() === "Change your team or times");
    }
    await shot(page, `stage-${st}-${tag}`);
    await ctx.close();
  }

  // ---- confirmed: rep chips, List toggle, the change warning
  {
    const { ctx, page } = await open(w, h, "conf");
    await page.click('[data-ycrep="r2"]');
    check(`[${tag} conf] rep chip filters the calendar`, (await page.locator("[data-calrow]").count()) === 1);
    await page.click('[data-ycview="list"]');
    check(`[${tag} conf] List follows the filter`, (await page.locator("[data-chatgroup]").count()) === 1 && (await page.locator("#ycCal").count()) === 0);
    await page.click('[data-ycrep="all"]');
    await shot(page, `conf-list-${tag}`);
    await page.click('[data-ycview="cal"]');
    await page.click("#changeAsk");
    const n = await page.evaluate(() => MOCK.bookedCount());
    const m = await T(page, "#modal");
    check(`[${tag} conf] Change opens the warning first`, (await vis(page, "#modal")) && m.includes("Invites are already out") && m.includes(`${n} invited hackers`), m.slice(0, 200));
    const bg = await page.$eval("#warnGo", (e) => getComputedStyle(e).backgroundColor);
    check(`[${tag} conf] the warning's primary button is red`, bg === "rgb(180, 35, 24)", bg);
    await shot(page, `change-warning-${tag}`, false);
    await page.keyboard.press("Escape");
    check(`[${tag} conf] Esc closes the warning and returns focus`, !(await vis(page, "#modal")) && (await page.evaluate(() => document.activeElement?.id)) === "changeAsk");
    await page.click("#changeAsk"); await page.click("#warnGo"); await page.waitForTimeout(150);
    check(`[${tag} conf] Change anyway opens the times with the warning banner and a red Save`, (await page.evaluate(() => location.hash)) === "#chats-2" && (await T(page, "#editWarn")).includes("Invites are already out") && (await page.$eval("[data-saveedit]", (e) => e.className)).includes("btn-danger"));
    await shot(page, `conf-editing-${tag}`);
    await ctx.close();
  }

  // ---- scan
  for (const st of ["prefs", "conf"]) {
    const { ctx, page } = await open(w, h, st, "scan");
    if (st === "conf") await shot(page, `scan-camera-${tag}`);
    await page.click("[data-scanmode='id']");
    await page.fill("#hid", "HW-1043");
    await page.click("[data-findhid]");
    check(`[${tag} ${st}] hacker ID finds the hacker`, (await T(page, "#scanWho")).includes("Felix J."));
    if (st === "conf") await shot(page, `scan-found-${tag}`);
    await page.click("[data-addlist]");
    const res = await T(page, "#scanRes");
    check(`[${tag} ${st}] Add to my list`, st === "conf" ? /^Offered .+ with /.test(res) : res.includes("invited before"), res);
    await page.click('[data-scanrep="r3"]');
    check(`[${tag} ${st}] optional Who talked to them? picks a rep`, (await page.getAttribute('[data-scanrep="r3"]', "aria-pressed")) === "true" && (st !== "conf" || (await T(page, "#scanRes")).includes("Priya S.")));
    await shot(page, `scan-added-${st}-${tag}`);
    if (st === "conf") {
      await page.evaluate(() => (location.hash = "chats"));
      await page.waitForTimeout(150);
      check(`[${tag} conf] the scanned hacker shows as Waiting in Your chats`, /Felix J\.\s*·\s*Waiting/.test(await page.textContent("#ycCal")));
    } else {
      await page.evaluate(() => (location.hash = "short-1"));
      await page.click('[data-smode="list"]');
      check(`[${tag} prefs] the scanned hacker is in the shortlist's met-at-your-booth group`, (await T(page, "#scannedGrp")).includes("Felix J."));
    }
    await ctx.close();
  }

  // ---- the full setup flow from Not started
  {
    const { ctx, page } = await open(w, h, "new");
    await page.click("#startSetup");
    check(`[${tag}] Start opens Your team`, (await page.evaluate(() => location.hash)) === "#chats-1");
    await shot(page, `flow-team-empty-${tag}`);
    await page.click("[data-demoteam]");
    await page.click("[data-nextteam]"); await page.waitForTimeout(100);
    check(`[${tag}] no Longer chats option, no hackers-free counts`, !(await T(page, "#pane")).match(/Longer chats|hackers free/i));
    for (let i = 0; i < 2; i++) await page.click("#ch-r4-m");
    check(`[${tag}] chats per rep can be 0`, (await T(page, "#chv-r4")).trim() === "0" && (await T(page, "#cht-r4")).includes("No chats"));
    await shot(page, `flow-prefs-${tag}`);
    await page.click("[href='#chats-3'][data-next]");
    await shot(page, `flow-review-${tag}`);
    await page.click("[data-submitprefs]"); await page.waitForTimeout(150);
    check(`[${tag}] submit goes back to Coffee chats, stage 2`, (await page.evaluate(() => location.hash)) === "#chats" && (await page.getAttribute("#chatsPage", "data-stage")) === "prefs");
    await page.click("#startShort");
    await shot(page, `flow-shortlist-${tag}`);
    check(`[${tag}] shortlist has no Who's shortlisting?`, !(await T(page, "#pane")).includes("Who's shortlisting"));
    await page.click("[data-oshort]"); await page.click("[data-oshort]");
    await page.click("[href='#short-2'][data-next]");
    await page.click("[data-submitshort]"); await page.waitForTimeout(150);
    check(`[${tag}] submit shortlist: Shortlist sent (2)`, (await T(page, "#dlShort")).includes("Shortlist sent (2)"));
    await page.click("[data-changeprefs]");
    check(`[${tag}] Change before invites opens times without the red warning`, (await page.evaluate(() => location.hash)) === "#chats-2" && !(await T(page, "#editWarn")).includes("Invites are already out"));
    await ctx.close();
  }

  // ---- home (Open your booth -> Scan) and the nav
  {
    const { ctx, page } = await open(w, h, "prefs", "home");
    const b = page.locator('[data-step="f3"]');
    check(`[${tag}] Home's Friday Open your booth step has Scan`, (await b.count()) === 1 && (await b.getAttribute("href")) === "#scan");
    await shot(page, `home-${tag}`);
    await b.click();
    check(`[${tag}] ... and it opens the scan screen`, (await page.evaluate(() => location.hash)) === "#scan");
    if (desk) {
      const nav = await page.evaluate(() => [...document.querySelectorAll("#snav .navl")].map((a) => a.textContent.trim()).join(" · ") + " | " + document.querySelector("#snavL").textContent);
      check(`[${tag}] side nav: Home · Schedule · Map · (Your tasks) Chats · Judging`, nav === "Home · Schedule · Map · Chats · Judging | Your tasks", nav);
      const hb = await page.locator("#sideHelp").boundingBox();
      check(`[${tag}] Help bottom left of the side nav`, hb && hb.x < 100 && hb.y > h - 160, JSON.stringify(hb));
    } else {
      const tabs = await page.evaluate(() => [...document.querySelectorAll("#tabs a")].map((a) => a.textContent.trim()));
      check(`[${tag}] tab bar: Home · Chats · Scan · Schedule · Map · Judge (short for Judging)`, tabs.join(" · ") === "Home · Chats · Scan · Schedule · Map · Judge", tabs.join(" · "));
      const g = await page.evaluate(() => { const c = document.querySelector(".scan-c").getBoundingClientRect(), t = document.querySelector("#tabs").getBoundingClientRect(); return { w: c.width, h: c.height, raised: t.top - c.top, round: getComputedStyle(document.querySelector(".scan-c")).borderRadius }; });
      check(`[${tag}] Scan tab is a raised 56 px circle`, g.w === 56 && g.h === 56 && g.raised > 8 && g.round === "999px", JSON.stringify(g));
      await page.evaluate(() => (location.hash = "chats")); await page.waitForTimeout(150);
      await layout(page, "tabbar-390");
      await page.screenshot({ path: path.join(SHOTS, "tabbar-390.png"), clip: { x: 0, y: h - 170, width: w, height: 170 } }); shots.push("tabbar-390");
    }
    await ctx.close();
  }
  // ---- no prize track hides Judging
  {
    const { ctx, page } = await open(w, h, "conf", "chats", { prize: false });
    const j = await page.evaluate(() => [...document.querySelectorAll("#tabs a, #snav a")].some((a) => /Judging/.test(a.textContent)));
    check(`[${tag}] no prize track: Judging hidden`, !j);
    if (!desk) {
      const tabs = await page.evaluate(() => [...document.querySelectorAll("#tabs a")].map((a) => a.textContent.trim()));
      check(`[${tag}] no prize track tab bar: Home · Chats · Scan · Schedule · Map`, tabs.join(" · ") === "Home · Chats · Scan · Schedule · Map", tabs.join(" · "));
      const off = await page.evaluate(() => { const c = document.querySelector(".scan-c").getBoundingClientRect(); return Math.abs(c.left + c.width / 2 - window.innerWidth / 2); });
      check(`[${tag}] no prize track: Scan is the centre tab`, off < 1.5, `${off}px off centre`);
      await page.screenshot({ path: path.join(SHOTS, "tabbar-noprize-390.png"), clip: { x: 0, y: h - 170, width: w, height: 170 } }); shots.push("tabbar-noprize-390");
    }
    await ctx.close();
  }
}
// ---- v2: Schedule (chats merged in) and Map, at both widths
for (const [w, h, tag] of [[390, 844, "390"], [1280, 800, "1280"]]) {
  // confirmed: Saturday, Everyone
  {
    const { ctx, page } = await open(w, h, "conf", "schedule");
    check(`[${tag}] Schedule page title`, (await T(page, w >= 768 ? ".desk-h h1" : ".m-hi")).trim() === "Schedule");
    check(`[${tag}] Schedule nav item is current`, (await page.locator(`${w >= 768 ? "#snav" : "#tabs"} [data-nav="schedule"][aria-current="page"]`).count()) === 1);
    check(`[${tag} conf] Schedule opens on Saturday (the mock's day)`, (await page.getAttribute('[data-sday="sat"]', "aria-pressed")) === "true");
    const blocks = await page.evaluate(() => MOCK.S.blocks.length);
    check(`[${tag} conf] one chat block per rep session`, (await page.locator("[data-chatblk]").count()) === blocks && blocks === 6, `${blocks}`);
    const dana = await page.getAttribute('[data-chatblk="r1-10-11"]', "aria-label");
    check(`[${tag} conf] a block reads rep, time, room, chats, accepted and waiting`, /^Coffee chats, Dana W\., 10 AM to 11 AM, Rm 2242, 4 chats, \d+ accepted, \d+ waiting/.test(dana), dana);
    const vis1 = await T(page, '[data-chatblk="r1-10-11"]');
    check(`[${tag} conf] the 1-hour block shows every line`, ["COFFEE CHATS", "Dana W.", "10:00–11:00", "Rm 2242", "4 chats", "accepted", "waiting"].every((x) => vis1.includes(x)), vis1);
    const part = await page.evaluate(() => { const b = document.querySelector('[data-chatblk-li="r1-11-12"]').getBoundingClientRect(), f = document.querySelector('[data-chatblk-li="r1-10-11"]').getBoundingClientRect(); return { h: b.height, full: f.height, txt: document.querySelector('[data-chatblk="r1-11-12"]').textContent }; });
    check(`[${tag} conf] a partial session shows its real window (11:00–11:30, half the height)`, part.txt.includes("11:00–11:30") && Math.abs(part.h - part.full / 2) < 2, JSON.stringify(part));
    const colour = await page.$eval('[data-chatblk="r1-10-11"]', (e) => getComputedStyle(e).borderLeftColor);
    check(`[${tag} conf] chat blocks have their own colour, named in the legend`, colour === "rgb(107, 69, 194)" && (await T(page, "#dgLeg")).includes("Your coffee chats"), colour);
    const sb = await T(page, "#schedBody");
    check(`[${tag} conf] chats sit alongside the workshop, booth and meals`, /Sun\sLife Workshop/.test(sb) && sb.includes("Sponsor Bay Open") && sb.includes("Lunch"));
    const chips = await page.evaluate(() => [...document.querySelectorAll("#sReps .chip")].map((c) => c.textContent.trim()).join(" · "));
    check(`[${tag} conf] rep chips: Everyone · Dana · Marcus · Priya · Leo`, chips === "Everyone · Dana · Marcus · Priya · Leo", chips);
    await shot(page, `schedule-conf-${tag}`);
    // one rep
    const others = await page.locator(".dg-li:not(.chat)").count();
    await page.click('[data-srep="r1"]');
    const ids = await page.evaluate(() => [...document.querySelectorAll("[data-chatblk]")].map((b) => b.dataset.chatblk));
    check(`[${tag} conf] a rep chip shows only that rep's chats`, ids.length === 2 && ids.every((x) => x.startsWith("r1-")), ids.join(","));
    check(`[${tag} conf] ... and filters only the chat blocks`, (await page.locator(".dg-li:not(.chat)").count()) === others);
    check(`[${tag} conf] ... focus stays on the chip`, (await page.evaluate(() => document.activeElement?.dataset.srep)) === "r1");
    await shot(page, `schedule-conf-dana-${tag}`);
    // the sheet
    await page.click('[data-chatblk="r1-10-11"]');
    const m = await T(page, "#modal");
    check(`[${tag} conf] tapping a block opens that hour's chats`, (await vis(page, "#modal")) && m.includes("Dana W.'s coffee chats") && m.includes("Rm 2242 · Main building") && (await page.locator("#sheetList li").count()) >= 1, m.slice(0, 200));
    check(`[${tag} conf] the sheet shows hackers as Accepted / Waiting only`, m.includes("Accepted") && !/Declined|open seat|empty/i.test(m));
    check(`[${tag} conf] the sheet links to Your chats`, (await T(page, "#sheetOpen")).trim() === "Open in Your chats");
    await shot(page, `schedule-sheet-${tag}`, false);
    await page.keyboard.press("Escape");
    check(`[${tag} conf] Esc closes the sheet and returns focus to the block`, !(await vis(page, "#modal")) && (await page.evaluate(() => document.activeElement?.dataset.chatblk)) === "r1-10-11");
    await page.click('[data-chatblk="r1-11-12"]');
    await page.click("#sheetOpen"); await page.waitForTimeout(150);
    check(`[${tag} conf] Open in Your chats goes to Chats, filtered to that rep`, (await page.evaluate(() => location.hash)) === "#chats" && (await page.locator("[data-calrow]").count()) === 1 && (await page.getAttribute('[data-ycrep="r1"]', "aria-pressed")) === "true");
    // other days have no chat blocks or chips
    await page.evaluate(() => (location.hash = "schedule")); await page.waitForTimeout(100);
    await page.click('[data-sday="sun"]');
    check(`[${tag} conf] Sunday: no chat blocks, no rep chips`, (await page.locator("[data-chatblk], #sReps").count()) === 0);
    await page.click('[data-sday="sat"]');
    await page.check("#dgHk");
    check(`[${tag} conf] Show hackathon events adds them (and the legend says so)`, (await page.locator(".dg-li.muted").count()) > 0 && (await T(page, "#dgLeg")).includes("Hackathon events"));
    await layout(page, `schedule-hk-${tag}`);
    await ctx.close();
  }
  // before confirmation: one placeholder on Saturday
  for (const st of ["new", "prefs", "short"]) {
    const { ctx, page } = await open(w, h, st, "schedule");
    check(`[${tag} ${st}] Schedule opens on Friday (the mock's day)`, (await page.getAttribute('[data-sday="fri"]', "aria-pressed")) === "true");
    await page.click('[data-sday="sat"]');
    check(`[${tag} ${st}] Saturday: one placeholder block, no reps, no chips`, (await page.locator("#chatPh").count()) === 1 && (await T(page, "#chatPh")).includes("Coffee chats: times confirmed Fri 10 PM") && (await page.locator("[data-chatblk], #sReps").count()) === 0);
    if (st === "prefs") await shot(page, `schedule-prefs-${tag}`);
    await ctx.close();
  }
  // Map
  {
    const { ctx, page } = await open(w, h, "conf", "map");
    check(`[${tag}] Map: Sponsor Bay with the booth highlighted`, (await T(page, "#mapBody")).includes("Right wall, middle booth") && (await page.locator(".bay .me").count()) === 1);
    check(`[${tag}] Map: floor plans, Level 1 / Level 2`, (await page.locator("[data-floor]").count()) === 2);
    await page.click('[data-floor="2"]');
    check(`[${tag}] Map: Level 2 switches the plan`, (await page.getAttribute('[data-floor="2"]', "aria-pressed")) === "true" && (await page.locator('img[src$="floor2.webp"]').count()) >= 1);
    await page.click('[data-floor="1"]');
    await page.waitForFunction(() => [...document.images].every((i) => i.complete));
    await shot(page, `map-${tag}`);
    await ctx.close();
  }
}
// phone tab bar at 360 and 390, with and without Judging: every label fits inside its tab
for (const w of [360, 390]) for (const prize of [true, false]) {
  const { ctx, page } = await open(w, 800, "conf", "schedule", { prize });
  const r = await page.evaluate(() => [...document.querySelectorAll("#tabs a")].map((a) => { const b = a.getBoundingClientRect(), t = a.querySelector(".tlab"), l = t.getBoundingClientRect(); return { t: a.textContent.trim(), w: Math.round(b.width), h: Math.round(b.height), fits: l.left >= b.left - 0.5 && l.right <= b.right + 0.5 && t.scrollWidth <= l.width + 0.5 }; }));
  check(`[${w}${prize ? "" : " no prize"}] tab bar: ${r.length} tabs, every label fits, every tab 44 px+`, r.length === (prize ? 6 : 5) && r.every((x) => x.fits && x.w >= 44 && x.h >= 44), JSON.stringify(r));
  await layout(page, `tabbar-${w}${prize ? "" : "-noprize"}`);
  const name = `tabbar-${prize ? "judging" : "nojudging"}-${w}`;
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), clip: { x: 0, y: 800 - 130, width: w, height: 130 } }); shots.push(name);
  await ctx.close();
}

// ---- v3 changes, at both widths
const elShot = async (page, sel, name) => { await page.waitForTimeout(150); await layout(page, name); const st = await page.addStyleTag({ content: "#mockp,#tabs,.top,.toast{visibility:hidden!important}" }); await page.locator(sel).screenshot({ path: path.join(SHOTS, `${name}.png`) }); await st.evaluate((e) => e.remove()); shots.push(name); };
for (const [w, h, tag] of [[390, 844, "390"], [1280, 800, "1280"]]) {
  const desk = w >= 768;
  // 1 + 2: availability grid starts all ticked; step 1 is "Send availability" everywhere
  {
    const { ctx, page } = await open(w, h, "new");
    check(`[${tag}] 2-step line says 1 Send availability → 2 Hackers you'd like to meet`, (await T(page, "#steps")).replace(/\s+/g, " ").includes("Send availability") && (await T(page, "#steps")).includes("Hackers you'd like to meet"));
    await page.click("#startSetup"); await page.click("[data-demoteam]");
    await page.click("[data-nextteam]"); await page.waitForTimeout(150);
    const g = await page.evaluate(() => { const t = [...document.querySelectorAll("#availGrid [data-tick]")], l = [...document.querySelectorAll("#availGrid .av-t.blk")]; return { n: t.length, on: t.filter((x) => x.getAttribute("aria-checked") === "true").length, locked: l.length, lockedDisabled: l.every((x) => x.disabled && !x.querySelector(".tk")) }; });
    check(`[${tag}] availability: every open session starts ticked (${g.on}/${g.n})`, g.n === 16 && g.on === g.n, JSON.stringify(g));
    check(`[${tag}] availability: workshop sessions stay unticked and locked`, g.locked === 8 && g.lockedDisabled, JSON.stringify(g));
    check(`[${tag}] availability: hint is "Untick any time a rep isn't free."`, (await T(page, "#untick")).trim() === "Untick any time a rep isn't free.");
    check(`[${tag}] flow heading is Send availability`, (await T(page, "#flowPrefs h1")).trim() === "Send availability");
    const rail = await page.getAttribute(".stepper nav", "aria-label");
    check(`[${tag}] step rail is labelled Send availability`, rail === "Send availability parts", rail);
    await shot(page, `avail-ticked-${tag}`);
    await page.click("[href='#chats-3'][data-next]");
    check(`[${tag}] submit button says Send availability`, (await T(page, "[data-submitprefs]")).trim() === "Send availability");
    await page.click("[data-submitprefs]"); await page.waitForTimeout(150);
    check(`[${tag}] done line: ✓ Availability sent · Change`, (await T(page, "#dlPrefs")).replace(/\s+/g, " ").includes("Availability sent · Change"));
    check(`[${tag}] no "Chat times" or "Chatting preferences" left in step 1`, !/Chat times|Chatting preferences/.test(await page.evaluate(() => document.querySelector("#pane").innerHTML + document.querySelector("#toast").innerHTML)));
    await ctx.close();
  }
  // 3 + 4: shortlist shows all 40; icon links
  {
    const { ctx, page } = await open(w, h, "prefs", "short-1");
    check(`[${tag}] one at a time pages through all 40`, (await T(page, "#oneLeft")).includes("Hacker 1 of 40") && (await T(page, "#oneLeft")).includes("40 hackers left"), await T(page, "#oneLeft"));
    const ic = await page.evaluate(() => { const h = MOCK.UI && document.querySelector("#swc"); return [...h.querySelectorAll(".lkb")].map((a) => { const b = a.getBoundingClientRect(); return { l: a.getAttribute("aria-label"), t: a.getAttribute("title"), w: b.width, h: b.height, svg: !!a.querySelector("svg"), txt: a.textContent.trim() }; }); });
    check(`[${tag}] hacker card: profile links are 44 px icon buttons with aria-label + title, no text`, ic.length >= 3 && ic.every((x) => x.w >= 44 && x.h >= 44 && x.svg && !x.txt && /^Avery K\.'s (Résumé|LinkedIn|GitHub|Website|Devpost)$/.test(x.l) && x.t), JSON.stringify(ic));
    await elShot(page, "#swc", `hacker-card-icons-${tag}`);
    // a hacker without every link shows only the icons they have
    await page.click("[data-oskip]"); await page.click("[data-oskip]"); await page.click("[data-oskip]");
    const c3 = await page.evaluate(() => { const id = +document.querySelector("#swc").dataset.swc, hk = document.querySelectorAll("#swc .lkb").length; return { id, hk }; });
    check(`[${tag}] only the icons a hacker has (Priya S.: no GitHub)`, c3.id === 3 && c3.hk === 4 && (await page.locator('#swc [data-link="github"]').count()) === 0, JSON.stringify(c3));
    await page.click('[data-smode="list"]');
    check(`[${tag}] list: 40 hackers interested in Sun Life`, (await T(page, "#poolLine")).replace(/\s+/g, " ").trim() === "40 hackers interested in Sun Life");
    check(`[${tag}] list: Everyone 40`, /Everyone\s*40/.test(await T(page, '[data-sview="all"]')));
    await shot(page, `shortlist-list-40-${tag}`);
    const seen = new Set(); for (let i = 0; i < 6; i++) { (await page.evaluate(() => [...document.querySelectorAll("#pane .hrow")].map((a) => a.getAttribute("aria-label")))).forEach((x) => seen.add(x)); const n = page.locator('#pager [data-spage]:has-text("Next")'); if (await n.isDisabled()) break; await n.click(); }
    check(`[${tag}] list pages through all 40`, seen.size === 40, `${seen.size}`);
    // met at your booth stays pinned first
    await page.evaluate(() => { MOCK.UI.met.push({ h: 30, rep: "r2" }); MOCK.UI.spage = 0; MOCK.render(); });
    const firstRow = await page.evaluate(() => document.querySelector("#pane .hrow")?.getAttribute("aria-label"));
    check(`[${tag}] list: Met at your booth pinned first`, firstRow === "Chloe D." && (await T(page, "#scannedGrp")).includes("Met at your booth"), firstRow);
    await page.click('[data-smode="one"]');
    check(`[${tag}] one at a time: met hacker first, marked invited first`, (await T(page, "#swc")).includes("Chloe D.") && (await T(page, "#swc")).includes("Invited first"));
    await ctx.close();
  }
  // 5: Key rooms on Home follow the stage
  for (const st of ["new", "prefs", "short", "conf"]) {
    const { ctx, page } = await open(w, h, st, "home");
    const kr = (await T(page, "#krChats")).replace(/\s+/g, " ");
    if (st !== "conf") check(`[${tag} ${st}] Key rooms: Coffee chats · Rooms assigned Fri 10 PM`, kr.includes("Coffee chats") && kr.includes("Rooms assigned Fri 10 PM"), kr);
    else check(`[${tag} conf] Key rooms: real rooms, Ivey walk, each rep's room`, /Rm 2242/.test(kr) && /Ivey Rm 1352/.test(kr) && kr.includes("(15 min walk)") && kr.includes("Dana W.: Rm 2242") && kr.includes("Marcus O.: Ivey Rm 1352"), kr);
    if (st === "prefs" || st === "conf") { await shot(page, `home-${st}-${tag}`); await elShot(page, "#krCard", `keyrooms-${st}-${tag}`); }
    await ctx.close();
  }
  // 6 + 7: contacts and welcome
  {
    const { ctx, page } = await open(w, h, "prefs", "home");
    const order = await page.evaluate(() => [...document.querySelector("#pane").children].map((e) => e.id || e.className).slice(0, 4).join(" > "));
    check(`[${tag}] Home order: greeting > welcome > contacts > Up next`, order === "greet > welcomeA > contactsCard > upCard", order);
    const ct = (await T(page, "#contactsCard")).replace(/\s+/g, " ");
    check(`[${tag}] contacts: point of contact Daniel Wang 555-0101, emergency Noah Medland 555-0102`, /Your point of contact Daniel Wang 555-0101/i.test(ct) && /Emergency contact Noah Medland 555-0102/i.test(ct), ct);
    check(`[${tag}] contacts: Call links dial the numbers`, (await page.locator('#contactsCard a[href="tel:5550101"]').count()) === 1 && (await page.locator('#contactsCard a[href="tel:5550102"]').count()) === 1);
    await page.click('#ct-emerg [data-copy]');
    check(`[${tag}] contacts: Copy copies that number`, (await T(page, "#toast")).includes("Copied 555-0102"));
    await elShot(page, "#contactsCard", `contacts-${tag}`);
    const wa = (await T(page, "#welcomeA")).replace(/\s+/g, " ");
    check(`[${tag}] welcome A: card with the Gold thank-you`, wa.includes("Welcome to Hack Western 13!") && wa.includes("Thank you so much for being a Gold sponsor."), wa);
    const ff = await page.$eval("#welcomeA h2", (e) => getComputedStyle(e).fontFamily);
    check(`[${tag}] welcome A: Figtree, no Pix32`, /Figtree/.test(ff) && !/Pix32/.test(ff), ff);
    await page.screenshot({ path: path.join(SHOTS, `welcome-a-${tag}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, 520) } }); shots.push(`welcome-a-${tag}`);
    await page.click("#welX");
    check(`[${tag}] welcome A: × closes it`, (await page.locator("#welcomeA").count()) === 0);
    await page.reload(); await page.waitForTimeout(200);
    check(`[${tag}] welcome A: closed stays closed on this device`, (await page.locator("#welcomeA").count()) === 0);
    await layout(page, `welcome-a-closed-${tag}`);
    await page.screenshot({ path: path.join(SHOTS, `welcome-a-closed-${tag}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, 520) } }); shots.push(`welcome-a-closed-${tag}`);
    await ctx.close();
  }
  {
    const { ctx, page } = await open(w, h, "prefs", "home");
    await page.goto(page.url().replace("?stage=prefs", "?stage=prefs&welcome=b")); await page.waitForTimeout(200);
    check(`[${tag}] welcome B: one quiet line under the greeting, no card`, (await T(page, "#welcomeB")).replace(/\s+/g, " ").trim() === "Welcome to Hack Western 13 · Thank you for being a Gold sponsor" && (await page.locator("#welcomeA").count()) === 0);
    await layout(page, `welcome-b-${tag}`);
    await page.screenshot({ path: path.join(SHOTS, `welcome-b-${tag}.png`), clip: { x: 0, y: 0, width: w, height: Math.min(h, 520) } }); shots.push(`welcome-b-${tag}`);
    await page.click("#mockT");
    await page.selectOption("#mkTier", "Silver");
    check(`[${tag}] Tier select changes the thank-you (Silver)`, (await T(page, "#welcomeB")).includes("a Silver sponsor"));
    await page.click('[data-welv="a"]');
    check(`[${tag}] panel switches back to welcome A`, (await T(page, "#welcomeA")).includes("a Silver sponsor."));
    await ctx.close();
  }
}

// mock panel open (phone)
{
  const { ctx, page } = await open(390, 844, "conf");
  await page.click("#mockT");
  check("[390] mock panel: four stages, prize toggle, welcome A/B, Tier select", (await page.locator("[data-stagep]").count()) === 4 && (await page.locator("#mkPrize").count()) === 1 && (await page.locator("[data-welv]").count()) === 2 && (await page.locator("#mkTier option").count()) === 4);
  await page.click('[data-stagep="prefs"]'); await page.waitForTimeout(150);
  check("[390] picking a stage switches the page", (await page.getAttribute("#chatsPage", "data-stage")) === "prefs");
  await page.screenshot({ path: path.join(SHOTS, "mock-panel-390.png") }); shots.push("mock-panel-390");
  await ctx.close();
}

check("no page errors", pageErrors.length === 0, pageErrors.slice(0, 3).join(" | "));
await browser.close();
for (const r of results) console.log(r.join("  "));
const fails = results.filter((r) => r[0] === "FAIL").length;
console.log(`\n${results.length - fails}/${results.length} checks passed · ${shots.length} screenshots`);
process.exit(fails ? 1 : 0);
