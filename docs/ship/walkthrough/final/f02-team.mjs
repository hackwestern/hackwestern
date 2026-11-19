// Sponsor · Your team (Test Sponsor, from "Not started"). Fake reps, 555 phones.
import { open, snap, read, say, wait, close, BASE, SPONSORS } from "./lib-final.mjs";
import { filledButtons } from "../after/portal-lib.mjs";

const W = Number(process.argv[2] || 1280);
const tag = W === 1280 ? "" : "-390";
const { page } = await open(W);
const main = page.locator("#sponsor-main");
const card = () => page.getByRole("region", { name: "Where things stand" });
const live = async () => (await page.locator('[role="status"], [role="alert"], [aria-live]').allInnerTexts()).map((s) => s.trim()).filter(Boolean).join(" / ");

await page.goto(`${BASE}/sponsors/${SPONSORS.test}/coffee-chats`, { waitUntil: "networkidle", timeout: 120000 });
await wait(page, 1500);
say("Chats home. EXPECT: status 'Not started'; 'Start' the only filled button; shortlist locked; 'Add a hacker' outline");
await read(main, 1500);
console.log("filled:", await filledButtons(main));
await snap(page, `f02-chats-home-not-started${tag}`);

say("EXPECT: Start -> step 1; status card 'Step 1 of 3: …'");
await main.getByRole("link", { name: /^Start/ }).or(main.getByRole("button", { name: /^Start/ })).first().click();
await wait(page, 1500);
console.log("url:", page.url());
console.log("status:", (await card().innerText().catch(() => "(no card)")).replace(/\s+/g, " "));

say("EXPECT: Next with no reps -> 'Add at least one rep to continue.'");
const next = main.getByRole("button", { name: /^Next/ }).or(main.getByRole("link", { name: /^Next/ })).first();
console.log("next label:", await next.innerText().catch(() => "(none)"));
await next.click().catch((e) => console.log("next click failed", e.message));
await wait(page, 800);
console.log("live:", await live());
console.log("text has msg:", /Add at least one rep to continue\./.test(await main.innerText()));

const name = main.getByLabel("Name", { exact: true }).first();
const phone = main.getByLabel("Phone", { exact: true }).first();
const save = main.getByRole("button", { name: "Save rep" });
if (!(await name.count())) await main.getByRole("button", { name: "Add rep" }).click();
say("EXPECT: blank Save -> both errors at once");
await save.click();
await wait(page, 600);
console.log("alerts:", (await main.getByRole("alert").allInnerTexts()).join(" | "));
console.log("main has errors:", (await main.innerText()).match(/.*(Add a name|name|phone).*(\.)/gi)?.slice(0, 4));
await snap(page, `f02-blank-save${tag}`);

say("EXPECT: short phone -> 'That phone number looks too short.'");
await name.fill("Walkthrough Dana");
await phone.fill("12345");
await save.click();
await wait(page, 700);
console.log("too short:", /That phone number looks too short\./.test(await main.innerText()));

say("EXPECT: add Dana -> 'Walkthrough Dana added.', crown 'Main contact'");
await phone.fill("519-555-0142");
await save.click();
await wait(page, 1500);
console.log("live:", await live());
say("EXPECT: add Kevin -> 'Walkthrough Kevin added.', Kevin shows 'Make main contact'");
await main.getByRole("button", { name: "Add rep" }).click();
await wait(page, 400);
await name.fill("Walkthrough Kevin");
await phone.fill("519-555-0143");
await save.click();
await wait(page, 1500);
console.log("live:", await live());
await read(main, 1500);
console.log("status:", (await card().innerText().catch(() => "(no card)")).replace(/\s+/g, " "));
await snap(page, `f02-two-reps${tag}`);

say("EXPECT: tap Kevin's crown -> 'Walkthrough Kevin is now the main contact.'");
const labels = await main.locator("button[aria-label]").evaluateAll((b) => b.map((x) => x.getAttribute("aria-label")));
console.log("aria labels:", labels.join(" | "));
await main.getByRole("button", { name: /Make Walkthrough Kevin.*main contact|main contact.*Kevin/i }).first().click();
await wait(page, 1500);
console.log("live:", await live());
await snap(page, `f02-crown-moved${tag}`);

say("EXPECT: edit Dana's phone -> saved");
await main.getByRole("button", { name: /Edit Walkthrough Dana/ }).click();
await wait(page, 600);
await main.getByLabel("Phone", { exact: true }).last().fill("519-555-0144");
await main.getByRole("button", { name: /^Save/ }).last().click();
await wait(page, 1500);
console.log("live:", await live(), "| phone shown:", /519-555-0144|\(519\) 555-0144/.test(await main.innerText()));

say("EXPECT: remove Kevin (main contact) -> 'Walkthrough Kevin removed. Undo', crown to Dana");
await main.getByRole("button", { name: /Remove Walkthrough Kevin/ }).click();
await wait(page, 1200);
console.log("dialogs:", await page.getByRole("dialog").count(), "| removed msg:", (await main.innerText()).match(/.*removed\..*/)?.[0]);
console.log("Dana main contact:", /Walkthrough Dana[\s\S]{0,80}Main contact/.test(await main.innerText()));
await snap(page, `f02-removed-undo${tag}`);
say("EXPECT: Undo -> Kevin back with crown");
await main.getByRole("button", { name: /Undo/ }).first().click();
await wait(page, 1800);
const t = await main.innerText();
console.log("Kevin back:", /Walkthrough Kevin/.test(t), "| Kevin main:", /Walkthrough Kevin[\s\S]{0,80}Main contact/.test(t), "| live:", await live());
say("Move crown back to Dana for the rest of the walk");
await main.getByRole("button", { name: /Make Walkthrough Dana.*main contact|main contact.*Dana/i }).first().click().catch(() => console.log("no Dana crown button"));
await wait(page, 1200);
await read(main, 1200);
console.log("next label:", await main.getByRole("button", { name: /^Next/ }).or(main.getByRole("link", { name: /^Next/ })).first().innerText());
await snap(page, `f02-final${tag}`);
console.log("errors:", page.errors.slice(0, 5));
await close();
