// Sponsor · Your chats (Test Sponsor, after Send): order of cards, Calendar /
// List, rep filter, 390 px scroll hint.
import { open, snap, say, wait, close, BASE, SPONSORS, clean } from "./lib-final.mjs";

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  const main = page.locator("#sponsor-main");
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 2500);
  const t = clean(await main.innerText());
  say(`[${W}] EXPECT order: status card, 'Your chats', 'Your setup' (Change your team or times, Shortlist + count, Add a hacker + booth count)`);
  const pos = ["Scheduled", "Your chats", "Your setup"].map((s) => t.indexOf(s));
  console.log("positions:", pos.join(", "), "| in order:", pos.every((p, i) => p >= 0 && (i === 0 || p > pos[i - 1])));
  console.log("rooms:", [...new Set(t.match(/Rm \d+ · [^\n]+/g) ?? [])].join(" | "));
  console.log("session rows:", (t.match(/^(10–11 AM|11 AM–12 PM|1–2 PM|2–3 PM|3–4 PM|4–5 PM)/gm) ?? []).length);
  if (W === 390) console.log("scroll hint:", /Scroll for later times/.test(t));
  await main.getByRole("table").first().scrollIntoViewIfNeeded().catch(() => {});
  await snap(page, `f07-calendar${tag}`, { full: W === 1280 });
  say(`[${W}] List view`);
  await main.getByRole("radio", { name: "List" }).or(main.getByRole("tab", { name: "List" })).or(main.getByRole("button", { name: "List", exact: true })).first().click();
  await wait(page, 800);
  const l = clean(await main.innerText());
  const i = l.indexOf("Your chats");
  console.log(l.slice(i, i + 900));
  await main.getByText(/^Walkthrough Kevin$/).last().scrollIntoViewIfNeeded().catch(() => {});
  await snap(page, `f07-list${tag}`, { full: W === 1280 });
  say(`[${W}] Filter: Walkthrough Kevin. EXPECT only Kevin's chats`);
  await main.getByRole("radio", { name: "Walkthrough Kevin" }).or(main.getByRole("button", { name: "Walkthrough Kevin", exact: true })).first().click();
  await wait(page, 800);
  const k = clean(await main.innerText());
  const j = k.indexOf("Your chats");
  const seg = k.slice(j, k.indexOf("Your setup"));
  console.log("Dana in list:", /Walkthrough Dana ·|Dana\n/.test(seg.replace(/Walkthrough Dana\nWalkthrough Kevin/, "")), "\n" + seg.slice(0, 600));
  await snap(page, `f07-filter-kevin${tag}`, { full: W === 1280 });
  console.log("errors:", page.errors.slice(0, 5));
  await page.context().close();
}
await close();
