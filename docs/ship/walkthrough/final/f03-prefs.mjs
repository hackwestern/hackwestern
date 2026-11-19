// Sponsor · Chatting preferences (step 2), Test Sponsor, then Sun Life's workshop row.
import { open, snap, read, say, wait, close, BASE, SPONSORS } from "./lib-final.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const live = async () => (await page.locator('[role="status"], [aria-live]').allInnerTexts()).map((s) => s.trim()).filter((s) => s && !/Hack Western$/.test(s)).join(" / ");
const grab = async (re) => ((await main.innerText()).match(re) || ["(none)"]).join(" ");

await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1200);
console.log("home status:", (await page.getByRole("region", { name: "Where things stand" }).innerText()).replace(/\s+/g, " "));
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle" });
await wait(page, 1500);
say("Step 2. EXPECT: new reps 4 chats, every open session ticked, headers 10–11 AM … 4–5 PM");
await read(main, 3500);
await snap(page, `f03-step2${tag}`, { full: true });

say("EXPECT: pick 3 -> 'Groups of 3 · 30 min · 6 hackers an hour per rep', 'Each chat: 1 rep + 3 hackers', Saving…/Saved.");
await main.getByRole("radio", { name: "3" }).click();
await wait(page, 300);
console.log("right after:", await live());
await wait(page, 1500);
console.log("after 1.5s:", await live());
console.log("format:", await grab(/.*(Groups of|1-on-1).*/), "|", await grab(/Each chat:.*/), "| totals:", await grab(/Up to \d+ chats.*/));

say("EXPECT: Kevin to 0 -> 'Doesn't chat', row greyed");
for (let i = 0; i < 6; i++) await main.getByRole("button", { name: "Fewer chats for Walkthrough Kevin" }).click().catch(() => {});
await wait(page, 1500);
console.log("Doesn't chat:", /Doesn't chat/.test(await main.innerText()), "| totals:", await grab(/Up to \d+ chats.*/));
await snap(page, `f03-kevin-zero${tag}`);

say("EXPECT: Dana unticks everything -> '…isn't free any time Saturday.' and 'No free time'");
const boxes = main.getByRole("checkbox", { name: /Walkthrough Dana, / });
const n = await boxes.count();
const names = await boxes.evaluateAll((b) => b.map((x) => x.getAttribute("aria-label") + ":" + x.getAttribute("aria-checked")));
console.log("Dana boxes:", names.join(" | "));
for (let i = 0; i < n; i++) if ((await boxes.nth(i).getAttribute("aria-checked")) === "true") await boxes.nth(i).click();
await wait(page, 1500);
console.log("msg:", await grab(/.*isn't free any time.*/), "| No free time:", /No free time/.test(await main.innerText()));
await snap(page, `f03-dana-not-free${tag}`);

say("EXPECT: Dana free 1–2 only, 4 chats, groups -> '…is free for 1 hour, so up to 2 chats.'");
await main.getByRole("checkbox", { name: /Walkthrough Dana, 1–2/ }).click();
await wait(page, 1500);
console.log("msg:", await grab(/.*so up to.*/));

say("Final state: Dana 1–2, 2–3, 3–4 (4 chats); Kevin 10–11..4–5 at 2 chats");
for (const s of ["2–3", "3–4"]) await main.getByRole("checkbox", { name: new RegExp(`Walkthrough Dana, ${s}`) }).click();
for (let i = 0; i < 2; i++) await main.getByRole("button", { name: "More chats for Walkthrough Kevin" }).click();
await wait(page, 2500);
console.log("live:", await live());
const before = await main.innerText();
say("EXPECT: reload keeps everything");
await page.reload({ waitUntil: "networkidle" });
await wait(page, 2000);
const after = await main.innerText();
const strip = (s) => s.replace(/Thu \d+:\d+ [AP]M/g, "").replace(/Saved\.|Saving…/g, "");
console.log("same after reload:", strip(before) === strip(after));
console.log("format:", await grab(/.*(Groups of|1-on-1).*/), "| totals:", await grab(/Up to \d+ chats.*/));
await snap(page, `f03-after-reload${tag}`, { full: true });
if (W === 390) console.log("scroll hint:", /Scroll for later times/.test(after));

say("EXPECT: 'Something doesn't fit? Ask an organizer' opens Help");
await main.getByRole("button", { name: /Ask an organizer/ }).click();
await wait(page, 1000);
console.log("dialog:", (await page.getByRole("dialog").innerText().catch(() => "none")).split("\n")[0]);
await page.keyboard.press("Escape");

say("Sun Life (submitted, read only look): workshop row + partial session");
await page.goto(`${BASE}/sponsors/${SPONSORS.sunlife}/coffee-chats?flow=prefs&step=2`, { waitUntil: "networkidle" });
await wait(page, 2000);
console.log("Your events:", await grab(/Your events[\s\S]{0,120}/), "| workshop:", await grab(/Your workshop.*/), "| partial:", await grab(/.*only\b.*/));
await snap(page, `f03-sunlife-workshop${tag}`);
console.log("errors:", page.errors.slice(0, 5));
await close();
