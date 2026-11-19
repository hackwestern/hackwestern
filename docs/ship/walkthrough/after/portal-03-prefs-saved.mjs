// Sponsor · Chatting preferences · autosave, after the B6 fix ("Saved.").
// Test Sponsor is already sent, so the save is answered in the browser
// (no DB write) and "Change anyway" is safe to press.
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-03-prefs-saved.mjs
import { open, shot, wait, close, BASE, SPONSORS } from "./portal-lib.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  let saves = 0;
  await page.route(/\/api\/trpc\/.*coffeeChatSetup\.savePrefs/, async (route) => {
    saves++;
    await new Promise((r) => setTimeout(r, 400));
    await route.fulfill({ json: [{ result: { data: { json: { ok: true, skipped: 0 } } } }] });
  });
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const footer = page.locator("p[role=status]").last();
  await page.getByRole("radio", { name: "2" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Change anyway" }).click().catch(() => {});
  await wait(page, 1000);
  console.log("during:", await footer.innerText());
  await wait(page, 1200);
  console.log("after:", await footer.innerText(), "| saves:", saves);
  await footer.scrollIntoViewIfNeeded();
  await shot(page, `portal-03-prefs-saved${tag}`, { full: false });
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
