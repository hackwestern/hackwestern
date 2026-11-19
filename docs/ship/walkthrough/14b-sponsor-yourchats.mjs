// Sponsor · Your chats: List view, filter by rep, phone width.
import { open, shot, wait, close, BASE, SPONSORS } from "./lib.mjs";
for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const main = page.locator("#sponsor-main");
  const yc = main.locator("section").filter({ has: page.getByRole("heading", { name: "Your chats" }) }).last();
  if (W === 390) { await yc.scrollIntoViewIfNeeded(); await shot(page, `14-sponsor-yourchats-calendar${tag}`, { full: false }); }
  await main.getByRole("radio", { name: "List" }).or(main.getByRole("button", { name: "List", exact: true })).first().click();
  await wait(page, 800);
  if (W === 1280) {
    const t = await yc.innerText().catch(async () => await main.innerText());
    console.log("LIST:\n" + t.slice(0, 1500));
  }
  await yc.screenshot({ path: `docs/ship/walkthrough/14-sponsor-yourchats-list${tag}.png` }).catch(() => shot(page, `14-sponsor-yourchats-list${tag}`));
  await main.getByRole("button", { name: "Walkthrough Kevin", exact: true }).or(main.getByRole("radio", { name: "Walkthrough Kevin" })).first().click();
  await wait(page, 800);
  if (W === 1280) console.log("FILTERED:\n" + (await yc.innerText().catch(() => "")).slice(0, 800));
  await yc.screenshot({ path: `docs/ship/walkthrough/14-sponsor-yourchats-filter-kevin${tag}.png` }).catch(() => {});
  const sc = await page.evaluate(() => [...document.querySelectorAll("#sponsor-main *")].filter((e) => e.scrollWidth > e.clientWidth + 2 && getComputedStyle(e).overflowX !== "visible").map((e) => e.tagName + "." + (e.className || "").toString().slice(0, 40)).slice(0, 3));
  await main.getByRole("button", { name: "Everyone", exact: true }).first().click().catch(() => {}); await main.getByRole("radio", { name: "Calendar" }).or(main.getByRole("button", { name: "Calendar", exact: true })).first().click(); await wait(page, 600);
  const clip = await page.evaluate(() => { const t = document.querySelector("#sponsor-main table"); if (!t) return "no table"; let p = t.parentElement; const r = []; while (p && p.id !== "sponsor-main") { const cs = getComputedStyle(p); r.push(`${p.tagName} ow=${cs.overflowX} cw=${p.clientWidth} sw=${p.scrollWidth}`); p = p.parentElement; } return `table w=${t.scrollWidth}; ` + r.slice(0, 4).join(" / "); });
  console.log(`${W}: calendar clip:`, clip);
  console.log(`${W}: horizontally scrollable areas:`, sc.join(" | ") || "none");
  await page.context().close();
}
await close();
