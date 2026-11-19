// 390 px read-only captures: preferences step 2 and review (Test Sponsor, sent),
// and the organizer coffee board. No writes.
import { open, snap, say, wait, close, BASE, SPONSORS, USERS, clean } from "./lib-final.mjs";

{
  const { page } = await open(390);
  const main = page.locator("#sponsor-main");
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const t = clean(await main.innerText());
  say("Prefs 390. EXPECT 'Scroll for later times →' above the grid; grid scrolls inside its box");
  console.log("scroll hint:", /Scroll for later times/.test(t));
  const table = main.getByRole("table").first();
  await table.scrollIntoViewIfNeeded();
  const box = await table.evaluate((el) => { const p = el.parentElement; return { scrollW: p.scrollWidth, clientW: p.clientWidth, docW: document.documentElement.scrollWidth }; });
  console.log("grid box:", JSON.stringify(box));
  await snap(page, "f17-prefs-390");
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=3`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  await main.getByText(/Organizers call/).scrollIntoViewIfNeeded();
  await snap(page, "f17-review-390");
  console.log("errors:", page.errors.slice(0, 3));
  await page.context().close();
}
{
  const { page } = await open(390, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors?tab=coffee&sponsor=${SPONSORS.test}`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  await wait(page, 2500);
  console.log("page wider than viewport:", await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth));
  await snap(page, "f17-board-test-sponsor-390");
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 3));
}
await close();
