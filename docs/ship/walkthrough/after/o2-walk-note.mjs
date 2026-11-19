// After: B8 walk note. Temporarily swaps Dana's 3-4 chat (Ivey 1348) with
// whatever sits in near room 2242 at 3-4, so she's back to back Ivey -> near,
// screenshots, then swaps them back.
import { open, wait, close, BASE, USERS, sql, shotAfter } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const dana = sql(`select id from coffee_chat_rep where name='Walkthrough Dana'`).trim();
const other = sql(`select id from coffee_chat_placement where room='2242' and session_id='15'`).trim();
const swap = (a, b) =>
  sql(`begin; update coffee_chat_placement set room='tmp' where rep_id='${dana}' and session_id='15';
    ${other ? `update coffee_chat_placement set room='${b}' where id='${other}';` : ""}
    update coffee_chat_placement set room='${a}' where rep_id='${dana}' and session_id='15'; commit;`);
swap("2242", "1348");
try {
  const { page } = await open(W, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  const row = page.getByRole("button", { name: /^Test Sponsor,/ });
  await row.click();
  await wait(page, 800);
  const band = page.locator('section[aria-labelledby="coffee-sponsors"]');
  const body = await band.innerText();
  console.log("walk notes:", body.split("\n").filter((l) => /Walk (to|back)/.test(l)).join(" / ") || "(none)");
  await band.screenshot({ path: `docs/ship/walkthrough/after/o2-walk-note${tag}.png` });
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
  await close();
} finally {
  swap("1348", "2242");
  console.log("restored:", sql(`select session_id, room from coffee_chat_placement where rep_id='${dana}' order by 1`).trim());
}
