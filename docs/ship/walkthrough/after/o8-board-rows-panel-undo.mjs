// After: sponsor names beside logos, the chat panel scrolls into view, and
// "Removed." has an Undo for a booking. Test organizer. Books one empty cell,
// removes it, undoes, then removes it for good (the board ends as it began).
import { open, wait, close, BASE, USERS, sql, shotAfter } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
await page.waitForSelector("text=Suggested fixes", { timeout: 180000 });
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
await wait(page, 1000);
const band = page.locator('section[aria-labelledby="coffee-sponsors"]');
console.log("rows text:", (await band.innerText()).replace(/\n+/g, " / ").slice(0, 300));
await band.screenshot({ path: `docs/ship/walkthrough/after/o8-board-rows${tag}.png` });

// A chat cell: the panel opens under the grid and is scrolled into view.
const chat = page.locator('button[aria-label*="Walkthrough Kevin"]').first();
await chat.click();
await wait(page, 1200);
const panel = page.getByRole("button", { name: "Move" }).first();
const pb = await panel.boundingBox();
const vh = page.viewportSize().height;
console.log("Move button y:", Math.round(pb?.y ?? -1), "viewport:", vh, "visible above bar:", pb && pb.y > 0 && pb.y + pb.height < vh - 60);
await shotAfter(page, `o8-chat-panel${tag}`);
await page.keyboard.press("Escape");

// Undo a removed booking.
const empty = page.locator('button[aria-label^="Book a room:"]').first();
const where = (await empty.getAttribute("aria-label")).replace("Book a room: ", "");
await empty.click();
await page.getByLabel("Who it's for").fill("Undo check");
await page.getByRole("button", { name: "Book", exact: true }).click();
await wait(page, 1500);
await page.getByRole("button", { name: "Remove" }).first().click();
const undo = page.locator("[data-sonner-toast] button", { hasText: "Undo" }).first();
await undo.waitFor({ timeout: 5000 });
console.log("toast:", (await page.locator("[data-sonner-toast]").last().innerText()).replace(/\n+/g, " "));
await undo.click();
await wait(page, 1500);
console.log("after undo:", sql(`select label, room, session_id from coffee_chat_room_booking where label='Undo check'`).trim(), "| cell:", where);
sql(`delete from coffee_chat_room_booking where label='Undo check'`);
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
