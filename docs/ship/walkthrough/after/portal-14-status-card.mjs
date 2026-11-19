// Sponsor · Your chats · status card after Send, after the fix: live invite
// counts, and only organizers' changes in "Last change", including a move.
// Read-only: the "move" is staged by telling this device it last saw Dana's
// 3–4 chat at 1–2 in Rm 2242 (the device memory that "Last change" reads).
// Usage: BASE=http://localhost:3061 node docs/ship/walkthrough/after/portal-14-status-card.mjs
import { open, shot, wait, close, BASE, SPONSORS, sql } from "./portal-lib.mjs";

const rows = sql(
  `select p.id, p.rep_id, p.session_id, p.room from coffee_chat_placement p join coffee_chat_rep r on r.id = p.rep_id where r.sponsor_id = '${SPONSORS.test}' and p.status = 'sent' order by p.session_id;`,
)
  .trim()
  .split("\n")
  .map((l) => l.split("|"));
const seen = Object.fromEntries(
  rows.map(([id, repId, sessionId, room]) => [id, { repId, sessionId, room, start: `${sessionId}:00` }]),
);
// Pretend the last 3–4 chat used to be at 1–2 in Rm 2242.
const last = rows.at(-1)[0];
seen[last] = { ...seen[last], sessionId: "13", room: "2242", start: "13:00" };

for (const W of [1280, 390]) {
  const tag = W === 1280 ? "" : "-390";
  const { page, context } = await open(W);
  await context.addInitScript(
    ([key, value, seenKey]) => {
      if (!sessionStorage.getItem("staged")) {
        localStorage.setItem(key, value);
        // Last visit before Send, so the move and the Send are both "since".
        localStorage.setItem(seenKey, "2026-11-19T12:00:00.000Z");
        sessionStorage.setItem("staged", "1");
      }
    },
    [`hw-coffee-chats-seen:${SPONSORS.test}`, JSON.stringify({ chats: seen, notes: [] }), `hw-coffee-setup-seen:${SPONSORS.test}`],
  );
  await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
  await wait(page, 1500);
  const card = page.getByRole("region", { name: "Where things stand" });
  console.log("first look:", (await card.innerText()).replace(/\s+/g, " "));
  await shot(page, `portal-14-status-card${tag}`, { full: false });
  // Back later: the move stays as the last change.
  await page.reload({ waitUntil: "networkidle" });
  await wait(page, 1500);
  console.log("reload:", (await card.innerText()).replace(/\s+/g, " "));
  console.log("errors:", page.errors.slice(0, 3));
  await context.close();
}
await close();
