// Sponsor · Your team (Test Sponsor, from "Not started").
// Adds fake reps "Walkthrough Dana" / "Walkthrough Kevin" (555 phones).
import { open, shot, text, wait, close, BASE, SPONSORS, sql } from "./lib.mjs";

// Start from "Not started" every run.
sql(`delete from coffee_chat_rep where sponsor_id='${SPONSORS.test}'; delete from coffee_chat_pref where sponsor_id='${SPONSORS.test}';`);

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W);
const say = (s) => console.log(`\n=== ${s}`);
const main = page.locator("#sponsor-main");
const status = async () =>
  console.log("live/status text:", (await page.locator('[role="status"], [aria-live]').allInnerTexts()).filter(Boolean).join(" / "));
const btns = async () =>
  console.log("buttons:", (await main.getByRole("button").evaluateAll((b) => b.map((x) => (x.getAttribute("aria-label") || x.innerText).replace(/\s+/g, " ")))).join(" | "));

await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats?flow=prefs&step=1`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
const name = main.getByLabel("Name", { exact: true }).first();
const phone = main.getByLabel("Phone", { exact: true }).first();
const save = main.getByRole("button", { name: "Save rep" });

say("EXPECT: Save with blank name/phone -> an error, nothing saved");
await save.click();
await wait(page, 800);
await text(page, "#sponsor-main", 1500);
await status();
await shot(page, `02-sponsor-team-blank-save${tag}`, { full: false });

say("EXPECT: short phone -> 'That phone number looks too short.'");
await name.fill("Walkthrough Dana");
await phone.fill("12345");
await save.click();
await wait(page, 1000);
await status();
console.log((await main.innerText()).match(/.*too short.*/)?.[0] ?? "NO too-short message");
await shot(page, `02-sponsor-team-short-phone${tag}`, { full: false });

say("EXPECT: add Dana -> 'Walkthrough Dana added.' and she gets the crown");
await phone.fill("519-555-0142");
await save.click();
await wait(page, 1500);
await status();
await shot(page, `02-sponsor-team-added-first${tag}`);
say("EXPECT: add Kevin -> 'Walkthrough Kevin added.', crown stays on Dana");
await btns();
await main.getByRole("button", { name: "Add rep" }).click();
await wait(page, 500);
await name.fill("Walkthrough Kevin");
await phone.fill("519-555-0143");
await save.click();
await wait(page, 1500);
await status();
await btns();
await text(page, "#sponsor-main", 2500);

await shot(page, `02-sponsor-team-two-reps-dana-primary${tag}`, { full: false });
say("EXPECT: tap Kevin's crown -> 'Walkthrough Kevin is now the primary contact.'");
const crown = main.getByRole("button", { name: /Kevin/ }).filter({ hasNot: page.getByText("Edit") });
const crownBtn = main.locator("button[aria-label*='primary' i]").filter({ hasText: "" });
const labels = await main.locator("button[aria-label]").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
console.log("aria labels:", labels.join(" | "));
const kCrown = main.locator("button[aria-label*='Kevin' i][aria-label*='primary' i]").or(main.locator("li, [data-rep]").filter({ hasText: "Kevin" }).getByRole("button", { name: /primary|crown/i })).first();
if (await kCrown.count()) {
  await kCrown.click();
  await wait(page, 1500);
  await status();
} else console.log("BUG? no crown button for Kevin found");
await shot(page, `02-sponsor-team-crown-moved${tag}`);

say("EXPECT: Edit Dana's phone -> saved");
const edit = main.locator("button[aria-label*='Edit' i][aria-label*='Dana' i]").first();
if (await edit.count()) {
  await edit.click();
  await wait(page, 800);
  await shot(page, `02-sponsor-team-edit-open${tag}`, { full: false });
  await btns();
  const ph = main.locator("input[type=tel], input[name*=phone i]");
  console.log("phone inputs:", await ph.count());
  await ph.last().fill("519-555-0144");
  await main.getByRole("button", { name: /^Save/ }).last().click();
  await wait(page, 1500);
  await status();
} else console.log("no Edit button for Dana");

say("EXPECT: remove Kevin (the primary) -> crown moves to Dana");
const rm = main.locator("button[aria-label*='Remove' i][aria-label*='Kevin' i]").first();
if (await rm.count()) {
  await rm.click();
  await wait(page, 800);
  await shot(page, `02-sponsor-team-remove-confirm${tag}`, { full: false });
  await btns();
  console.log("dialog after Remove:", await page.getByRole("dialog").count(), "| undo button:", await page.getByRole("button", { name: /undo/i }).count());
  await wait(page, 1500);
  await status();
} else console.log("no Remove button for Kevin");
await text(page, "#sponsor-main", 2500);
await shot(page, `02-sponsor-team-after-remove${tag}`);

say("Add Kevin back so there are two reps");
await main.getByRole("button", { name: "Add rep" }).click();
await wait(page, 500);
await name.fill("Walkthrough Kevin");
await phone.fill("519-555-0143");
await save.click();
await wait(page, 1500);
await status();
await shot(page, `02-sponsor-team-two-reps${tag}`);
console.log("errors:", page.errors.slice(0, 5));
await close();
