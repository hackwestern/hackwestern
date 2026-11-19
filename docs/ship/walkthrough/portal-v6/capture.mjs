// Portal v6 restyle: one screenshot per sponsor portal route at 390 and 1280.
// Usage (repo root, dev server on :3081):
//   BASE=http://localhost:3081 node docs/ship/walkthrough/portal-v6/capture.mjs before
//   BASE=http://localhost:3081 node docs/ship/walkthrough/portal-v6/capture.mjs after
// Real phones are masked (same rule as ../lib.mjs). Test Sponsor only: its
// team and hackers are fake.
import path from "node:path";
import fs from "node:fs";
import { open, close, wait, SPONSORS, BASE } from "../lib.mjs";

const phase = process.argv[2] ?? "after";
const only = process.argv[3] ?? null;
const OUT = path.resolve("docs/ship/walkthrough/portal-v6", phase);
fs.mkdirSync(OUT, { recursive: true });

const base = `${BASE}/sponsors/${SPONSORS.test}`;
const routes = [
  ["01-today", ""],
  ["02-chats", "/coffee-chats"],
  ["03-prefs-team", "/coffee-chats?flow=prefs&step=1"],
  ["04-prefs-questions", "/coffee-chats?flow=prefs&step=2"],
  ["05-prefs-review", "/coffee-chats?flow=prefs&step=3"],
  ["06-shortlist", "/coffee-chats?flow=shortlist&step=1"],
  ["07-shortlist-review", "/coffee-chats?flow=shortlist&step=2"],
  ["08-scan", "/scan"],
  ["09-schedule", "/schedule?day=saturday"],
  ["10-judging-locked", "/picks"],
  ["11-judging", "/picks?preview=judging"],
  ["12-map", "/map"],
  ["13-help", "", "help"],
];

const phone = /^\s*\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]\d{4}\s*$/;
for (const w of [390, 1280]) {
  const { page } = await open(w);
  for (const [name, href, action] of routes) {
    if (only && !name.startsWith(only)) continue;
    const res = await page.goto(base + href, { waitUntil: "networkidle", timeout: 120000 });
    if (res && res.status() === 404) {
      console.log(`[skip] ${name} 404`);
      continue;
    }
    await wait(page, 1200);
    if (action === "help") {
      await page.getByRole("button", { name: /help/i }).first().click();
      await wait(page, 700);
    }
    const file = path.join(OUT, `${name}-${w}.png`);
    // Hide the Next.js dev badge.
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    // Headless full-page shots stop painting below the first screen at phone
    // width, so grow the viewport to the page instead.
    const vh = w < 600 ? 844 : 900;
    if (action !== "help") {
      const h = await page.evaluate(() =>
        Math.max(document.documentElement.scrollHeight, document.body.scrollHeight),
      );
      await page.setViewportSize({ width: w, height: Math.max(vh, h) });
      await wait(page, 400);
    }
    await page.screenshot({
      path: file,
      fullPage: false,
      mask: [
        page.locator('a[href^="tel:"]').filter({ hasNotText: /555/ }),
        page.getByText(phone),
      ],
      maskColor: "#9a9a9a",
    });
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth + 1,
    );
    await page.setViewportSize({ width: w, height: vh });
    console.log(`[shot] ${file}${sideways ? "  !! sideways scroll" : ""}`);
  }
  if (page.errors.length) console.log("errors:", page.errors.slice(0, 5));
}
await close();
