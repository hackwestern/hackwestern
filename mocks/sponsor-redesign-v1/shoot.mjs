// Sponsor redesign screenshots at 390 and 1280 wide. Dev server on :3019.
//   node mocks/sponsor-redesign-v1/seed.mjs
//   node mocks/sponsor-redesign-v1/shoot.mjs before|after
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3019";
const DIR = "mocks/sponsor-redesign-v1";
const TAG = process.argv[2] ?? "after";
const S = "33333333-3333-4333-8333-000000000001";
const HACKER = "redesign-hacker-01";

const browser = await chromium.launch();

async function open(vp, { hacker = false } = {}) {
  const context = await browser.newContext({
    viewport: vp,
    permissions: [],
    reducedMotion: "reduce",
  });
  if (hacker) {
    const token = await encode({
      token: { sub: HACKER, name: "Tess Example", email: `${HACKER}@example.com` },
      secret: "local-dev-only-secret",
    });
    await context.addCookies([
      { name: "next-auth.session-token", value: token, url: BASE },
    ]);
  }
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.appendChild(style),
    );
  });
  return context;
}

const shots = [
  ["home", `/sponsors/${S}`, "main, h1"],
  ["coffee-chats", `/sponsors/${S}/coffee-chats`, "#interested"],
  ["scan", `/sponsors/${S}/scan`, "h2"],
  ["candidates", `/sponsors/${S}/coffee-chats#interested`, "#interested"],
  ["offer", `/sponsors/${S}/scan?hacker=${HACKER}`, "h2"],
  ["schedule", `/sponsors/${S}/schedule`, "h1"],
];

for (const width of [390, 1280]) {
  const vp = { width, height: width === 390 ? 844 : 900 };
  const context = await open(vp);
  const page = await context.newPage();
  for (const [name, path, wait] of shots) {
    await page.goto(BASE + path);
    await page.locator(wait).first().waitFor({ timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(1500);
    // Headless fullPage leaves everything below the first screen blank
    // here, so grow the viewport to the page instead.
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width, height: Math.min(h, 6000) });
    await page.waitForTimeout(500);
    await page.screenshot({ path: `${DIR}/${TAG}-${name}-${width}.png` });
    await page.setViewportSize(vp);
    console.log("shot", name, width);
  }
  // The help sheet, open.
  await page.goto(`${BASE}/sponsors/${S}`);
  await page.getByRole("button", { name: /Need help/ }).click().catch(() => {});
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${DIR}/${TAG}-help-sheet-${width}.png` });
  await context.close();

  const live = await open(vp, { hacker: true });
  const lp = await live.newPage();
  await lp.goto(`${BASE}/live?tab=coffee-chats`);
  await lp.waitForTimeout(8000);
  await lp.screenshot({ path: `${DIR}/${TAG}-live-chats-${width}.png`, fullPage: false });
  console.log("shot live", width);
  await live.close();
}
await browser.close();
