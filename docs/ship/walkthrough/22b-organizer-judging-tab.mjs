// Organizer · Judging tab after a failed Schedule presentations, plus the
// PCBWay digital entry with a link that matches no team.
import { open, shot, wait, close, BASE, USERS } from "./lib.mjs";
const NL = String.fromCharCode(10);
const { page } = await open(1280, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=judging`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
console.log("buttons:", (await page.getByRole("button").allInnerTexts()).map((s) => s.trim()).filter(Boolean).slice(0, 20).join(" | "));
await page.getByRole("button", { name: /presentations/i }).first().click().catch(() => {});
await wait(page, 1500);
await shot(page, "22-organizer-judging-no-room", { full: false });
console.log("Open round 2 disabled:", await page.getByRole("button", { name: "Open round 2" }).isDisabled());
console.log("EXPECT: no match -> '…doesn't match a submitted team…'; Save stays off");
const inputs = page.getByRole("textbox");
console.log("textboxes:", await inputs.count());
const first = page.getByLabel(/1st place/).first();
await first.fill("https://devpost.com/software/walkthrough-nothing");
await first.blur();
await wait(page, 1500);
const t = await page.locator("body").innerText();
const i = t.indexOf("Digital sponsors");
console.log(t.slice(i, i + 700));
console.log("Save disabled:", await page.getByRole("button", { name: "Save top 3" }).isDisabled());
const sec = page.locator("section, div").filter({ has: page.getByText("Digital sponsors don't use the portal") }).last();
await sec.screenshot({ path: "docs/ship/walkthrough/22-organizer-judging-digital-nomatch.png" });
await close();
