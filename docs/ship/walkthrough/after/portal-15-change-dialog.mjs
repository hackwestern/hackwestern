// Sponsor · Change after invites, after the B4 fix: the dialog counts only
// invites in the chats being changed. Always presses "Keep it as is", so the
// shared DB isn't changed.
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-15-change-dialog.mjs
import { open, shot, wait, close, BASE, SPONSORS } from "./portal-lib.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  for (const [label, name] of [
    ["sent chat with 3 invited", /Walkthrough Dana, 3–4( PM)?: free/],
    ["session with no chat", /Walkthrough Kevin, 11 AM–12 PM: free|Walkthrough Kevin, 11–12: free/],
  ]) {
    await page.getByRole("checkbox", { name }).click();
    await wait(page, 600);
    const dlg = page.getByRole("alertdialog");
    console.log(`${label}:`, (await dlg.innerText().catch(() => "(no dialog)")).replace(/\s+/g, " "));
    if (label.startsWith("sent")) await shot(page, `portal-15-change-dialog${tag}`, { full: false });
    await dlg.getByRole("button", { name: "Keep it as is" }).click().catch(() => {});
    await wait(page, 400);
  }
  const card = page.getByRole("region", { name: "Where things stand" });
  console.log("status card:", (await card.innerText()).replace(/\s+/g, " "));
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
