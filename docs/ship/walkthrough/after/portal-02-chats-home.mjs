// Sponsor · Chats home, after the "Chats home" simplify: one main button in
// the order of the job, Your chats first after Send, all six sessions at
// 390 px. Read-only: "submitted, not sent" is Test Sponsor's answer patched
// in the browser; "not submitted" is Commure (reps, no submit).
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-02-chats-home.mjs
import { open, shot, wait, close, filledButtons, BASE, SPONSORS } from "./portal-lib.mjs";

/** Patch coffeeChatSetup.get in a (batched) tRPC response. */
async function patchSetup(page, patch) {
  await page.route(/\/api\/trpc\/.*coffeeChatSetup\.get/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()).split(",");
    names.forEach((n, i) => {
      if (n !== "coffeeChatSetup.get") return;
      const data = body[i]?.result?.data;
      if (!data?.json) return;
      Object.assign(data.json, patch);
      for (const k of Object.keys(patch)) {
        if (data.meta?.values) delete data.meta.values[k];
      }
    });
    await route.fulfill({ response: res, json: body });
  });
}

const states = [
  ["not-submitted", SPONSORS.commure, null],
  ["submitted", SPONSORS.test, { confirmed: false, chats: [], sentAt: null, editedAfterSend: false }],
  ["sent", SPONSORS.test, null],
];

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  for (const [name, sponsor, patch] of states) {
    const { page } = await open(W);
    if (patch) await patchSetup(page, patch);
    await page.goto(`${BASE}/sponsors/${sponsor}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
    await wait(page, 1500);
    const main = page.locator("#sponsor-main");
    const lines = (await main.innerText()).split("\n").filter(Boolean);
    console.log(`\n[${name}${tag}] order:`, lines.slice(0, 14).join(" / "));
    console.log(`[${name}${tag}] filled in main:`, await filledButtons(main));
    if (name === "sent") {
      // Every session row visible without scrolling sideways?
      const rows = await main.locator("table tbody th[scope=row]").allInnerTexts();
      console.log(`[sent${tag}] session rows:`, rows.join(" | "));
      const scroll = await main.locator("[role=region]").first().evaluate((el) => [el.scrollWidth, el.clientWidth]);
      console.log(`[sent${tag}] calendar scrollWidth/clientWidth:`, scroll.join("/"));
    }
    await shot(page, `portal-02-chats-home-${name}${tag}`);
    if (W < 600) {
      // Phones: the page scrolls inside the shell, so also shoot further down.
      const target = name === "sent" ? main.locator("table").first() : main.getByText(/Add a hacker/).first();
      await target.scrollIntoViewIfNeeded().catch(() => {});
      await wait(page, 300);
      await shot(page, `portal-02-chats-home-${name}${tag}-b`, { full: false });
    }
    console.log("errors:", page.errors.slice(0, 3));
    await page.context().close();
  }
}
await close();
