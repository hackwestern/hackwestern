// Organizer · Invite status and rounds (test organizer). Dry-run invites.
// Prints Test Sponsor's part of the status endpoint, then runs a round by hand
// and checks that re-running only fills seats not offered this round.
import { open, say, wait, close, BASE, USERS, sql } from "./lib-final.mjs";

const { page } = await open(1280, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 1500);
const status = async () => {
  const r = await page.evaluate(async () => (await fetch("/api/trpc/coffeeChatInvites.status")).json());
  return r?.result?.data?.json ?? r;
};
say("Status endpoint. EXPECT per sponsor/chat: seats, filled, accepted, open; each invite's status, round, source");
const s = await status();
const keys = Object.keys(s ?? {});
console.log("top-level keys:", keys.join(", "));
const sponsors = s.sponsors ?? s;
const ts = (Array.isArray(sponsors) ? sponsors : []).find((x) => /Test Sponsor/.test(JSON.stringify(x).slice(0, 200)));
console.log("Test Sponsor:", JSON.stringify(ts, null, 0)?.replace(/"userId":"[^"]+",?/g, "").slice(0, 1800));
const total = (Array.isArray(sponsors) ? sponsors : []).map((x) => `${x.name ?? x.sponsor}: ${JSON.stringify(x.totals ?? { seats: x.seats, filled: x.filled, accepted: x.accepted, open: x.open })}`);
console.log(total.join("\n"));
say("RUN ROUND NOW. EXPECT one invite per open seat (scanned, shortlist, interested); a hacker holds at most 2 live invites; dry-run");
const before = sql(`select count(*) from coffee_chat where placement_id is not null`).trim();
const r1 = await page.evaluate(async () => (await fetch("/api/trpc/coffeeChatInvites.runRoundNow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: {} }) })).json());
console.log("run 1:", JSON.stringify(r1).slice(0, 600));
const mid = sql(`select count(*) from coffee_chat where placement_id is not null`).trim();
const r2 = await page.evaluate(async () => (await fetch("/api/trpc/coffeeChatInvites.runRoundNow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: {} }) })).json());
console.log("run 2:", JSON.stringify(r2).slice(0, 400));
const after = sql(`select count(*) from coffee_chat where placement_id is not null`).trim();
console.log("invites:", before, "->", mid, "->", after);
console.log("max live per hacker:", sql(`select max(n) from (select user_id, count(*) n from coffee_chat where placement_id is not null and status in ('pending','accepted') group by 1) x`).trim());
console.log("by round/source:", sql(`select round, source, status, count(*) from coffee_chat where placement_id is not null group by 1,2,3 order by 1,2,3`).trim().replace(/\n/g, ", "));
say("Board row for a sent sponsor. EXPECT 'Invites: N accepted · N waiting · N open'");
await page.goto(`${BASE}/internal/sponsors?tab=coffee&sponsor=3d3e323d-e50e-4379-bc04-41d85870ef63`, { waitUntil: "networkidle" });
await wait(page, 3000);
console.log((await page.locator("main").innerText()).match(/Invites: .*/)?.[0] ?? "(no invites line)");
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
