// Sponsor · Judging step 5 (send the shortlist) + Organizer · Judging tab.
// Sun Life (Dana W.) saves 3 fake teams and sends; the test organizer reads
// the Judging tab, tries Schedule presentations and the PCBWay top 3.
// Organizer names on the Judging tab are masked.
import { open, snap, say, wait, close, BASE, SPONSORS, USERS, sql, clean, FINAL } from "./lib-final.mjs";
import path from "node:path";

const SL = SPONSORS.sunlife;
const live = async (page) => (await page.locator('[role="status"], [role="alert"], [data-sonner-toast]').allInnerTexts()).map((s) => s.trim().replace(/\s+/g, " ")).filter((s) => s.replace(/[.\s]/g, "") && !/Event now/.test(s)).join(" / ");
{
  const { page } = await open(1280);
  const main = page.locator("#sponsor-main");
  await page.goto(`${BASE}/sponsors/${SL}/picks?preview=judging`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  await main.getByRole("button", { name: /Dana W\./ }).first().click();
  const sj = main.getByRole("button", { name: "Start judging" });
  if (await sj.count()) await sj.click();
  await wait(page, 1200);
  say("Dana saves 3 projects to the shortlist");
  let saved = 0;
  for (let i = 0; i < 8 && saved < 3; i++) {
    const save = main.getByRole("button", { name: /^Save .* to your shortlist/ }).first();
    if (await save.count()) { await save.click(); saved++; await wait(page, 700); }
    const nx = main.getByRole("button", { name: "Next", exact: true });
    if (await nx.count()) { await nx.click(); await wait(page, 500); }
  }
  console.log("saved:", saved);
  await page.getByRole("tab", { name: /Your shortlist/ }).click();
  await wait(page, 800);
  const send = main.getByRole("button", { name: /^Send/ }).first();
  say(`SEND shortlist (${await send.innerText().catch(() => "no button")}). EXPECT it's sent and organizers see it`);
  if (await send.count()) {
    await send.click();
    await wait(page, 800);
    const dlg = page.getByRole("dialog").or(page.getByRole("alertdialog"));
    if (await dlg.count()) { console.log("confirm:", (await dlg.first().innerText()).replace(/\s+/g, " ")); await dlg.first().getByRole("button", { name: /Send/ }).last().click(); }
    await wait(page, 2000);
  }
  console.log(clean(await main.innerText()).split("\n").filter((l) => /sent|Sent|round|top 3|closed|presentation/i.test(l)).slice(0, 8).join(" / "));
  console.log("DB send:", sql(`select array_length(team_ids,1), sent_at is not null from sponsor_shortlist_send where sponsor_id='${SL}'`).trim());
  await snap(page, "f16-judging-shortlist-sent");
  await page.context().close();
}
{
  const { page } = await open(1280, USERS.organizer);
  await page.goto(`${BASE}/internal/sponsors?tab=judging`, { waitUntil: "networkidle", timeout: 180000 });
  await wait(page, 2500);
  const nt = page.getByRole("button", { name: "No thanks" });
  if (await nt.count()) await nt.first().click();
  const main = page.locator("main");
  let t = clean(await main.innerText());
  const i = t.indexOf("Sponsor judging\n");
  say("Judging tab");
  console.log(t.slice(t.indexOf("Sun Life", i) - 400, t.indexOf("Sun Life", i) + 900));
  say("SCHEDULE PRESENTATIONS. EXPECT either slots placed, or 'Nothing scheduled yet. See why below.' with '<team> · Sun Life has no judging room on Sponsor Day-Of'");
  const sch = page.getByRole("button", { name: /^Schedule presentations/ });
  console.log("button:", await sch.count(), await sch.isDisabled().catch(() => "n/a"));
  if (await sch.count() && !(await sch.isDisabled())) {
    await sch.click();
    await wait(page, 600);
    const dlg = page.getByRole("dialog").or(page.getByRole("alertdialog"));
    if (await dlg.count()) { console.log("confirm:", (await dlg.first().innerText()).replace(/\s+/g, " ").slice(0, 300)); await dlg.first().getByRole("button").filter({ hasText: /Schedule|Yes|Confirm/ }).last().click(); }
    let m = ""; for (let k = 0; k < 16 && !m; k++) { await wait(page, 250); m = await live(page); }
    console.log("toast:", m || "(none)");
    await wait(page, 1500);
  }
  t = clean(await main.innerText());
  console.log(t.split("\n").filter((l) => /Nothing scheduled|judging room|Schedule|round 2|Round 2|slots/i.test(l)).slice(0, 10).join(" / "));
  const r2 = page.getByRole("button", { name: /Open round 2/ });
  console.log("Open round 2:", await r2.count(), "disabled:", await r2.isDisabled().catch(() => "n/a"));
  const pres = page.locator("section, div").filter({ has: page.getByText(/Nothing scheduled yet|Presentations/) }).filter({ has: sch.or(page.getByRole("button", { name: /Schedule/ })) }).last();
  await pres.screenshot({ path: path.join(FINAL, "f16-organizer-presentations.png"), mask: [page.getByText(/Noah Medland|Alice Nguyen|Caroline Ge|Daniel Wang/)] }).catch((e) => console.log("shot failed", e.message.split("\n")[0]));
  say("PCBWay digital top 3: paste a link that matches nothing. EXPECT '…doesn't match a submitted team…', Save off");
  const inputs = page.locator("input").filter({ has: page.locator("xpath=.") });
  const dig = page.locator("section, div").filter({ has: page.getByText("Digital sponsors", { exact: true }) }).last();
  const boxes = dig.getByRole("textbox");
  console.log("digital inputs:", await boxes.count());
  if (await boxes.count()) {
    await boxes.first().fill("https://devpost.com/software/not-a-real-walkthrough-team");
    await boxes.first().blur();
    await wait(page, 1500);
    console.log(clean(await dig.innerText()).split("\n").filter((l) => /match|team ID|Save/i.test(l)).slice(0, 5).join(" / "));
    console.log("Save disabled:", await dig.getByRole("button", { name: /^Save/ }).isDisabled().catch(() => "n/a"));
    await dig.screenshot({ path: path.join(FINAL, "f16-organizer-pcbway-nomatch.png") });
    await boxes.first().fill("");
  }
  console.log("PCBWay under Presentations:", /PCBWay/.test(t.slice(t.indexOf("Presentations"), t.indexOf("Digital sponsors"))));
  console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
}
await close();
