// Sponsor side, the review's other "unclear" entries, after the fixes.
// Read-only: Test Sponsor's setup is patched in the browser to look
// unsubmitted where needed, and every write is answered in the browser.
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-07-other-fixes.mjs
import { open, shot, wait, close, BASE, SPONSORS } from "./portal-lib.mjs";

const T = SPONSORS.test;
const url = (q) => `${BASE}/sponsors/${T}/coffee-chats${q}`;

/** Patch coffeeChatSetup.get; `fn` edits the decoded json in place. */
async function patchSetup(page, fn) {
  await page.route(/\/api\/trpc\/.*coffeeChatSetup\.get/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()).split(",");
    names.forEach((n, i) => {
      const data = body[i]?.result?.data;
      if (n !== "coffeeChatSetup.get" || !data?.json) return;
      fn(data.json);
      for (const k of ["submittedAt", "sentAt"]) {
        if (data.json[k] === null && data.meta?.values) delete data.meta.values[k];
      }
    });
    await route.fulfill({ response: res, json: body });
  });
}
const draft = (j) => Object.assign(j, { confirmed: false, chats: [], sentAt: null, submittedAt: null, editedAfterSend: false });
/** Answer every setup write in the browser (nothing reaches the DB). */
async function fakeWrites(page) {
  await page.route(/\/api\/trpc\/.*coffeeChatSetup\.(addRep|removeRep|savePrefs|setPrimary|updateRep)/, (route) => {
    const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()).split(",");
    const json = names.map((n) =>
      n.endsWith("addRep")
        ? { result: { data: { json: { id: "00000000-0000-4000-8000-000000000001", isPrimary: false } } } }
        : { result: { data: { json: { ok: true, skipped: 0, primaryId: null } } } },
    );
    return route.fulfill({ json });
  });
}

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  let { page, context } = await open(W);
  const main = () => page.locator("#sponsor-main");

  // Team · Step 2: status card says the step; both field errors at once.
  await patchSetup(page, draft);
  await fakeWrites(page);
  await page.goto(url("?flow=prefs&step=1"), { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const card = page.getByRole("region", { name: "Where things stand" });
  console.log(`[team${tag}] status:`, (await card.innerText()).replace(/\s+/g, " "));
  console.log(`[team${tag}] main landmarks:`, await page.locator("main, [role=main]").count());
  await main().getByRole("button", { name: "Add rep" }).click();
  await main().getByRole("button", { name: "Save rep" }).click();
  await wait(page, 300);
  console.log(`[team${tag}] blank save:`, (await main().getByRole("alert").first().innerText()).replace(/\s+/g, " "));
  await shot(page, `portal-07-team-both-errors${tag}`, { full: false });
  await main().getByRole("button", { name: "Cancel" }).click();
  // Team · Step 3: Remove, then Undo (writes answered in the browser).
  await main().getByRole("button", { name: /Remove Walkthrough Kevin/ }).click();
  await wait(page, 800);
  console.log(`[team${tag}] after remove:`, (await main().getByText(/removed\./).first().innerText().catch(() => "(none)")));
  await shot(page, `portal-07-team-undo${tag}`, { full: false });
  await main().getByRole("button", { name: /Undo removing/ }).click();
  await wait(page, 800);
  console.log(`[team${tag}] undo gone:`, (await main().getByRole("button", { name: /Undo removing/ }).count()) === 0);

  // Preferences: 0-chats row greyed, "No free time", legend only when hatched.
  await context.close();
  ({ page, context } = await open(W));
  await patchSetup(page, (j) => {
    draft(j);
    j.reps[0].free = [];
    if (j.reps[1]) j.reps[1].chatsWanted = 0;
  });
  await fakeWrites(page);
  await page.goto(url("?flow=prefs&step=2"), { waitUntil: "networkidle" });
  await wait(page, 1500);
  const prefs = main().locator("section[aria-labelledby=prefs-heading]");
  const t = (await prefs.innerText()).replace(/\s+/g, " ");
  console.log(`[prefs${tag}] doesn't chat / no free time / legend:`, /Doesn't chat/.test(t), /No free time/.test(t), /travel time either side/.test(t));
  await main().getByRole("table").first().scrollIntoViewIfNeeded();
  await shot(page, `portal-07-prefs-zero-chats${tag}`, { full: false });

  // Review: plain ticks, call line as body text.
  await page.goto(url("?flow=prefs&step=3"), { waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log(`[review${tag}] checkbox-looking cells in review grid:`, await main().locator("table [role=checkbox]").count());
  await main().getByText(/Organizers call/).scrollIntoViewIfNeeded();
  await shot(page, `portal-07-review${tag}`, { full: false });
  await context.close();

  // Shortlist · Step 2: submitted says editing un-submits; no Remove buttons.
  ({ page, context } = await open(W));
  await page.goto(url("?flow=shortlist&step=2"), { waitUntil: "networkidle" });
  await wait(page, 1500);
  const sl = (await main().innerText()).replace(/\s+/g, " ");
  console.log(`[shortlist${tag}] banner:`, sl.match(/Your shortlist is submitted[^.]*\.[^.]*\./)?.[0]);
  console.log(`[shortlist${tag}] Remove buttons:`, await main().getByRole("button", { name: /^Remove / }).count());
  await shot(page, `portal-07-shortlist-submitted${tag}`, { full: false });
  await context.close();

  // Judging before Sunday: the page says when it opens, like the nav.
  ({ page, context } = await open(W));
  await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/picks`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log(`[judging${tag}]`, (await main().innerText()).split("\n").filter(Boolean).slice(0, 3).join(" / "));
  await shot(page, `portal-07-judging-locked${tag}`, { full: false });
  await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/picks?preview=judging`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log(`[judging preview${tag}]`, (await main().innerText()).split("\n").filter(Boolean).slice(0, 2).join(" / "));
  console.log("errors:", page.errors.slice(0, 3));
  await context.close();
}
await close();
