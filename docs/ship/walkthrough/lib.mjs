// Shared helpers for the ship-run walkthrough (Steps 2-3).
// Dev only: points at the local dev server (default :3050) and signs test
// sessions with local-dev-only-secret. Never point this at production.
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import { execSync } from "node:child_process";

export const BASE = process.env.BASE || "http://localhost:3050";
export const OUT = path.resolve("docs/ship/walkthrough");
// Screens that may show live-sheet data (real phones) go here, not the repo.
export const PRIVATE =
  process.env.PRIVATE_OUT || path.join(os.tmpdir(), "hw-walkthrough-private");
fs.mkdirSync(OUT, { recursive: true });

export const SPONSORS = {
  test: "3d3e323d-e50e-4379-bc04-41d85870ef63",
  sunlife: "89170676-4186-4912-8a06-fa0eda0ff309",
  canada: "ef75780e-e201-4056-919b-e2df68c5a42f",
  scotia: "6e9f7724-418d-429b-b60e-64112772dc9c",
  startech: "adaa0779-1608-42bd-9ce2-aad41b3840c2",
  cse: "47bd093d-8eb1-4c54-85b3-6aba883e8e3d",
  commure: "764846fa-3fff-4487-b2b3-7f69c3a809c4",
};

export const USERS = {
  organizer: {
    sub: "redesign-organizer-1",
    name: "Redesign Organizer",
    email: "redesign.organizer@test.local",
  },
  alex: { sub: "demo-hacker-1", name: "Alex Demo", email: "demo.hacker1@test.local" },
  sam: { sub: "demo-hacker-2", name: "Sam Demo", email: "demo.hacker2@test.local" },
};

export const sql = (q) =>
  execSync(
    `docker exec -i hackwestern_db psql -U postgres -d hackwestern_spon -At -F "|"`,
    { input: q, encoding: "utf8" },
  );

let browser;
export async function getBrowser() {
  browser ??= await chromium.launch();
  return browser;
}
export async function close() {
  await browser?.close();
}

/** A fresh browser context ("hours later, new device"). */
export async function open(width = 1280, user = null) {
  const b = await getBrowser();
  const context = await b.newContext({
    viewport: { width, height: width < 600 ? 844 : 900 },
  });
  if (user) {
    const token = await encode({ token: user, secret: "local-dev-only-secret" });
    await context.addCookies([
      { name: "next-auth.session-token", value: token, url: BASE },
    ]);
  }
  const page = await context.newPage();
  page.errors = [];
  page.on("pageerror", (e) => page.errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") page.errors.push(m.text());
  });
  return { context, page };
}

export async function shot(page, name, { priv = false, full = true } = {}) {
  const dir = priv ? PRIVATE : OUT;
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, `${name}.png`);
  // Phones that aren't fake 555 numbers come from the live sheet: mask them.
  // Anchored and with a separator, so long digit runs (room grids) don't match.
  const phone = /^\s*\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]\d{4}\s*$/;
  await page.screenshot({
    path: file,
    fullPage: full,
    mask: priv
      ? []
      : [
          page.locator('a[href^="tel:"]').filter({ hasNotText: /555/ }),
          page.getByText(phone),
        ],
    maskColor: "#9a9a9a",
  });
  console.log(`[shot] ${priv ? "PRIVATE " : ""}${file}`);
}

/** Visible text of main content, trimmed, for wording review. */
export async function text(page, sel = "body", max = 4000) {
  const t = await page.locator(sel).first().innerText().catch(() => "");
  const s = t
    .replace(/\n{2,}/g, "\n")
    .replace(/\(?\d{3}\)?[ .-]?(?!555)\d{3}[ .-]?\d{4}/g, "[real phone]")
    .trim();
  console.log(`----- text (${page.url()}) -----\n${s.slice(0, max)}\n-----`);
  return s;
}

export const wait = (page, ms = 1000) => page.waitForTimeout(ms);
