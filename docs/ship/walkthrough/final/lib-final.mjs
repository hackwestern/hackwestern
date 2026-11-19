// Step 6 (final walkthrough) helpers. Same sessions and masking as ../lib.mjs;
// screenshots land in this folder (fake data only). Run from the repo root
// with BASE=http://localhost:3070. Dev only.
import path from "node:path";
import fs from "node:fs";
import { sql } from "../lib.mjs";
export * from "../lib.mjs";

export const FINAL = path.resolve("docs/ship/walkthrough/final");
fs.mkdirSync(FINAL, { recursive: true });

/** Screenshot into final/. Real (non-555) phones are masked, plus any extra locators. */
export async function snap(page, name, { full = false, mask = [] } = {}) {
  const file = path.join(FINAL, `${name}.png`);
  const phone = /^\s*\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]\d{4}\s*$/;
  await page.screenshot({
    path: file,
    fullPage: full,
    mask: [
      page.locator('a[href^="tel:"]').filter({ hasNotText: /555/ }),
      page.getByText(phone),
      // Organizer names from the live sheet.
      page.getByText(/Noah Medland/),
      ...mask,
    ],
    maskColor: "#9a9a9a",
  });
  console.log(`[shot] ${file}`);
}

/** Noah's session: the local organizer row whose email was read from HW Contacts at setup. */
export const noah = () => ({
  sub: "walkthrough-noah",
  name: "Noah",
  email: sql(`select email from "user" where id='walkthrough-noah'`).trim(),
});

export const say = (s) => console.log(`\n=== ${s}`);
/** Inner text with real phones and emails scrubbed. */
export const clean = (s) =>
  s
    .replace(/\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]?\d{4}/g, "[real phone]")
    .replace(/[\w.+-]+@(?!example\.test|test\.local)[\w-]+\.[\w.]+/g, "[email]")
    .replace(/\n{2,}/g, "\n");
export async function read(loc, max = 3000) {
  const t = clean(await loc.innerText().catch(() => ""));
  console.log(t.slice(0, max));
  return t;
}
