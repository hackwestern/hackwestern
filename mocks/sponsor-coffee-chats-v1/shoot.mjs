// T19 check: the sponsor chat list from seeded rows (mocks/sponsor-scan-v1/seed.mjs:
// accepted, declined, expired, pending, cancelled for StarTech). Dev server on :3021.
import { chromium } from "playwright";
import postgres from "postgres";

const sql = postgres("postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat");
const EMPTY = "33333333-3333-4333-8333-333333333333";
await sql`insert into sponsor_judging_sponsor (id, name) values (${EMPTY}, 'Northwind') on conflict (id) do nothing`;
await sql.end();

const DIR = "mocks/sponsor-coffee-chats-v1";
const browser = await chromium.launch();
const out = [];
for (const [sponsor, name] of [
  ["11111111-1111-4111-8111-111111111111", "list"],
  [EMPTY, "empty"],
]) {
  for (const vp of [
    { width: 360, height: 1300 },
    { width: 375, height: 1300 },
    { width: 1280, height: 1300 },
  ]) {
    const page = await browser.newPage({ viewport: vp });
    await page.goto(`http://localhost:3021/sponsors/${sponsor}/coffee-chats`);
    await page.getByRole("heading", { level: 1 }).waitFor();
    await page.waitForTimeout(300);
    const chips = await page.locator("li span.rounded-full").allTextContents();
    const sideways = await page.evaluate(
      () => document.documentElement.scrollWidth > window.innerWidth,
    );
    await page.screenshot({ path: `${DIR}/${name}-${vp.width}.png` });
    out.push(`${name} @${vp.width}: chips [${chips.join(", ")}], sideways scroll = ${sideways}`);
    await page.close();
  }
}
await browser.close();
console.log(out.join("\n"));
