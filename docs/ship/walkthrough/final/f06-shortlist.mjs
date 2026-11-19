// Sponsor · Shortlist (Test Sponsor), real DB writes, fake hackers only.
import { open, snap, read, say, wait, close, BASE, SPONSORS, sql } from "./lib-final.mjs";

const T = SPONSORS.test;
const W = 1280;
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const grab = async (re) => ((await main.innerText()).match(re) || ["(none)"]).join(" ");
const go = async (q) => { await page.goto(`${BASE}/sponsors/${T}/coffee-chats${q}`, { waitUntil: "networkidle", timeout: 120000 }); await wait(page, 1500); };

await go("?flow=shortlist&step=1");
say("Shortlist step 1. EXPECT: 'People you met · invited first' read-only block first; cap line 'N seats · 3 taken by people you met · shortlist up to M'");
await read(main, 2500);
await snap(page, "f06-open", { full: true });
const views = await main.getByRole("tab").or(main.getByRole("radio")).or(main.getByRole("button", { name: /^(List|One at a time)$/ })).allInnerTexts();
console.log("view switch:", views.join(" | "));

say("One at a time: Shortlist, Skip, Shortlist");
await main.getByRole("button", { name: /^One at a time$/ }).or(main.getByRole("tab", { name: /One at a time/ })).or(main.getByRole("radio", { name: /One at a time/ })).first().click().catch((e) => console.log("no one-at-a-time:", e.message.split("\n")[0]));
await wait(page, 800);
await read(main.locator("section, article").last(), 600);
for (const b of ["Shortlist", "Skip", "Shortlist"]) {
  await main.getByRole("button", { name: new RegExp(`^${b}`) }).first().click().catch((e) => console.log(`no ${b}:`, e.message.split("\n")[0]));
  await wait(page, 1000);
}
await snap(page, "f06-one-at-a-time");
console.log("picked in DB:", sql(`select count(*) from sponsor_shortlist where sponsor_id='${T}'`).trim());

say("List: shortlist 3 more");
await main.getByRole("button", { name: /^List$/ }).or(main.getByRole("tab", { name: /^List/ })).or(main.getByRole("radio", { name: /^List/ })).first().click().catch(() => {});
await wait(page, 800);
const adds = main.getByRole("button", { name: /^Shortlist / });
console.log("list shortlist buttons:", await adds.count());
for (let i = 0; i < 3 && (await adds.count()); i++) { await adds.first().click(); await wait(page, 900); }
console.log("picked in DB:", sql(`select count(*) from sponsor_shortlist where sponsor_id='${T}'`).trim(), "| cap line:", await grab(/.*seats ·.*/));
await snap(page, "f06-list", { full: true });

say("Over cap: lower Dana and Kevin to 1 chat each (6 seats - 3 met = 3). EXPECT step 1: 'You now have room for 3 on your shortlist. Remove 2.'; home: '5 shortlisted, room for 3. Remove 2.'");
const keep = sql(`select name, chats_wanted from coffee_chat_rep where sponsor_id='${T}' order by position`).trim();
console.log("chats before:", keep.replace(/\n/g, ", "));
sql(`update coffee_chat_rep set chats_wanted=1 where sponsor_id='${T}'`);
await go("?flow=shortlist&step=1");
console.log("cap msg:", await grab(/.*room for \d+ on your shortlist.*/), "| '5 of 3' shown:", /5 of 3/.test(await main.innerText()));
console.log("full msg on add:", await grab(/Your shortlist is full.*/));
await snap(page, "f06-over-cap");
await go("");
console.log("home:", await grab(/.*shortlisted.*/));
for (const row of keep.split("\n")) { const [n, c] = row.split("|"); sql(`update coffee_chat_rep set chats_wanted=${c} where sponsor_id='${T}' and name='${n}'`); }
console.log("chats restored:", sql(`select name, chats_wanted from coffee_chat_rep where sponsor_id='${T}' order by position`).trim().replace(/\n/g, ", "));

say("Submit. EXPECT: 'Shortlist submitted', banner 'Editing un-submits it until you submit again.', no Remove buttons; Edit reopens");
await go("?flow=shortlist&step=2");
await read(main, 1500);
await main.getByRole("button", { name: /^Submit/ }).click();
await wait(page, 2000);
console.log("submitted:", /Shortlist submitted/.test(await main.innerText()), "| banner:", await grab(/.*Editing un-submits.*/), "| Remove buttons:", await main.getByRole("button", { name: /^Remove / }).count());
await snap(page, "f06-submitted", { full: true });
const edit = main.getByRole("button", { name: /Edit shortlist/ }).or(main.getByRole("link", { name: /Edit shortlist/ }));
console.log("Edit shortlist:", await edit.count());
if (await edit.count()) { await edit.first().click(); await wait(page, 1200); console.log("after Edit url:", page.url(), "| Remove buttons:", await main.getByRole("button", { name: /^Remove / }).count()); }
console.log("DB shortlist_submitted_at:", sql(`select shortlist_submitted_at from coffee_chat_pref where sponsor_id='${T}'`).trim());
console.log("errors:", page.errors.slice(0, 5));
await close();
