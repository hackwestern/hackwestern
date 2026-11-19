// Both · Invites: hacker invited -> answers -> both sides see it.
// Alex (demo-hacker-1) accepts Test Sponsor; Sam (demo-hacker-2) declines Sun Life.
import { open, shot, text, wait, close, BASE, USERS, sql } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const NL = String.fromCharCode(10);

for (const [who, action] of [["alex", "Accept"], ["sam", "Decline"]]) {
  const { page } = await open(W, USERS[who]);
  say(`${who}: open /live. EXPECT toast '<Sponsor> wants to chat with you' with Accept / Decline`);
  await page.goto(`${BASE}/live`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 3000);
  const toastTxt = await page.locator("[data-sonner-toast], [role=status], [role=alert]").allInnerTexts();
  console.log("toasts:", toastTxt.map((s) => s.replace(/\s+/g, " ")).filter(Boolean).join(" / ") || "(none)");
  await shot(page, `19-hacker-${who}-live${tag}`, { full: false });
  say(`${who}: /live?tab=coffee-chats, press ${action}`);
  await page.goto(`${BASE}/live?tab=coffee-chats`, { waitUntil: "networkidle" });
  await wait(page, 2500);
  const body = await page.locator("body").innerText();
  const i = body.search(/wants to chat|invite/i);
  console.log(body.slice(Math.max(0, i - 200), i + 900));
  await shot(page, `19-hacker-${who}-coffee-tab${tag}`, { full: false });
  const btn = page.getByRole("button", { name: new RegExp(`^${action}`) }).first();
  console.log(`${action} buttons:`, await page.getByRole("button", { name: new RegExp(`^${action}`) }).count());
  if (await btn.count()) {
    await btn.click();
    await wait(page, 800);
    const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog"));
    if (await dlg.count()) {
      console.log("confirm:", (await dlg.first().innerText()).replace(/\s+/g, " "));
      await dlg.first().getByRole("button", { name: new RegExp(action) }).last().click();
    }
    await wait(page, 2000);
    const after = await page.locator("body").innerText();
    const j = after.search(/Test Sponsor|Sun Life/);
    console.log("after:", after.slice(Math.max(0, j - 100), j + 500).replace(/\n+/g, " / "));
    await shot(page, `19-hacker-${who}-after-${action.toLowerCase()}${tag}`, { full: false });
  }
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 3));
  await page.context().close();
}
console.log("DB:\n" + sql("select c.user_id, s.name, c.status, c.slot_time from coffee_chat c join sponsor_judging_sponsor s on s.id=c.sponsor_id where c.user_id in ('demo-hacker-1','demo-hacker-2') and c.placement_id is not null"));
await close();
