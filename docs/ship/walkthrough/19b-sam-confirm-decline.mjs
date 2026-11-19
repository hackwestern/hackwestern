// Sam confirms the decline ("Yes, decline" is inline, not a dialog).
import { open, shot, wait, close, BASE, USERS, sql } from "./lib.mjs";
const { page } = await open(1280, USERS.sam);
await page.goto(`${BASE}/live?tab=coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 2500);
await page.getByRole("button", { name: /^Decline/ }).first().click();
await wait(page, 600);
await shot(page, "19-hacker-sam-decline-confirm", { full: false });
await page.getByRole("button", { name: /^Yes, decline/ }).click();
await wait(page, 2000);
const t = await page.locator("body").innerText();
const i = t.indexOf("Coffee Chats\n");
console.log(t.slice(i, i + 700).replace(/\n+/g, " / "));
await shot(page, "19-hacker-sam-after-decline", { full: false });
console.log("DB:", sql("select status from coffee_chat where user_id='demo-hacker-2' and placement_id is not null").trim());
await close();
