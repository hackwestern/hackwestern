// Screenshots of every prototype screen. Run from the repo root:
// node mocks/sponsor-portal-flow-hacker-v1/capture.mjs
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const URL = pathToFileURL(path.join(DIR, "index.html")).href;
const out = (n) => path.join(DIR, "screens", n + ".png");

// [name, hash, optional setup(page)]
const shots = [
  ["01-today", "today"],
  ["02-chats-1-calendar", "chats-1"],
  ["03-chats-1-panel", "chats-1", async (p) => { if (await p.locator('[data-rep="priya"]').isVisible()) await p.click('[data-rep="priya"]'); await p.click('[data-blk="3"] >> nth=0'); await p.waitForTimeout(400); }],
  ["04-chats-1-rep-priya", "chats-1", async (p) => { await p.click('[data-rep="priya"]'); }],
  ["05-chats-2-shortlist", "chats-2"],
  ["06-chats-3-confirm", "chats-3"],
  ["07-chats-3-phone-error", "chats-3", async (p) => { await p.click("[data-submit]"); }],
  ["08-chats-done", "chats-3", async (p) => { await p.fill("#ph", "519-555-0199"); await p.click("[data-submit]"); await p.waitForTimeout(300); }],
  ["09-scan", "scan"],
  ["10-scan-result", "scan", async (p) => { await p.click("[data-doscan]"); }],
  ["11-scan-no-camera", "scan", async (p) => { await p.click("[data-nocam]"); }],
  ["12-judging-locked", "judging"],
  ["13-judging-browse", "judging-browse"],
  ["14-judging-shortlist-sent", "judging-shortlist", async (p) => { await p.click("[data-jsend]"); }],
  ["15-judging-round2", "judging-r2"],
  ["16-schedule-sat", "schedule"],
  ["17-map", "map"],
  ["18-help", "help"],
  ["19-help-sent", "help", async (p) => { await p.fill("#hm", "We need 2 more chairs at the booth"); await p.fill("#hw", "Rm 1235 (Sponsor Bay), Sun Life booth"); await p.click("[data-help]"); }],
  ["20-today-no-judging", "today", async (p) => { await p.click("[data-nojudge]"); }],
];

const browser = await chromium.launch();
const problems = [];
for (const [w, h, tag] of [[390, 844, "390"], [1280, 800, "1280"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === "390" ? 2 : 1 });
  const page = await ctx.newPage();
  for (const [name, hash, setup] of shots) {
    if (tag === "1280" && !["01-today", "02-chats-1-calendar", "03-chats-1-panel"].includes(name)) continue;
    await page.goto(URL + "#" + hash);
    await page.reload();
    await page.waitForTimeout(700);
    if (setup) await setup(page);
    await page.waitForTimeout(300);
    // overflow check: horizontal page scroll or text wider than its box
    const o = await page.evaluate(() => {
      const bad = [];
      if (document.documentElement.scrollWidth > innerWidth + 1) bad.push("page scrolls sideways: " + document.documentElement.scrollWidth);
      document.querySelectorAll("#pane *, .tabs *, .top *, .sheet *").forEach((el) => {
        const cs = getComputedStyle(el);
        if (el.closest(".repsw") || el.matches(".sr") || cs.display === "none") return;
        if (el.scrollWidth > el.clientWidth + 2 && cs.overflow !== "visible" && el.clientWidth > 0 && !el.matches(".cal-h div,.blk,.blk *"))
          bad.push(`${el.tagName}.${el.className}: "${(el.textContent || "").trim().slice(0, 40)}"`);
      });
      return bad;
    });
    if (o.length) problems.push(`${name}@${tag}: ${o.join(" | ")}`);
    await page.screenshot({ path: out(`${name}-${tag}`) });
    if (tag === "390" && (await page.evaluate(() => document.documentElement.scrollHeight > innerHeight + 40))) {
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      await page.waitForTimeout(250);
      await page.screenshot({ path: out(`${name}-${tag}-end`) });
    }
  }
  await ctx.close();
}
await browser.close();
console.log(problems.length ? problems.join("\n") : "no overflow found");
