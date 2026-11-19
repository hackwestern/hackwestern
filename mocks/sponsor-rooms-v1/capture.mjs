// Screenshots for T41-T44 (coffee chat rooms, add a chat, watcher) and T42
// (the map on "Where is everyone"). Run against the dev server on :3021
// backed by hackwestern_sd_chat, after seed.mjs. The run-of-show sheet isn't
// reachable locally, so every call that reads it (and the mutations that
// would) is stubbed here with fixtures; hacker search is real. The clock is
// Saturday 10:40 AM, during coffee chats.
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3021";
const NOW = new Date("2026-11-21T10:40:00-05:00");
const login = JSON.parse(fs.readFileSync("_local/organizer-login.json", "utf8"));

const ID = {
  StarTech: "11111111-1111-4111-8111-111111111111",
  "Sun Life": "22222222-2222-4222-8222-222222222222",
  Northwind: "33333333-3333-4333-8333-333333333333",
  "Northwind Robotics": "22222222-2222-4222-8222-000000000002",
  "Maple Labs": "22222222-2222-4222-8222-000000000003",
  "Orbit Bank": "22222222-2222-4222-8222-000000000004",
  "Lumen AI": "22222222-2222-4222-8222-000000000005",
};

const cc = (sponsor, windowStart, windowEnd, room, durationMinutes = 15, groupSize = 1, hackers = 8) => ({
  sponsor, windowStart, windowEnd, durationMinutes, groupSize, slots: null, hackers, format: null, room,
});
const item = (day, start, end, column, title, location = null, sponsors = []) => ({
  id: `${day}-${start}-${column}`, day, start, end, column, title, location, sponsors,
});

const setups = {
  StarTech: cc("StarTech", "10:00", "12:00", "Rm 2241"),
  Northwind: cc("Northwind", "10:30", "12:30", "Rm 2242", 30, 3, 9),
  "Maple Labs": cc("Maple Labs", "10:00", "11:00", "Rm 2243"),
  "Northwind Robotics": cc("Northwind Robotics", "13:00", "14:00", null, 30),
  "Sun Life": cc("Sun Life", null, null, null),
};
const assigned = { StarTech: "Rm 2241", Northwind: "Rm 2242", "Maple Labs": "Rm 2243" };
const watchers = { StarTech: "Wendy Organizer", Northwind: "Sam Kim", "Maple Labs": "Wendy Organizer" };
const sheetRooms = { "Northwind Robotics": "Rm 2245" };
const names = Object.keys(ID).sort();

function organizerRooms() {
  return {
    rooms: ["Rm 2241", "Rm 2242", "Rm 2243"],
    watchers: ["Org Anizer", "Wendy Organizer"],
    sponsors: names.map((name) => {
      const s = setups[name];
      return {
        sponsorId: ID[name],
        sponsor: name,
        windowStart: s?.windowStart ?? null,
        windowEnd: s?.windowEnd ?? null,
        durationMinutes: s?.durationMinutes ?? 15,
        groupSize: s?.groupSize ?? 1,
        hackers: s?.hackers ?? null,
        assignedRoom: assigned[name] ?? null,
        sheetRoom: sheetRooms[name] ?? null,
        watcher: watchers[name] ?? null,
      };
    }),
  };
}

const shared = "Orbit Bank: Rm 2110, Lumen AI: Rm 2235";
const itemsOf = {
  "Sun Life": [item("Saturday", "10:00", "11:00", "sponsor-workshop", "Sun Life Workshop: Intro to Fintech APIs", "Rm 2230 (50)", ["Sun Life"])],
  "Orbit Bank": [item("Saturday", "10:30", "11:30", "sponsor-workshop", "Orbit Bank and Lumen AI Workshops", shared, ["Orbit Bank", "Lumen AI"])],
  "Lumen AI": [item("Saturday", "10:30", "11:30", "sponsor-workshop", "Orbit Bank and Lumen AI Workshops", shared, ["Orbit Bank", "Lumen AI"])],
};
const companies = () => ({
  readAt: new Date("2026-11-21T10:39:00-05:00").toISOString(),
  sponsorBay: [
    item("Friday", "16:00", "23:00", "spon-booth", "Sponsor Bay", "SM Atrium"),
    item("Saturday", "10:00", "24:00", "spon-booth", "Sponsor Bay", "SM Atrium"),
  ],
  companies: names.map((name) => ({
    name,
    items: itemsOf[name] ?? [],
    coffeeChat: setups[name]
      ? { ...setups[name], room: assigned[name] ?? sheetRooms[name] ?? null }
      : null,
  })),
});
const organizer = () => ({
  readAt: new Date("2026-11-21T10:39:00-05:00").toISOString(),
  sheetUrl: null,
  items: [],
  tasks: [],
  coffeeChats: Object.values(setups),
});

const freeTimes = {
  room: "Rm 2241",
  durationMinutes: 15,
  groupSize: 1,
  reps: 2,
  watcherName: "Wendy Organizer",
  times: ["10:45", "11:00", "11:15", "11:30", "11:45"].map((slotTime, i) => ({
    slotTime,
    seatsLeft: i === 0 ? 1 : 2,
    room: "Rm 2241",
  })),
};

const ok = (json) => ({ result: { data: { json } } });
const err = (proc, code, httpStatus, message) => ({
  error: { json: { message, code: -32009, data: { code, httpStatus, path: proc } } },
});

function stubFor(proc, input) {
  switch (proc) {
    case "sponsorSchedule.organizer":
      return ok(organizer());
    case "sponsorSchedule.organizerCompanies":
      return ok(companies());
    case "coffeeChatRequests.organizerRooms":
      return ok(organizerRooms());
    case "coffeeChatRequests.freeTimes":
      return ok(freeTimes);
    case "coffeeChatRequests.assignCoffeeChatRoom":
      // Northwind (10:30-12:30) into 2241 overlaps StarTech (10:00-12:00).
      if (input?.sponsorId === ID.Northwind && input?.room === "Rm 2241") {
        return err(proc, "CONFLICT", 409, "StarTech already has Rm 2241 from 10:00 AM to 12:00 PM, which overlaps this window.");
      }
      return ok({ sponsorId: input.sponsorId, room: input.room, chatIds: [] });
    case "coffeeChatRequests.setCoffeeChatWatcher": {
      const name = names.find((n) => ID[n] === input.sponsorId);
      watchers[name] = input.watcher;
      return ok({ sponsorId: input.sponsorId, watcher: input.watcher });
    }
    case "coffeeChatRequests.organizerOffer":
      return ok({
        chatId: "00000000-0000-4000-8000-0000000000aa",
        firstName: "Alex",
        slotTime: input.slotTime,
        durationMinutes: 15,
        room: "Rm 2241",
        status: "pending",
        expiresAt: NOW.toISOString(),
      });
    default:
      return null;
  }
}

async function stub(page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/trpc/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    let inputs = {};
    if (req.method() === "POST") inputs = JSON.parse(req.postData() ?? "{}");
    else if (url.searchParams.get("input")) inputs = JSON.parse(url.searchParams.get("input"));
    const stubs = procs.map((p, i) => stubFor(p, inputs[i]?.json));
    if (stubs.every((s) => s === null)) return route.continue();
    let body = procs.map(() => null);
    if (stubs.some((s) => s === null)) {
      const res = await route.fetch();
      body = await res.json().catch(() => body);
    }
    body = body.map((b, i) => stubs[i] ?? b);
    const failed = body.some((b) => b?.error);
    await route.fulfill({
      status: failed ? (body.length === 1 ? body[0].error.json.data.httpStatus : 207) : 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function signIn(ctx) {
  const csrf = await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json();
  const res = await ctx.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: { username: login.email, password: login.password, csrfToken: csrf.csrfToken, json: "true" },
  });
  if (!res.ok()) throw new Error(`sign in failed: ${res.status()}`);
}

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  delete watchers["Northwind Robotics"];
  // Tall viewports instead of fullPage (fullPage leaves the lower page blank).
  const ctx = await browser.newContext({
    viewport: { width, height: width === 375 ? 5200 : 2600 },
  });
  await signIn(ctx);
  const page = await ctx.newPage();
  await stub(page);
  const file = (name) => path.join(OUT, `${name}-${width}.png`);

  await page.goto(`${BASE}/internal/sponsor-schedule`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Coffee chats", exact: true }).click();
  await page.getByRole("heading", { name: "Rooms" }).waitFor();
  await page.waitForTimeout(500);
  await page.screenshot({ path: file("1-rooms") });

  // Room clash: Northwind -> Rm 2241 overlaps StarTech.
  const card = (name) =>
    page.locator("li", { has: page.getByRole("heading", { name, exact: true }) });
  const northwind = card("Northwind");
  await northwind.getByLabel("Room").selectOption("Rm 2241");
  await northwind.getByText("already has Rm 2241").waitFor();
  await northwind.screenshot({ path: file("2-room-clash") });

  // Watcher: name someone for Northwind Robotics and save.
  const robotics = card("Northwind Robotics");
  await robotics.getByLabel("Watched by").fill("Wendy Organizer");
  await robotics.getByRole("button", { name: "Save" }).click();
  await robotics.getByText("Saved", { exact: true }).waitFor();
  await robotics.screenshot({ path: file("3-watcher") });

  // Add a chat: sponsor, real hacker search, a free time, rep.
  const add = page.locator("section", { has: page.getByRole("heading", { name: "Add a chat" }) });
  await add.getByLabel("Sponsor").selectOption({ label: "StarTech" });
  await add.getByLabel("Hacker").fill("otter");
  await add.getByRole("button", { name: /Alex Example/ }).waitFor();
  await add.screenshot({ path: file("4-add-chat-search") });
  await add.getByRole("button", { name: /Alex Example/ }).click();
  await add.getByLabel("Start time").selectOption("11:00");
  await add.getByLabel("Rep name (optional)").fill("Priya");
  await add.screenshot({ path: file("5-add-chat-filled") });
  await add.getByRole("button", { name: "Add chat" }).click();
  await add.getByText("Sent Alex Example a request").waitFor();
  await add.screenshot({ path: file("6-add-chat-sent") });

  // The map on "Where is everyone".
  await page.getByRole("button", { name: "Where is everyone", exact: true }).click();
  await page.getByRole("heading", { name: "Map", exact: true }).waitFor();
  await page.waitForTimeout(1000);
  await page.getByRole("button", { name: /^2241,/ }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: file("7-map-floor2") });
  await page.getByRole("button", { name: "Floor 1" }).click();
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /^Sponsor Bay,/ }).click();
  await page.waitForTimeout(200);
  await page.screenshot({ path: file("8-map-floor1") });

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  console.log(`width ${width}: page horizontal overflow ${overflow}px`);
  await ctx.close();
}
await browser.close();
