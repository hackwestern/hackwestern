// Organizer · fix a sent chat (Test Sponsor's "isn't free anymore"), then Noah
// re-sends. Writes to the local DB; invites are dry-run.
import { open, snap, say, wait, close, BASE, USERS, sql, noah, clean } from "./lib-final.mjs";

const T = "3d3e323d-e50e-4379-bc04-41d85870ef63";
const inv = () => sql(`select c.status, c.slot_time, c.room, count(*) from coffee_chat c where c.sponsor_id='${T}' and c.placement_id is not null group by 1,2,3 order by 2,1`).trim().replace(/\n/g, ", ");
const go = async (page) => {
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  await wait(page, 1200);
};
const toastOf = async (page) => {
  let t = "";
  for (let k = 0; k < 40 && !t; k++) {
    await wait(page, 250);
    t = (await page.locator("[data-sonner-toast]").allInnerTexts()).join(" / ").replace(/\s+/g, " ");
  }
  return t || "(none)";
};

{
  const { page } = await open(1280, USERS.organizer);
  await go(page);
  console.log("invites before:", inv());
  say("APPLY the Test Sponsor fix (move to 11–12, Rm 1352). EXPECT chat stays 'Sent', moves; its 6 invited hackers asked to confirm the new time");
  const fix = page.locator("li, article, div").filter({ hasText: /^Test Sponsor/ }).filter({ has: page.getByRole("button", { name: "Apply fix" }) }).last();
  await fix.getByRole("button", { name: "Apply fix" }).click();
  console.log("toast:", await toastOf(page));
  await wait(page, 2500);
  console.log("Kevin placements:", sql(`select p.session_id, p.room, p.status, p.pinned from coffee_chat_placement p join coffee_chat_rep r on r.id=p.rep_id where r.name='Walkthrough Kevin' order by 1`).trim().replace(/\n/g, ", "));
  console.log("invites after:", inv());
  const t = clean(await page.locator("main").innerText());
  const j = t.indexOf("Coffee chats\nSaturday");
  console.log(t.slice(j, t.indexOf("Rooms\nRoom", j)));
  await snap(page, "f13-fix-applied-sent");
  await page.context().close();
}
{
  const { page } = await open(1280, noah());
  await go(page);
  const b = page.getByRole("button", { name: /Send confirmed|^Send/ }).last();
  say("Noah: Send stays up while a sponsor is flagged. EXPECT button enabled; confirm; toast 'Re-confirmed 1 sponsor who changed after invites.'; flag clears");
  console.log("button:", await b.innerText(), "| disabled:", await b.isDisabled(), "| drafts:", sql(`select count(*) from coffee_chat_placement where status='draft'`).trim());
  await b.click();
  await wait(page, 800);
  const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog")).last();
  console.log("confirm:", clean(await dlg.innerText().catch(() => "(no dialog)")).replace(/\n/g, " | "));
  await dlg.getByRole("button", { name: /Send now/ }).click().catch((e) => console.log("no Send now:", e.message.split("\n")[0]));
  console.log("toast:", await toastOf(page));
  await wait(page, 2500);
  const t = clean(await page.locator("main").innerText());
  const j = t.indexOf("Coffee chats\nSaturday");
  console.log(t.slice(j, j + 600));
  await snap(page, "f13-resend-after");
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
}
await close();
