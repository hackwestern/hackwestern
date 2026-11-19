// Sponsor · Shortlist over the cap (Test Sponsor): shortlist 5 in List view,
// lower both reps to 1 chat (room for 3), read the messages, restore, resubmit.
import { open, snap, read, say, wait, close, BASE, SPONSORS, sql } from "./lib-final.mjs";

const T = SPONSORS.test;
for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  const main = page.locator("#sponsor-main");
  const grab = async (re) => ((await main.innerText()).match(re) || ["(none)"]).join(" ");
  const go = async (q) => { await page.goto(`${BASE}/sponsors/${T}/coffee-chats${q}`, { waitUntil: "networkidle", timeout: 120000 }); await wait(page, 1500); };
  await go("?flow=shortlist&step=1");
  await main.getByRole("radio", { name: "List" }).click();
  await wait(page, 800);
  if (W === 1280) {
    console.log("list buttons:", (await main.getByRole("button").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label") || x.innerText))).join(" | "));
    await main.getByRole("radio", { name: "Not shortlisted" }).click();
    await wait(page, 600);
    const add = main.getByRole("button", { name: /^Shortlist Walkthrough/ });
    for (let i = 0; i < 3; i++) { await add.first().click(); await wait(page, 900); }
    console.log("picked in DB:", sql(`select count(*) from sponsor_shortlist where sponsor_id='${T}'`).trim());
  }
  const keep = sql(`select name, chats_wanted from coffee_chat_rep where sponsor_id='${T}' order by position`).trim();
  sql(`update coffee_chat_rep set chats_wanted=1 where sponsor_id='${T}'`);
  await go("?flow=shortlist&step=1");
  say(`[${W}] Over cap. EXPECT: only 'You now have room for 3 on your shortlist. Remove 2.' (no '5 of 3')`);
  console.log("cap msg:", await grab(/.*room for \d+ on your shortlist.*/), "| '5 of 3':", /5 of 3/.test(await main.innerText()), "| top:", await grab(/\d+ of \d+ shortlisted/));
  await main.getByRole("radio", { name: "List" }).click();
  await wait(page, 600);
  await snap(page, `f06-over-cap${tag}`);
  await go("");
  console.log("home:", await grab(/.*shortlisted.*/));
  await snap(page, `f06-over-cap-home${tag}`);
  for (const row of keep.split("\n")) { const [n, c] = row.split("|"); sql(`update coffee_chat_rep set chats_wanted=${c} where sponsor_id='${T}' and name='${n}'`); }
  if (W === 390) {
    say("Restored chats; submit shortlist. EXPECT: 'Shortlist submitted'");
    await go("?flow=shortlist&step=2");
    await main.getByRole("button", { name: /^Submit/ }).click();
    await wait(page, 2000);
    console.log("submitted:", /Shortlist submitted/.test(await main.innerText()), "| DB:", sql(`select shortlist_submitted_at is not null from coffee_chat_pref where sponsor_id='${T}'`).trim());
    await snap(page, `f06-submitted${tag}`);
  }
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
