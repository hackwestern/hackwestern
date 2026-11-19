// Hand-off: an organizer arrives cold after the sponsor changed after invites.
import { open, shot, wait, close, BASE, USERS } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const NL = String.fromCharCode(10);
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1500);
const t = await page.locator("body").innerText();
const pick = (a, b) => { const i = t.indexOf(a); return i < 0 ? `(no ${a})` : t.slice(i, t.indexOf(b, i + 1)); };
console.log("NEEDS ATTENTION:\n" + pick("Needs attention now", "Event now"));
console.log("BOARD TOP:\n" + pick("Book a room\nHelp", "Rooms\n"));
const labels = await page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || "").trim()).filter(Boolean));
console.log("chips:", labels.filter((l) => /^(Commure|Canada Life|CSE|Scotiabank|StarTech|Sun Life|Test Sponsor), /.test(l)).join(" | "));
await shot(page, `16-handoff-organizer-sees-change${tag}`);
// Open Test Sponsor's row: invite summary (Integration 7).
await page.locator('button[aria-label^="Test Sponsor"]').first().click();
await wait(page, 1000);
const t2 = await page.locator("body").innerText();
const i = t2.indexOf("Invites:");
console.log("INVITE SUMMARY:", i < 0 ? "(no 'Invites:' line)" : t2.slice(i, i + 200).split(NL).slice(0, 3).join(" / "));
await shot(page, `16-handoff-organizer-test-sponsor-row${tag}`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
