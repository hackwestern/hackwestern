// T34 check (v2, after the accessibility review): Chromium's fake camera
// plays a QR of a seeded hacker's user id or hacker ID; the scanner must
// decode it and reach the offer card. Also the typed-code path, client-side
// rejection of junk QRs, and live-region announcements. `hackerByCode` hits the real
// local DB (seed.mjs); `freeTimes` / `offer` are mocked because they read the
// run-of-show Google Sheet, which local dev can't reach.
// Run: node mocks/sponsor-scan-v2/seed.mjs && node mocks/sponsor-scan-v2/make-qr.mjs
//      node mocks/sponsor-scan-v2/check.mjs   (dev server on :3021)
import { chromium } from "playwright";

const BASE = "http://localhost:3021";
const SPONSOR = "11111111-1111-4111-8111-111111111111";
const PAGE_URL = `${BASE}/sponsors/${SPONSOR}/scan`;
const DIR = "mocks/sponsor-scan-v2";
const WIDTHS = [
  { width: 375, height: 1100 },
  { width: 1280, height: 1000 },
];

const ALL_TIMES = ["10:00", "10:15", "10:30", "10:45", "11:00", "11:15"].map(
  (slotTime, i) => ({
    slotTime,
    seatsLeft: i === 0 ? 1 : 2,
    room: i < 4 ? "Rm 2241" : "Rm 2242",
  }),
);
const free = (times) => ({
  room: "Rm 2241",
  durationMinutes: 15,
  groupSize: 1,
  reps: 2,
  times,
});
const ok = (json) => ({ result: { data: { json } } });
const fail = (code, httpStatus, message) => ({
  error: { json: { message, code: -32600, data: { code, httpStatus } } },
});

/** Mock only the sheet-backed procedures; everything else goes to the server. */
async function routeTrpc(page, scenario, log) {
  let offers = 0;
  page.on("request", (r) => {
    if (r.url().includes("hackerByCode")) log.push(`lookup ${r.url()}`);
  });
  await page.route("**/api/trpc/**", (route) =>
    handle(route).catch(() => undefined),
  );
  async function handle(route) {
    const url = new URL(route.request().url());
    const names = url.pathname.replace("/api/trpc/", "").split(",");
    const mocked = names.some((n) => /freeTimes|offer/.test(n));
    if (!mocked) return route.continue();
    let real = null;
    const needsReal = names.some((n) => !/freeTimes|offer/.test(n));
    if (needsReal) {
      const res = await route.fetch();
      real = await res.json();
    }
    const body = names.map((name, i) => {
      if (name.endsWith("freeTimes")) {
        if (scenario === "noTimes") return ok(free([]));
        if (scenario === "offerError" && offers > 0)
          return ok(free(ALL_TIMES.slice(1)));
        return ok(free(ALL_TIMES));
      }
      if (name.endsWith("offer")) {
        offers++;
        const input = JSON.parse(route.request().postData() ?? "{}")[i]?.json;
        log.push(`offer input ${JSON.stringify(input)}`);
        if (scenario === "offerError" && offers <= 2)
          return fail("CONFLICT", 409, "That time is full. Pick another one.");
        return ok({
          chatId: "00000000-0000-4000-8000-0000000000aa",
          firstName: "Alex",
          slotTime: input.slotTime,
          durationMinutes: 15,
          room: "Rm 2241",
          status: "pending",
          expiresAt: "2026-11-21T15:10:00.000Z",
        });
      }
      if (name.endsWith("hacker")) log.push(`hacker ${JSON.stringify(real?.[i])}`);
      return real?.[i];
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  }
}

async function noSideways(page) {
  return page.evaluate(
    () => document.documentElement.scrollWidth <= window.innerWidth,
  );
}

async function shot(page, name, vp, results) {
  await page.waitForTimeout(350);
  const path = `${DIR}/${name}-${vp.width}.png`;
  await page.screenshot({ path });
  results.push(`${name} @${vp.width}: saved, no sideways scroll = ${await noSideways(page)}`);
}

const cameraError = (name) => `
  navigator.mediaDevices.getUserMedia = () =>
    Promise.reject(new DOMException("blocked", ${JSON.stringify(name)}));
`;

const recordAnnouncements = `
  window.__said = [];
  new MutationObserver(() => {
    const el = document.querySelector('[role="status"]');
    if (el && el.textContent) window.__said.push(el.textContent);
  }).observe(document, { subtree: true, childList: true, characterData: true });
`;
const said = (page) => page.evaluate(() => window.__said);

async function withBrowser(y4m, fn) {
  const browser = await chromium.launch({
    args: [
      "--use-fake-ui-for-media-stream",
      "--use-fake-device-for-media-stream",
      `--use-file-for-fake-video-capture=${y4m}`,
    ],
  });
  try {
    await fn(browser);
  } finally {
    await browser.close();
  }
}

const results = [];
const log = [];
const card = (page) =>
  page.getByRole("heading", { name: "Chat with Alex?" }).waitFor({ timeout: 20000 });

// 1. Scanning (camera live, nothing to read yet), with the typed-code field.
await withBrowser(`${DIR}/blank.y4m`, async (browser) => {
  for (const vp of WIDTHS) {
    const page = await browser.newPage({ viewport: vp });
    await page.addInitScript(recordAnnouncements);
    await routeTrpc(page, "ok", log);
    await page.goto(PAGE_URL);
    await page.getByText("Looking for a QR code").first().waitFor();
    await page.waitForTimeout(400);
    results.push(`scanning @${vp.width}: announced [${(await said(page)).join(" | ")}]`);
    await shot(page, "1-scanning", vp, results);
    await page.close();
  }
});

// 2-5. Seeded hacker's /live QR (user id) -> offer card -> sent; offer
// error twice; no times.
await withBrowser(`${DIR}/badge-qr.y4m`, async (browser) => {
  for (const vp of WIDTHS) {
    let page = await browser.newPage({ viewport: vp });
    await routeTrpc(page, "ok", log);
    await page.goto(PAGE_URL);
    await card(page);
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    const picked = await page.locator('input[name="slot"]:checked').getAttribute("value");
    const checkIcons = await page.locator("label:has(input:checked) svg.lucide-check").count();
    const rooms = await page.locator("fieldset label").allTextContents();
    results.push(`offer card @${vp.width}: focus "${focused}"; preselected ${picked}; check icon on selected = ${checkIcons}; chips [${rooms.join(" / ")}]`);
    await page.getByLabel("Your name (optional)").fill("Sam");
    await shot(page, "2-offer-card", vp, results);
    await page.getByRole("button", { name: "Offer chat" }).click();
    await page.getByRole("heading", { name: "Offer sent" }).waitFor();
    await shot(page, "3-sent", vp, results);
    await page.close();

    page = await browser.newPage({ viewport: vp });
    await page.addInitScript(recordAnnouncements);
    await routeTrpc(page, "offerError", log);
    await page.goto(PAGE_URL);
    await card(page);
    for (let i = 0; i < 2; i++) {
      await page.getByRole("button", { name: "Offer chat" }).click();
      await page.waitForTimeout(700);
    }
    const full = (await said(page)).filter((t) => t === "That time is full. Pick another one.");
    results.push(`offer error @${vp.width}: same error announced ${full.length} times`);
    await shot(page, "4-offer-error", vp, results);
    await page.close();

    page = await browser.newPage({ viewport: vp });
    await routeTrpc(page, "noTimes", log);
    await page.goto(PAGE_URL);
    await page.getByRole("heading", { name: "No open times" }).waitFor({ timeout: 20000 });
    await shot(page, "5-no-times", vp, results);
    await page.close();
  }
});

// 2b. Wallet pass / printed badge QR (hacker ID words).
await withBrowser(`${DIR}/pass-qr.y4m`, async (browser) => {
  const page = await browser.newPage({ viewport: WIDTHS[0] });
  await routeTrpc(page, "ok", log);
  await page.goto(PAGE_URL);
  await card(page);
  results.push("hacker ID QR (brave-otter-kite) @375: reached the offer card");
  await page.close();
});

// 6. Not a hacker: a real 404 from the server, and a junk QR rejected
// client-side without a lookup.
await withBrowser(`${DIR}/nonhacker-qr.y4m`, async (browser) => {
  for (const vp of WIDTHS) {
    const page = await browser.newPage({ viewport: vp });
    await routeTrpc(page, "ok", log);
    await page.goto(PAGE_URL);
    await page.getByRole("heading", { name: "Not a hacker badge" }).waitFor({ timeout: 20000 });
    await shot(page, "6-not-a-hacker", vp, results);
    await page.close();
  }
});
await withBrowser(`${DIR}/junk-qr.y4m`, async (browser) => {
  const page = await browser.newPage({ viewport: WIDTHS[0] });
  const before = log.length;
  await routeTrpc(page, "ok", log);
  await page.goto(PAGE_URL);
  await page.getByRole("heading", { name: "Not a hacker badge" }).waitFor({ timeout: 20000 });
  const lookups = log.slice(before).filter((l) => l.startsWith("lookup")).length;
  results.push(`junk QR ("hello world") @375: not-a-hacker, server lookups = ${lookups}`);
  await page.close();
});

// 7-8. Camera blocked / no camera: focus + announcement, then type the code.
await withBrowser(`${DIR}/blank.y4m`, async (browser) => {
  for (const [name, error, heading] of [
    ["7-camera-denied", "NotAllowedError", "Camera blocked"],
    ["8-no-camera", "NotFoundError", "No camera found"],
  ]) {
    for (const vp of WIDTHS) {
      const page = await browser.newPage({ viewport: vp });
      await page.addInitScript(cameraError(error));
      await page.addInitScript(recordAnnouncements);
      await routeTrpc(page, "ok", log);
      await page.goto(PAGE_URL);
      await page.getByRole("heading", { name: heading }).waitFor();
      await page.waitForTimeout(400);
      const focused = await page.evaluate(() => document.activeElement?.textContent);
      results.push(`${name} @${vp.width}: focus "${focused}"; announced [${(await said(page)).slice(-1)}]`);
      await shot(page, name, vp, results);
      if (name === "7-camera-denied") {
        await page.getByLabel("Type their hacker code").fill("Brave Otter Kite");
        await page.keyboard.press("Enter");
        await card(page);
        results.push(`typed "Brave Otter Kite" @${vp.width}: reached the offer card`);
        if (vp.width === 375) await shot(page, "9-typed-code-card", vp, results);
      }
      await page.close();
    }
  }
});

console.log(results.join("\n"));
