// Organizer · Read the coffee board, then Schedule and fix (test organizer).
// Board data is seed data (fake reps, 555 phones); sponsor names are public.
import { open, shot, text, wait, close, BASE, USERS } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const phase = process.argv[3] || "read";
const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1500);
const board = page.locator("main").last();
const live = async () => (await page.locator('[role="status"], [role="alert"]').allInnerTexts()).map((s) => s.trim()).filter((s) => s && !/Event now/.test(s)).join(" / ");
const labels = async (sel = "button") =>
  (await page.locator(sel).evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean)));

if (phase === "read") {
  await shot(page, `09-organizer-board${tag}`);
  say("Open Scotiabank's row");
  await page.locator('button[aria-label^="Scotiabank"]').first().click();
  await wait(page, 1000);
  const t = await page.locator("body").innerText();
  const i = t.indexOf("Asked for");
  console.log(t.slice(Math.max(0, i - 600), i + 900));
  await shot(page, `09-organizer-board-row-open${tag}`);
  say("Copy a phone. EXPECT 'Copied'");
  const c = page.locator('button[aria-label^="Copy "]').first();
  console.log("copy label:", await c.getAttribute("aria-label"));
  await c.click();
  await wait(page, 300);
  console.log("after:", (await labels('button[aria-label^="Cop"]')).slice(0, 3).join(" | "), "| live:", await live());
  say("Help");
  await page.getByRole("button", { name: "Help" }).first().click();
  await wait(page, 1000);
  console.log((await page.getByRole("dialog").innerText().catch(() => "no dialog")).slice(0, 2500));
  await shot(page, `09-organizer-board-help${tag}`, { full: false });
}

if (phase === "schedule") {
  say("Auto-schedule. EXPECT 'Placed N chats.'; chips 'Scheduled (draft)'; Scotiabank fix 'put all 3 reps in Ivey (…) at 1-2…'");
  await page.getByRole("button", { name: /^Auto-schedule/ }).first().click();
  await wait(page, 3000);
  console.log("live:", await live());
  const t = await page.locator("body").innerText();
  const s = t.indexOf("Coffee chats\nSaturday");
  console.log(t.slice(s, s + 3000));
  await shot(page, `09-organizer-board-autoscheduled${tag}`);
  console.log("buttons:", (await labels()).filter((l) => !/^(\+|Tour|Start|No thanks)$/.test(l)).slice(0, 80).join(" | "));
}
if (phase === "fixes") {
  const body = async () => await page.locator("body").innerText();
  const sec = async (a, b) => { const t = await body(); const i = t.indexOf(a); return i < 0 ? "(no " + a + ")" : t.slice(i, b ? t.indexOf(b, i) : i + 1500); };
  say("State after Auto-schedule (fresh load)");
  console.log(await sec("Book a room\nHelp", "Rooms\n"));
  await shot(page, `09-organizer-board-after-auto${tag}`);
  say("Re-run auto-schedule; capture toast fast");
  await page.getByRole("button", { name: /Re-run auto-schedule|^Auto-schedule/ }).first().click();
  for (let i = 0; i < 6; i++) { await wait(page, 250); const l = await live(); if (l.replace(/[.\s]/g, "")) { console.log("toast:", l); break; } }
  await shot(page, `09-organizer-board-rerun-toast${tag}`, { full: false });
}
if (phase === "act") {
  const body = async () => await page.locator("body").innerText();
  say("Apply Scotiabank's fix. EXPECT Scotiabank's 3 reps move to Ivey at 1–2; chip 'Scheduled (draft)'");
  await page.getByRole("button", { name: "Apply fix" }).first().click();
  for (let i = 0; i < 8; i++) { await wait(page, 300); const l = await live(); if (l.replace(/[.\s]/g, "")) { console.log("toast:", l); break; } }
  await wait(page, 1500);
  console.log("Scotiabank chip:", (await labels()).filter((l) => /^Scotiabank/.test(l)).join(" | "));
  await shot(page, `09-organizer-board-fix-applied${tag}`);

  say("Click a placed chat (Test Sponsor · Walkthrough Kevin, 2243, 10–11)");
  await page.getByRole("button", { name: "Test Sponsor · Walkthrough Kevin, 2243, 10–11" }).click();
  await wait(page, 800);
  const dlg = page.getByRole("dialog").last();
  console.log("dialog:", (await dlg.innerText().catch(() => "(no dialog)")).slice(0, 1200));
  console.log("dialog buttons:", (await dlg.getByRole("button").allInnerTexts().catch(() => [])).join(" | "));
  await shot(page, `09-organizer-board-chat-open${tag}`, { full: false });
}
if (phase === "move") {
  say("Select Walkthrough Kevin's chat and read the panel");
  await page.getByRole("button", { name: "Test Sponsor · Walkthrough Kevin, 2243, 10–11" }).click();
  await wait(page, 800);
  const t = await page.locator("body").innerText();
  const i = t.indexOf("Rm 2243 · 10–11");
  console.log(t.slice(i - 40, i + 900));
  console.log("cell labels now:", (await labels()).filter((l) => /1352, 10–11|2242, 1–2|Move|here/i.test(l)).join(" | "));
  say("EXPECT move to empty 1352 10–11 works and stays pinned; Kevin isn't free? (he is free all day)");
  const target = page.getByRole("button", { name: /1352, 10–11/ }).first();
  console.log("target label:", await target.getAttribute("aria-label"));
  await target.click();
  for (let k = 0; k < 8; k++) { await wait(page, 300); const l = await live(); if (l.replace(/[.\s]/g, "")) { console.log("toast:", l); break; } }
  await wait(page, 1200);
  console.log("Kevin now:", (await labels()).filter((l) => /Walkthrough Kevin/.test(l)).join(" | "));
  await shot(page, `09-organizer-board-moved${tag}`, { full: false });
  say("EXPECT a taken-room error: move Kevin into 2241 1–2 (Mentors)");
  await page.getByRole("button", { name: /Test Sponsor · Walkthrough Kevin/ }).first().click();
  await wait(page, 600);
  await page.getByRole("button", { name: /2241, 1–2/ }).first().click().catch((e) => console.log("click failed", e.message.split(String.fromCharCode(10))[0]));
  for (let k = 0; k < 8; k++) { await wait(page, 300); const l = await live(); if (l.replace(/[.\s]/g, "")) { console.log("toast:", l); break; } }
  const t2 = await page.locator("body").innerText();
  console.log("taken msg:", t2.split(String.fromCharCode(10)).filter((l) => /taken|during|isn't free|busy|can't/i.test(l)).slice(0, 5).join(" / "));
  await shot(page, `09-organizer-board-move-blocked${tag}`, { full: false });
  say("Workshop window: move a Sun Life chat into 2–3");
  await page.keyboard.press("Escape");
  const sl = page.getByRole("button", { name: /^Sun Life · Kevin T\./ }).first();
  await sl.click();
  await wait(page, 600);
  await page.getByRole("button", { name: /1354, 2–3/ }).first().click().catch((e) => console.log("click failed", e.message.split(String.fromCharCode(10))[0]));
  for (let k = 0; k < 8; k++) { await wait(page, 300); const l = await live(); if (l.replace(/[.\s]/g, "")) { console.log("toast:", l); break; } }
  const t3 = await page.locator("body").innerText();
  console.log("workshop msg:", t3.split(String.fromCharCode(10)).filter((l) => /workshop|isn't free|can't/i.test(l)).slice(0, 6).join(" / "));
}
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
