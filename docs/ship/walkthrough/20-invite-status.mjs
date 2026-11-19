// Organizer · Invite status and rounds, then the sponsor's view after answers.
// EXPECT status endpoint: per sponsor/chat seats, filled, accepted, open + each
// invite's status, round and source. runRoundNow fills only unoffered seats.
import { open, shot, wait, close, BASE, USERS, SPONSORS, text } from "./lib.mjs";

const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(1280, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=coffee`, { waitUntil: "networkidle", timeout: 120000 });
say("status endpoint");
const status = await page.evaluate(async () => (await fetch("/api/trpc/coffeeChatInvites.status")).json());
const data = status?.result?.data?.json ?? status;
const s = JSON.stringify(data);
console.log("top keys:", Object.keys(data || {}).join(", "));
const ts = (Array.isArray(data) ? data : data.sponsors || []).find?.((x) => /Test Sponsor/.test(JSON.stringify(x).slice(0, 200)));
console.log("Test Sponsor entry:", JSON.stringify(ts ?? s.slice(0, 600)).slice(0, 1500));
say("runRoundNow. EXPECT only unoffered seats; dry mode saves, sends nothing");
const run = await page.evaluate(async () => (await fetch("/api/trpc/coffeeChatInvites.runRoundNow", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ json: {} }) })).json());
console.log("runRoundNow:", JSON.stringify(run).slice(0, 600));
await page.context().close();

say("Sponsor fresh view. EXPECT 'Scheduled, 1 of N seats accepted' and 'Confirmed' next to Alex");
const r = await open(1280);
await r.page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
await wait(r.page, 2000);
const t = await r.page.locator("#sponsor-main").innerText();
console.log(t.split(String.fromCharCode(10)).filter((l) => /Scheduled|accepted|Confirmed|Alex|LAST CHANGE|SINCE|hacker/i.test(l)).slice(0, 14).join(" / "));
await shot(r.page, "20-sponsor-yourchats-after-answers");
await close();
