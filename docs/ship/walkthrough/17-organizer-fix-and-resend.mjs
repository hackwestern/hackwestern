// Organizer applies Test Sponsor's fix (move Dana's 1–2 chat), then Noah sends
// again. EXPECT: the moved chat stays Sent and its 3 hackers are re-asked with
// a new slot time; Send re-confirms Test Sponsor and clears "Changed after invites".
import { open, shot, wait, close, BASE, USERS, SPONSORS, sql } from "./lib.mjs";

const W = 1280;
const say = (s) => console.log(`\n=== ${s}`);
const inv = () => sql(`select user_id, status, slot_time, expires_at from coffee_chat where sponsor_id='${SPONSORS.test}' and placement_id is not null and slot_time >= '13:00' order by 3,1`);
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
console.log("invites at 1–2 before:\n" + inv());
{
  const page = await go(USERS.organizer);
  say("Apply Test Sponsor's fix");
  const fix = page.locator("div, li, article").filter({ hasText: /Walkthrough Dana's pinned chat/ }).getByRole("button", { name: "Apply fix" }).first();
  await fix.click();
  let m = ""; for (let k = 0; k < 12 && !m; k++) { await wait(page, 250); m = await live(page); }
  console.log("toast:", m || "(none)");
  await wait(page, 1500);
  const labels = await page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || "").trim()).filter(Boolean));
  console.log("Dana chats:", labels.filter((l) => /Walkthrough Dana/.test(l)).join(" | "));
  console.log("chip:", labels.filter((l) => /^Test Sponsor, /.test(l)).join(" | "));
  await shot(page, `17-organizer-fix-applied-sent-chat`, { full: false });
  console.log("invites after fix:\n" + inv());
  await page.context().close();
}
{
  const email = sql(`select email from "user" where id='walkthrough-noah'`).trim();
  const page = await go({ sub: "walkthrough-noah", name: "Noah", email });
  say("Noah: Send again. EXPECT toast 'Re-confirmed 1 sponsor who changed after invites.' and the flag clears");
  const send = page.getByRole("button", { name: /^Send confirmed schedules/ });
  console.log("send visible:", await send.count(), "| disabled:", await send.isDisabled().catch(() => "?"));
  await send.click();
  let m = ""; for (let k = 0; k < 30 && !m; k++) { await wait(page, 300); m = await live(page); }
  console.log("toast:", m || "(none)");
  await wait(page, 2000);
  const labels = await page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || "").trim()).filter(Boolean));
  console.log("chip:", labels.filter((l) => /^(Test Sponsor|Sun Life), /.test(l)).join(" | "));
  const t = await page.locator("body").innerText();
  console.log("summary:", t.split(String.fromCharCode(10)).filter((l) => /changed after|Re-confirmed|Nothing new|sponsors? need|Last sent/.test(l)).slice(0, 5).join(" / "));
  await shot(page, `17-organizer-resend-after${"" }`, { full: false });
}
await close();
