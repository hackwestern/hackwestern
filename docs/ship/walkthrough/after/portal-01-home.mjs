// Sponsor · First visit and Help, after the fixes: one contact answer (B11),
// the "What to do now" card, the banner wording and the tour.
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-01-home.mjs
import { open, shot, wait, close, filledButtons, BASE, SPONSORS } from "./portal-lib.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 2000);
  const main = page.locator("#sponsor-main");
  const t = await main.innerText();
  console.log("home:", t.replace(/\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]?\d{4}/g, "[phone]").split("\n").slice(0, 40).join(" / "));
  console.log("filled (whole page):", await filledButtons(page.locator("body")));
  await shot(page, `portal-01-home${tag}`);
  await page.getByRole("button", { name: /need help/i }).first().click();
  await wait(page, 1200);
  const dlg = page.getByRole("dialog");
  console.log("help:", (await dlg.innerText()).replace(/\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/g, "[phone]").replace(/\s+/g, " "));
  await shot(page, `portal-01-help${tag}`, { full: false });
  await page.keyboard.press("Escape");
  await wait(page, 500);
  console.log("focus after Esc:", await page.evaluate(() => document.activeElement?.textContent?.trim().slice(0, 30)));
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
