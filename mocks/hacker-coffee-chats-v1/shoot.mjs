// T36 check: /live?tab=coffee-chats as seeded hackers (see seed.mjs), signed
// in with a locally minted session JWT (NEXTAUTH_SECRET=local-dev-only-secret).
// Dev server on :3021. Run from the worktree root:
//   node mocks/hacker-coffee-chats-v1/shoot.mjs
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const BASE = "http://localhost:3021";
const DIR = "mocks/hacker-coffee-chats-v1";
const seed = async () => (await import(`./seed.mjs?${Date.now()}`)).tessChatIds;

const tokenFor = (id, name) =>
  encode({
    token: { sub: id, name, email: `${id}@example.com` },
    secret: "local-dev-only-secret",
  });

const browser = await chromium.launch();
const out = [];

async function open(vp, user, name, { markToasted = [] } = {}) {
  const context = await browser.newContext({ viewport: vp });
  await context.addCookies([
    {
      name: "next-auth.session-token",
      value: await tokenFor(user, name),
      url: BASE,
    },
  ]);
  if (markToasted.length) {
    await context.addInitScript(
      ([key, ids]) => window.localStorage.setItem(key, JSON.stringify(ids)),
      [`hw-coffee-chat-toasted:${user}`, markToasted],
    );
  }
  // The dev error overlay (a Google Fonts fetch failing offline) would
  // cover the page; it isn't part of the app.
  await context.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = "nextjs-portal { display: none !important; }";
    document.addEventListener("DOMContentLoaded", () =>
      document.head.appendChild(style),
    );
  });
  const page = await context.newPage();
  return { context, page };
}

const focused = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    return `${el?.tagName} "${el?.textContent?.trim().slice(0, 60)}"`;
  });
const status = async (page) =>
  (await page.locator('[role="status"]').allTextContents())
    .filter(Boolean)
    .join(" | ");

for (const vp of [
  { width: 375, height: 1500 },
  { width: 1280, height: 1100 },
]) {
  const w = vp.width;

  // Pending (plus upcoming and past).
  let ids = await seed();
  let { context, page } = await open(vp, "seed-hacker-tess", "Tess Example", {
    markToasted: ids,
  });
  await page.goto(`${BASE}/live?tab=coffee-chats`);
  await page
    .getByRole("button", { name: "Accept coffee chat with StarTech" })
    .waitFor({ timeout: 90000 });
  await page.waitForTimeout(600);
  out.push(
    `@${w} pending: h2s ${(await page.locator("main h2").allTextContents()).join(" / ")}`,
  );
  if (w === 1280) {
    out.push(
      `@${w} nav badge in link name: ${(await page.getByRole("link", { name: /Coffee chats.*2 chats waiting/ }).count()) > 0}`,
    );
  }
  await page.screenshot({ path: `${DIR}/pending-${w}.png` });

  // Accept StarTech.
  await page
    .getByRole("button", { name: "Accept coffee chat with StarTech" })
    .click();
  await page
    .getByRole("button", {
      name: "Can't make it to coffee chat with StarTech",
    })
    .waitFor();
  await page.waitForTimeout(400);
  out.push(
    `@${w} after accept: focus ${await focused(page)}; status "${await status(page)}"`,
  );
  await page.screenshot({ path: `${DIR}/accepted-${w}.png` });
  await context.close();

  // Decline Northwind: inline confirm, then yes.
  ids = await seed();
  ({ context, page } = await open(vp, "seed-hacker-tess", "Tess Example", {
    markToasted: ids,
  }));
  await page.goto(`${BASE}/live?tab=coffee-chats`);
  await page
    .getByRole("button", {
      name: "Decline coffee chat with Northwind Robotics",
    })
    .click({ timeout: 90000 });
  const yes = page.getByRole("button", {
    name: "Yes, decline coffee chat with Northwind Robotics",
  });
  await yes.waitFor();
  out.push(`@${w} decline confirm: focus ${await focused(page)}`);
  await page.screenshot({ path: `${DIR}/decline-confirm-${w}.png` });
  await yes.click();
  await page.waitForFunction(
    () => !document.body.textContent.includes("Yes, decline"),
  );
  await page.waitForTimeout(500);
  out.push(
    `@${w} after decline: focus ${await focused(page)}; status "${await status(page)}"`,
  );
  await page.screenshot({ path: `${DIR}/after-decline-${w}.png` });
  await context.close();

  // Empty: Nico has no chats. Opened directly: short message, no code
  // card, no nav item.
  ({ context, page } = await open(vp, "seed-hacker-nico", "Nico Example"));
  await page.goto(`${BASE}/live?tab=coffee-chats`);
  await page.getByText("No coffee chats yet.").waitFor({ timeout: 90000 });
  await page.waitForTimeout(400);
  out.push(
    `@${w} empty: code cards ${await page.locator("code").count()}; nav links ${await page.locator('a[href="/live?tab=coffee-chats"]').count()}`,
  );
  await page.screenshot({ path: `${DIR}/empty-${w}.png` });
  await context.close();
}

// Toast "View" on home opens the tab and focuses that chat; home shows the
// compact summary instead of the full list.
{
  await seed();
  const { context, page } = await open(
    { width: 375, height: 1100 },
    "seed-hacker-tess",
    "Tess Example",
  );
  await page.goto(`${BASE}/live?tab=home`);
  const toast = page.locator("[data-sonner-toast]");
  await toast.first().waitFor({ timeout: 90000 });
  await page.getByRole("link", { name: "View coffee chats" }).waitFor();
  out.push(
    `home: ${await toast.count()} toasts; summary "${(await page.getByText(/waiting for your answer ·/).textContent())?.trim()}"`,
  );
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${DIR}/home-summary-toast-375.png` });
  // Toasts stack; use the front one's View.
  const front = page.locator('[data-sonner-toast][data-front="true"]');
  const frontText = (await front.textContent())?.trim();
  await front.getByRole("button", { name: "View" }).click();
  await page.waitForURL(/tab=coffee-chats/);
  await page.waitForFunction(() => document.activeElement?.tagName === "H3");
  out.push(
    `toast View ("${frontText}"): url ${new URL(page.url()).search}; focus ${await focused(page)}`,
  );
  await context.close();
}

// Nico on /live, then a sponsor offers a chat: the nav item and the toast
// appear on the next refetch (30 s), no reload.
{
  await seed();
  const { context, page } = await open(
    { width: 1280, height: 900 },
    "seed-hacker-nico",
    "Nico Example",
  );
  await page.goto(`${BASE}/live?tab=schedule`);
  await page.locator("nav").first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(2000);
  const navLink = page.locator('nav a[href="/live?tab=coffee-chats"]');
  const before = await navLink.count();
  const { default: postgres } = await import("postgres");
  const sql = postgres(
    "postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat",
  );
  const [startech] =
    await sql`select id from sponsor_judging_sponsor where name = 'StarTech'`;
  await sql`insert into coffee_chat (sponsor_id, user_id, room, slot_time, duration_minutes, status) values (${startech.id}, 'seed-hacker-nico', 'Rm 2241', '15:00', 15, 'pending')`;
  await sql.end();
  await navLink.waitFor({ timeout: 45000 });
  await page.locator("[data-sonner-toast]").first().waitFor();
  out.push(
    `new offer while open: nav links before ${before}, after ${await navLink.count()}; toast "${(await page.locator("[data-sonner-toast]").first().textContent())?.trim()}"`,
  );
  await context.close();
}

await seed();
await browser.close();
console.log(out.join("\n"));
