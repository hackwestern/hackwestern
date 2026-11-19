// Organizer · Schedule and fix: does a move say "Moved."? Moves Canada Life's
// first chat (sent, no invites) to an empty cell and watches every toast.
import { open, say, wait, close, BASE, USERS, sql } from "./lib-final.mjs";

const { page } = await open(1280, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1000);
const seen = new Set();
const watch = setInterval(async () => {
  for (const t of await page.locator("[data-sonner-toast], [role=status]").allInnerTexts().catch(() => [])) if (t.trim()) seen.add(t.replace(/\s+/g, " ").trim());
}, 100);
const labels = async () => page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || "").trim()).filter(Boolean));
const chat = (await labels()).find((l) => /^Canada Life · /.test(l));
say(`Move '${chat}'. EXPECT toast 'Moved.'; chip stays 'Sent'`);
await page.getByRole("button", { name: chat, exact: true }).click();
await wait(page, 600);
await page.getByRole("button", { name: "Move", exact: true }).first().click();
await wait(page, 600);
const target = (await labels()).find((l) => /^Move here: 13\d\d, 4–5/.test(l)) ?? (await labels()).find((l) => /^Move here/.test(l));
console.log("target:", target);
await page.getByRole("button", { name: target, exact: true }).click();
await wait(page, 4000);
clearInterval(watch);
console.log("messages seen:", [...seen].filter((s) => !/Event now/.test(s)).join(" | ") || "(none)");
console.log("Canada Life chip:", (await page.locator('section[aria-labelledby="coffee-sponsors"]').innerText()).match(/Canada Life\n[^\n]+/)?.[0]);
console.log("DB:", sql(`select r.name, p.session_id, p.room, p.status from coffee_chat_placement p join coffee_chat_rep r on r.id=p.rep_id join sponsor_judging_sponsor s on s.id=r.sponsor_id where s.name='Canada Life' order by 1,2`).trim().replace(/\n/g, ", "));
await close();
