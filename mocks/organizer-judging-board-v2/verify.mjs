// Checks + screenshots. Run from the repo root: node mocks/organizer-judging-board-v2/verify.mjs
import { chromium } from "playwright";
import { pathToFileURL } from "node:url";
import path from "node:path";

const DIR = "mocks/organizer-judging-board-v2";
const URL0 = pathToFileURL(path.resolve(DIR, "index.html")).href;
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"} ${m}`); if (!c) fails++; };
const errors = [];
const browser = await chromium.launch();

async function noSideScroll(page, name) {
  const h = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok(h <= 0, `${name}: no sideways page scroll (${h})`);
}
const board = (page, fn) => page.evaluate(fn);
// No team presents twice within 10 minutes, across every room and the remote list.
async function gapOK(page, label) {
  const g = await board(page, () => window.__board.minGap(window.__board.state.slots));
  ok(g >= 10, `${label}: every team's talks are 10+ min apart (smallest gap ${g === null ? "none" : g} min)`);
}

for (const [w, h] of [[1280, 800], [390, 844]]) {
  const phone = w < 500;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: phone, isMobile: phone });
  await ctx.grantPermissions(["clipboard-read", "clipboard-write"]).catch(() => {});
  const page = await ctx.newPage();
  page.on("pageerror", (e) => errors.push(`${w}: ${e.message}`));
  page.on("console", (m) => { if (m.type() === "error") errors.push(`${w} console: ${m.text()}`); });
  const shot = async (n, sel = null, full = false) => {
    await page.evaluate((sel) => { document.getElementById("toast").hidden = true; if (sel) document.querySelector(sel)?.scrollIntoView({ block: "start" }); else scrollTo(0, 0); }, sel);
    await page.waitForTimeout(150);
    return page.screenshot({ path: `${DIR}/screens/${n}-${w}.png`, fullPage: full });
  };

  await page.goto(URL0);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(300);

  // fonts
  const fonts = await page.evaluate(() => [...new Set([...document.querySelectorAll("body *")].filter((e) => e.offsetParent && e.textContent.trim()).map((e) => getComputedStyle(e).fontFamily.split(",")[0].replace(/"/g, "").trim()))]);
  ok(fonts.length === 1 && fonts[0] === "Figtree", `${w}: Figtree only (${fonts.join(", ")})`);

  // 1. no suggested-fixes UI, no clashes, no Add a room
  const body = await page.locator("body").innerText();
  ok(!/Suggested fixes|Apply fix|Swap T-|Clash|Add a room/i.test(body), `${w}: no suggested fixes, Apply, Swap, clash chips or Add a room`);
  ok(await page.locator("#fixes, [data-fixact], .p-clash, .cell.clash, #addRoomBtn").count() === 0, `${w}: no fixes/clash/add-room elements`);
  await gapOK(page, `${w} start`);

  // 2. 3 rooms, run-of-show defaults, Sun Life unset, TinyFish remote
  const rooms = await board(page, () => window.__board.ROOMS);
  ok(rooms.join() === "Rm 2230,Rm 2235,Rm 2110", `${w}: exactly 3 rooms (${rooms.join(", ")})`);
  const sel = async (id) => page.locator(`#spList [data-roomsel="${id}"]`).inputValue();
  ok((await sel("scotia")) === "Rm 2110" && (await sel("canadalife")) === "Rm 2230" && (await sel("qnx")) === "Rm 2235", `${w}: Scotiabank 2110, Canada Life 2230, QNX 2235`);
  ok((await sel("sunlife")) === "" && (await page.locator('#spList [data-roomsel="sunlife"] option:checked').textContent()) === "Set a room", `${w}: Sun Life starts on "Set a room"`);
  const opts = await page.locator('#spList [data-roomsel="sunlife"] option').evaluateAll((os) => os.map((o) => ({ t: o.textContent, d: o.disabled, v: o.value })));
  const roomOpts = opts.filter((o) => o.v && o.v !== "__other");
  ok(roomOpts.length === 3 && opts.some((o) => o.v === "__other" && o.t === "Other…"), `${w}: select has the 3 rooms plus Other… (${opts.map((o) => o.t).join(" | ")})`);
  ok(roomOpts.every((o) => o.d) && roomOpts.some((o) => o.t === "Rm 2230 · Canada Life"), `${w}: taken rooms show who has them and can't be picked`);
  ok((await page.locator('#spList [data-sp="tinyfish"] .sp-rm').textContent()) === "Remote (judges online)" && await page.locator('#spList [data-roomsel="tinyfish"]').count() === 0, `${w}: TinyFish is Remote (judges online), no select`);

  // 3. to-dos first: Text lead, Sun Life's room, Notify teams
  const tds = await page.locator("#todo .td").evaluateAll((els) => els.map((e) => e.dataset.td));
  ok(tds.join() === "list:sunlife,room:sunlife,notify", `${w}: to-dos in order (${tds.join(", ")})`);
  const t0 = (await page.locator('[data-td="list:sunlife"] .td-p').innerText()).replace(/\s+/g, " ");
  ok(t0 === "SL Sun Life's shortlist isn't in · Text Daniel (lead) · 555-0101", `${w}: Text lead line ("${t0}")`);
  ok((await page.locator('[data-td="list:sunlife"] a[href^="sms:"]').getAttribute("href")).startsWith("sms:+15195550101") && await page.locator('[data-td="list:sunlife"] [data-copy]').count() === 1, `${w}: Copy and Text (sms:) on the warning`);
  ok((await page.locator("#notifyMsg").textContent()) === "28 teams haven't been told their times", `${w}: "28 teams haven't been told their times"`);
  const below = await page.evaluate(() => ["list:sunlife", "room:sunlife", "notify"].map((k) => document.querySelector(`[data-td="${k}"]`).getBoundingClientRect().bottom));
  ok(below.every((b) => b <= h - 56), `${w}: all three to-dos visible at 9:20 without scrolling (${below.map(Math.round).join(", ")} of ${h})`);
  ok(await page.locator('[data-td^="list:"], [data-td^="scores:"], [data-td^="top:"]').count() === (await page.locator("#todo .td.warn").count()), `${w}: the only warnings are Text lead ones`);

  // sponsor list: say it once, quiet normal case
  const slRow = (await page.locator('#spList [data-sp="sunlife"] .sp-row').innerText());
  ok((slRow.match(/shortlist/gi) || []).length === 1 && !/Due 9:30|not sent/i.test(slRow), `${w}: Sun Life row says the problem once`);
  ok(!/Room set|Contact|Profiles:/i.test(await page.locator("#spList").innerText()), `${w}: no "Room set", Contact buttons or "Profiles:"`);
  ok((await page.locator('#spList [data-sp="scotia"] .sp-meta').textContent()) === "9 teams · 3 reps judging", `${w}: "3 reps judging" wording`);
  ok(await page.locator("#spList .sp-row [data-copy], #spList .sp-row a[href^='sms:']").count() === 0, `${w}: no phones on collapsed rows`);

  // legend + one Calendar/Schedule switch
  const lg = await page.locator("#legend li").allInnerTexts();
  ok(["Told their time", "Not told yet", "Presenting now", "Presented", "Remote (judges online)"].every((x) => lg.some((l) => l.includes(x))) && lg.some((l) => l.includes("2 sponsors")), `${w}: legend explains every style (${lg.length} items)`);
  ok(await page.locator('[data-view="cal"]').count() === 1 && await page.locator('[data-view="sch"]').count() === 1 && await page.locator('[role="tablist"]').count() === 1, `${w}: one Calendar/Schedule switch`);

  // grid shows names, blank empty slots, 2-sponsor marker
  const names = await page.locator("#grid .cell .nm").allTextContents();
  ok(names.includes("PillPal") && names.includes("SafeRoute") && !names.some((n) => /^T-\d+$/.test(n)), `${w}: grid shows project names (${names.length} cells)`);
  ok(await page.locator("#grid .cell .cd .num").first().textContent() !== "", `${w}: team code shown small under the name`);
  ok(!/\bOpen\b/.test(await page.locator("#grid").innerText()) && await page.locator("#grid td:empty").count() > 0, `${w}: empty slots are blank`);
  ok(await page.locator('#grid .cell[data-team="T-017"] .mk').count() === 2, `${w}: T-017 marked "2 sponsors" in both rooms`);
  await noSideScroll(page, `${w} 9:20`);
  await shot("01-overview-0920");
  await shot("01-overview-0920-full", null, true);

  // 4. team modal
  await page.click('#grid .cell[data-team="T-017"] >> nth=0');
  await page.waitForTimeout(100);
  ok(await page.locator("#md").isVisible(), `${w}: clicking a team opens a modal`);
  ok((await page.locator("#mdT").textContent()) === "PillPal" && (await page.locator("#mdId").textContent()) === "T-017", `${w}: modal name large, ID small`);
  const fs = await page.evaluate(() => [parseFloat(getComputedStyle(document.getElementById("mdT")).fontSize), parseFloat(getComputedStyle(document.getElementById("mdId")).fontSize)]);
  ok(fs[0] >= 22 && fs[1] <= 14, `${w}: title ${fs[0]}px, ID ${fs[1]}px`);
  const ibs = await page.locator("#md .mb > .row .ib").evaluateAll((as) => as.map((a) => ({ l: a.getAttribute("aria-label"), w: a.offsetWidth, h: a.offsetHeight, href: a.href })));
  ok(ibs.length === 2 && ibs[0].l === "PillPal on Devpost" && ibs[1].l === "PillPal on GitHub" && ibs.every((b) => b.w === 44 && b.h === 44), `${w}: Devpost + GitHub 44px icon buttons (${JSON.stringify(ibs.map((b) => [b.l, b.w]))})`);
  ok((await page.locator("#att").innerText()) === "Confirmed: 1 of 4 members checked in" && await page.locator("#att.ok").count() === 1, `${w}: attendance 1 of 4, green`);
  ok(await page.locator("#mdMembers li").count() === 4, `${w}: 4 member profiles`);
  const m0 = await page.locator("#mdMembers li").first().innerText();
  ok(/University|College/.test(m0) && /year|Master/.test(m0) && /Checked in|Not checked in/.test(m0), `${w}: member shows school, program, year, role, check-in`);
  const mlinks = await page.locator("#mdMembers .links a").evaluateAll((as) => as.map((a) => a.getAttribute("aria-label")));
  ok(mlinks.length > 0 && mlinks.every((l) => /LinkedIn|GitHub|résumé|website/.test(l)), `${w}: member link icons have labels (${mlinks.length})`);
  const times = (await page.locator("#mdTimes").innerText()).replace(/\s+/g, " ");
  const talks = await board(page, () => window.__board.talksOf("T-017").map((k) => k.t));
  ok(/Canada Life \d+:\d\d · Rm 2230/.test(times) && /QNX \d+:\d\d · Rm 2235/.test(times) && talks[1] - talks[0] >= 10, `${w}: modal lists both times ("${times}")`);
  ok(await page.locator("#mdScores li").count() === 2, `${w}: scores so far per sponsor`);
  await noSideScroll(page, `${w} modal`);
  await page.waitForTimeout(100);
  await page.screenshot({ path: `${DIR}/screens/02-team-modal-${w}.png` });
  await page.keyboard.press("Escape");
  ok(!(await page.locator("#md").isVisible()), `${w}: Esc closes the modal`);
  // a team with nobody checked in
  await page.click('#grid .cell[data-team="T-021"]');
  ok((await page.locator("#att").innerText()) === "No one from this team has confirmed" && await page.locator("#att.none").count() === 1, `${w}: 0 checked in shows amber "No one from this team has confirmed"`);
  await page.click("[data-mclose]");

  // 5. Move to: only the 3 rooms (swap)
  await page.click('.colh[data-roomdlg="qnx"]');
  const mv = await page.locator("[data-moveto]").evaluateAll((b) => b.map((x) => x.dataset.moveto));
  ok(mv.length === 2 && mv.every((r) => rooms.includes(r)), `${w}: Move to offers only the other 2 of the 3 rooms (${mv.join(", ")})`);
  await page.click("[data-mclose]");

  // 6. room select with Other…
  await page.selectOption('#todo [data-roomsel="sunlife"]', "__other");
  ok(await page.locator("#oth-sunlife-todo").isVisible(), `${w}: Other… opens a text box`);
  await page.fill("#oth-sunlife-todo", "Rm 2230");
  await page.click('[data-otherform="sunlife"] [type="submit"]');
  ok((await page.locator('[data-otherform="sunlife"] .err').textContent()).includes("Canada Life"), `${w}: typing a taken room is refused`);
  await page.fill("#oth-sunlife-todo", "Rm 3100");
  await shot("03-room-select-other", "#todoCard");
  await page.click('[data-otherform="sunlife"] [type="submit"]');
  ok((await sel("sunlife")) === "Rm 3100" && await page.locator('[data-td="room:sunlife"]').count() === 0, `${w}: Sun Life set to Rm 3100, room to-do gone`);

  // 7. Sun Life sends: scheduled around the others, still no clash
  await page.click("#mockBtn");
  await page.click("#sunSend");
  await gapOK(page, `${w} after Sun Life sends`);
  const tb = await board(page, () => window.__board.talksOf("T-047").map((k) => `${k.sp.id}@${k.t}`));
  ok(tb.length === 2, `${w}: T-047 presents to QNX and Sun Life (${tb.join(", ")})`);
  ok((await page.locator("#notifyMsg").textContent()) === "34 teams haven't been told their times" && await page.locator('[data-td="list:sunlife"]').count() === 0, `${w}: shortlist warning gone, 34 teams to tell`);

  // 8. notify
  await page.click("#notifyBtn");
  ok((await page.locator("#notifiedMsg").innerText()) === "All teams notified · 9:20 AM", `${w}: "All teams notified · 9:20 AM"`);
  ok(await page.locator("#grid .cell.untold").count() === 0, `${w}: no cell marked not told after notifying`);
  await page.click("#mockBtn");

  // 9. schedule view
  await page.click('[data-view="sch"]');
  ok(await page.locator(".sch-room").count() === 5, `${w}: schedule lists the 3 rooms, Rm 3100 and Remote (${await page.locator(".sch-room").count()})`);
  ok(!/T-\d{3}\s*$/m.test(await page.locator(".sch .tb b").first().textContent()), `${w}: schedule shows names`);
  await noSideScroll(page, `${w} schedule`);
  await shot("04-schedule", "#roomsCard");
  await page.click('[data-view="cal"]');

  // 10. fresh page at 10:30
  await page.goto(URL0); await page.waitForTimeout(200);
  await page.click("#mockBtn"); await page.click('[data-time="630"]'); await page.click("#mockBtn");
  const td2 = await page.locator("#todo .td").evaluateAll((els) => els.map((e) => e.dataset.td));
  ok(td2.slice(0, 2).sort().join() === "list:sunlife,scores:canadalife", `${w}: 10:30 to-dos (${td2.join(", ")})`);
  ok((await page.locator('[data-td="scores:canadalife"] .td-p').innerText()).replace(/\s+/g, " ").includes("Canada Life has no scores yet · Text Priya (lead) · 555-0104"), `${w}: 10:30 Canada Life Text lead`);
  ok(await page.locator("#grid .cell.now").count() >= 3 && await page.locator("#grid tr.now").count() === 1, `${w}: 10:30 presenting-now cells and row`);
  ok(await page.locator("#grid .cell.done").count() > 0, `${w}: presented cells`);
  await gapOK(page, `${w} 10:30`);
  await noSideScroll(page, `${w} 10:30`);
  await shot("05-1030");
  await shot("05-1030-rooms", "#roomsCard");

  // 11. 12:05
  await page.click("#mockBtn"); await page.click('[data-time="725"]'); await page.click("#mockBtn");
  const td3 = await page.locator("#todo .td").evaluateAll((els) => els.map((e) => e.dataset.td));
  ok(td3.includes("top:canadalife") && td3.includes("pcb") && !td3.includes("list:sunlife"), `${w}: 12:05 to-dos (${td3.join(", ")})`);
  const metas = await page.locator("#spList .sp-meta").allTextContents();
  ok(metas.filter((m) => m === "Top 5 in").length === 3, `${w}: 12:05 three Top 5 in (${metas.join(" | ")})`);
  await page.click('[data-open="qnx"]');
  ok(await page.locator('[data-sp="qnx"] .top5 li').count() === 5, `${w}: ranked top 5 shown`);
  await page.click('[data-open="qnx"]');
  // PCBWay top 5 entry
  await page.click("#pcbTodo");
  const links = await board(page, () => ["T-012", "T-030", "T-042", "T-009", "T-051"].map((t) => window.__board.TEAMS[t].devpost));
  for (let k = 0; k < 5; k++) await page.fill(`#pcb${k}`, links[k]);
  ok((await page.locator("#pcbForm .mt.okm").first().textContent()) === "AgentDesk · T-012", `${w}: pasted Devpost link matches the team`);
  await noSideScroll(page, `${w} 12:05`);
  await shot("06-1205");
  await shot("06-1205-pcbway", "#dig");
  await page.click('#pcbForm [type="submit"]');
  ok(await page.locator('[data-td="pcb"]').count() === 0, `${w}: PCBWay to-do clears when saved`);

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
