// Screenshots for T47: the organizer run of show as an hourly grid (with the
// Team tasks column), the sponsor grid, the details panel, and a
// keyboard-focused block. Run against the dev server on :3025 backed by
// hackwestern_sd_sched2, after seed.mjs. The run-of-show sheet isn't
// reachable locally, so the tRPC reads and /api/schedule are stubbed with
// fixtures. Clock: Saturday 10:40 AM Eastern.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3025";
const NOW = new Date("2026-11-21T10:40:00-05:00");
const SPONSOR = "11111111-1111-4111-8111-111111111111";
const login = JSON.parse(fs.readFileSync("_local/organizer-login.json", "utf8"));

const item = (day, start, end, column, title, location = null, sponsors = []) => ({
  id: `${day}-${start}-${column}-${title}`, day, start, end, column, title, location, sponsors,
});
const items = [
  item("Friday", "17:00", "18:30", "big-event", "Check-in and registration", "SM Atrium"),
  item("Friday", "18:30", "19:30", "food", "Dinner", "SM Atrium"),
  item("Friday", "19:30", "20:30", "big-event", "Opening Ceremony", "Alumni Hall"),
  item("Friday", "20:30", "21:00", "big-event", "Team formation mixer", "SM Atrium"),
  item("Friday", "21:00", "21:30", "sponsor-workshop", "StarTech Workshop: Shipping a Hackathon API in 30 Minutes", "StarTech: Rm 2110, Sun Life: Rm 2230", ["StarTech", "Sun Life"]),
  item("Friday", "20:30", "23:00", "spon-booth", "Sponsor Bay", "SM Atrium"),
  item("Saturday", "08:00", "09:30", "food", "Breakfast", "SM Atrium"),
  item("Saturday", "09:30", "10:00", "big-event", "Hacking check-in and announcements", "Alumni Hall"),
  item("Saturday", "10:00", "11:00", "sponsor-workshop", "StarTech Workshop: Building accessible dashboards with real-time data", "Rm 2110", ["StarTech"]),
  item("Saturday", "10:30", "11:00", "sponsor-workshop", "Sun Life Lightning Talk: Fintech careers", "Rm 2230", ["Sun Life"]),
  item("Saturday", "10:00", "16:00", "spon-booth", "Sponsor Bay", "SM Atrium"),
  item("Saturday", "10:30", "12:00", "coffee-chats", "StarTech coffee chats", "Rm 2241", ["StarTech"]),
  item("Saturday", "12:00", "13:00", "food", "Lunch", "SM Atrium"),
  item("Saturday", "13:00", "13:30", "sponsor-workshop", "Northwind Robotics: Intro to ROS", "Rm 2245", ["Northwind Robotics"]),
];
const tasks = [
  { day: "Friday", start: "16:30", task: "Set up registration tables and badge printers", owner: "Ana" },
  { day: "Friday", start: "19:00", task: "AV check in Alumni Hall", owner: "Ben" },
  { day: "Friday", start: "19:00", task: "Seat sponsors in the front row", owner: null },
  { day: "Friday", start: "21:00", task: "Move tables for StarTech workshop", owner: "Chris" },
  { day: "Saturday", start: "08:00", task: "Breakfast setup with catering", owner: "Dana" },
  { day: "Saturday", start: "09:45", task: "Open sponsor bay, hand out sponsor wifi codes", owner: "Ana" },
  { day: "Saturday", start: "10:00", task: "Room check: Rm 2110 projector", owner: "Ben" },
  { day: "Saturday", start: "10:00", task: "Greet StarTech reps", owner: null },
  { day: "Saturday", start: "12:00", task: "Lunch lines", owner: "Dana" },
];
const workshops = [
  { title: "StarTech Workshop: Building accessible dashboards with real-time data", sponsor: "StarTech", runners: ["Priya Shah", "Leo Park"], day: "Saturday", start: "10:00", room: "Rm 2110", description: "Build a live dashboard that works with a keyboard and a screen reader, using a public transit feed. Bring a laptop with Node 20." },
  { title: "Northwind Robotics: Intro to ROS", sponsor: "Northwind Robotics", runners: [], day: "Saturday", start: "13:00", room: "Rm 2245", description: null },
];
const readAt = new Date("2026-11-21T10:39:00-05:00").toISOString();
const organizer = () => ({ readAt, sheetUrl: "https://docs.google.com/spreadsheets/d/example", items, tasks, coffeeChats: [], ceremonies: [], workshops });
const sponsorView = () => ({
  sponsorName: "StarTech",
  readAt,
  items: items.filter((i) => i.sponsors.includes("StarTech") || ["big-event", "food", "spon-booth"].includes(i.column)),
  coffeeChat: null,
  ceremonies: [],
  workshops: workshops.filter((w) => w.sponsor === "StarTech"),
});

const cell = (title, location = "") => ({ title, location });
const liveSchedule = [
  { day: "Friday", events: [
    { time: "7:30 PM", bigEvent: cell("Opening Ceremony", "Alumni Hall") },
    { time: "8:00 PM", bigEvent: cell("Opening Ceremony", "Alumni Hall") },
    { time: "9:00 PM", activities1: cell("Cup stacking", "Rm 1300") },
    { time: "9:30 PM", activities1: cell("Cup stacking", "Rm 1300") },
    { time: "10:00 PM", otherWorkshop: cell("Intro to Git and GitHub", "Rm 2100") },
  ] },
  { day: "Saturday", events: [
    { time: "9:00 AM", otherWorkshop: cell("Hackathon 101", "Rm 2100") },
    { time: "11:00 AM", otherWorkshop: cell("Figma for hackers", "Rm 2100") },
    { time: "11:30 AM", activities1: cell("Bob Ross painting", "Rm 1300") },
    { time: "12:00 PM", activities1: cell("Bob Ross painting", "Rm 1300") },
  ] },
];

const ok = (json) => ({ result: { data: { json } } });
function stubFor(proc) {
  if (proc === "sponsorSchedule.organizer") return ok(organizer());
  if (proc === "sponsorSchedule.get") return ok(sponsorView());
  return null;
}

async function stub(page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/schedule", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(liveSchedule) }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    const stubs = procs.map((p) => stubFor(p));
    if (stubs.every((s) => s === null)) return route.continue();
    let body = procs.map(() => null);
    if (stubs.some((s) => s === null)) {
      const res = await route.fetch();
      body = await res.json().catch(() => body);
    }
    body = body.map((b, i) => stubs[i] ?? b);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });
}

async function signIn(ctx) {
  const csrf = await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json();
  const res = await ctx.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { username: login.email, password: login.password, csrfToken: csrf.csrfToken, json: "true" },
  });
  if (!res.ok()) throw new Error(`sign in failed: ${res.status()}`);
}

const grid = (page) => page.getByRole("region", { name: /schedule, scrolls sideways/ });
const overflow = (page) =>
  page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 375 ? 812 : 1000 } });
  await signIn(ctx);
  const page = await ctx.newPage();
  await stub(page);
  const file = (name) => path.join(OUT, `${name}-${width}.png`);
  const shotGrid = async (name) => {
    await grid(page).scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: file(name) });
  };

  // Organizer: Friday and Saturday grids with the Team tasks column.
  await page.goto(`${BASE}/internal/sponsor-schedule`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Friday", exact: true }).click();
  await grid(page).waitFor();
  await page.waitForTimeout(500);
  await shotGrid("1-organizer-friday");
  if (width === 375) {
    // Scroll the grid itself sideways to the Team tasks column.
    await grid(page).evaluate((el) => el.scrollTo({ left: el.scrollWidth }));
    await page.waitForTimeout(200);
    await shotGrid("2-organizer-friday-tasks");
    await grid(page).evaluate((el) => el.scrollTo({ left: 0 }));
  }
  console.log(`organizer friday ${width}: page overflow ${await overflow(page)}px`);
  await page.getByRole("button", { name: "Saturday", exact: true }).click();
  await page.waitForTimeout(500);
  await shotGrid("3-organizer-saturday");

  // Keyboard: Tab into a block, show its focus ring, open it with Enter.
  const block = grid(page).getByRole("button", { name: /StarTech Workshop: Building/ });
  await block.focus();
  await page.keyboard.press("Shift+Tab");
  await page.keyboard.press("Tab");
  await page.waitForTimeout(200);
  await page.screenshot({ path: file("4-organizer-block-focused") });
  await page.keyboard.press("Enter");
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: file("5-organizer-details") });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(300);
  const back = await block.evaluate((el) => el === document.activeElement);
  console.log(`organizer ${width}: focus back on block after Escape: ${back}`);

  // A team task's details.
  await grid(page).getByRole("button", { name: /Room check: Rm 2110/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: file("6-organizer-task-details") });
  await page.keyboard.press("Escape");

  // Sponsor view.
  await page.goto(`${BASE}/sponsors/${SPONSOR}/schedule?day=saturday`, { waitUntil: "networkidle" });
  await grid(page).waitFor();
  await page.waitForTimeout(500);
  await shotGrid("7-sponsor-saturday");
  console.log(`sponsor ${width}: page overflow ${await overflow(page)}px`);
  await grid(page).getByRole("button", { name: /StarTech Workshop: Building/ }).click();
  await page.getByRole("dialog").waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: file("8-sponsor-details") });
  await ctx.close();
}
await browser.close();
