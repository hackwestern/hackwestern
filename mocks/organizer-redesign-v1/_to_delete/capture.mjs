// Organizer dashboard redesign screenshots. Usage: node capture.mjs <before|after>
// Signs in as the local test organizer (redesign-organizer-1) with a minted
// next-auth JWT (NEXTAUTH_SECRET=local-dev-only-secret). Dev server on :3020.
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3020";
const DIR = "mocks/organizer-redesign-v1";
const label = process.argv[2] ?? "after";
const token = await encode({
  token: { sub: "redesign-organizer-1", name: "Redesign Organizer", email: "redesign.organizer@test.local" },
  secret: "local-dev-only-secret",
});
const browser = await chromium.launch();
for (const width of [1280, 390]) {
  const context = await browser.newContext({ viewport: { width, height: 900 } });
  await context.addCookies([{ name: "next-auth.session-token", value: token, url: BASE }]);
  const page = await context.newPage();
  for (const tab of ["sponsors", "schedule", "coffee", "help"]) {
    await page.goto(`${BASE}/internal/sponsors?tab=${tab}`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${DIR}/${label}-${tab}-${width}.png`, fullPage: true });
  }
  await context.close();
}
await browser.close();
console.log("done", label);
