// Hand-off 5: hackers answer invites; both sides see it. Alex (demo-hacker-1)
// accepts Test Sponsor; Sam (demo-hacker-2) declines Sun Life. Each side in a
// fresh context. Dry-run invites (nothing messaged).
import { open, snap, say, wait, close, BASE, USERS, SPONSORS, sql, clean } from "./lib-final.mjs";

for (const [who, action, sponsor] of [["alex", "Accept", "Test Sponsor"], ["sam", "Decline", "Sun Life"]]) {
  const { page } = await open(1280, USERS[who]);
  say(`${who}: open /live. EXPECT toast '${sponsor} wants to chat with you' with Accept / Decline`);
  await page.goto(`${BASE}/live`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 3000);
  console.log("toasts:", (await page.locator("[data-sonner-toast]").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" / ") || "(none)");
  await snap(page, `h5-${who}-live`);
  await page.goto(`${BASE}/live?tab=coffee-chats`, { waitUntil: "networkidle" });
  await wait(page, 2500);
  const body = clean(await page.locator("body").innerText());
  const i = body.indexOf(sponsor);
  console.log(body.slice(Math.max(0, i - 150), i + 600).replace(/\n+/g, " / "));
  say(`${who}: ${action.toUpperCase()} the ${sponsor} invite. EXPECT status ${action === "Accept" ? "accepted" : "declined"} in the DB`);
  const card = page.locator("li, article, section, div").filter({ hasText: sponsor }).filter({ has: page.getByRole("button", { name: new RegExp(`^${action}`) }) }).last();
  await card.getByRole("button", { name: new RegExp(`^${action}`) }).first().click();
  await wait(page, 800);
  const yes = page.getByRole("button", { name: new RegExp(`^Yes, ${action.toLowerCase()}`) });
  if (await yes.count()) { console.log("inline confirm shown"); await yes.click(); }
  await wait(page, 2000);
  const after = clean(await page.locator("body").innerText());
  const j = after.indexOf(sponsor);
  console.log("after:", after.slice(Math.max(0, j - 100), j + 400).replace(/\n+/g, " / "));
  await snap(page, `h5-${who}-after-${action.toLowerCase()}`);
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 3));
  await page.context().close();
}
console.log("DB:", sql(`select c.user_id, s.name, c.status, c.slot_time from coffee_chat c join sponsor_judging_sponsor s on s.id=c.sponsor_id where c.user_id in ('demo-hacker-1','demo-hacker-2') and c.placement_id is not null`).trim().replace(/\n/g, ", "));

say("Sponsor side (fresh device): Test Sponsor. EXPECT 'Scheduled, 1 of N seats accepted', 'Confirmed' next to Alex");
{
  const { page } = await open(1280);
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 2500);
  const t = clean(await page.locator("#sponsor-main").innerText());
  console.log(t.slice(0, 500));
  console.log("Alex line:", t.match(/Alex · \w+/)?.[0]);
  await snap(page, "h5-sponsor-after-answers", { full: true });
  await page.context().close();
}
say("Status endpoint: Sun Life totals after Sam declined. EXPECT Sam's seat open for the next round");
{
  const { page } = await open(1280, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
  const s = await page.evaluate(async () => (await (await fetch("/api/trpc/coffeeChatInvites.status")).json()).result.data.json);
  for (const sp of s.sponsors.filter((x) => /Sun Life|Test Sponsor/.test(x.name))) console.log(sp.name, JSON.stringify(sp.totals));
}
await close();
