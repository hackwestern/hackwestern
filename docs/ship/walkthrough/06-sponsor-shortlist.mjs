// Sponsor · Shortlist (Test Sponsor): one at a time, list, submit, edit, over-cap.
import { open, shot, text, wait, close, BASE, SPONSORS, sql } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const log = W === 1280;
const say = (s) => console.log(`\n=== ${s}`);
sql(`delete from sponsor_shortlist where sponsor_id='${SPONSORS.test}'; update coffee_chat_pref set shortlist_submitted_at=null where sponsor_id='${SPONSORS.test}';`);
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const lines = async (re) => (await main.innerText()).split("\n").filter((l) => re.test(l)).join(" / ");
const base = `${BASE}/sponsors/${SPONSORS.test}/coffee-chats`;
await page.goto(`${base}?flow=shortlist&step=1`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);

say("One at a time: Shortlist, Skip, Shortlist, Shortlist. EXPECT count 3 of 16");
for (const b of ["Shortlist", "Skip", "Shortlist", "Shortlist"]) {
  await main.getByRole("button", { name: new RegExp(`^${b}`) }).first().click();
  await wait(page, 900);
}
console.log(await lines(/shortlisted|left to look|seats/));
await shot(page, `06-sponsor-shortlist-one-at-a-time${tag}`);

say("List view");
console.log("List role:", await main.getByText("List", { exact: true }).first().evaluate((e) => `${e.tagName} ${e.getAttribute("role")} ${e.parentElement?.getAttribute("role")}`)); await main.getByText("List", { exact: true }).first().click();
await wait(page, 1000);
if (log) await text(page, "#sponsor-main", 3000);
await shot(page, `06-sponsor-shortlist-list${tag}`);

say("Next: Review & submit. EXPECT a review of 3 + scanned block");
await main.getByText(/^Next: Review & submit/).first().click();
await wait(page, 1500);
if (log) await text(page, "#sponsor-main", 3000);
await shot(page, `06-sponsor-shortlist-review${tag}`);
console.log("buttons:", (await main.getByRole("button").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" | "));

say("Submit. EXPECT 'Shortlist submitted' and an 'Edit shortlist' button");
await main.getByRole("button", { name: /^Submit/ }).first().click();
await wait(page, 2000);
if (log) await text(page, "#sponsor-main", 2000);
await shot(page, `06-sponsor-shortlist-submitted${tag}`);

say("Edit shortlist. EXPECT the list reopens");
const edit = main.getByRole("button", { name: /Edit shortlist/ }).or(main.getByRole("link", { name: /Edit shortlist/ })).first();
if (await edit.count()) {
  await edit.click();
  await wait(page, 1500);
  console.log("url:", page.url());
  console.log(await lines(/shortlisted|Submit|seats/));
} else console.log("no Edit shortlist control; buttons:", await main.getByRole("button").allInnerTexts());

if (log) {
  say("Over-cap edge: lower chats so seats < shortlist. Dana 1 chat, Kevin 0 -> 3 seats, 2 scanned -> cap 1, shortlist has 3.");
  const d = sql(`select id from coffee_chat_rep where sponsor_id='${SPONSORS.test}' and name='Walkthrough Dana'`).trim();
  const k = sql(`select id from coffee_chat_rep where sponsor_id='${SPONSORS.test}' and name='Walkthrough Kevin'`).trim();
  sql(`update coffee_chat_rep set chats_wanted=1 where id='${d}'; update coffee_chat_rep set chats_wanted=0 where id='${k}';`);
  await page.goto(`${base}?flow=shortlist&step=1`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log(await lines(/seat|Remove|shortlisted/));
  await shot(page, `06-sponsor-shortlist-over-cap${tag}`);
  await page.goto(base, { waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log("home:", await lines(/seat|Shortlist|Remove/));
  await shot(page, `06-sponsor-shortlist-over-cap-home${tag}`);
  sql(`update coffee_chat_rep set chats_wanted=4 where id='${d}'; update coffee_chat_rep set chats_wanted=2 where id='${k}';`);
}
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
