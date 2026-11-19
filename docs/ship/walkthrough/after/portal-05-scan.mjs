// Sponsor · Scan a hacker, after the B1 fix (one job: Add to my list).
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-05-scan.mjs
import { open, shot, text, wait, close, filledButtons, BASE, SPONSORS } from "./portal-lib.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  const main = page.locator("#sponsor-main");
  const go = () => page.goto(`${BASE}/sponsors/${SPONSORS.test}/scan`, { waitUntil: "networkidle", timeout: 120000 });
  const lookup = async (code) => {
    await main.getByRole("textbox").first().fill(code);
    await main.getByRole("button", { name: "Look up" }).click();
    await wait(page, 2000);
  };

  await go();
  await wait(page, 1500);
  await shot(page, `portal-05-scan-open${tag}`, { full: false });
  const t = await main.innerText();
  console.log("'No camera found' count:", (t.match(/No camera found/g) ?? []).length);

  // Repeat scan: Alex is already on the list.
  await lookup("demo-otter-kite");
  await text(page, "#sponsor-main", 1500);
  console.log("filled:", await filledButtons(main));
  await shot(page, `portal-05-scan-again${tag}`);

  // New hacker: one filled button, then Add, then Scan next.
  await go();
  await wait(page, 1200);
  await lookup(W === 1280 ? "walkthrough-hacker-2" : "walkthrough-hacker-3");
  await text(page, "#sponsor-main", 1500);
  console.log("filled:", await filledButtons(main));
  await shot(page, `portal-05-scan-found${tag}`);
  // The 5-year-old presses the most obvious button.
  await main.getByRole("button", { name: "Add to my list" }).click();
  await wait(page, 1500);
  await text(page, "#sponsor-main", 800);
  console.log("filled after add:", await filledButtons(main));
  await shot(page, `portal-05-scan-added${tag}`);
  await main.getByRole("button", { name: "Scan next" }).click();
  await wait(page, 800);
  console.log("after Scan next:", (await main.innerText()).split("\n").slice(0, 2).join(" / "));
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
