// Sponsor · First visit and Help (Test Sponsor, fresh profile, nothing submitted).
import { open, snap, read, say, wait, close, BASE, SPONSORS } from "./lib-final.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  say(`[${W}] Home. EXPECT: 'What to do now' with a filled 'Tell us when your reps can chat'`);
  await read(page.locator("#sponsor-main"), 1500);
  await snap(page, `f01-home${tag}`);
  const tourBtn = page.getByRole("button", { name: /tour/i }).first();
  console.log("tour button:", await tourBtn.count(), "| dialog open already:", await page.getByRole("dialog").count());
  if (!(await page.getByRole("dialog").count()) && (await tourBtn.count())) await tourBtn.click();
  await wait(page, 900);
  for (let i = 1; i <= 14; i++) {
    const dlg = page.getByRole("dialog").first();
    if (!(await dlg.count())) break;
    const dt = (await dlg.innerText().catch(() => "")).replace(/\s+/g, " ");
    console.log(`tour ${i}: ${dt.slice(0, 300)}`);
    if (/help|coffee/i.test(dt)) await snap(page, `f01-tour-${i}${tag}`);
    const btn = dlg.getByRole("button", { name: /^(Next|Got it|Done|Finish|Let's go|Show me)/i }).last();
    if (!(await btn.count())) { console.log("buttons:", await dlg.getByRole("button").allInnerTexts()); break; }
    await btn.click();
    await wait(page, 700);
  }
  say(`[${W}] Need help? EXPECT: lead + emergency contact (Noah), phone links + copy icons`);
  await page.getByRole("button", { name: /need help/i }).first().click();
  await wait(page, 1500);
  const dlg = page.getByRole("dialog");
  await read(dlg, 1200);
  console.log("tel links:", await dlg.locator('a[href^="tel:"]').count(), "| copy buttons:", await dlg.getByRole("button", { name: /copy/i }).count());
  // Organizer names come from the live sheet: mask the dialog's people.
  await snap(page, `f01-help${tag}`);
  await page.keyboard.press("Escape");
  await wait(page, 400);
  console.log("dialog after Esc:", await page.getByRole("dialog").count(), "| errors:", page.errors.slice(0, 3));
}
await close();
