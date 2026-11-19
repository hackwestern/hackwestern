// Organizer · Schedule and fix: move, blocked moves, remove, book a room, re-run.
// Run after Auto-schedule and the Scotiabank fix (09-organizer-board.mjs).
import { open, shot, wait, close, BASE, USERS } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 120000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1500);
const NL = String.fromCharCode(10);
const live = async () =>
  (await page.locator('[role="status"], [role="alert"]').allInnerTexts())
    .map((s) => s.trim())
    .filter((s) => s.replace(/[.\s]/g, "") && !/Event now/.test(s))
    .join(" / ");
const toast = async () => {
  for (let k = 0; k < 10; k++) {
    await wait(page, 250);
    const l = await live();
    if (l) return l;
  }
  return "(no toast)";
};
const labels = async () =>
  page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean));
const select = async (name) => {
  await page.getByRole("button", { name }).first().click();
  await wait(page, 600);
};
const bodyLines = async (re) => (await page.locator("body").innerText()).split(NL).filter((l) => re.test(l));

if (process.argv[3] !== "rest") {
say("Select Walkthrough Kevin's chat, press Move");
await select(/^Test Sponsor · Walkthrough Kevin, /);
await page.getByRole("button", { name: "Move", exact: true }).click();
await wait(page, 800);
const after = await labels();
console.log("labels with 'move':", after.filter((l) => /move|here/i.test(l)).slice(0, 12).join(" | "));
console.log("lines:", (await bodyLines(/move|pick|choose|tap/i)).slice(0, 6).join(" / "));
await shot(page, `10-organizer-schedule-move-mode${tag}`, { full: false });

say("EXPECT: moving to empty 1352 10–11 works ('Moved…'), chat pinned");
await page.getByRole("button", { name: /1352, 10–11/ }).first().click();
console.log("toast:", await toast());
await wait(page, 1000);
console.log("Kevin now:", (await labels()).filter((l) => /Walkthrough Kevin/.test(l)).join(" | "));
await shot(page, `10-organizer-schedule-moved${tag}`, { full: false });

}
// Taken rooms, the workshop window and a rep's busy times are never offered as
// "Move here" cells, so those server errors can't be reached from the board.
say("Phase 2 (re-run): after the move");
if (process.argv[3] !== "rest") { console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5)); await close(); process.exit(0); }
say("Remove a chat (CSE · Mei Z. 4–5). EXPECT it leaves the grid; CSE shows fewer reps placed / a fix");
await select(/^CSE · Mei Z\., 1352, 4–5/);
await page.getByRole("button", { name: "Remove", exact: true }).click();
await wait(page, 500);
const dlg = page.getByRole("alertdialog").or(page.getByRole("dialog"));
if (await dlg.count()) {
  console.log("confirm dialog:", (await dlg.first().innerText()).replace(/\s+/g, " "));
  await dlg.first().getByRole("button", { name: /Remove/ }).click();
}
console.log("toast:", await toast());
console.log("CSE:", (await labels()).filter((l) => /^CSE/.test(l)).join(" | "));

say("Book a room: 1358 10–11 for Mentors");
await page.getByRole("button", { name: /Book a room: 1358, 10–11/ }).click();
await wait(page, 800);
console.log("book UI:", (await page.locator("body").innerText()).split(NL).filter((l) => /Book|label|Who|What|note|Save/i.test(l)).slice(-10).join(" / "));
await shot(page, `10-organizer-schedule-book-room${tag}`, { full: false });
const inputs = await page.locator("input, textarea, select").evaluateAll((e) => e.map((x) => `${x.tagName}:${x.name || x.id}:${x.getAttribute("aria-label") || ""}:${x.placeholder || ""}`));
console.log("inputs:", inputs.join(" | "));

console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
