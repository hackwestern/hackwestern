// Organizer dashboard redesign screenshots (before/after).
//   npx tsx mocks/organizer-redesign-v1/capture.mts <before|after>
// Dev server on :3020 against hackwestern_spon. Signs in as the local test
// organizer (redesign-organizer-1) with a minted next-auth JWT. Sheet reads
// are stubbed in the browser with fixtures (locally they have no creds);
// chats, sponsors and the summary come from the real DB. Help requests are
// stubbed too so nothing is written. Clock: Saturday 10:40 AM Eastern.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encode } from "next-auth/jwt";
import { chromium, type Page } from "playwright";
import postgres from "postgres";
import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import type { CoffeeChatSetup, RunOfShowItem } from "~/lib/run-of-show";
import { buildChatBoard } from "~/server/api/utils/coffee-chat-board";

const OUT = path.dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3020";
const NOW = new Date("2026-11-21T10:40:00-05:00");
const label = process.argv[2] ?? "after";
const sql = postgres(
  "postgresql://postgres:postgres@localhost:5432/hackwestern_spon",
);

const dbSponsors = await sql<
  {
    id: string;
    name: string;
    reps: number;
    assignedRoom: string | null;
    watcher: string | null;
  }[]
>`select id, name, coffee_chat_reps as reps, coffee_chat_room as "assignedRoom",
    coffee_chat_watcher as watcher from sponsor_judging_sponsor order by name`;

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
  cc("Redesign Demo Co", "10:00", "12:00", "Rm 2241"),
  cc("Northwind Robotics Demo", "10:30", "12:30", "Rm 2242", 30, 3),
  cc("StarTech", "10:00", "11:00", "Rm 2243"),
  cc("Sun Life", "10:30", "11:30", "Rm 2241", 30),
  cc("Scotiabank", null, null, null),
];

const statuses = [
  "Not arrived",
  "Checked in",
  "Booth set up",
  "Workshop live",
  "Left",
] as const;
const sponsorRows = [
  ...dbSponsors.map((s, i) => ({
    name: s.name,
    tier: ["Gold", "Silver", "Bronze", "Platinum"][i % 4]!,
    amount: "",
    companyContact: i % 3 === 0 ? "" : `Rep ${i + 1}`,
    hwContact: ["Ana", "Ben", "Chris", "—"][i % 4]!,
    notes: i === 2 ? "Bringing two extra banners; needs a power bar at the booth." : "",
    sponsorId: s.id,
    teamIds: i % 2 === 0 ? ["t1", "t2", "t3"] : [],
    status: statuses[i % statuses.length]!,
    roomNumber: i % 3 === 1 ? "TBD" : `Rm 22${30 + i}`,
    boothLocation: i % 3 === 2 ? "TBD" : `Booth ${i + 1}`,
    onMasterSheet: true,
  })),
  {
    name: "The Extraordinarily Long Named Financial Technology Corporation of Canada",
    tier: "Title",
    amount: "",
    companyContact: "",
    hwContact: "Dana",
    notes: "",
    sponsorId: null,
    teamIds: [],
    status: "Not arrived" as const,
    roomNumber: "TBD",
    boothLocation: "TBD",
    onMasterSheet: true,
  },
  {
    name: "Typo Sponsr Inc",
    tier: "",
    amount: "",
    companyContact: "",
    hwContact: "—",
    notes: "Registered but missing from the master sheet",
    sponsorId: null,
    teamIds: [],
    status: "Not arrived" as const,
    roomNumber: "TBD",
    boothLocation: "TBD",
    onMasterSheet: false,
  },
];

const item = (
  start: string,
  end: string,
  column: string,
  title: string,
  location: string | null,
  sponsors: string[] = [],
): RunOfShowItem =>
  ({
    id: `Saturday-${start}-${column}-${title}`,
    day: "Saturday",
    start,
    end,
    column,
    title,
    location,
    sponsors,
  }) as RunOfShowItem;
const organizer = () => ({
  readAt: NOW.toISOString(),
  sheetUrl: "https://docs.google.com/spreadsheets/d/example",
  items: [
    item("08:00", "09:30", "food", "Breakfast", "SM Atrium"),
    item("09:30", "10:00", "big-event", "Hacking check-in", "Alumni Hall"),
    item("10:00", "11:00", "sponsor-workshop", "StarTech workshop: accessible dashboards", "Rm 2110", ["StarTech"]),
    item("10:00", "16:00", "spon-booth", "Sponsor Bay", "SM Atrium"),
    item("12:00", "13:00", "food", "Lunch", "SM Atrium"),
  ],
  tasks: [
    { day: "Saturday", start: "10:00", task: "Move tables for StarTech workshop", owner: "Chris" },
    { day: "Saturday", start: "11:30", task: "Lunch setup with catering", owner: null },
  ],
  coffeeChats: setups,
  ceremonies: [
    { ceremony: "opening", order: 1, start: "19:30", durationMinutes: 5, title: "Welcome", sponsor: null, speakers: ["Co-chairs"] },
    { ceremony: "opening", order: 2, start: "19:35", durationMinutes: 3, title: "StarTech", sponsor: "StarTech", speakers: ["Jordan Lee"] },
    { ceremony: "closing", order: 1, start: null, durationMinutes: 4, title: "Sun Life", sponsor: "Sun Life", speakers: [] },
  ],
  workshops: [],
});
const companies = () => ({
  readAt: NOW.toISOString(),
  sponsorBay: [item("09:00", "17:00", "spon-booth", "Sponsor Bay", "SM Atrium")],
  companies: setups.map((s) => ({ name: s.sponsor, items: [], coffeeChat: s })),
});

async function board() {
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
      sponsors: [...dbSponsors],
      setups,
      chats: [...chats],
      now: NOW,
    }),
    rooms: ["Rm 2241", "Rm 2242", "Rm 2243"],
    assignableRooms: ["Rm 2241", "Rm 2242", "Rm 2243"],
    watchers: ["Redesign Organizer", "Sam Kim"],
    readAt: NOW.toISOString(),
  };
}

const byName = (n: string) => dbSponsors.find((s) => s.name === n);
const help = () => [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000001",
    sponsorId: byName("StarTech")?.id ?? dbSponsors[0]!.id,
    sponsorName: "StarTech",
    reason: "power",
    note: "The power bar at our booth stopped working and the demo laptop is at 12%. Could someone bring an extension cord?",
    location: "Booth 4",
    repName: "Jordan Lee",
    phone: "519-555-0142",
    locationNote: null,
    status: "open",
    claimedByName: null,
    postedToSlack: true,
    createdAt: new Date(NOW.getTime() - 7 * 60_000).toISOString(),
    claimedAt: null,
  },
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-000000000002",
    sponsorId: byName("Sun Life")?.id ?? dbSponsors[1]!.id,
    sponsorName: "Sun Life",
    reason: "other",
    note: null,
    location: null,
    repName: null,
    phone: null,
    locationNote: "Room 2230, by the projector",
    status: "claimed",
    claimedByName: "Sam Kim",
    postedToSlack: false,
    createdAt: new Date(NOW.getTime() - 22 * 60_000).toISOString(),
    claimedAt: new Date(NOW.getTime() - 15 * 60_000).toISOString(),
  },
];

const ok = (json: unknown) => ({ result: { data: { json } } });

async function stubFor(proc: string): Promise<unknown> {
  switch (proc) {
    case "sponsorDashboard.getSponsors":
      return ok(sponsorRows);
    case "sponsorSchedule.organizer":
      return ok(organizer());
    case "sponsorSchedule.organizerCompanies":
      return ok(companies());
    case "coffeeChatRequests.organizerChatBoard":
      return ok(await board());
    case "sponsorHelp.list":
      return ok(help());
    default:
      return null;
  }
}

// The summary is real (DB) with the stubbed help requests folded in.
function patchSummary(b: unknown): unknown {
  const data = (b as { result?: { data?: { json?: { sponsors: { sponsorId: string; help: unknown }[] } } } })
    ?.result?.data?.json;
  if (!data) return b;
  for (const h of help()) {
    const row = data.sponsors.find((s) => s.sponsorId === h.sponsorId);
    if (row)
      row.help = {
        id: h.id,
        status: h.status,
        claimedByName: h.claimedByName,
        createdAt: h.createdAt,
      };
  }
  Object.assign(data, { liveHelp: 2, openHelp: 1 });
  return b;
}

async function stub(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/schedule", (route) =>
    route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
  );
  await page.route("**/api/trpc/**", async (route) => {
    if (route.request().method() !== "GET") return route.continue();
    const url = new URL(route.request().url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    const stubs = await Promise.all(procs.map((p) => stubFor(p)));
    const needsSummary = procs.includes("sponsorOrganizer.summary");
    if (stubs.every((s) => s === null) && !needsSummary) return route.continue();
    let body: unknown[] = procs.map(() => null);
    if (stubs.some((s) => s === null)) {
      const res = await route.fetch();
      body = ((await res.json().catch(() => body)) as unknown[]) ?? body;
    }
    body = body.map((b, i) =>
      procs[i] === "sponsorOrganizer.summary" ? patchSummary(b) : (stubs[i] ?? b),
    );
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

const browser = await chromium.launch();
for (const width of [1280, 1440, 390]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 390 ? 844 : 900 },
  });
  await ctx.addCookies([
    { name: "next-auth.session-token", value: token, url: BASE },
  ]);
  const page = await ctx.newPage();
  await stub(page);
  for (const tab of ["sponsors", "schedule", "coffee", "help"]) {
    await page.goto(`${BASE}/internal/sponsors?tab=${tab}`, {
      waitUntil: "networkidle",
      timeout: 180_000,
    });
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(OUT, `${label}-${tab}-${width}.png`),
      fullPage: true,
    });
    const overflow = await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    );
    console.log(`${label} ${tab} @${width}: horizontal overflow ${overflow}px`);
    if (width === 390) {
      // Headless Chrome leaves the lower page blank in tall phone shots, so
      // grow the viewport to the page and cut it into phone-sized parts.
      const height = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await page.setViewportSize({ width, height });
      await page.waitForTimeout(500);
      for (let y = 0, n = 1; y < height && n <= 8; y += 844, n++) {
        await page.screenshot({
          path: path.join(OUT, `${label}-${tab}-${width}-part${n}.png`),
          clip: { x: 0, y, width, height: Math.min(844, height - y) },
        });
      }
      await page.setViewportSize({ width, height: 844 });
    }
  }
  // Focused flow: Run of show for one sponsor, with the back link.
  const sid = byName("StarTech")?.id;
  if (sid) {
    await page.goto(`${BASE}/internal/sponsors?tab=coffee&sponsor=${sid}`, {
      waitUntil: "networkidle",
    });
    await page.waitForTimeout(1200);
    await page.screenshot({
      path: path.join(OUT, `${label}-focus-coffee-${width}.png`),
    });
  }
  await ctx.close();
}
await browser.close();
await sql.end();
