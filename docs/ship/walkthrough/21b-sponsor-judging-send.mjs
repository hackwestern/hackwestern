// Sponsor · Judging: save two projects to the shortlist and send it; try round 2.
import { open, shot, wait, close, BASE, SPONSORS } from "./lib.mjs";
const NL = String.fromCharCode(10);
const { page } = await open(1280);
const main = page.locator("#sponsor-main");
await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/picks`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
await main.getByRole("button", { name: /Dana W./ }).first().click(); { const sj = main.getByRole("button", { name: "Start judging" }); if (await sj.count()) await sj.click(); } await wait(page, 1200);
const btnNames = async () => (await main.getByRole("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText).replace(/\s+/g, " ").trim()).filter(Boolean)));
console.log("buttons:", (await btnNames()).slice(0, 30).join(" | "));
const save = main.getByRole("button", { name: /shortlist/i }).filter({ hasNotText: /Your shortlist/ });
console.log("save-like buttons:", await save.count());
for (let i = 0; i < 2 && (await save.count()); i++) {
  await save.first().click();
  await wait(page, 800);
  const nxt = main.getByRole("button", { name: /^Next/ }).first();
  if (await nxt.count()) await nxt.click();
  await wait(page, 600);
}
await page.getByRole("tab", { name: /Your shortlist/ }).click();
await wait(page, 800);
console.log((await main.innerText()).split(NL).filter((l) => /shortlist|Send|sent|round|top 3|closed|presentation/i.test(l)).slice(0, 12).join(" / "));
console.log("buttons:", (await btnNames()).slice(0, 30).join(" | "));
const send = main.getByRole("button", { name: /^Send/ }).first();
if (await send.count()) {
  console.log("EXPECT: shortlist sent; organizers see it");
  await send.click();
  await wait(page, 800);
  const dlg = page.getByRole("dialog").or(page.getByRole("alertdialog"));
  if (await dlg.count()) { console.log("confirm:", (await dlg.first().innerText()).replace(/\s+/g, " ")); await dlg.first().getByRole("button", { name: /Send/ }).last().click(); }
  await wait(page, 2000);
  console.log("after:", (await main.innerText()).split(NL).filter((l) => /sent|Sent|round|top 3|closed|presentation|failed|error/i.test(l)).slice(0, 10).join(" / "));
}
await shot(page, "21-sponsor-judging-shortlist-sent", { full: false });
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
