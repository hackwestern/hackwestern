// Screenshots for T46 (ceremony running order, workshop details, "Your next
// event" card). Run against a dev server on :3025 backed by
// hackwestern_sd_sched2, seeded with seed.sql (sponsor "Scotiabank" and an
// organizer "org-shot-1"). The sheet isn't reachable locally, so
// sponsorSchedule.get / .organizer and /api/schedule are stubbed with
// fixtures copied from the sheet export (2026-11-14); every other call is real.
//   node mocks/sponsor-schedule-v4/capture.mjs
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3025";
const SPONSOR = "11111111-1111-4111-8111-111111111111";

const item = (day, start, end, column, title, location = null, sponsors = []) => ({
  id: `${day}-${start}-${column}`,
  day,
  start,
  end,
  column,
  title,
  location,
  sponsors,
});

const items = [
  item("Friday", "17:00", "24:00", "spon-booth", "Sponsor Bay Open", "SM Atrium"),
  item("Friday", "17:30", "18:30", "food", "Dinner", "Rm 1230"),
  item("Friday", "19:30", "20:30", "big-event", "OPENING CEREMONY", "Ivey BMO Auditorium"),
  item("Friday", "21:00", "21:30", "big-event", "Hacking Begins"),
  item("Saturday", "08:00", "09:00", "food", "Breakfast", "Rm 1230"),
  item("Saturday", "09:00", "17:00", "spon-booth", "Sponsor Bay Open", "SM Atrium"),
  item("Saturday", "10:00", "11:00", "sponsor-workshop", "Scotiabank Workshop", "2230 (50)", ["Scotiabank"]),
  item("Saturday", "12:00", "13:00", "food", "Lunch", "Rm 1230"),
  item("Saturday", "20:30", "21:30", "sponsor-workshop", "Scotiabank Workshop", "Rm 2230 (50)", ["Scotiabank"]),
  item("Sunday", "08:30", "09:00", "sponsor-workshop", "Sponsor Judging Workshop", "SM 2235 (50)"),
  item("Sunday", "10:00", "12:00", "sponsor-workshop", "Sponsor Track Judging", "Rm 2110", ["Scotiabank"]),
  item("Sunday", "14:00", "15:00", "big-event", "CLOSING CEREMONY", "Ivey BMO Auditorium"),
];

// The "Opening + Closing Ceremonies" tab as parsed (no times in the sheet).
const seg = (ceremony, order, durationMinutes, sponsor, speakers = []) => ({
  ceremony,
  order,
  start: null,
  durationMinutes,
  title: sponsor,
  sponsor,
  speakers,
});
const ceremonies = [
  seg("opening", 1, 1, "Canada Life", ["Rob Craig, Manager Emerging Talent and Programs"]),
  seg("opening", 2, 1, "Manulife"),
  seg("opening", 3, 1, "QNX", ["John Dallas, Principal Academic Partnerships Manager"]),
  seg("opening", 4, 3, "Scotiabank"),
  seg("opening", 5, 3, "Sun Life", ["Nassima Younes, Talent Acquisition Consultant"]),
  seg("closing", 1, 1, "Scotiabank"),
  seg("closing", 2, 1, "Sun Life", ["Nassima Younes, Talent Acquisition Consultant"]),
];

const ws = (title, sponsor, day, start, room, description = null) => ({
  title,
  sponsor,
  runners: [],
  day,
  start,
  room,
  description,
});
const workshops = [
  ws("MLH", null, "Friday", "22:00", "Rm 2230 (50)"),
  ws("Scotiabank Workshop 1", "Scotiabank", "Saturday", "10:00", "2230 (50)"),
  ws("Canada Life: Women in Technology Panel", "Canada Life", "Saturday", "13:00", "2230 (50)",
    "Join a panel of accomplished women working across technology, innovation, and digital transformation as they share their career journeys."),
  ws("Sun Life Workshop 1: Don't Wait for AI to Happen to You: How Engineers are Shaping the Future", "Sun Life", "Saturday", "14:30", "2230 (50)",
    "This session is designed to inspire and equip the next generation of software engineers with the mindset and practical tools to thrive in an AI-augmented world."),
  ws("QNX: Intro to QNX: Foundational Software for Embedded Systems", "QNX", "Saturday", "16:30", "2230 (50)",
    "A high-level overview of QNX, its mission-critical technology, key capabilities, and how it powers reliable, software-defined systems across industries."),
  ws("Scotiabank Workshop 2", "Scotiabank", "Saturday", "20:30", "Rm 2230 (50)"),
];

const coffeeChat = {
  sponsor: "Scotiabank",
  windowStart: "11:00",
  windowEnd: "15:00",
  durationMinutes: 30,
  groupSize: 1,
  slots: 8,
  hackers: 6,
  format: "1-on-1 (30 mins)",
  room: "Rm 2241",
};

const sponsorView = (cer = ceremonies) => ({
  sponsorName: "Scotiabank",
  readAt: new Date("2026-11-20T17:58:00-05:00").toISOString(),
  items,
  coffeeChat,
  ceremonies: cer.map((c) => ({ ...c, yours: c.sponsor === "Scotiabank" })),
  workshops: workshops.filter((w) => w.sponsor === "Scotiabank"),
});

const organizerView = {
  readAt: new Date("2026-11-20T17:58:00-05:00").toISOString(),
  sheetUrl: "https://docs.google.com/spreadsheets/d/fake/edit",
  items,
  tasks: [],
  coffeeChats: [coffeeChat],
  ceremonies,
  workshops,
};

async function stub(page, now, data) {
  await page.clock.setFixedTime(now);
  await page.route("**/api/schedule", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    const stubs = {
      "sponsorSchedule.get": data,
      "sponsorSchedule.organizer": organizerView,
    };
    if (!procs.some((p) => p in stubs)) return route.continue();
    const res = await route.fetch();
    let body = await res.json().catch(() => null);
    if (!Array.isArray(body)) body = procs.map(() => null);
    procs.forEach((p, i) => {
      if (p in stubs) body[i] = { result: { data: { json: stubs[p] } } };
    });
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

const FRIDAY_6PM = new Date("2026-11-20T18:00:00-05:00");
const browser = await chromium.launch();
const shots = [
  // name, width, now, data
  ["sponsor-friday-6pm", FRIDAY_6PM, sponsorView()],
  ["sponsor-after-event", new Date("2026-11-23T10:00:00-05:00"), sponsorView()],
  [
    "sponsor-timed-slot",
    new Date("2026-11-20T19:43:00-05:00"),
    // If organizers add a Time column: "You're on at 7:42 PM, 3 min".
    sponsorView(ceremonies.map((c, i) => ({ ...c, start: c.ceremony === "opening" ? `19:${String(33 + i * 3).padStart(2, "0")}` : null }))),
  ],
];
for (const width of [375, 1280]) {
  for (const [name, now, data] of shots) {
    const ctx = await browser.newContext({ viewport: { width, height: width === 375 ? 3400 : 2300 } });
    const page = await ctx.newPage();
    await stub(page, now, data);
    await page.goto(`${BASE}/sponsors/${SPONSOR}/schedule?day=friday`, {
      waitUntil: "networkidle",
    });
    await page.getByRole("heading", { name: "Your next event" }).waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: path.join(OUT, `${name}-${width}.png`), fullPage: true });
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    console.log(`${name} @${width}: horizontal overflow ${overflow}px`);
    await ctx.close();
  }
}

const token = await encode({
  token: { sub: "org-shot-1", name: "Jazz Organizer", email: "organizer@example.com" },
  secret: "local-dev-only-secret",
});
for (const width of [375, 1280]) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 375 ? 3400 : 2300 } });
  await ctx.addCookies([{ name: "next-auth.session-token", value: token, url: BASE }]);
  const page = await ctx.newPage();
  await stub(page, FRIDAY_6PM, sponsorView());
  await page.goto(`${BASE}/internal/sponsor-schedule`, { waitUntil: "networkidle" });
  await page.getByRole("heading", { name: "Workshops" }).waitFor();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, `organizer-schedule-${width}.png`), fullPage: true });
  await ctx.close();
}

await browser.close();
console.log("saved to", OUT);
