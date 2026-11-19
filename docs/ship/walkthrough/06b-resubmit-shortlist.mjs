// Re-submit Test Sponsor's shortlist after the Edit test (Edit un-submits it).
import { open, wait, close, BASE, SPONSORS, shot } from "./lib.mjs";
const { page } = await open(390);
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=shortlist&step=2`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
await shot(page, "06-sponsor-shortlist-review-390");
await page.locator("#sponsor-main").getByRole("button", { name: /^Submit shortlist/ }).click();
await wait(page, 1500);
await shot(page, "06-sponsor-shortlist-submitted-390", { full: false });
await close();
