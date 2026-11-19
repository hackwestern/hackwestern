// Sponsor · Your team and Chatting preferences, after the wording pass
// (Main contact, Next: When they're free, Your events, AM/PM headers, Each
// chat: 1 rep + N hackers, Something doesn't fit?). Read-only.
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-02-team-prefs.mjs
import { open, shot, wait, close, BASE, SPONSORS } from "./portal-lib.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  const main = page.locator("#sponsor-main");
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=1`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const team = main.locator("section[aria-labelledby=team-heading]");
  console.log(`[team${tag}]`, (await team.innerText()).replace(/\s+/g, " ").slice(0, 600));
  await team.scrollIntoViewIfNeeded();
  await shot(page, `portal-02-team${tag}`, { full: false });

  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  const prefs = main.locator("section[aria-labelledby=prefs-heading]");
  console.log(`[prefs${tag}]`, (await prefs.innerText()).replace(/\s+/g, " ").slice(0, 900));
  await main.getByRole("table").first().scrollIntoViewIfNeeded();
  await shot(page, `portal-03-prefs-grid${tag}`, { full: false });
  console.log("errors:", page.errors.slice(0, 3));
}
await close();
