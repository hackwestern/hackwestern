// After: "Open coffee chats" from Needs attention opens that sponsor's row,
// scrolls to it and moves focus there. Test organizer.
import { open, wait, close, BASE, USERS, shotAfter } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 2000);
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await page.getByRole("link", { name: /Open coffee chats/ }).or(page.getByRole("button", { name: /Open coffee chats/ })).first().click();
await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
await wait(page, 2500);
console.log("url:", page.url());
const focused = await page.evaluate(() => {
  const el = document.activeElement;
  const r = el?.getBoundingClientRect();
  return { label: el?.getAttribute("aria-label"), expanded: el?.getAttribute("aria-expanded"), top: r && Math.round(r.top), h: window.innerHeight };
});
console.log("focused:", JSON.stringify(focused));
await shotAfter(page, `o7-open-coffee-chats${tag}`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
