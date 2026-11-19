// Organizer · My sponsors as the local Noah user (walkthrough-noah; email read
// from the DB at runtime). Sheet writes are off. Organizer names are masked.
import { open, snap, say, wait, close, BASE, noah, clean } from "./lib-final.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page, context } = await open(W, noah());
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 3000);
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
const live = async () => (await page.locator('[role="status"], [aria-live]').allInnerTexts()).map((s) => s.trim()).filter(Boolean).join(" / ");
const body = async () => clean(await page.locator("main").innerText());

say("EXPECT: 'You lead N sponsors'; Needs attention grouped 'Your sponsors' / 'Other sponsors' / 'Run of show tasks'");
let t = await body();
console.log(t.match(/You lead \d+ sponsors?/)?.[0], "| groups:", ["Your sponsors", "Other sponsors", "All sponsors", "Run of show tasks"].filter((g) => t.includes(g)).join(", "));
const k = t.indexOf("You lead");
console.log(t.slice(k, k + 2200));
const people = page.getByRole("tabpanel").first();
await snap(page, `f08-my-sponsors${tag}`, { mask: [page.getByText(/^(Alice Nguyen|Caroline Ge|Daniel Wang)$/)] });

say("Copy the first rep phone. EXPECT 'Copied', clipboard is a 555 number");
const copy = people.locator('button[aria-label^="Copy "]').first();
console.log("copy label:", await copy.getAttribute("aria-label"));
await copy.click();
await wait(page, 300);
console.log("after:", await copy.getAttribute("aria-label"), "| clipboard 555:", /555/.test(await page.evaluate(() => navigator.clipboard.readText().catch(() => ""))));

say("Arrival pill. EXPECT it advances, then goes back with '<Sponsor>: Not written (sheet writes off)'");
const arrive = people.getByRole("button", { name: /Not arrived|Checked in|Booth set up/ }).first();
console.log("pill before:", (await arrive.innerText().catch(() => "?")).replace(/\s+/g, " "));
await arrive.click().catch((e) => console.log("arrival click failed:", e.message.split("\n")[0]));
await wait(page, 3000);
t = await body();
console.log("note:", t.match(/.*Not written.*/)?.[0] ?? "(none)", "| live:", await live());

say("CC workshop pill. EXPECT ticks 'At CC workshop' -> with writes off notes 'Not written (sheet writes off)'");
const cc = people.getByRole("button", { name: /Friday coffee chat briefing|CC workshop|briefing/i }).first();
console.log("cc pill:", await cc.count(), (await cc.getAttribute("aria-label").catch(() => "")) ?? "", "| disabled:", await cc.isDisabled().catch(() => "n/a"));
if (await cc.count()) { await cc.click().catch((e) => console.log("cc click failed:", e.message.split("\n")[0])); await wait(page, 3000); }
t = await body();
console.log("note:", t.match(/.*Not written.*/)?.[0] ?? "(none)", "| live:", await live());
const m = t.indexOf("Coffee chats");
console.log("coffee block:", t.slice(t.indexOf("Preferences"), t.indexOf("Preferences") + 300).replace(/\n/g, " / "));
console.log("workshop line:", t.match(/Their workshop[\s\S]{0,80}/)?.[0]?.replace(/\n/g, " / "));

say("Tabs: open each sponsor tab; look for PCBWay (digital: no Coffee chats block)");
const tabs = await page.getByRole("tab").allInnerTexts();
console.log("tabs:", tabs.join(" | "));
say("All sponsors (?list=all)");
await page.goto(`${BASE}/internal/sponsors?list=all`, { waitUntil: "networkidle" });
await wait(page, 2500);
t = await body();
console.log(t.match(/You lead \d+ sponsors?|All sponsors/g)?.slice(0, 3));
const pcb = page.getByRole("tab", { name: /PCBWay/ });
if (await pcb.count()) {
  await pcb.first().click();
  await wait(page, 1200);
  const p = clean(await page.getByRole("tabpanel").first().innerText());
  console.log("PCBWay: coffee block:", /Coffee chats/.test(p), "| presentation rows:", /Presentation/i.test(p));
}
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));

// Panel shot (Canada Life): fake reps, 555 phones; no organizer names in the panel.
{
  const { page } = await open(W, noah());
  await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
  await wait(page, 3000);
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  const panel = page.getByRole("tabpanel").filter({ hasText: "People" }).first();
  await panel.scrollIntoViewIfNeeded();
  await panel.screenshot({ path: `docs/ship/walkthrough/final/f08-my-sponsors-panel${tag}.png`, mask: [page.getByText(/Noah Medland|Alice Nguyen|Caroline Ge|Daniel Wang/)] });
  console.log("[shot] f08-my-sponsors-panel");
  await close();
}
