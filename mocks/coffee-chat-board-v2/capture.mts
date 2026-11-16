// Screenshots for T52 (coffee chats table + map and where-is-everyone panel).
// Run with
//   npx tsx mocks/coffee-chat-board-v2/capture.mts
// against the dev server on :3021 (hackwestern_sd_chat, after
// mocks/coffee-chat-board-v1/seed.mjs). Sheet reads are stubbed in the
// browser with fixtures; the board is built from the real DB chats with the
// real buildChatBoard. The page clock is Saturday 10:40 AM.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type BrowserContext, type Page } from "playwright";
import postgres from "postgres";
import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import type {
  CoffeeChatSetup,
  CompanyLocations,
  RunOfShowItem,
} from "~/lib/run-of-show";
import { buildChatBoard } from "~/server/api/utils/coffee-chat-board";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3021";
const NOW = new Date("2026-11-21T10:40:00-05:00");
const login = JSON.parse(
  fs.readFileSync("_local/organizer-login.json", "utf8"),
) as { email: string; password: string };
const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_sd_chat",
);

const cc = (
  sponsor: string,
  windowStart: string | null,
  windowEnd: string | null,
  room: string | null,
  durationMinutes: 15 | 30 = 15,
  groupSize = 1,
): CoffeeChatSetup => ({
  sponsor,
  windowStart,
  windowEnd,
  durationMinutes,
  groupSize,
  slots: null,
  hackers: 8,
  format: null,
  room,
});
const setups = [
  cc("StarTech", "10:00", "12:00", "Rm 2241"),
  cc("Northwind", "10:30", "12:30", "Rm 2242", 30, 3),
  cc("Maple Labs", "10:00", "11:00", "Rm 2243"),
  cc("Lumen AI", "11:00", "12:00", null),
  cc("Northwind Robotics", "13:00", "14:00", "Rm 2245", 30, 3),
  cc("Sun Life", null, null, null),
];

const item = (
  start: string,
  end: string,
  title: string,
  location: string | null,
  sponsors: string[],
): RunOfShowItem => ({
  id: `Saturday-${start}-${title}`,
  day: "Saturday",
  start,
  end,
  column: "sponsor",
  title,
  location,
  sponsors,
});
const companies: CompanyLocations = {
  readAt: NOW.toISOString(),
  sponsorBay: [item("09:00", "17:00", "Sponsor Bay", "SM Atrium", [])],
  companies: [
    { name: "StarTech", items: [], coffeeChat: setups[0]! },
    { name: "Northwind", items: [], coffeeChat: setups[1]! },
    { name: "Maple Labs", items: [], coffeeChat: setups[2]! },
    {
      name: "Lumen AI",
      items: [
        item("10:00", "11:00", "Lumen AI workshop", "Rm 2235 (60)", [
          "Lumen AI",
        ]),
      ],
      coffeeChat: setups[3]!,
    },
    {
      name: "Northwind Robotics",
      items: [
        item("10:30", "11:30", "Robotics tech talk", "Rm 2230 (50)", [
          "Northwind Robotics",
        ]),
      ],
      coffeeChat: setups[4]!,
    },
    { name: "Sun Life", items: [], coffeeChat: setups[5]! },
  ] as CompanyLocations["companies"],
};

async function board() {
  const sponsors = await sql<
    {
      id: string;
      name: string;
      reps: number;
      assignedRoom: string | null;
      watcher: string | null;
    }[]
  >`select id, name, coffee_chat_reps as reps, coffee_chat_room as "assignedRoom",
      coffee_chat_watcher as watcher from sponsor_judging_sponsor`;
  const chats = await sql<
    {
      chatId: string;
      sponsorId: string;
      firstName: string;
      lastName: string | null;
      hackerId: string | null;
      slotTime: string;
      durationMinutes: number;
      room: string | null;
      repName: string | null;
      status: CoffeeChatStatus;
    }[]
  >`select c.id as "chatId", c.sponsor_id as "sponsorId",
      coalesce(a.first_name, u.name, '') as "firstName", a.last_name as "lastName",
      u.hacker_id as "hackerId", c.slot_time as "slotTime",
      c.duration_minutes as "durationMinutes", c.room, c.rep_name as "repName", c.status
    from coffee_chat c join "user" u on u.id = c.user_id
    left join application a on a.user_id = c.user_id
    order by c.slot_time, c.created_at`;
  return {
    ...buildChatBoard({
      sponsors: [...sponsors],
      setups,
      chats: [...chats],
      now: NOW,
    }),
    rooms: ["Rm 2241", "Rm 2242", "Rm 2243", "Rm 2245"],
    assignableRooms: ["Rm 2241", "Rm 2242", "Rm 2243"],
    watchers: ["Sam Kim", "Wendy Organizer"],
    readAt: NOW.toISOString(),
  };
}

const organizer = () => ({
  readAt: NOW.toISOString(),
  sheetUrl: null,
  items: [],
  tasks: [],
  coffeeChats: setups,
  ceremonies: [],
  workshops: [],
});

const ok = (json: unknown) => ({ result: { data: { json } } });

async function stubFor(proc: string) {
  switch (proc) {
    case "sponsorSchedule.organizer":
      return ok(organizer());
    case "sponsorSchedule.organizerCompanies":
      return ok(companies);
    case "coffeeChatRequests.organizerChatBoard":
      return ok(await board());
    default:
      return null;
  }
}

async function stub(page: Page) {
  await page.clock.setFixedTime(NOW);
  // The public /live schedule reads Google; locally it 500s. Empty is fine.
  await page.route("**/api/schedule", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    const url = new URL(route.request().url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    const stubs = await Promise.all(procs.map((p) => stubFor(p)));
    if (stubs.every((s) => s === null)) return route.continue();
    let body: unknown[] = procs.map(() => null);
    if (stubs.some((s) => s === null)) {
      const res = await route.fetch();
      body = ((await res.json().catch(() => body)) as unknown[]) ?? body;
    }
    body = body.map((b, i) => stubs[i] ?? b);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function signIn(ctx: BrowserContext) {
  const csrf = (await (
    await ctx.request.get(`${BASE}/api/auth/csrf`)
  ).json()) as { csrfToken: string };
  const res = await ctx.request.post(`${BASE}/api/auth/callback/credentials`, {
    form: {
      username: login.email,
      password: login.password,
      csrfToken: csrf.csrfToken,
      json: "true",
    },
  });
  if (!res.ok()) throw new Error(`sign in failed: ${res.status()}`);
}

const overflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  const phone = width === 375;
  const ctx = await browser.newContext({
    viewport: { width, height: phone ? 812 : 900 },
  });
  await signIn(ctx);
  const page = await ctx.newPage();
  await stub(page);
  const file = (name: string) => path.join(OUT, `${name}-${width}.png`);

  await page.goto(`${BASE}/internal/sponsor-schedule`, {
    waitUntil: "load",
    timeout: 180_000,
  });
  await page.getByRole("button", { name: "Coffee chats", exact: true }).click();
  await page
    .getByRole("region", { name: "Coffee chats by sponsor and time" })
    .waitFor();
  const panel = page.getByRole("complementary", {
    name: "Map and where everyone is",
  });
  await panel.getByText("Showing 10:30 AM").waitFor();
  await page.waitForTimeout(800);
  await page
    .getByRole("heading", { name: "Saturday coffee chats" })
    .scrollIntoViewIfNeeded();
  await page.screenshot({ path: file("1-table-panel") });
  if (phone) {
    // The panel stacks below the table on phones.
    await panel.scrollIntoViewIfNeeded();
    await page.screenshot({ path: file("1b-panel-below") });
  }
  console.log(`width ${width}: on load overflow ${await overflow(page)}px`);

  // Pick 11:30 AM in the table: the panel follows, the row is highlighted.
  const row = page.getByRole("button", { name: "Show 11:30 AM on the map" });
  await row.click();
  await panel.getByText("Showing 11:30 AM").waitFor();
  console.log(
    `width ${width}: row pressed=${await row.getAttribute("aria-pressed")}, live=${await panel.getByText("Picked in the table").count()}`,
  );
  if (phone) {
    await page.getByRole("heading", { name: "Where is everyone" }).click();
    await page
      .getByRole("button", { name: "Show Where is everyone" })
      .click();
  }
  await page.waitForTimeout(300);
  if (phone) await row.scrollIntoViewIfNeeded();
  await page.screenshot({ path: file("2-time-selected") });
  if (phone) {
    await panel.getByText("Showing 11:30 AM").scrollIntoViewIfNeeded();
    await page.screenshot({ path: file("2b-time-selected-panel") });
  }

  // Pick the Northwind pin: its column is highlighted and scrolled to.
  const pin = panel.getByRole("button", { name: /^Rm 2242: Northwind/ });
  console.log(`width ${width}: pin name "${await pin.getAttribute("aria-label")}"`);
  await pin.click();
  await panel.getByText("Highlighting Northwind in the table").waitFor();
  await page.waitForTimeout(600);
  console.log(
    `width ${width}: table scrollLeft ${await page
      .getByRole("region", { name: "Coffee chats by sponsor and time" })
      .evaluate((el) => el.scrollLeft)}`,
  );
  if (phone) {
    await page.screenshot({ path: file("3-pin-clicked") });
    await page
      .getByRole("region", { name: "Coffee chats by sponsor and time" })
      .scrollIntoViewIfNeeded();
    await page.screenshot({ path: file("3b-pin-column-highlighted") });
  } else {
    await page.screenshot({ path: file("3-pin-clicked") });
  }

  // Now resets to the clock.
  await panel.getByRole("button", { name: "Show the current time" }).click();
  await panel.getByText("Showing 10:30 AM").waitFor();
  console.log(`width ${width}: after Now overflow ${await overflow(page)}px`);
  await ctx.close();
}
await browser.close();
await sql.end();
