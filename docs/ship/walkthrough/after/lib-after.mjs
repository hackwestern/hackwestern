// Step 5 (fix loop) re-walk helpers, organizer side. Same sessions and
// masking as ../lib.mjs; screenshots land in this folder (fake data only).
// Shots that could show real organizer names go to PRIVATE instead.
import path from "node:path";
import fs from "node:fs";
import { PRIVATE } from "../lib.mjs";
export * from "../lib.mjs";

export const AFTER = path.resolve("docs/ship/walkthrough/after");

export async function shotAfter(page, name, { priv = false, full = false } = {}) {
  const dir = priv ? PRIVATE : AFTER;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
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
  console.log(`[shot] ${priv ? "PRIVATE " : ""}${file}`);
}

export const noahUser = (sql) => ({
  sub: "walkthrough-noah",
  name: "Noah",
  email: sql(`select email from "user" where id='walkthrough-noah'`).trim(),
});
