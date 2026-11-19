// Track F check: drives the sponsor Judging page on a running dev server and
// screenshots it at 1280 and 390 px. Needs submitted teams in the DB and a
// prize track sponsor with reps. From the worktree root:
//   node docs/handoff/build-f-check.mjs http://localhost:3036 <sponsor-uuid>
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { execSync } from "node:child_process";

const [base = "http://localhost:3036", sponsor] = process.argv.slice(2);
if (!sponsor) throw new Error("Pass the sponsor uuid");
const out = path.resolve("docs/handoff/build-f-screens");
fs.mkdirSync(out, { recursive: true });
const url = `${base}/sponsors/${sponsor}/picks`;
const results = [];
const check = (name, ok, detail = "") => {
  results.push(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` (${detail})` : ""}`);
};

const browser = await chromium.launch();
// Each run starts with no scores for this sponsor (local DB container).
const resetScores = () =>
  execSync(
    `docker exec hackwestern_db psql -U postgres -d hackwestern_spon -c "delete from sponsor_team_score where sponsor_id = '${sponsor}'; update sponsor_team_review set score = null where sponsor_id = '${sponsor}';"`,
  );

async function run(width, height, tag) {
  resetScores();
  const page = await browser.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto(url, { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });
  const shot = (n) =>
    page.screenshot({ path: path.join(out, `${tag}-${n}.png`), fullPage: true });

  await page.getByRole("heading", { name: "Who's judging?" }).waitFor();
  check(`${tag}: Who's judging? shows first`, true);
  await shot("01-whos-judging");
  await page.getByRole("button", { name: "Dana W." }).click();
  await page.getByText("Judging as").waitFor();
  check(`${tag}: picking a rep shows Judging as`, true);

  const strip = page.getByRole("slider").first();
  check(
    `${tag}: score starts untouched`,
    (await strip.getAttribute("aria-valuetext")) === "Not scored yet",
  );
  await page.getByRole("button", { name: /^Raise your score/ }).first().click();
  await page.waitForTimeout(300);
  check(
    `${tag}: + from untouched gives 5.5`,
    (await strip.getAttribute("aria-valuetext")) === "5.5 out of 10",
  );
  await strip.focus();
  await page.keyboard.press("End");
  await page.waitForTimeout(300);
  await page.keyboard.press("ArrowLeft");
  await page.waitForTimeout(300);
  check(
    `${tag}: End then ← gives 9.5`,
    (await strip.getAttribute("aria-valuetext")) === "9.5 out of 10",
  );
  await page.waitForTimeout(800);
  await shot("02-one-at-a-time-scored");

  await page.getByRole("button", { name: /^Open the rubric/ }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();
  const crit = await dialog.getByRole("heading", { level: 3 }).allTextContents();
  check(`${tag}: rubric has 4 criteria`, crit.length === 4, crit.join(", "));
  await shot("03-rubric");
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  const focused = await page.evaluate(
    () => document.activeElement?.getAttribute("aria-label") ?? "",
  );
  check(`${tag}: Esc returns focus to Rubric`, focused.startsWith("Open the rubric"), focused);

  // A second rep scores the same team 4 points lower: disagreement flag.
  await page.getByRole("button", { name: "Switch who's judging on this phone" }).click();
  await page.getByRole("button", { name: "Kevin T." }).click();
  await page.getByRole("button", { name: /^Everyone's/ }).click();
  const strip2 = page.getByRole("slider").first();
  await strip2.focus();
  await page.keyboard.press("Home");
  await page.waitForTimeout(200);
  for (let i = 0; i < 10; i++) await page.keyboard.press("ArrowRight");
  await page.waitForTimeout(1200);
  check(
    `${tag}: second rep's score is 6`,
    (await strip2.getAttribute("aria-valuetext")) === "6 out of 10",
  );
  const flag = await page.getByText(/talk it through/).first().textContent();
  check(`${tag}: disagreement flag`, Boolean(flag), flag ?? "");
  const avg = await page.getByText(/^avg /).first().textContent().catch(() => "");
  check(`${tag}: team average shown`, avg === "avg 7.8", avg ?? "");
  await shot("04-two-reps-disagree");

  await page.getByRole("button", { name: "List", exact: true }).click();
  const cards = await page.locator("article").count();
  check(`${tag}: list shows every project`, cards >= 6, String(cards));
  await shot("05-list");
  await page.getByRole("button", { name: "One at a time", exact: true }).click();

  await page.getByRole("tab", { name: /Your shortlist/ }).click();
  await shot("06-shortlist");

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth,
  );
  check(`${tag}: no sideways page scroll`, overflow <= 0, String(overflow));
  // Reload: the name is remembered on this phone.
  await page.reload({ waitUntil: "networkidle" });
  await page.getByText("Judging as").waitFor();
  check(`${tag}: rep name remembered after reload`, true);
  check(`${tag}: no page errors`, errors.length === 0, errors.join(" | "));
  await page.close();
}

await run(1280, 800, "1280");
await run(390, 844, "390");
await browser.close();
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
