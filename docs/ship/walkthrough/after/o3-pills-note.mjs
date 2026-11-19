// After: B7, My sponsors pills say why they go back ("Not written (sheet
// writes off)"). Noah's local login; the page names real organizers, so the
// screenshot is private (kept out of the repo).
import { open, wait, close, BASE, sql, shotAfter, noahUser } from "./lib-after.mjs";
const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W, noahUser(sql));
await page.goto(`${BASE}/internal/sponsors`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 2500);
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
const pill = page.getByRole("button", { name: /Not arrived/ }).first();
await pill.click();
await wait(page, 2500);
console.log("status:", (await page.locator('[role="status"]').allInnerTexts()).filter((s) => /Not written/.test(s)).join(" / ") || "(none)");
console.log("note visible in viewport:", await page.getByText(/Not written/).first().isVisible().catch(() => false));
const box = await page.getByText(/Not written/).first().boundingBox().catch(() => null);
const pbox = await pill.boundingBox();
console.log("note y:", box?.y, "pill y:", pbox?.y);
await shotAfter(page, `o3-mysponsors-pill-note${tag}`, { priv: true });
const cc = page.getByRole("button", { name: /Not attended/ }).first();
await cc.click().catch((e) => console.log("cc click failed:", e.message.split("\n")[0]));
await wait(page, 2500);
console.log("after cc:", (await page.locator('[role="status"]').allInnerTexts()).filter((s) => /Not written/.test(s)).join(" / ") || "(none)");
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
