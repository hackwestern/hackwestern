// Sponsor · Chatting preferences (step 2). Test Sponsor first, then a look at
// Sun Life's workshop-blocked session.
import { open, shot, text, wait, close, BASE, SPONSORS, sql } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const log = W === 1280;
const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const status = async () =>
  console.log("live:", (await page.locator('[role="status"], [aria-live]').allInnerTexts()).filter(Boolean).join(" / "));

await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=1`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1200);
await main.getByText(/^Next: Chatting preferences/).first().click();
await wait(page, 1500);
say("Step 2 opened");
if (log) await text(page, "#sponsor-main", 5000);
await shot(page, `03-sponsor-prefs-step2${tag}`);
const controls = await main.locator("button, input, [role=radio], [role=checkbox], [role=switch]").evaluateAll((els) =>
  els.map((e) => `${e.tagName}:${e.getAttribute("role") || e.type || ""}:${(e.getAttribute("aria-label") || e.innerText || e.value || "").replace(/\s+/g, " ").slice(0, 60)}:${e.getAttribute("aria-checked") ?? e.getAttribute("aria-pressed") ?? (e.checked ?? "")}${e.disabled ? ":disabled" : ""}`),
);
if (log) console.log("controls:\n" + controls.join("\n"));
// (first context left open)

// --- Actions (run again so close() above doesn't matter: reopen) ---
const r = await open(W);
const p2 = r.page;
const m2 = p2.locator("#sponsor-main");
const grab = async (re) => ((await m2.innerText()).match(re) || ["(none)"]).join(" ");
const live = async () =>
  (await p2.locator('[role="status"], [aria-live]').allInnerTexts()).filter((s) => s && !/Hack Western$/.test(s)).join(" / ");
await p2.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle", timeout: 120000 });
await wait(p2, 1500);

say("EXPECT: pick 3 -> 'Groups of 3 · 30 min · 6 hackers an hour per rep', then Saving…/Saved.");
await m2.getByRole("radio", { name: "3" }).click();
await wait(p2, 300);
console.log("right after:", await live());
await wait(p2, 1500);
console.log("after 1.5s:", await live());
console.log("format line:", await grab(/.*(Groups of|1-on-1).*/));
console.log("totals:", await grab(/Up to \d+ chats.*/));
await shot(p2, `03-sponsor-prefs-groups-of-3${tag}`, { full: false });

say("EXPECT: untick Dana 10–11 and 11–12 -> '4 of 6 sessions', saves");
await m2.getByRole("checkbox", { name: /Walkthrough Dana, 10–11/ }).click();
await m2.getByRole("checkbox", { name: /Walkthrough Dana, 11–12/ }).click();
await wait(p2, 2000);
console.log("live:", await live());
console.log("Dana:", await grab(/Walkthrough Dana\n\d of \d sessions/));

say("EXPECT: Kevin down to 0 -> 'Doesn't chat'");
for (let i = 0; i < 6; i++) await m2.getByRole("button", { name: "Fewer chats for Walkthrough Kevin" }).click().catch(() => {});
await wait(p2, 1500);
console.log("Kevin row:", await grab(/Walkthrough Kevin\n.*\n.*/));
console.log("totals:", await grab(/Up to \d+ chats.*/));
await shot(p2, `03-sponsor-prefs-kevin-zero${tag}`);

say("EXPECT edge: Dana unticks everything -> '…isn't free any time Saturday.'");
for (const s of ["1–2", "2–3", "3–4", "4–5"]) await m2.getByRole("checkbox", { name: new RegExp(`Walkthrough Dana, ${s}`) }).click();
await wait(p2, 1500);
console.log("msg:", await grab(/.*isn't free.*/));
await shot(p2, `03-sponsor-prefs-dana-not-free${tag}`);

say("EXPECT edge: Dana free only 1–2 with 4 chats (groups, 2/hour) -> '…is free for 1 hour, so up to 2 chats.'");
await m2.getByRole("checkbox", { name: /Walkthrough Dana, 1–2/ }).click();
await wait(p2, 1500);
console.log("msg:", await grab(/.*so up to.*/));
await shot(p2, `03-sponsor-prefs-too-many-chats${tag}`);

say("Set a sensible final state: Dana free 1–2, 2–3, 3–4; 4 chats. Kevin back to 2 chats.");
for (const s of ["2–3", "3–4"]) await m2.getByRole("checkbox", { name: new RegExp(`Walkthrough Dana, ${s}`) }).click();
for (let i = 0; i < 2; i++) await m2.getByRole("button", { name: "More chats for Walkthrough Kevin" }).click();
await wait(p2, 2500);
console.log("live:", await live());
const before = await m2.innerText();

say("EXPECT: reload keeps everything");
await p2.reload({ waitUntil: "networkidle" });
await wait(p2, 2000);
const after = await m2.innerText();
const strip = (s) => s.replace(/Thu \d+:\d+ [AP]M/g, "").replace(/Saved\.|Saving…/g, "");
console.log("same after reload:", strip(before) === strip(after));
if (strip(before) !== strip(after)) console.log("AFTER:\n" + after.slice(0, 2500));
console.log("format:", await grab(/.*(Groups of|1-on-1).*/), "| totals:", await grab(/Up to \d+ chats.*/));
await shot(p2, `03-sponsor-prefs-after-reload${tag}`);

say("Contact organizers opens Help");
await m2.getByRole("button", { name: "Contact organizers" }).click();
await wait(p2, 1000);
console.log("dialog:", (await p2.getByRole("dialog").innerText().catch(() => "none")).split("\n")[0]);
console.log("errors:", p2.errors.slice(0, 5));
// (first context left open)
await close();
