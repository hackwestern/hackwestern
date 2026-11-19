// Sponsor · Change after invites (Test Sponsor, already sent).
// Untick Walkthrough Dana's 1–2 (3 hackers invited). First "Keep it as is",
// then "Change anyway".
import { open, shot, text, wait, close, BASE, SPONSORS, sql } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const invites = () => sql(`select c.user_id, c.status, to_char(c.slot_time,'HH24:MI') slot, to_char(c.expires_at,'Dy HH24:MI') exp from coffee_chat c where c.sponsor_id='${SPONSORS.test}' and c.placement_id is not null order by 3,1`);
console.log("invites before:\n" + invites());
const { page } = await open(W);
const main = page.locator("#sponsor-main");
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
await shot(page, `15-sponsor-change-step2-sent${tag}`, { full: false });
console.log("top of step:", (await main.innerText()).split(String.fromCharCode(10)).slice(0, 12).join(" / "));

say("EXPECT dialog 'Invites are already out' / 'Changing this will ask 3 hackers to confirm again…'");
const box = main.getByRole("checkbox", { name: /Walkthrough Dana, 1–2/ });
await box.click();
await wait(page, 800);
const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog")).first();
console.log("dialog:", (await dlg.innerText().catch(() => "(no dialog)")).replace(/\s+/g, " "));
console.log("buttons:", (await dlg.getByRole("button").allInnerTexts().catch(() => [])).join(" | "));
await shot(page, `15-sponsor-change-dialog${tag}`, { full: false });

say("Keep it as is. EXPECT nothing changes (box stays ticked)");
await dlg.getByRole("button", { name: /Keep/ }).click();
await wait(page, 1200);
console.log("Dana 1–2 checked:", await box.getAttribute("aria-checked"));

say("Again, Change anyway. EXPECT it saves; status card adds 'You changed your setup after invites went out…'");
await box.click();
await wait(page, 800);
await page.getByRole("alertdialog").or(page.getByRole("dialog")).first().getByRole("button", { name: /Change anyway/ }).click();
await wait(page, 3000);
console.log("Dana 1–2 checked:", await box.getAttribute("aria-checked"));
console.log("status:", (await main.innerText()).split(String.fromCharCode(10)).slice(0, 12).join(" / "));
await shot(page, `15-sponsor-change-saved${tag}`, { full: false });

say("EXPECT: the same screen doesn't ask again (untick Kevin 4–5, no sent chat there)");
await main.getByRole("checkbox", { name: /Walkthrough Kevin, 4–5/ }).click();
await wait(page, 800);
console.log("dialog shown again:", await page.getByRole("alertdialog").or(page.getByRole("dialog")).count());
await wait(page, 2000);
console.log("invites after:\n" + invites());
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
