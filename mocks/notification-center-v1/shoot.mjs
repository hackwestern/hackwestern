// Check for the /live notification center: as seeded hacker Ivy (seed.mjs),
// signed in with a locally minted session JWT (dev server started with
// NEXTAUTH_SECRET=local-dev-only-secret on :3026 (3022 was taken by another worktree)). Opens the bell, saves a
// Slack email, and fails on any console error. From the worktree root:
//   node mocks/notification-center-v1/shoot.mjs
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3026";
const DIR = "mocks/notification-center-v1";
const USER = "seed-hacker-ivy";

const browser = await chromium.launch();
const out = [];
const errors = [];

for (const vp of [
  { width: 375, height: 812 },
  { width: 1280, height: 900 },
]) {
  const w = vp.width;
  await import(`./seed.mjs?${Date.now()}-${w}`);
  const context = await browser.newContext({ viewport: vp });
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: await encode({
        token: { sub: USER, name: "Ivy Example", email: `${USER}@example.com` },
        secret: "local-dev-only-secret",
      }),
      url: BASE,
    },
  ]);
  // Coffee chat toasts would cover the sheet; mark the offer as toasted.
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.appendChild(style),
    );
  });
  const page = await context.newPage();
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`@${w} console: ${m.text()}`);
  });
  page.on("pageerror", (e) => errors.push(`@${w} pageerror: ${e.message}`));

  await page.goto(`${BASE}/live`);
  const bell = page.getByRole("button", { name: /^Notifications/ }).filter({
    visible: true,
  });
  await bell.waitFor({ timeout: 120000 });
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("button")].some((b) =>
        /unread/.test(b.getAttribute("aria-label") ?? ""),
      ),
    null,
    { timeout: 30000 },
  );
  await page.evaluate(() => {
    for (const t of document.querySelectorAll("[data-sonner-toast]")) t.remove();
  });
  out.push(`@${w} bell: ${await bell.getAttribute("aria-label")}`);
  await page.screenshot({ path: `${DIR}/bell-${w}.png` });

  await bell.click();
  const sheet = page.getByRole("dialog");
  await sheet.getByText("Your team presents to Scotiabank").waitFor();
  await page.waitForTimeout(700);
  out.push(
    `@${w} notices: ${(await sheet.locator("li").allInnerTexts()).map((t) => t.replace(/\s+/g, " ")).join(" | ")}`,
  );
  await page.screenshot({ path: `${DIR}/open-${w}.png` });

  const input = sheet.getByLabel("Email you use on Slack");
  await input.fill("not-an-email");
  await sheet.getByRole("button", { name: "Save" }).click();
  await page.waitForTimeout(800);
  out.push(`@${w} invalid: ${await sheet.locator('[aria-live="polite"]').innerText()}`);
  await input.fill("Ivy.Personal@Gmail.com");
  await sheet.getByRole("button", { name: "Save" }).click();
  await sheet.getByText("Saved").waitFor();
  await input.scrollIntoViewIfNeeded();
  out.push(`@${w} saved value: ${await input.inputValue()}`);
  await page.screenshot({ path: `${DIR}/slack-email-${w}.png` });

  await page.keyboard.press("Escape");
  await page.waitForTimeout(1500);
  out.push(`@${w} bell after: ${await bell.getAttribute("aria-label")}`);
  await context.close();
}
await browser.close();
console.log(out.join("\n"));
console.log(errors.length ? `ERRORS:\n${errors.join("\n")}` : "No console errors");
