// Screenshots of the organizer coffee chat board (track C check).
// Logs in as the local test organizer with a minted next-auth JWT signed with
// the dev server's local-dev-only-secret. Dev only; never points at prod.
// Usage (from the repo root, dev server on :3033):
//   node docs/handoff/build-c-cc-board/capture.mjs
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const SECRET = process.env.S || "local-dev-only-secret";
const BASE = process.env.BASE || "http://127.0.0.1:3033";
const DIR = "docs/handoff/build-c-cc-board";
const token = await encode({
  token: { sub: "redesign-organizer-1", name: "Redesign Organizer", email: "redesign.organizer@test.local" },
  secret: SECRET,
});
const browser = await chromium.launch();
for (const [w, h] of [[1440, 900], [390, 844]]) {
  const context = await browser.newContext({ viewport: { width: w, height: h } });
  await context.addCookies([{ name: "next-auth.session-token", value: token, url: BASE }]);
  const page = await context.newPage();
  await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
  const skip = page.getByRole("button", { name: "No thanks" });
  if (await skip.count()) await skip.first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${DIR}/board-${w}.png`, fullPage: true });
  // Open Canada Life's row: its 1:00 workshop cuts 2-3 to 2:15-3:00, and People
  // shows each phone with a copy icon.
  const row = page.locator('section[aria-labelledby="coffee-sponsors"] button[aria-label^="Canada Life"]').first();
  // Dev data has no rep free in a cut session, so preview one in this browser
  // only: Priya (Canada Life) ticks 2-3 and her 10-11 chat sits there.
  await page.route("**/api/trpc/coffeeChatSessions.getBoard**", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    for (const r of [body].flat()) {
      const b = r?.result?.data?.json;
      if (!b?.placements || !b?.sponsors) continue;
      const sp = b.sponsors.find((x) => x.name === "Canada Life");
      const priya = sp?.reps.find((x) => x.name === "Priya S.");
      if (!priya) continue;
      priya.free = [...priya.free, "14"];
      const p = b.placements.find((x) => x.repId === priya.id && x.sessionId === "10");
      if (p && sp.partial["14"]) Object.assign(p, { sessionId: "14", room: "2243", window: sp.partial["14"] });
    }
    await route.fulfill({ response: res, json: body });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
  if (await row.count()) {
    await row.click();
    await page.waitForTimeout(800);
    const copyBtn = page.locator('button[aria-label^="Copy "]').first();
    await copyBtn.click().catch(() => undefined);
    await page.waitForTimeout(200);
    await page.screenshot({ path: `${DIR}/board-${w}-open.png`, fullPage: true });
  }
  // Send bar preview: pretend 3 chats are drafts, in this browser only (the
  // shared dev DB isn't touched). This user isn't Noah, so Send is disabled.
  await page.unrouteAll();
  await page.route("**/api/trpc/coffeeChatSessions.getBoard**", async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    for (const r of [body].flat()) if (r?.result?.data?.json?.placements) r.result.data.json.draftCount = 3;
    await route.fulfill({ response: res, json: body });
  });
  await page.reload({ waitUntil: "networkidle" });
  await page.waitForSelector("text=Suggested fixes", { timeout: 120000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${DIR}/board-${w}-send.png` });
  console.log(w, JSON.stringify((await page.evaluate(() => document.body.innerText)).slice(0, 1200)));
  await context.close();
}
await browser.close();
