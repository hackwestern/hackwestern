// Organizer · Happening now (test organizer, matches nobody in HW Contacts).
// The full Sponsors tab lists real organizer names (HW contact column), so
// only the Happening now section goes in the repo; the full page stays private.
import { open, shot, text, wait, close, BASE, USERS } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 2500);
await shot(page, `07-organizer-sponsors-full${tag}`, { priv: true });
const sec = page.locator("section, div").filter({ has: page.getByText("Needs attention now") }).filter({ has: page.getByText(/Now and next/) }).last();
await sec.screenshot({ path: `docs/ship/walkthrough/07-organizer-happening-now${tag}.png` });
console.log("[shot] happening now section");
say("Follow 'Open coffee chats' on the first item. EXPECT the coffee board opens on that sponsor");
await page.getByRole("link", { name: /Open coffee chats/ }).or(page.getByRole("button", { name: /Open coffee chats/ })).first().click();
await page.waitForLoadState("networkidle");
await wait(page, 2500);
console.log("url:", page.url());
console.log("focused:", await page.evaluate(() => (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "").slice(0, 80)));
await shot(page, `07-organizer-happening-now-link${tag}`, { full: false });
say("?tab=pings and #help");
await page.goto(`${BASE}/internal/sponsors?tab=pings`, { waitUntil: "networkidle" });
await wait(page, 1500);
console.log("pings url ->", page.url(), "| tabs:", (await page.getByRole("tab").allInnerTexts()).join(", "));
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
