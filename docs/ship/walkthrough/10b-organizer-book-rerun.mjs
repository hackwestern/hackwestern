// Organizer · Schedule and fix: book a room, then re-run Auto-schedule.
// EXPECT the booking holds, the manual move (Kevin in 1352 10–11) stays pinned.
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
const live = async () => (await page.locator('[role="status"], [role="alert"]').allInnerTexts()).map((s) => s.trim()).filter((s) => s.replace(/[.\s]/g, "") && !/Event now/.test(s)).join(" / ");
const toast = async () => { for (let k = 0; k < 12; k++) { await wait(page, 250); const l = await live(); if (l) return l; } return "(no toast)"; };
const labels = async () => page.locator("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText || "").replace(/\s+/g, " ").trim()).filter(Boolean));

say("Book 1358 10–11 for 'Walkthrough booking'");
await page.getByRole("button", { name: /Book a room: 1358, 10–11/ }).click();
await wait(page, 800);
await page.locator("#bk-who").fill("Walkthrough booking");
await shot(page, `10-organizer-schedule-book-form${tag}`, { full: false });
await page.getByRole("button", { name: "Book", exact: true }).click();
console.log("toast:", await toast());
await wait(page, 1000);
console.log("1358 10–11 now:", (await labels()).filter((l) => /1358, 10–11/.test(l)).join(" | "));

say("Re-run Auto-schedule. EXPECT 'Placed N chats.'; Kevin still in 1352 10–11; booking kept");
await page.getByRole("button", { name: /Re-run auto-schedule|^Auto-schedule/ }).first().click();
console.log("toast:", await toast());
await wait(page, 1500);
const L = await labels();
console.log("Kevin:", L.filter((l) => /Walkthrough Kevin/.test(l)).join(" | "));
console.log("booking:", L.filter((l) => /Walkthrough booking/.test(l)).join(" | "));
console.log("chips:", L.filter((l) => /^(Commure|Canada Life|CSE|Scotiabank|StarTech|Sun Life|Test Sponsor), /.test(l)).join(" | "));
const t = await page.locator("body").innerText();
const i = t.indexOf("Suggested fixes");
console.log(t.slice(i, i + 700));
await shot(page, `10-organizer-schedule-rerun${tag}`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
