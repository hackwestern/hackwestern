// Organizer · Judging tab · PCBWay digital top 3: a link that matches nothing,
// then a team ID that doesn't exist. Nothing is saved.
import { open, say, wait, close, BASE, USERS, clean, FINAL } from "./lib-final.mjs";
import path from "node:path";

const { page } = await open(1280, USERS.organizer);
await page.goto(`${BASE}/internal/sponsors?tab=judging`, { waitUntil: "networkidle", timeout: 180000 });
await wait(page, 2500);
const nt = page.getByRole("button", { name: "No thanks" });
if (await nt.count()) await nt.first().click();
const first = page.getByLabel(/1st place/).first();
console.log("1st place input:", await first.count());
say("Paste a Devpost link that matches nothing. EXPECT '…doesn't match a submitted team…', Save off");
await first.fill("https://devpost.com/software/not-a-real-walkthrough-team");
await first.blur();
await wait(page, 2000);
const sec = page.locator("section, div").filter({ has: page.getByText("Digital sponsors", { exact: true }) }).filter({ has: first }).last();
console.log(clean(await sec.innerText()).split("\n").filter((l) => /match|team ID|place|Save/i.test(l)).slice(0, 8).join(" / "));
console.log("Save disabled:", await page.getByRole("button", { name: "Save top 3" }).isDisabled());
await sec.screenshot({ path: path.join(FINAL, "f16-organizer-pcbway-nomatch.png") });
console.log("[shot] f16-organizer-pcbway-nomatch");
await first.fill("");
console.log("errors:", page.errors.filter((e) => !/%c/.test(e)).slice(0, 5));
await close();
