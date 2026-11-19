// Shared helpers for the portal fix loop (Step 5): re-walks sponsor steps
// after a fix and saves screenshots here (docs/ship/walkthrough/after/).
// Run from the repo root with BASE=http://localhost:3061. Dev only.
import path from "node:path";
import fs from "node:fs";
export { open, text, wait, close, BASE, SPONSORS, sql } from "../lib.mjs";

export const AFTER = path.resolve("docs/ship/walkthrough/after");
fs.mkdirSync(AFTER, { recursive: true });

/** Screenshot into after/; real (non-555) phones are masked, as in lib.shot. */
export async function shot(page, name, { full = true } = {}) {
  const file = path.join(AFTER, `${name}.png`);
  const phone = /^\s*\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]\d{4}\s*$/;
  await page.screenshot({
    path: file,
    fullPage: full,
    mask: [
      page.locator('a[href^="tel:"]').filter({ hasNotText: /555/ }),
      page.getByText(phone),
    ],
    maskColor: "#9a9a9a",
  });
  console.log(`[shot] ${file}`);
}

/** Buttons that look filled (primary background), for the "one main button" check. */
export async function filledButtons(scope) {
  return scope.evaluate((root) =>
    [...root.querySelectorAll("button, a")]
      .filter((el) => {
        const bg = getComputedStyle(el).backgroundColor;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height) return false;
        const m = bg.match(/\d+/g)?.map(Number) ?? [];
        // Saturated blue fills (the action-primary token), not white/grey.
        return m.length >= 3 && m[2] > 150 && m[0] < 120 && (m[3] ?? 1) !== 0;
      })
      .map((el) => el.textContent.trim().replace(/\s+/g, " ")),
  );
}
