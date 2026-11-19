// Hand-off 4: sponsor asks for help -> organizer contact. Sun Life has a lead
// on Sponsor Day-Of, so Help shows lead + emergency contact. Names and phones
// come from the live sheet: they're scrubbed in the log and masked in shots.
// The organizer side checks that nothing new appears on the dashboard.
import { open, snap, say, wait, close, BASE, SPONSORS, USERS, clean } from "./lib-final.mjs";

const scrubNames = (s) => s.replace(/(Your Hack Western contact\n)([^\n]+)/, "$1[lead name]").replace(/Noah Medland/g, "[emergency contact]");
{
  const { page } = await open(390);
  await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  say("Sponsor (Sun Life, 390): Need help? EXPECT lead name + number, then emergency contact; phone links + copy icons");
  await page.getByRole("button", { name: /need help/i }).first().click();
  await wait(page, 1500);
  const dlg = page.getByRole("dialog");
  console.log(scrubNames(clean(await dlg.innerText())));
  console.log("tel links:", await dlg.locator('a[href^="tel:"]').count(), "| copy buttons:", await dlg.getByRole("button", { name: /copy/i }).count());
  // Mask the lead's name (the line after the label) and both phones.
  await snap(page, "h4-sponsor-help-lead-390", { mask: [dlg.locator("p, span, strong, dd, div").filter({ hasText: /^(?!.*(contact|Need help|Text or call|emergency)).+$/i }).filter({ hasNot: page.locator("button, a, svg") })] });
  await page.keyboard.press("Escape");
  say("Preferences step: 'Something doesn't fit? Ask an organizer' opens the same Help");
  await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  await page.getByRole("button", { name: /Ask an organizer/ }).click();
  await wait(page, 800);
  console.log("same dialog:", (await page.getByRole("dialog").innerText()).split("\n")[0]);
  await page.context().close();
}
{
  const { page } = await open(1280, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
  await wait(page, 3000);
  const t = clean(await page.locator("main").innerText());
  say("Organizer side (fresh). EXPECT nothing about help on the dashboard; reps' phones on the board row to call back");
  console.log("help items:", t.split("\n").filter((l) => /help request|asked for help|needs help/i.test(l)).length);
  const k = t.indexOf("Needs attention");
  console.log(t.slice(k, t.indexOf("Now and next", k)));
}
await close();
