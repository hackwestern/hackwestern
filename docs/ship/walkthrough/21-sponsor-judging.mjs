// Sponsor · Judging (Sun Life, seeded fake teams from sponsor-picks.ts).
import { open, shot, wait, close, BASE, SPONSORS, sql } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const NL = String.fromCharCode(10);
sql(`delete from sponsor_team_score where sponsor_id='${SPONSORS.sunlife}'; update sponsor_team_review set score=null where sponsor_id='${SPONSORS.sunlife}';`);
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const lines = async (re, n = 8) => (await main.innerText()).split(NL).filter((l) => re.test(l)).slice(0, n).join(" / ");
await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/picks`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
await shot(page, `21-sponsor-judging-whos-judging${tag}`, { full: false });

say("Pick Dana W. EXPECT 'Judging as Dana W.' and a 1–10 strip, untouched");
await main.getByRole("button", { name: /Dana W\./ }).first().click();
await wait(page, 400);
const start = main.getByRole("button", { name: "Start judging" });
if (await start.count()) await start.click();
await wait(page, 1200);
const strip = page.getByRole("slider").first();
console.log("strip:", await strip.getAttribute("aria-valuetext"));
console.log(await lines(/Judging as|Your \d|Everyone's|of \d+|Rubric/));
await shot(page, `21-sponsor-judging-one-at-a-time${tag}`);

say("Score with + then keyboard End, Left. EXPECT 5.5 then 9.5");
await page.getByRole("button", { name: /^Raise your score/ }).first().click();
await wait(page, 300);
console.log("after +:", await strip.getAttribute("aria-valuetext"));
await strip.focus();
await page.keyboard.press("End");
await page.keyboard.press("ArrowLeft");
await wait(page, 1200);
console.log("after End,Left:", await strip.getAttribute("aria-valuetext"));
await shot(page, `21-sponsor-judging-scored${tag}`, { full: false });

say("Rubric");
await page.getByRole("button", { name: /^Open the rubric/ }).first().click();
await wait(page, 600);
console.log("rubric:", (await page.getByRole("dialog").innerText()).replace(/\s+/g, " ").slice(0, 400));
await shot(page, `21-sponsor-judging-rubric${tag}`, { full: false });
await page.keyboard.press("Escape");

say("Second rep Kevin T. scores the same team 6. EXPECT 'Dana 9.5 · Kevin 6', average, amber flag");
await page.getByRole("button", { name: "Switch who's judging on this phone" }).click();
await page.getByRole("button", { name: /Kevin T\./ }).first().click();
const st2 = main.getByRole("button", { name: "Start judging" });
if (await st2.count()) await st2.click();
await wait(page, 800);
console.log("split tabs:", await lines(/^Your \d|^Everyone's/));
await page.getByRole("button", { name: /^Everyone's/ }).first().click().catch(() => console.log("no Everyone's"));
const s2 = page.getByRole("slider").first();
await s2.focus();
await page.keyboard.press("Home");
for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
await wait(page, 1500);
console.log("Kevin:", await s2.getAttribute("aria-valuetext"));
console.log(await lines(/Dana|Kevin|avg|talk it through/));
await shot(page, `21-sponsor-judging-two-reps${tag}`, { full: false });

say("List view");
await page.getByRole("button", { name: "List", exact: true }).click();
await wait(page, 800);
await shot(page, `21-sponsor-judging-list${tag}`, { full: false });
await page.getByRole("button", { name: "One at a time", exact: true }).click();

say("Shortlist tab, send. EXPECT send works (or a clear empty-shortlist message)");
await page.getByRole("tab", { name: /Your shortlist/ }).click();
await wait(page, 800);
console.log(await lines(/shortlist|Send|empty|Save/i, 10));
console.log("buttons:", (await main.getByRole("button").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).filter(Boolean).slice(0, 20).join(" | "));
await shot(page, `21-sponsor-judging-shortlist${tag}`, { full: false });
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
