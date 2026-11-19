// After: Send asks once before messaging hackers. Noah's local login. One
// of Dana's sent chats is set back to draft for the shot (sent_at kept), the
// dialog is cancelled (nothing is sent), and the row is put back.
import { open, wait, close, BASE, sql, shotAfter, noahUser } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const dana = sql(`select id from coffee_chat_rep where name='Walkthrough Dana'`).trim();
sql(`update coffee_chat_placement set status='draft' where rep_id='${dana}' and session_id='15'`);
try {
  const { page } = await open(W, noahUser(sql));
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  await wait(page, 1000);
  const send = page.getByRole("button", { name: /^Send confirmed schedules/ });
  console.log("send enabled:", !(await send.isDisabled()));
  await send.click();
  const dlg = page.getByRole("alertdialog");
  await dlg.waitFor({ timeout: 5000 });
  console.log("dialog:", (await dlg.innerText()).replace(/\n+/g, " / "));
  await shotAfter(page, `o6-send-confirm${tag}`);
  await dlg.getByRole("button", { name: "Cancel" }).click();
  await wait(page, 500);
  console.log("dialog closed:", (await page.getByRole("alertdialog").count()) === 0);
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
  await close();
} finally {
  sql(`update coffee_chat_placement set status='sent' where rep_id='${dana}' and session_id='15'`);
  console.log("restored:", sql(`select session_id, status from coffee_chat_placement where rep_id='${dana}' order by 1`).trim().replace(/\n/g, " "));
}
