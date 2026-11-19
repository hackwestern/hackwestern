// Organizer · Send (Noah only). The cookie carries Noah's login email (read
// from HW Contacts into the local DB user walkthrough-noah; never in the repo).
// Invites run in dry mode (COFFEE_INVITES_ENABLED=dry): saved, not sent.
import { open, shot, wait, close, BASE, USERS, sql } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const live = async (page) => (await page.locator('[role="status"], [role="alert"], [data-sonner-toast]').allInnerTexts()).map((s) => s.trim()).filter((s) => s.replace(/[.\s]/g, "") && !/Event now/.test(s)).join(" / ");
const go = async (user) => {
  const { page } = await open(W, user);
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  await wait(page, 1500);
  return page;
};

say("Test organizer: EXPECT Send disabled with 'Only Noah sends'");
{
  const page = await go(USERS.organizer);
  const send = page.getByRole("button", { name: /^Send confirmed schedules/ });
  console.log("disabled:", await send.isDisabled(), "| bar:", (await page.locator("body").innerText()).split(String.fromCharCode(10)).filter((l) => /Only Noah|Invites go out|fix(es)? open/.test(l)).join(" / "));
  await shot(page, `13-organizer-send-not-noah${tag}`, { full: false });
}

say("Noah: EXPECT 'Send confirmed schedules & invites' enabled; after Send toast 'Sent N chats. Invited M hackers' and chips 'Sent'");
console.log("drafts before:", sql("select count(*) from coffee_chat_placement where status='draft'").trim(), "| invites before:", sql("select count(*) from coffee_chat where placement_id is not null").trim());
const email = sql(`select email from "user" where id='walkthrough-noah'`).trim();
const page = await go({ sub: "walkthrough-noah", name: "Noah", email });
const send = page.getByRole("button", { name: /^Send confirmed schedules/ });
console.log("disabled:", await send.isDisabled());
await shot(page, `13-organizer-send-noah-before${tag}`, { full: false });
await send.click();
await wait(page, 600);
const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog"));
if (await dlg.count()) {
  console.log("confirm dialog:", (await dlg.first().innerText()).replace(/\s+/g, " "));
  await shot(page, `13-organizer-send-confirm${tag}`, { full: false });
  await dlg.first().getByRole("button", { name: /Send/ }).last().click();
}
let msg = "";
for (let k = 0; k < 30 && !msg; k++) { await wait(page, 300); msg = await live(page); }
console.log("toast:", msg || "(none)");
await shot(page, `13-organizer-send-after${tag}`, { full: false });
await wait(page, 2000);
const labels = await page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || "").trim()).filter(Boolean));
console.log("chips:", labels.filter((l) => /^(Commure|Canada Life|CSE|Scotiabank|StarTech|Sun Life|Test Sponsor), /.test(l)).join(" | "));
console.log("bar:", (await page.locator("body").innerText()).split(String.fromCharCode(10)).filter((l) => /Only Noah|Invites go out|Sent|fix(es)? open|Nothing new/.test(l)).slice(0, 6).join(" / "));
console.log("drafts after:", sql("select count(*) from coffee_chat_placement where status='draft'").trim(), "| sent:", sql("select count(*) from coffee_chat_placement where status='sent'").trim());
console.log("invites:", sql("select c.user_id, s.name, c.status, c.round, c.source from coffee_chat c join sponsor_judging_sponsor s on s.id=c.sponsor_id where c.placement_id is not null order by s.name, c.user_id"));
await shot(page, `13-organizer-send-board-after${tag}`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
