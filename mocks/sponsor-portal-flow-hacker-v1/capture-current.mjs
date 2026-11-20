// Screenshots of the hacker /live site and the public home page, for comparison.
// Logs in as a local demo hacker. The password is read from _local/demo-accounts.md
// at run time and never written anywhere.
// Run from the repo root: node mocks/sponsor-portal-flow-hacker-v1/capture-current.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(DIR, "../..");
const BASE = "http://127.0.0.1:3013";
const accounts = fs.readFileSync(path.join(ROOT, "_local/demo-accounts.md"), "utf8");
const email = accounts.match(/demo\.hacker1@[\w.]+/)?.[0];
const pw = accounts.match(/Password:\s*(\S+)/i)?.[1];

const browser = await chromium.launch();
let loggedIn = false;
for (const [w, h, tag] of [[390, 844, "phone"], [1280, 800, "desktop"]]) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: tag === "phone" ? 2 : 1 });
  const page = await ctx.newPage();
  await page.goto(BASE + "/", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2500);
  await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
  await page.screenshot({ path: path.join(DIR, "screens", `00-current-home-${tag}.png`) });

  if (email && pw) {
    await page.goto(BASE + "/login", { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', pw);
    await page.click('button[type="submit"]');
    await page.waitForTimeout(4000);
  }
  for (const tab of ["home", "schedule"]) {
    await page.goto(`${BASE}/live?tab=${tab}`, { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
    await page.waitForTimeout(2500);
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
    if (page.url().includes("/live")) loggedIn = true;
    await page.screenshot({ path: path.join(DIR, "screens", `00-current-live-${tab}-${tag}.png`) });
  }
  if (tag === "phone" && page.url().includes("/live")) {
    await page.goto(`${BASE}/live?tab=home`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Open menu" }).click().catch(() => {});
    await page.waitForTimeout(800);
    await page.screenshot({ path: path.join(DIR, "screens", `00-current-live-menu-phone.png`) });
  }
  await ctx.close();
}
await browser.close();
console.log(loggedIn ? "login ok" : "login failed (redirected away from /live)");
