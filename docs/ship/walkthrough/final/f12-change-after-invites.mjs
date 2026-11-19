// Sponsor · Change after invites (Test Sponsor, sent). Harmless edits first
// (Keep), then untick Kevin's 10–11 (a sent chat with invites): Keep, then
// "Change anyway". Writes to the local DB.
import { open, snap, say, wait, close, BASE, SPONSORS, sql, clean } from "./lib-final.mjs";

const T = SPONSORS.test;
const inv = () => sql(`select c.status, c.slot_time, count(*) from coffee_chat c where c.sponsor_id='${T}' and c.placement_id is not null group by 1,2 order by 2,1`).trim().replace(/\n/g, ", ");
const { page } = await open(1280);
const main = page.locator("#sponsor-main");
const dlg = page.getByRole("alertdialog");
const read = async () => (await dlg.innerText().catch(() => "(no dialog)")).replace(/\s+/g, " ");
await page.goto(`${BASE}/sponsors/${T}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
console.log("invites before:", inv());
const k1011 = sql(`select count(*) from coffee_chat c join coffee_chat_placement p on p.id=c.placement_id join coffee_chat_rep r on r.id=p.rep_id where r.name='Walkthrough Kevin' and p.session_id='10' and c.status in ('pending','accepted')`).trim();

say("Tick an empty session (Dana 4–5). EXPECT dialog 'This doesn't affect any invited hackers.'; Keep it as is");
await main.getByRole("checkbox", { name: /Walkthrough Dana, 4–5 PM/ }).click();
await wait(page, 600);
console.log("dialog:", await read());
await dlg.getByRole("button", { name: "Keep it as is" }).click().catch(() => {});
await wait(page, 500);

say(`Untick Kevin 10–11 (sent chat, ${k1011} live invites). EXPECT 'Invites are already out' + 'This affects ${k1011} invited hackers. Organizers will update their chats, and the hackers will be told.'`);
await main.getByRole("checkbox", { name: /Walkthrough Kevin, 10–11 AM/ }).click();
await wait(page, 600);
console.log("dialog:", await read());
await snap(page, "f12-change-dialog");
say("KEEP IT AS IS. EXPECT nothing changes (box still ticked, DB same)");
await dlg.getByRole("button", { name: "Keep it as is" }).click();
await wait(page, 1500);
console.log("box:", await main.getByRole("checkbox", { name: /Walkthrough Kevin, 10–11 AM/ }).getAttribute("aria-checked"),
  "| Kevin sessions:", sql(`select string_agg(session_id, ',' order by session_id) from coffee_chat_rep_session s join coffee_chat_rep r on r.id=s.rep_id where r.name='Walkthrough Kevin'`).trim());

say("Again, CHANGE ANYWAY. EXPECT it saves; that screen doesn't ask again; invites for Kevin 10–11 re-asked/moved/cancelled");
await main.getByRole("checkbox", { name: /Walkthrough Kevin, 10–11 AM/ }).click();
await wait(page, 600);
await dlg.getByRole("button", { name: "Change anyway" }).click();
await wait(page, 3000);
console.log("Kevin sessions:", sql(`select string_agg(session_id, ',' order by session_id) from coffee_chat_rep_session s join coffee_chat_rep r on r.id=s.rep_id where r.name='Walkthrough Kevin'`).trim());
console.log("invites after:", inv());
say("Second edit on this screen (Dana 4–5 tick). EXPECT no dialog");
await main.getByRole("checkbox", { name: /Walkthrough Dana, 4–5 PM/ }).click();
await wait(page, 800);
console.log("dialog count:", await dlg.count());
await main.getByRole("checkbox", { name: /Walkthrough Dana, 4–5 PM/ }).click();
await wait(page, 2500);
const card = page.getByRole("region", { name: "Where things stand" });
console.log("status card:", clean(await card.innerText()).replace(/\s+/g, " "));
await page.goto(`${BASE}/sponsors/${T}/coffee-chats`, { waitUntil: "networkidle" });
await wait(page, 2000);
say("Chats home. EXPECT 'You changed your setup after invites went out.' + the same sentence");
console.log(clean(await main.innerText()).slice(0, 700));
await snap(page, "f12-home-after-change", { full: true });
console.log("errors:", page.errors.slice(0, 5));
await close();
