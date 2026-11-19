// Room holds + sponsor table screenshots. Usage (dev server on :3018 against
// a COPY of the local DB with demo holds):
//   node mocks/room-holds-v1/capture.mjs
// Signs in as the local test organizer (redesign-organizer-1) with a minted
// next-auth JWT (NEXTAUTH_SECRET=local-dev-only-secret). The run-of-show
// sheet isn't readable here, so the three sheet-backed organizer queries
// are answered with fake-data.json (see fake-data.ts); everything else is
// the real dev server.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";

const fake = JSON.parse(
  readFileSync("mocks/room-holds-v1/fake-data.json", "utf8"),
);
const FAKE = {
  "coffeeChatRequests.organizerChatBoard": fake.board,
  "sponsorOrganizer.summary": fake.summary,
  "sponsorDashboard.getSponsors": fake.list,
};

const BASE = "http://localhost:3018";
const DIR = "mocks/room-holds-v1";
const CANADA_LIFE = "ef75780e-e201-4056-919b-e2df68c5a42f";
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
  // Phones: a tall viewport instead of fullPage (full-page shots at 390
  // came out blank below the fold).
  const context = await browser.newContext({
    viewport: { width, height: width < 640 ? 2200 : 900 },
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
  for (const [name, path] of [
    ["rooms", "?tab=coffee"],
    ["rooms-highlight", `?tab=coffee&sponsor=${CANADA_LIFE}`],
    ["sponsors", "?tab=sponsors"],
  ]) {
    await page.goto(`${BASE}/internal/sponsors${path}`, {
      waitUntil: "networkidle",
      timeout: 240000,
    });
    await page.waitForTimeout(3000);
    if (name === "sponsors") {
      // Open the first registered sponsor's row.
      const toggle = page
        .locator(
          width < 640
            ? "li button[aria-expanded]"
            : "table button[aria-expanded]",
        )
        .first();
      if (await toggle.count()) await toggle.click();
      await page.waitForTimeout(800);
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
