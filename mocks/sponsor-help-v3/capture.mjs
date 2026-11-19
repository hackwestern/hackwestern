// Screenshots for T35 (help pings carry rep, phone and location).
// Run against a dev server on :3022 backed by a fresh DB with sponsor
// 11111111-1111-4111-8111-111111111111 ("Scotiabank") seeded and Slack off.
// The sponsor sheet isn't reachable locally, so the portal info call is
// stubbed with a booth location; every other tRPC call is real.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3022";
const SPONSOR = "11111111-1111-4111-8111-111111111111";
const PAGE = `${BASE}/sponsors/${SPONSOR}`;

const portalInfo = {
  sponsorName: "Scotiabank",
  hwContact: "Jazz",
  hwContactPhone: null,
  roomNumber: "Rm 2110",
  boothLocation: "Booth 12, Atrium",
  workshopLocation: null,
  workshopTime: null,
  picksCount: 0,
  maxCoffeeChatMinutes: 0,
  maxCoffeeChatBlocks: 0,
  coffeeChatBookedCount: 0,
};

async function stubPortal(page) {
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    const idx = procs.indexOf("sponsorPortal.getSponsorPortalInfo");
    if (idx === -1) return route.continue();
    const res = await route.fetch();
    let body = await res.json().catch(() => null);
    if (!Array.isArray(body)) body = procs.map(() => null);
    body[idx] = { result: { data: { json: portalInfo } } };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

const shot = (page, name, width) =>
  page.screenshot({ path: path.join(OUT, `${name}-${width}.png`) });

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 375 ? 1400 : 1100 },
  });
  const page = await ctx.newPage();
  await stubPortal(page);
  await page.goto(PAGE, { waitUntil: "networkidle" });

  // 1. Empty sheet, first time on this device.
  await page.getByRole("button", { name: "Need help?" }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "1-sheet-empty", width);

  // 2. Send with nothing filled: errors on reason, name and phone.
  await page.getByRole("button", { name: "Send for help" }).click();
  await shot(page, "2-sheet-errors", width);

  // 3. Filled in.
  await page.getByLabel("Out of swag or supplies").check();
  await page.getByLabel("Your name").fill("Priya Shah");
  await page.getByLabel("Phone number").fill("519-555-0123");
  await page
    .getByLabel("Where are you right now? (optional)")
    .fill("By the window, second floor");
  await shot(page, "3-sheet-filled", width);

  // 4. Sent: status card shows who pinged.
  await page.getByRole("button", { name: "Send for help" }).click();
  await page.getByText("Pinged as Priya Shah").waitFor();
  await shot(page, "4-status-waiting", width);

  // Cancel, then reopen: name and phone come back from this device.
  await page.getByRole("button", { name: "Cancel request" }).click();
  await page.getByRole("button", { name: "Need help?" }).click();
  await page.getByRole("dialog").waitFor();
  await shot(page, "5-sheet-remembered", width);

  await ctx.close();
}
await browser.close();
console.log("saved to", OUT);
