// Sponsor · First visit and Help (Test Sponsor, fresh profile).
// Phones from the live sheet are masked in every screenshot (lib.shot).
import { open, shot, text, wait, close, BASE, SPONSORS } from "./lib.mjs";

const url = `${BASE}/sponsors/${SPONSORS.test}`;
for (const w of [1280, 390]) {
  const tag = w === 1280 ? "" : "-390";
  const log = w === 1280;
  const { page } = await open(w);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  await shot(page, `01-sponsor-firstvisit-home${tag}`);
  // The tour doesn't auto-run; a "New here?" card offers it.
  await page.getByRole("button", { name: "Take the tour" }).first().click();
  await wait(page, 900);
  for (let i = 1; i <= 12; i++) {
    const t = (await page.locator("body").innerText()).split("\n");
    const dlg = page.getByRole("dialog").first();
    const dt = (await dlg.innerText().catch(() => "")).replace(/\s+/g, " ");
    if (log) console.log(`tour step ${i}: ${dt.slice(0, 500)}`);
    await shot(page, `01-sponsor-firstvisit-tour-${String(i).padStart(2, "0")}${tag}`, { full: false });
    const btn = dlg
      .getByRole("button", { name: /^(Next|Got it|Done|Finish|Start|Let's go|Close tour|Show me)/i })
      .last();
    if (!(await btn.count())) {
      if (log) console.log("no next button; buttons:", await dlg.getByRole("button").allInnerTexts());
      break;
    }
    await btn.click();
    await wait(page, 800);
    if (!(await page.getByRole("dialog").count())) break;
  }
  await shot(page, `01-sponsor-firstvisit-after-tour${tag}`, { full: false });
  await page.getByRole("button", { name: /need help/i }).first().click();
  await wait(page, 1500);
  await shot(page, `01-sponsor-firstvisit-help${tag}`, { full: false });
  if (log) {
    const t = await page.getByRole("dialog").innerText().catch(() => "(no dialog)");
    console.log("HELP DIALOG:\n" + t.replace(/\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/g, "[phone]"));
    // Keyboard: Escape closes? focus returns?
    await page.keyboard.press("Escape");
    await wait(page, 400);
    console.log("dialog after Esc:", await page.getByRole("dialog").count());
    console.log("focused:", await page.evaluate(() => document.activeElement?.textContent?.slice(0, 40)));
  }
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
