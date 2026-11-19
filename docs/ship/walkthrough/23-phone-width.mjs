// Phone-width (390 px) captures of screens not already shot at 390, and a
// check for sideways page scroll on each.
import { open, shot, wait, close, BASE, SPONSORS, USERS } from "./lib.mjs";

const pages = [
  ["01-sponsor-firstvisit-home-390", `/sponsors/${SPONSORS.test}`, null],
  ["02-sponsor-chats-home-sent-390", `/sponsors/${SPONSORS.test}/coffee-chats`, null],
  ["02-sponsor-team-sent-390", `/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=1`, null],
  ["03-sponsor-prefs-step2-sent-390", `/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, null],
  ["03-sponsor-prefs-sunlife-workshop-390", `/sponsors/${SPONSORS.sunlife}/coffee-chats?flow=prefs&step=2`, null],
  ["04-sponsor-review-390", `/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=3`, null],
  ["09-organizer-board-390", `/internal/sponsors?tab=coffee`, USERS.organizer],
  ["21-sponsor-judging-whos-judging-390", `/sponsors/${SPONSORS.canada}/picks`, null],
];
for (const [name, path, user] of pages) {
  const { page, context } = await open(390, user);
  await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 2000);
  const nt = page.getByRole("button", { name: /^(No thanks|Not now)$/ });
  if (await nt.count()) { await nt.first().click(); await wait(page, 300); }
  const over = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  console.log(`${name}: sideways overflow ${over}px`);
  // Full-page capture is blank below the fold here (inner scroll), so take
  // viewport shots at three scroll positions instead.
  for (const [i, sfx] of ["", "-b", "-c"].entries()) {
    if (i) {
      await page.mouse.move(195, 400);
      await page.mouse.wheel(0, 700);
      await wait(page, 500);
    }
    await shot(page, name + sfx, { full: false });
  }
  await context.close();
}
await close();
