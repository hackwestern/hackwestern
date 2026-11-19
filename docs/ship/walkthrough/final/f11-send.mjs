// Organizer · Send. First the test organizer (not Noah), then Noah (local
// walkthrough-noah user; email read from the DB at runtime). Invites are in
// dry-run mode (COFFEE_INVITES_ENABLED=dry): saved, nothing messaged.
// Usage: node f11-send.mjs [label]
import { open, snap, say, wait, close, BASE, USERS, sql, noah, clean } from "./lib-final.mjs";

const label = process.argv[2] || "first";
const go = async (page) => {
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  await wait(page, 1200);
};
const bar = (page) => page.getByRole("button", { name: /Send confirmed|Save & confirm|^Send/ }).last();

if (label === "first") {
  const { page } = await open(1280, USERS.organizer);
  await go(page);
  say("Test organizer. EXPECT Send disabled with 'Only Noah sends'");
  const b = bar(page);
  console.log("button:", await b.innerText(), "| disabled:", await b.isDisabled(), "| 'Only Noah sends':", /Only Noah sends/.test(await page.locator("main").innerText()));
  await snap(page, "f11-send-not-noah");
  await page.context().close();
}

const { page } = await open(1280, noah());
await go(page);
const drafts = sql(`select count(*) from coffee_chat_placement where status='draft'`).trim();
const flagged = sql(`select count(*) from coffee_chat_pref where submitted_at is not null`).trim();
const seats = sql(`select coalesce(sum(c.hackers_per_chat * case when c.hackers_per_chat=1 then 4 else 2 end),0) from coffee_chat_placement p join coffee_chat_rep r on r.id=p.rep_id join coffee_chat_pref c on c.sponsor_id=r.sponsor_id where p.status='draft'`).trim();
say(`Noah (${label}). Drafts in DB: ${drafts}; seats in draft sessions (upper bound): ${seats}`);
const b = bar(page);
console.log("button:", await b.innerText(), "| disabled:", await b.isDisabled());
console.log("send bar:", clean(await page.locator("main").innerText()).split("\n").slice(-6).join(" / "));
say("PRESS SEND. EXPECT one confirm: 'Send N sponsors' schedules and invite up to M hackers? Hackers get a Slack message now.' (Send now / Cancel)");
await b.click();
await wait(page, 800);
const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
const dt = clean(await dlg.innerText().catch(() => "(no dialog)"));
console.log("confirm:", dt.replace(/\n/g, " | "));
await snap(page, `f11-send-confirm-${label}`);
say("SEND NOW. EXPECT toast 'Sent N chats. Invited M hackers … (dry run: nothing was messaged)'; chips 'Sent'");
await dlg.getByRole("button", { name: /Send now/ }).click();
let toast = "";
for (let k = 0; k < 40 && !toast; k++) {
  await wait(page, 250);
  toast = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" / ").replace(/\s+/g, " ");
}
console.log("toast:", toast || "(none)");
await wait(page, 2500);
await snap(page, `f11-send-after-${label}`);
const t = clean(await page.locator("main").innerText());
const i = t.indexOf("Coffee chats\nSaturday");
console.log(t.slice(i, i + 900));
console.log("placements:", sql(`select status, count(*) from coffee_chat_placement group by 1`).trim().replace(/\n/g, ", "));
console.log("invites:", sql(`select status, source, count(*) from coffee_chat where placement_id is not null group by 1,2 order by 1,2`).trim().replace(/\n/g, ", "));
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
