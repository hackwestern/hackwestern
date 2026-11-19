// Sponsor · Shortlist · over the cap, after the B5 fix. The shared DB isn't
// changed: the shortlist query's answer is patched in the browser to "3
// shortlisted, room for 1" (the review's case).
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-06-shortlist-over-cap.mjs
import { open, shot, text, wait, close, BASE, SPONSORS } from "./portal-lib.mjs";

/** Patch sponsorShortlist.list in a (batched) tRPC response. */
async function overCap(page) {
  await page.route(/\/api\/trpc\/.*sponsorShortlist\.list/, async (route) => {
    const res = await route.fetch();
    const body = await res.json();
    const names = decodeURIComponent(new URL(route.request().url()).pathname.split("/").pop()).split(",");
    names.forEach((n, i) => {
      if (n !== "sponsorShortlist.list") return;
      const d = body[i]?.result?.data?.json;
      if (!d) return;
      let k = 0;
      d.hackers = d.hackers.map((h) => ({ ...h, shortlisted: k++ < 3 }));
      d.picked = 3;
      d.seats = d.scanned.length + 1;
      d.maxShortlist = 1;
      d.submittedAt = null;
    });
    await route.fulfill({ response: res, json: body });
  });
}

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page } = await open(W);
  await overCap(page);
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=shortlist&step=1`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const t = await text(page, "#sponsor-main", 1400);
  console.log("'3 of 1' shown:", /3 of 1/.test(t), "| 'seats are shortlisted' shown:", /seats are shortlisted/.test(t));
  await shot(page, `portal-06-shortlist-over-cap${tag}`, { full: false });
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle" });
  await wait(page, 1500);
  const home = await page.locator("#sponsor-main").innerText();
  console.log("home shortlist line:", home.split("\n").filter((l) => /shortlist/i.test(l)).join(" / "));
  console.log("errors:", page.errors.slice(0, 5));
}
await close();
