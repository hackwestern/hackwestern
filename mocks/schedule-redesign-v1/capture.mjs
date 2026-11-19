// Before/after screenshots for the schedule redesign (run-of-show grid,
// day picker, details dialog, Happening now banner). Dev server on :3018
// (hackwestern_spon). The sheet, /api/schedule and the coffee chat lists are
// stubbed with fixtures; the organizer is redesign.organizer@test.local
// (JWT cookie). Clock: Saturday 10:40 AM Eastern.
//   node mocks/schedule-redesign-v1/capture.mjs before|after
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PHASE = process.argv[2] ?? "after";
const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3018";
const NOW = new Date("2026-11-21T10:40:00-05:00");
const SPONSOR = "adaa0779-1608-42bd-9ce2-aad41b3840c2"; // StarTech

const item = (
  day,
  start,
  end,
  column,
  title,
  location = null,
  sponsors = [],
) => ({
  id: `${day}-${start}-${column}-${title}`,
  day,
  start,
  end,
  column,
  title,
  location,
  sponsors,
});
const items = [
  item(
    "Friday",
    "17:00",
    "18:30",
    "big-event",
    "Check-in and registration",
    "SM Atrium",
  ),
  item("Friday", "18:30", "19:30", "food", "Dinner", "SM Atrium"),
  item(
    "Friday",
    "19:30",
    "20:30",
    "big-event",
    "Opening Ceremony",
    "Alumni Hall",
  ),
  item("Saturday", "08:00", "09:30", "food", "Breakfast", "SM Atrium"),
  item(
    "Saturday",
    "09:30",
    "10:00",
    "big-event",
    "Hacking check-in and announcements",
    "Alumni Hall",
  ),
  item(
    "Saturday",
    "10:00",
    "11:00",
    "sponsor-workshop",
    "StarTech Workshop: Building accessible dashboards with real-time data",
    "Rm 2110",
    ["StarTech"],
  ),
  item(
    "Saturday",
    "10:30",
    "11:00",
    "sponsor-workshop",
    "Sun Life Lightning Talk: Fintech careers",
    "Rm 2230",
    ["Sun Life"],
  ),
  item("Saturday", "10:00", "16:00", "spon-booth", "Sponsor Bay", "SM Atrium"),
  item(
    "Saturday",
    "10:30",
    "12:00",
    "coffee-chats",
    "StarTech coffee chats",
    "Rm 2241",
    ["StarTech"],
  ),
  item("Saturday", "12:00", "13:00", "food", "Lunch", "SM Atrium"),
  item(
    "Saturday",
    "13:00",
    "13:30",
    "sponsor-workshop",
    "Northwind Robotics: Intro to ROS",
    "Rm 2245",
    ["Northwind Robotics"],
  ),
  item(
    "Saturday",
    "13:00",
    "14:00",
    "judging",
    "Sponsor judging briefing",
    "Rm 2235",
    ["StarTech", "Sun Life"],
  ),
  item("Saturday", "18:00", "19:00", "food", "Dinner", "SM Atrium"),
];
const tasks = [
  {
    day: "Saturday",
    start: "08:00",
    task: "Breakfast setup with catering",
    owner: "Dana",
  },
  {
    day: "Saturday",
    start: "09:45",
    task: "Open sponsor bay, hand out sponsor wifi codes",
    owner: "Ana",
  },
  {
    day: "Saturday",
    start: "10:00",
    task: "Room check: Rm 2110 projector",
    owner: "Ben",
  },
  { day: "Saturday", start: "10:00", task: "Greet StarTech reps", owner: null },
  { day: "Saturday", start: "12:00", task: "Lunch lines", owner: "Dana" },
];
const workshops = [
  {
    title:
      "StarTech Workshop: Building accessible dashboards with real-time data",
    sponsor: "StarTech",
    runners: ["Priya Shah", "Leo Park"],
    day: "Saturday",
    start: "10:00",
    room: "Rm 2110",
    description:
      "Build a live dashboard that works with a keyboard and a screen reader, using a public transit feed. Bring a laptop with Node 20.",
  },
];
const readAt = new Date("2026-11-21T10:39:00-05:00").toISOString();
const organizer = () => ({
  readAt,
  sheetUrl: "https://docs.google.com/spreadsheets/d/example",
  items,
  tasks,
  coffeeChats: [],
  ceremonies: [],
  workshops,
});
const sponsorView = () => ({
  sponsorName: "StarTech",
  readAt,
  items: items.filter(
    (i) =>
      i.sponsors.includes("StarTech") ||
      ["big-event", "food", "spon-booth"].includes(i.column),
  ),
  coffeeChat: null,
  ceremonies: [],
  workshops,
});
const chat = (id, sponsorName, firstName, hhmm, room, status) => ({
  chatId: id,
  sponsorName,
  firstName,
  lastName: "",
  slotTime: `${hhmm}`,
  durationMinutes: 15,
  room,
  status,
  startsAt: new Date(`2026-11-21T${hhmm}:00-05:00`).toISOString(),
});
const chats = [
  chat("c1", "StarTech", "Maya", "11:00", "rm 2241", "accepted"),
  chat("c2", "StarTech", "Omar", "11:00", "rm 2241", "pending"),
  chat("c3", "Sun Life", "Kai", "11:15", "Rm 2230", "accepted"),
];

const cell = (title, location = "") => ({ title, location });
const liveSchedule = [
  {
    day: "Saturday",
    events: [
      { time: "9:00 AM", otherWorkshop: cell("Hackathon 101", "Rm 2100") },
      { time: "11:00 AM", otherWorkshop: cell("Figma for hackers", "Rm 2100") },
      { time: "11:30 AM", activities1: cell("Bob Ross painting", "Rm 1300") },
      { time: "12:00 PM", activities1: cell("Bob Ross painting", "Rm 1300") },
    ],
  },
];

const ok = (json) => ({ result: { data: { json } } });
function stubFor(proc) {
  if (proc === "sponsorSchedule.organizer") return ok(organizer());
  if (proc === "sponsorSchedule.get") return ok(sponsorView());
  if (proc === "coffeeChatRequests.organizerChats")
    return ok({ chats, rooms: [] });
  if (proc === "coffeeChatRequests.sponsorChats")
    return ok({
      sponsorName: "StarTech",
      watcherName: null,
      chats: chats.filter((c) => c.sponsorName === "StarTech"),
    });
  return null;
}
async function stub(page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/schedule", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(liveSchedule),
    }),
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
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

const token = await encode({
  token: {
    sub: "redesign-organizer-1",
    name: "Redesign Organizer",
    email: "redesign.organizer@test.local",
  },
  secret: "local-dev-only-secret",
});
const grid = (page) =>
  page.getByRole("region", { name: /schedule, scrolls sideways/ });
const overflow = (page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
// The organizer agent is moving the room map out from beside the grid (in
// its own branch). "after" emulates that here so the grid gets the page
// width: the map column is dropped from the tab's two-column layout.
const fullWidth = (page) =>
  page.evaluate(() => {
    const region = document.querySelector(
      '[role="region"][aria-label$="scrolls sideways"]',
    );
    const wrap = [...document.querySelectorAll("div")].find(
      (d) => d.className.includes("340px") && d.contains(region),
    );
    if (wrap) wrap.style.gridTemplateColumns = "minmax(0, 1fr)";
  });
const sideways = (page) =>
  page.evaluate(() => {
    const r = document.querySelector(
      '[role="region"][aria-label$="scrolls sideways"]',
    );
    return r ? r.scrollWidth - r.clientWidth : null;
  });
const shot = async (page, name, width) => {
  await page.waitForTimeout(400);
  await page.screenshot({
    path: path.join(OUT, `${PHASE}-${name}-${width}.png`),
  });
};

const browser = await chromium.launch();
for (const width of PHASE === "before" ? [390, 1280] : [390, 1280, 1440]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 1000 },
  });
  await ctx.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await ctx.newPage();
  await stub(page);

  // Organizer Run of show tab, hackathon events on.
  await page.goto(`${BASE}/internal/sponsors?tab=schedule`, {
    waitUntil: "networkidle",
  });
  await grid(page).waitFor();
  const toggle = page.getByLabel("Show hackathon events");
  if (PHASE !== "before") {
    await fullWidth(page);
    if (await toggle.isChecked()) await toggle.click();
    await page.waitForTimeout(300);
    console.log(
      `organizer ${width}: hackathon events OFF (default), grid sideways scroll ${await sideways(page)}px`,
    );
    await grid(page).scrollIntoViewIfNeeded();
    await shot(page, "0-organizer-grid-default", width);
  }
  if (!(await toggle.isChecked())) await toggle.click();
  if (PHASE !== "before") await fullWidth(page);
  await page
    .getByRole("group", { name: "Pick a day" })
    .scrollIntoViewIfNeeded();
  await page.evaluate(() => window.scrollBy(0, -16));
  await shot(page, "1-organizer-grid", width);
  console.log(
    `organizer ${width}: page overflow ${await overflow(page)}px, grid sideways scroll ${await sideways(page)}px`,
  );
  await grid(page).scrollIntoViewIfNeeded();
  await shot(page, "1b-organizer-grid-only", width);

  // Focus the Workshops column.
  await grid(page).scrollIntoViewIfNeeded();
  await page.getByRole("button", { name: "Focus on Workshops" }).click();
  await page.waitForTimeout(700); // let the sideways scroll finish
  await shot(page, "2-organizer-focus", width);
  await page.keyboard.press("Escape");

  // Details for a team task.
  await page
    .getByRole("button", { name: /Team task, 10:00 AM: Greet StarTech reps/ })
    .click();
  await shot(page, "3-organizer-task-dialog", width);
  await page.keyboard.press("Escape");

  // Sponsor page.
  await page.goto(`${BASE}/sponsors/${SPONSOR}/schedule?day=saturday`, {
    waitUntil: "networkidle",
  });
  await grid(page).waitFor();
  await shot(page, "4-sponsor-top", width);
  await grid(page).scrollIntoViewIfNeeded();
  await shot(page, "5-sponsor-grid", width);
  console.log(
    `sponsor ${width}: page overflow ${await overflow(page)}px, grid sideways scroll ${await sideways(page)}px`,
  );
  await page
    .getByRole("button", { name: /Building accessible dashboards/ })
    .first()
    .click();
  await shot(page, "6-sponsor-dialog", width);
  await ctx.close();
}
await browser.close();
console.log("saved to", OUT);
