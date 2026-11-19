// Sponsor · Scan a hacker (Test Sponsor), typed code path.
import { open, shot, text, wait, close, BASE, SPONSORS } from "./lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const say = (s) => console.log(`\n=== ${s}`);
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const go = () => page.goto(`${BASE}/sponsors/${SPONSORS.test}/scan`, { waitUntil: "networkidle", timeout: 120000 });
const lookup = async (code) => {
  const box = main.getByRole("textbox").first();
  await box.fill(code);
  await main.getByRole("button", { name: "Look up" }).click();
  await wait(page, 2000);
};

await go();
await wait(page, 1500);
say("EXPECT: non-hacker code -> 'That isn't a Hack Western hacker's badge.'");
await lookup("redesign-organizer-1");
await text(page, "#sponsor-main", 1500);
await shot(page, `05-sponsor-scan-not-a-hacker${tag}`, { full: false });

say("EXPECT: look up Alex (demo-otter-kite) -> profile + 'Which rep wants to talk to them?'");
await go();
await wait(page, 1200);
await lookup("demo-otter-kite");
await text(page, "#sponsor-main", 2500);
await shot(page, `05-sponsor-scan-found${tag}`);
console.log("buttons:", (await main.getByRole("button").allInnerTexts()).map((s) => s.replace(/\s+/g, " ")).join(" | "));
console.log("radios:", (await main.getByRole("radio").evaluateAll((r) => r.map((x) => x.getAttribute("aria-label") || x.parentElement?.innerText))).join(" | "));

say("Pick rep Walkthrough Kevin, then 'Add to Met at Hacker Fair'. EXPECT: 'Alex is on your Met at Hacker Fair list. We'll invite them first.'");
const kev = main.getByRole("radio", { name: /Kevin/ }).or(main.getByRole("button", { name: /Kevin/ })).or(main.getByLabel(/Kevin/)).first();
if (await kev.count()) await kev.click();
else console.log("no Kevin control");
await main.getByRole("button", { name: /Add to Met at Hacker Fair/ }).click();
await wait(page, 2000);
await text(page, "#sponsor-main", 2000);
await shot(page, `05-sponsor-scan-added${tag}`);

say("Second scan of Alex with 'Anyone'. EXPECT: first time kept; rep replaced");
await go();
await wait(page, 1200);
await lookup("demo-otter-kite");
await text(page, "#sponsor-main", 2000);
await shot(page, `05-sponsor-scan-again${tag}`);

say("Also scan Walkthrough Ada (walk-ada-test), Anyone");
await go();
await wait(page, 1200);
await lookup("walk-ada-test");
await main.getByRole("button", { name: /Add to Met at Hacker Fair/ }).click().catch((e) => console.log("add failed", e.message));
await wait(page, 1500);
console.log((await main.innerText()).split("\n").filter((l) => /list|invite/i.test(l)).join(" / "));

say("Chats home. EXPECT: '2 people you scanned'");
await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle" });
await wait(page, 1500);
await text(page, "#sponsor-main", 2000);
await shot(page, `05-sponsor-scan-chats-home${tag}`);
console.log("errors:", page.errors.slice(0, 5));
await close();
