// Screenshots of /sponsors/[uuid]/coffee-chats (T45) at 375 and 1280, plus a
// check that the old /hackers link redirects and that Shortlist toggles.
// Run from the worktree root with the dev server on :3023 and the T45 seed.
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fitToContent } from "./fit.mjs";

const dir = path.dirname(fileURLToPath(import.meta.url));
const base = "http://localhost:3023";
const sponsor = "5f0c7a2e-1b3d-4c8e-9a6f-2d4b8e1c7f30";
const page_ = `${base}/sponsors/${sponsor}/coffee-chats`;

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  const page = await browser.newPage({
    viewport: { width, height: width === 375 ? 812 : 900 },
  });
  await page.goto(page_, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Interested hackers" }).waitFor();
  await fitToContent(page, width);
  await page.screenshot({
    path: path.join(dir, `1-page-${width}.png`),
    fullPage: true,
  });

  if (width === 375) {
    // Old link: lands on the coffee chats page at #interested.
    await page.goto(`${base}/sponsors/${sponsor}/hackers`, {
      waitUntil: "networkidle",
    });
    console.log("redirected to", page.url());

    // Toggle Jordan on, check pressed state + announcement.
    const toggle = page.getByRole("button", { name: "Shortlist Jordan Okafor" });
    await toggle.waitFor();
    await toggle.click();
    await page.waitForTimeout(800);
    await fitToContent(page, width);
    console.log("aria-pressed", await toggle.getAttribute("aria-pressed"));
    console.log(
      "status",
      await page.locator('[role="status"]').first().textContent(),
    );
    await page.locator("#interested").screenshot({
      path: path.join(dir, `2-interested-toggled-${width}.png`),
    });

    // Filter to shortlisted only.
    await page.getByRole("button", { name: "Shortlisted only" }).click();
    await page.waitForTimeout(300);
    await page.locator("#interested").screenshot({
      path: path.join(dir, `3-shortlisted-only-${width}.png`),
    });
    // Undo so reruns start the same.
    await page.getByRole("button", { name: "Shortlist Jordan Okafor" }).click();
    await page.waitForTimeout(800);
  }
  await page.close();
}
await browser.close();
