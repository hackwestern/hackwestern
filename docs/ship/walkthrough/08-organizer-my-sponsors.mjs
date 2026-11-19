// Organizer · My sponsors. The test organizer matches nobody (All sponsors).
// A real lead's view shows live HW Contacts data, so it is saved privately
// and its text is redacted here. Pass the lead's user id as argv[2].
import { open, shot, text, wait, close, BASE, USERS, sql } from "./lib.mjs";
const leadSub = process.argv[2];
const W = Number(process.argv[3] || 1280);
const say = (s) => console.log(`\n=== ${s}`);

say("Test organizer: EXPECT lands on All sponsors");
{
  const { page } = await open(W, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 2000);
  const t = await page.locator("body").innerText();
  console.log("has 'You lead':", /You lead/.test(t), "| has My sponsors:", /My sponsors/.test(t), "| has All sponsors:", /All sponsors/.test(t));
  console.log(t.split("\n").filter((l) => /lead|My sponsors|All sponsors|HW Contacts|match/i.test(l)).slice(0, 10).join(" / "));
}
if (leadSub) {
  const email = sql(`select email from "user" where id='${leadSub}'`).trim();
  say("Lead view (private)");
  const { page } = await open(W, { sub: leadSub, name: "Lead", email });
  await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 2500);
  const t = (await page.locator("body").innerText());
  const red = (s) => s.replace(/\(?\d{3}\)?[ .-]?\d{3}[ .-]?\d{4}/g, "[phone]");
  const i = t.indexOf("You lead");
  console.log(i >= 0 ? red(t.slice(i, i + 2500)) : "NO 'You lead' text\n" + red(t.slice(0, 1500)));
  await shot(page, "08-organizer-my-sponsors-lead", { priv: true });
  console.log("buttons:", (await page.getByRole("button").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).filter(Boolean).slice(0, 60).join(" | "));
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
}
await close();
