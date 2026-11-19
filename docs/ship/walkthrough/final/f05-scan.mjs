// Sponsor · Scan a hacker (Test Sponsor). Fake hackers only (demo-hacker-1, walk-*-test).
import { open, snap, read, say, wait, close, BASE, SPONSORS, sql } from "./lib-final.mjs";
import { filledButtons } from "../after/portal-lib.mjs";

const T = SPONSORS.test;
for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  const main = page.locator("#sponsor-main");
  const go = async () => { await page.goto(`${BASE}/sponsors/${T}/scan`, { waitUntil: "networkidle", timeout: 120000 }); await wait(page, 1500); };
  const lookup = async (code) => {
    const typeBtn = main.getByRole("button", { name: /Type their hacker code/i });
    if (await typeBtn.count()) await typeBtn.first().click();
    await main.getByRole("textbox").first().fill(code);
    await main.getByRole("button", { name: "Look up" }).click();
    await wait(page, 2000);
  };
  await go();
  say(`[${W}] Scan page. EXPECT: 'No camera found' once; 'Type their hacker code'`);
  const t = await main.innerText();
  console.log("No camera found x", (t.match(/No camera found/g) ?? []).length, "| type link:", /Type their hacker code/.test(t));
  if (W === 390) await snap(page, `f05-scan-open${tag}`);
  if (W === 1280) {
    say("Look up demo-otter-kite (Alex). EXPECT: 'Met at your booth · You met Alex', no times/rooms; one filled 'Add to my list'");
    await lookup("demo-otter-kite");
    await read(main, 900);
    console.log("filled:", await filledButtons(main));
    await snap(page, `f05-found${tag}`);
    say("Pick Walkthrough Kevin, Add. EXPECT: 'Alex is on your list. We'll invite them first.' + text 'Scan next'");
    await main.getByRole("button", { name: /Walkthrough Kevin/ }).or(main.getByRole("radio", { name: /Walkthrough Kevin/ })).first().click();
    await main.getByRole("button", { name: "Add to my list" }).click();
    await wait(page, 1500);
    console.log((await main.innerText()).match(/.*on your list.*/)?.[0], "| filled:", await filledButtons(main));
    await snap(page, `f05-added${tag}`);
    await main.getByRole("button", { name: "Scan next" }).click();
    await wait(page, 800);
    say("Repeat Alex. EXPECT: 'Already on your list · added <time> · talked to Walkthrough Kevin', button 'Save'");
    await lookup("demo-otter-kite");
    console.log((await main.innerText()).match(/Already on your list.*/)?.[0], "| buttons:", (await main.getByRole("button").allInnerTexts()).join(" | "));
    await snap(page, `f05-again${tag}`);
    say("Pick Anyone + Save. EXPECT: first time kept, rep replaced by null");
    const before = sql(`select scanned_at, rep_name from sponsor_scan where sponsor_id='${T}' and user_id='demo-hacker-1'`).trim();
    await main.getByRole("button", { name: /^Anyone/ }).or(main.getByRole("radio", { name: /Anyone/ })).first().click();
    await main.getByRole("button", { name: /^Save/ }).click();
    await wait(page, 1500);
    console.log("before:", before, "| after:", sql(`select scanned_at, rep_name from sponsor_scan where sponsor_id='${T}' and user_id='demo-hacker-1'`).trim());
    say("Not now: walk-ben-test, then Not now. EXPECT: back to scanning, nothing added");
    await go();
    await lookup("walk-ben-test");
    await main.getByRole("button", { name: "Not now" }).click();
    await wait(page, 800);
    console.log("ben scanned:", sql(`select count(*) from sponsor_scan where sponsor_id='${T}' and user_id='walkthrough-hacker-2'`).trim());
    say("Non-hacker: redesign-organizer-1. EXPECT: 'That isn't a Hack Western hacker's badge.'");
    await go();
    await lookup("redesign-organizer-1");
    console.log((await main.innerText()).match(/.*isn't a Hack Western.*/)?.[0] ?? "(no message)");
    await snap(page, `f05-not-a-hacker${tag}`);
    say("Also add Ada and Cleo (Anyone) so 3 people are met at the booth");
    for (const c of ["walk-ada-test", "walk-cleo-test"]) { await go(); await lookup(c); await main.getByRole("button", { name: "Add to my list" }).click(); await wait(page, 1200); }
  } else {
    await lookup("walk-cleo-test");
    console.log("390 repeat:", (await main.innerText()).match(/Already on your list.*/)?.[0]);
    await snap(page, `f05-again${tag}`);
  }
  await page.goto(`${BASE}/sponsors/${T}/coffee-chats`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log("home booth line:", (await main.innerText()).match(/.*met at your booth.*/i)?.[0]);
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
