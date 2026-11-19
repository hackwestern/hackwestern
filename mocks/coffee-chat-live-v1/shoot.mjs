// T18 check: /live as seeded hacker Sofia (a pending StarTech request, from
// mocks/sponsor-scan-v1/seed.mjs). Signs in with a locally minted session JWT
// (NEXTAUTH_SECRET=local-dev-only-secret). Accepting writes to the local DB,
// so re-run seed.mjs afterwards. Dev server on :3021.
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3021";
const DIR = "mocks/coffee-chat-live-v1";
const token = await encode({
  token: { sub: "seed-hacker-sofia", name: "Sofia Example", email: "seed-hacker-sofia@example.com" },
  secret: "local-dev-only-secret",
});

const browser = await chromium.launch();
const out = [];
for (const vp of [
  { width: 375, height: 1100 },
  { width: 1280, height: 1000 },
]) {
  const context = await browser.newContext({ viewport: vp });
  await context.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/live?tab=home`);
  await page.getByRole("heading", { name: "StarTech wants to chat" }).waitFor({ timeout: 60000 });
  const toast = page.locator("[data-sonner-toast]");
  await toast.first().waitFor();
  out.push(`@${vp.width} first load: ${await toast.count()} toast "${(await toast.first().textContent())?.trim()}"`);
  out.push(`@${vp.width} buttons: ${(await page.getByRole("button", { name: /^(Accept|Decline)$/ }).allTextContents()).join(", ")}`);
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/pending-toast-${vp.width}.png` });

  // Reload: the same request must not toast again.
  await page.reload();
  await page.getByRole("heading", { name: "StarTech wants to chat" }).waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  out.push(`@${vp.width} after reload: ${await page.locator("[data-sonner-toast]").count()} toasts`);
  await page.screenshot({ path: `${DIR}/pending-${vp.width}.png` });

  await context.close();
}

// Last, since it changes the row: accept at 375.
{
  const context = await browser.newContext({ viewport: { width: 375, height: 1100 } });
  await context.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await context.newPage();
  await page.goto(`${BASE}/live?tab=home`);
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Can't make it" }).waitFor();
  const focused = await page.evaluate(() => document.activeElement?.textContent);
  const status = await page.locator('[role="status"]').allTextContents();
  out.push(`@375 after accept: focus on "${focused}"; status region "${status.filter(Boolean).join(" | ")}"`);
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${DIR}/accepted-375.png` });
  await context.close();
}
await browser.close();
console.log(out.join("\n"));
