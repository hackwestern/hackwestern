// Screenshots for T38 (sponsor schedule matches /live, hackathon events
// overlaid). Run against a dev server on :3023 backed by hackwestern_sd_sched
// with sponsor 11111111-1111-4111-8111-111111111111 ("Scotiabank") and an
// organizer user "org-shot-1" seeded. Neither Google Sheet is reachable
// locally, so sponsorSchedule.get and /api/schedule are stubbed here with
// fixtures; every other call is real. The clock is set to Saturday 1:40 PM.
import { chromium } from "playwright";
import { encode } from "next-auth/jwt";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3023";
const SPONSOR = "11111111-1111-4111-8111-111111111111";
const NOW = new Date("2026-11-21T13:40:00-05:00");

// --- /live's schedule (/api/schedule) ------------------------------------
// [startMinute, endMinute, column, title, location]
const LIVE = {
  Friday: [
    [960, 1080, "bigEvent", "Check-in", "Atrium"],
    [1020, 1260, "sponsorBooth", "Sponsor Bay", "Sponsor Bay"],
    [1080, 1140, "bigEvent", "Opening Ceremony", "Alumni Hall"],
    [1140, 1200, "food", "Dinner", "Atrium"],
    [1170, 1230, "activities1", "Team Formation", "Rm 1200"],
    [1200, 1260, "sponsorWorkshop", "Scotiabank Workshop", "Rm 2110"],
    [1260, 1290, "bigEvent", "Hacking Begins", ""],
    [1320, 1380, "otherWorkshop", "Intro to React", "Rm 3100"],
    [1410, 1440, "food", "Midnight Snack", "Atrium"],
  ],
  Saturday: [
    [480, 540, "food", "Breakfast", "Atrium"],
    [540, 1020, "sponsorBooth", "Sponsor Bay", "Sponsor Bay"],
    [570, 630, "otherWorkshop", "Intro to Git", "Rm 3100"],
    [660, 720, "sponsorWorkshop", "Google Cloud Workshop", "Rm 2230"],
    [720, 780, "food", "Lunch", "Atrium"],
    [780, 840, "scavengerHunt", "Scavenger Hunt", "Everywhere"],
    [840, 900, "activities1", "Cup Stacking", "Atrium"],
    [1080, 1140, "food", "Dinner", "Atrium"],
    [1260, 1320, "activities1", "Werewolf", "Rm 1200"],
    [1410, 1440, "food", "Midnight Snack", "Atrium"],
  ],
  Sunday: [
    [480, 540, "food", "Breakfast", "Atrium"],
    [540, 570, "bigEvent", "Hacking Ends", ""],
    [660, 780, "bigEvent", "Judging Expo", "Alumni Hall"],
    [750, 810, "food", "Lunch", "Atrium"],
    [840, 900, "bigEvent", "Closing Ceremony", "Alumni Hall"],
  ],
};

const clock = (m) => {
  const h = Math.floor(m / 60) % 24;
  return `${h % 12 || 12}:${String(m % 60).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};

function liveDays() {
  return Object.entries(LIVE).map(([day, events]) => {
    const from = Math.min(...events.map((e) => e[0]));
    const to = Math.max(...events.map((e) => e[1]));
    const rows = [];
    for (let t = from; t < to; t += 30) {
      const row = { time: clock(t) };
      for (const [s, e, key, title, location] of events) {
        if (s <= t && t < e) row[key] = { title, location };
      }
      rows.push(row);
    }
    return { day, events: rows };
  });
}

// --- The run of show (sponsorSchedule.get) --------------------------------
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

const schedule = {
  sponsorName: "Scotiabank",
  readAt: new Date("2026-11-21T13:38:00-05:00").toISOString(),
  coffeeChat: {
    sponsor: "Scotiabank",
    windowStart: "13:00",
    windowEnd: "15:00",
    durationMinutes: 30,
    groupSize: 1,
    slots: 8,
    hackers: 6,
    format: "1-on-1 (30 mins)",
    room: "Rm 2241",
  },
  items: [
    item("Friday", "18:00", "19:00", "big-event", "Opening Ceremony"),
    item("Friday", "19:00", "20:00", "food", "Dinner"),
    item("Friday", "17:00", "21:00", "spon-booth", "Sponsor Bay"),
    item("Friday", "20:00", "21:00", "sponsor-workshop", "Scotiabank Workshop: Building with Open Banking APIs", "Rm 2110", ["Scotiabank"]),
    item("Saturday", "08:00", "09:00", "food", "Breakfast"),
    item("Saturday", "09:00", "17:00", "spon-booth", "Sponsor Bay"),
    item("Saturday", "10:00", "10:30", "sponsor-workshop", "Sponsor Judging Workshop", "Rm 3100"),
    item("Saturday", "12:00", "13:00", "food", "Lunch"),
    item("Saturday", "13:00", "15:00", "coffee-chats", "Scotiabank Coffee Chats", "Scotiabank: Rm 2241, RBC: Rm 2245", ["Scotiabank"]),
    item("Saturday", "18:00", "19:00", "food", "Dinner"),
    item("Sunday", "08:00", "09:00", "food", "Breakfast"),
    item("Sunday", "10:00", "11:00", "sponsor-workshop", "Sponsor Track Shortlisting", "Rm 3100"),
    item("Sunday", "11:00", "13:00", "sponsor-workshop", "Sponsor Judging", "Alumni Hall"),
    item("Sunday", "14:00", "15:00", "big-event", "Closing Ceremony"),
  ],
};

async function stub(page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/schedule", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(liveDays()),
    }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    const idx = procs.indexOf("sponsorSchedule.get");
    if (idx === -1) return route.continue();
    const res = await route.fetch();
    let body = await res.json().catch(() => null);
    if (!Array.isArray(body)) body = procs.map(() => null);
    body[idx] = { result: { data: { json: schedule } } };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 375 ? 2700 : 2100 },
  });
  const page = await ctx.newPage();
  await stub(page);
  for (const hackathon of [true, false]) {
    for (const day of ["Friday", "Saturday", "Sunday"]) {
      await page.goto(`${BASE}/sponsors/${SPONSOR}/schedule?day=${day.toLowerCase()}`, {
        waitUntil: "networkidle",
      });
      const toggle = page.getByRole("checkbox", { name: "Show hackathon events" });
      await toggle.waitFor();
      if ((await toggle.isChecked()) !== hackathon) await toggle.click();
      await page.waitForTimeout(200);
      const name = `${day.slice(0, 3).toLowerCase()}-${hackathon ? "with" : "without"}-hackathon-${width}.png`;
      await page.screenshot({ path: path.join(OUT, name) });
      if (width === 375 && hackathon && day === "Saturday") {
        // The grid scrolls sideways in its own box; the time column stays.
        await page.getByRole("region", { name: /Saturday schedule/ }).evaluate((el) => {
          el.scrollLeft = el.scrollWidth;
        });
        await page.waitForTimeout(200);
        await page.screenshot({ path: path.join(OUT, `sat-with-hackathon-375-scrolled.png`) });
      }
    }
  }
  // Sideways scroll check.
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`width ${width}: horizontal overflow ${overflow}px`);
  await ctx.close();
}

// /live's schedule tab for comparison, signed in as the seeded organizer.
// Pranav's draft (PR #1142) keeps this same 11-column grid and only swaps in
// Figtree and dashboard text colours; it also turns the tab off
// (SCHEDULE_ENABLED = false), so the grid is captured from this branch.
const token = await encode({
  token: { sub: "org-shot-1", name: "Jazz Organizer", email: "organizer@example.com" },
  secret: "local-dev-only-secret",
});
for (const width of [375, 1280]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 375 ? 2700 : 2100 },
  });
  await ctx.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await ctx.newPage();
  await stub(page);
  await page.goto(`${BASE}/live?tab=schedule`, { waitUntil: "networkidle" });
  await page.getByText("Saturday, November").first().waitFor();
  await page.screenshot({ path: path.join(OUT, `live-schedule-${width}.png`) });
  await ctx.close();
}

await browser.close();
console.log("saved to", OUT);
