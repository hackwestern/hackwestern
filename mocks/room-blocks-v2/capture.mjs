// Coffee chats v2 screenshots. Usage (dev server on :3032 against the
// hackwestern_sd_blocks DB):
//   npx tsx mocks/room-blocks-v2/fake-data.ts > mocks/room-blocks-v2/fake-data.json
//   node mocks/room-blocks-v2/capture.mjs
// Signs in as the local test organizer (redesign-organizer-1) with a minted
// next-auth JWT (NEXTAUTH_SECRET=local-dev-only-secret). The run-of-show
// sheet isn't readable here, so the sheet-backed queries are answered with
// fake-data.json; everything else is the real dev server.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const fake = JSON.parse(
  readFileSync("mocks/room-blocks-v2/fake-data.json", "utf8"),
);
const FAKE = {
  "coffeeChatRequests.organizerChatBoard": fake.board,
  "sponsorOrganizer.summary": fake.summary,
  "coffeeChatRequests.sponsorChats": fake.sponsorChats,
};

const BASE = "http://localhost:3032";
const DIR = "mocks/room-blocks-v2";
const STARTECH = "adaa0779-1608-42bd-9ce2-aad41b3840c2";
const token = await encode({
  token: {
    sub: "redesign-organizer-1",
    name: "Redesign Organizer",
    email: "redesign.organizer@test.local",
  },
  secret: "local-dev-only-secret",
});
const browser = await chromium.launch();
for (const width of [1280, 390]) {
  const context = await browser.newContext({
    viewport: { width, height: width < 640 ? 2400 : 1000 },
  });
  await context.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await context.newPage();
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procs = decodeURIComponent(
      url.pathname.split("/api/trpc/")[1] ?? "",
    ).split(",");
    if (!procs.some((p) => p in FAKE)) return route.continue();
    const real = await route.fetch();
    let body;
    try {
      body = await real.json();
    } catch {
      body = procs.map(() => ({ result: { data: { json: null } } }));
    }
    const out = procs.map((p, i) =>
      p in FAKE ? { result: { data: { json: FAKE[p] } } } : body[i],
    );
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(out),
    });
  });
  const shots = [
    ["organizer-view", "/internal/sponsors?tab=coffee", null],
    [
      "organizer-highlight",
      `/internal/sponsors?tab=coffee&sponsor=${STARTECH}`,
      null,
    ],
    [
      "block-dialog",
      "/internal/sponsors?tab=coffee",
      'button[aria-label^="Rm 2241, 11:00"]',
    ],
    [
      "give-room",
      "/internal/sponsors?tab=coffee",
      'button[aria-label$="give room"]',
    ],
    ["sponsor-page", `/sponsors/${STARTECH}/coffee-chats`, null],
  ];
  for (const [name, path, click] of shots) {
    await page.goto(`${BASE}${path}`, {
      waitUntil: "networkidle",
      timeout: 240000,
    });
    await page.waitForTimeout(2500);
    if (click) {
      await page.locator(click).first().click();
      await page.waitForTimeout(1000);
    }
    console.log(name, width, page.url());
    await page.screenshot({
      path: `${DIR}/${name}-${width}.png`,
      fullPage: width >= 640,
    });
  }
  await context.close();
}
await browser.close();
console.log("done");
