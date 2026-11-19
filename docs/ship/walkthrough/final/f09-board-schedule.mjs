// Organizer · Read the coffee board + Schedule and fix (test organizer).
// Board data: seed data + Test Sponsor's walkthrough reps (fake, 555 phones).
// Usage: BASE=http://localhost:3070 node f09-board-schedule.mjs <width> <read|auto|fix|move|remove|book|rerun>
import { open, snap, say, wait, close, BASE, USERS, sql, clean } from "./lib-final.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page, context } = await open(W, USERS.organizer);
await context.grantPermissions(["clipboard-read", "clipboard-write"]);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1200);
const live = async () =>
  (await page.locator('[role="status"], [role="alert"], [data-sonner-toast]').allInnerTexts())
    .map((s) => s.trim().replace(/\s+/g, " "))
    .filter((s) => s.replace(/[.\s]/g, "") && !/Event now/.test(s))
    .join(" / ");
const toast = async () => {
  for (let k = 0; k < 12; k++) {
    await wait(page, 250);
    const l = await live();
    if (l) return l;
  }
  return "(no toast)";
};
const labels = async () =>
  page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean));
const coffee = async () => {
  const t = clean(await page.locator("main").innerText());
  const i = t.indexOf("Coffee chats\nSaturday");
  return t.slice(i, i + 2200);
};
const pinnedSql = `select r.name, p.session_id, p.room, p.pinned from coffee_chat_placement p join coffee_chat_rep r on r.id=p.rep_id where p.pinned order by 1,2`;
const step = process.argv[3] || "read";

if (step === "read") {
  say("Open Scotiabank row; copy a phone. EXPECT 'Asked for N chats · N h', 'Main contact', copy flips to 'Copied'");
  await page.locator('button[aria-label^="Scotiabank"]').first().click();
  await wait(page, 1000);
  const c = page.locator('button[aria-label^="Copy "]').first();
  const before = await c.getAttribute("aria-label");
  await c.click();
  await wait(page, 200);
  console.log("copy:", before, "->", (await labels()).filter((l) => /Copied/.test(l)).slice(0, 2).join(" | "),
    "| clipboard 555:", /555/.test(await page.evaluate(() => navigator.clipboard.readText().catch(() => ""))));
  say("Help. EXPECT the board help dialog");
  await page.getByRole("button", { name: "Help" }).first().click();
  await wait(page, 800);
  console.log(clean(await page.getByRole("dialog").innerText().catch(() => "no dialog")).slice(0, 1800));
  await snap(page, `f09-board-help${tag}`);
  await page.keyboard.press("Escape");
}

if (step === "auto") {
  say("AUTO-SCHEDULE. EXPECT toast 'Placed N chats.'; chips 'Scheduled, not sent'; Scotiabank fix 'put all 3 reps in Ivey (…) at 1-2 so they stay together.'");
  await page.getByRole("button", { name: /^Auto-schedule/ }).first().click();
  console.log("toast:", await toast());
  await wait(page, 2500);
  console.log(await coffee());
  await snap(page, `f09-auto-scheduled${tag}`, { full: true });
  console.log("placements:", sql(`select status, count(*) from coffee_chat_placement group by 1`).trim().replace(/\n/g, ", "));
}

if (step === "fix") {
  say("APPLY Scotiabank's fix. EXPECT Scotiabank's reps together in Ivey at 1–2, fix gone, pinned");
  const t = clean(await page.locator("main").innerText());
  const i = t.indexOf("Suggested fixes");
  console.log(t.slice(i, i + 900));
  await page.getByRole("button", { name: "Apply fix" }).first().click();
  console.log("toast:", await toast());
  await wait(page, 1500);
  console.log("Scotiabank chats:", (await labels()).filter((l) => /^Scotiabank · /.test(l)).join(" | "));
  console.log("pinned:", sql(pinnedSql).trim().replace(/\n/g, ", "));
  await snap(page, `f09-fix-applied${tag}`);
}

if (step === "move") {
  const kev = (await labels()).filter((l) => /^Test Sponsor · Walkthrough Kevin, /.test(l));
  console.log("Kevin's chats:", kev.join(" | "));
  say("Select Kevin's first chat. EXPECT the chat panel scrolls into view above the Send bar");
  await page.getByRole("button", { name: kev[0] }).first().click();
  await wait(page, 1000);
  const mv = page.getByRole("button", { name: "Move", exact: true }).first();
  const pb = await mv.boundingBox();
  console.log("Move button visible in viewport:", !!pb && pb.y > 0 && pb.y + pb.height < page.viewportSize().height - 60);
  await snap(page, `f09-chat-panel${tag}`);
  say("MOVE to an empty cell. EXPECT 'Moved…', chat pinned, survives re-run");
  await mv.click();
  await wait(page, 800);
  const here = (await labels()).filter((l) => /Move here/i.test(l));
  console.log("move-here cells:", here.length, here.slice(0, 4).join(" | "));
  const cur = kev[0].split(", ").pop();
  const target = here.find((l) => !l.includes(cur)) ?? here[0];
  console.log("target:", target);
  await page.getByRole("button", { name: target, exact: true }).first().click();
  console.log("toast:", await toast());
  await wait(page, 1200);
  console.log("Kevin now:", (await labels()).filter((l) => /^Test Sponsor · Walkthrough Kevin, /.test(l)).join(" | "));
  console.log("Kevin placements:", sql(`select p.session_id, p.room, p.pinned from coffee_chat_placement p join coffee_chat_rep r on r.id=p.rep_id where r.name='Walkthrough Kevin'`).trim().replace(/\n/g, ", "));
  await snap(page, `f09-moved${tag}`);
}

if (step === "remove") {
  const dana = (await labels()).filter((l) => /^Test Sponsor · Walkthrough Dana, /.test(l));
  console.log("Dana's chats:", dana.join(" | "));
  say("REMOVE Dana's last chat. EXPECT 'Removed.' with Undo (draft); Undo brings it back");
  await page.getByRole("button", { name: dana[dana.length - 1] }).first().click();
  await wait(page, 600);
  await page.getByRole("button", { name: "Remove", exact: true }).first().click();
  await wait(page, 400);
  const dlg = page.getByRole("alertdialog");
  if (await dlg.count()) {
    console.log("confirm:", (await dlg.innerText()).replace(/\s+/g, " "));
    await dlg.getByRole("button", { name: /Remove/ }).click();
  }
  console.log("toast:", await toast());
  console.log("Dana count after remove:", (await labels()).filter((l) => /^Test Sponsor · Walkthrough Dana, /.test(l)).length);
  const undo = page.locator("[data-sonner-toast] button", { hasText: "Undo" }).first();
  if (await undo.count()) {
    await undo.click();
    await wait(page, 1500);
  } else console.log("NO UNDO in toast");
  console.log("Dana count after undo:", (await labels()).filter((l) => /^Test Sponsor · Walkthrough Dana, /.test(l)).length);
}

if (step === "book") {
  say("BOOK 1358 at 10–11 for 'Walkthrough booking'. EXPECT the cell shows it and holds after a re-run");
  const cell = page.getByRole("button", { name: /Book a room: 1358, 10–11/ }).first();
  console.log("cell:", await cell.count());
  await cell.click();
  await wait(page, 700);
  await page.getByLabel("Who it's for").fill("Walkthrough booking");
  await page.getByRole("button", { name: "Book", exact: true }).click();
  console.log("toast:", await toast());
  await wait(page, 1200);
  console.log("DB:", sql(`select label, room, session_id from coffee_chat_room_booking order by label`).trim().replace(/\n/g, ", "));
}

if (step === "rerun") {
  const before = sql(pinnedSql).trim();
  say("RE-RUN Auto-schedule. EXPECT pinned moves/fixes and the booking stay");
  await page.getByRole("button", { name: /Re-run auto-schedule|^Auto-schedule/ }).first().click();
  console.log("toast:", await toast());
  await wait(page, 2500);
  const after = sql(pinnedSql).trim();
  console.log("pinned same:", before === after, "| pinned rows:", after.split("\n").length,
    "| booking:", sql(`select count(*) from coffee_chat_room_booking where label='Walkthrough booking'`).trim());
  console.log(await coffee());
  await snap(page, `f09-after-rerun${tag}`, { full: true });
}
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
