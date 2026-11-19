// Judging round 2 end to end (seeded fake teams):
// 1. Sun Life adds a 3rd project and re-sends its shortlist.
// 2. Organizer: Schedule presentations, Open round 2 (no Notify hackers, no Sync).
// 3. Sun Life ranks a top 3 and submits; then tries the wrong count first.
// 4. Organizer: PCBWay digital top 3 with a link that doesn't match.
import { open, shot, wait, close, BASE, SPONSORS, USERS } from "./lib.mjs";

const NL = String.fromCharCode(10);
const say = (s) => console.log(`\n=== ${s}`);
const live = async (page) => (await page.locator('[role="status"], [role="alert"], [data-sonner-toast]').allInnerTexts()).map((s) => s.trim()).filter((s) => s.replace(/[.\s]/g, "") && !/Event now/.test(s)).join(" / ");
const sponsorPage = async () => {
  const { page } = await open(1280);
  await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/picks`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1200);
  const main = page.locator("#sponsor-main");
  await main.getByRole("button", { name: /Dana W\./ }).first().click();
  await wait(page, 1200);
  return { page, main };
};

{
  say("1. Sun Life saves a 3rd project and sends again");
  const { page, main } = await sponsorPage();
  for (let i = 0; i < 4; i++) {
    const save = main.getByRole("button", { name: /^Save .* to your shortlist/ }).first();
    if (await save.count()) { await save.click(); await wait(page, 700); break; }
    await main.getByRole("button", { name: "Next", exact: true }).click();
    await wait(page, 500);
  }
  await page.getByRole("tab", { name: /Your shortlist/ }).click();
  await wait(page, 800);
  const send = main.getByRole("button", { name: /^Send/ }).first();
  console.log("send label:", await send.innerText().catch(() => "none"));
  if (await send.count()) await send.click();
  await wait(page, 1500);
  console.log((await main.innerText()).split(NL).filter((l) => /Sent|teams/.test(l)).slice(0, 3).join(" / "));
  await page.context().close();
}
{
  say("2. Organizer: Schedule presentations, then Open round 2");
  const { page } = await open(1280, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors?tab=judging`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  for (const b of ["Schedule presentations", "Open round 2"]) {
    await page.getByRole("button", { name: b }).click();
    await wait(page, 600);
    const dlg = page.getByRole("dialog").or(page.getByRole("alertdialog"));
    if (await dlg.count()) {
      console.log(`${b} confirm:`, (await dlg.first().innerText()).replace(/\s+/g, " ").slice(0, 300));
      await dlg.first().getByRole("button").filter({ hasText: /Schedule|Open|Yes|Confirm/ }).last().click();
    }
    let m = ""; for (let k = 0; k < 16 && !m; k++) { await wait(page, 250); m = await live(page); }
    console.log(`${b} toast:`, m || "(none)");
    await wait(page, 1000);
  }
  const t = await page.locator("body").innerText();
  const i = t.indexOf("Presentations\n");
  console.log(t.slice(i, i + 900));
  await shot(page, "22-organizer-judging-round2-open");
  await page.context().close();
}
{
  say("3. Sun Life round 2: wrong count first, then exactly 3");
  const { page, main } = await sponsorPage();
  const t = await main.innerText();
  console.log(t.split(NL).filter((l) => /Round 2|top 3|rank|1st|2nd|3rd|Submit|presented/i.test(l)).slice(0, 12).join(" / "));
  console.log("tabs:", (await page.getByRole("tab").allInnerTexts()).join(" | "));
  const r2 = page.getByRole("tab", { name: /Round 2|Top 3/i }).first();
  if (await r2.count()) { await r2.click(); await wait(page, 1000); }
  console.log("buttons:", (await main.getByRole("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText).replace(/\s+/g, " ").trim()).filter(Boolean))).slice(0, 30).join(" | "));
  await shot(page, "22-sponsor-judging-round2", { full: false });
  await page.context().close();
}
await close();
