// Screenshots for T48 (organizer coffee chat board). Run with
//   npx tsx mocks/coffee-chat-board-v1/capture.mts
// against the dev server on :3021 (hackwestern_sd_chat, after seed.mjs).
// The run-of-show sheet isn't reachable locally, so calls that read it are
// stubbed in the browser with fixtures. The board itself is built from the
// real DB chats with the real buildChatBoard and the fixture sheet rows;
// cancel, move room and hacker search hit the real server. The page clock
// is Saturday 10:40 AM, during coffee chats.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, type Page, type BrowserContext } from "playwright";
import postgres from "postgres";
import type { CoffeeChatStatus } from "~/lib/coffee-chat-requests";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
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
// The sheet's Coffee Chats tab.
const setups = [
  cc("StarTech", "10:00", "12:00", "Rm 2241"),
  cc("Northwind", "10:30", "12:30", "Rm 2242", 30, 3),
  cc("Maple Labs", "10:00", "11:00", "Rm 2243"),
  cc("Lumen AI", "11:00", "12:00", null),
  cc("Northwind Robotics", "13:00", "14:00", "Rm 2245", 30, 3),
  cc("Sun Life", null, null, null),
];

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
const err = (proc: string, code: string, httpStatus: number, message: string) => ({
  error: { json: { message, code: -32009, data: { code, httpStatus, path: proc } } },
});

type Input = Record<string, string> | undefined;
async function stubFor(proc: string, input: Input) {
  switch (proc) {
    case "sponsorSchedule.organizer":
      return ok(organizer());
    case "coffeeChatRequests.organizerChatBoard":
      return ok(await board());
    case "coffeeChatRequests.assignCoffeeChatRoom":
      // Northwind (10:30-12:30) into 2241 overlaps StarTech (10:00-12:00).
      return err(
        proc,
        "CONFLICT",
        409,
        "StarTech already has Rm 2241 from 10:00 AM to 12:00 PM, which overlaps this window.",
      );
    case "coffeeChatRequests.organizerOffer":
      return ok({
        chatId: "00000000-0000-4000-8000-0000000000aa",
        firstName: "Alex",
        slotTime: input?.slotTime,
        durationMinutes: 15,
        room: "Rm 2241",
        status: "pending",
        expiresAt: NOW.toISOString(),
      });
    default:
      return null;
  }
}

async function stub(page: Page) {
  await page.clock.setFixedTime(NOW);
  await page.route("**/api/trpc/**", async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const procs = url.pathname.replace("/api/trpc/", "").split(",");
    let inputs: Record<string, { json?: Input }> = {};
    const raw =
      req.method() === "POST" ? req.postData() : url.searchParams.get("input");
    if (raw) inputs = JSON.parse(raw) as typeof inputs;
    const stubs = await Promise.all(
      procs.map((p, i) => stubFor(p, inputs[i]?.json)),
    );
    if (stubs.every((s) => s === null)) return route.continue();
    let body: unknown[] = procs.map(() => null);
    if (stubs.some((s) => s === null)) {
      const res = await route.fetch();
      body = ((await res.json().catch(() => body)) as unknown[]) ?? body;
    }
    body = body.map((b, i) => stubs[i] ?? b);
    const errors = body.filter(
      (b) => (b as { error?: unknown } | null)?.error,
    ) as ReturnType<typeof err>[];
    await route.fulfill({
      status:
        errors.length === 0
          ? 200
          : body.length === 1
            ? errors[0]!.error.json.data.httpStatus
            : 207,
      contentType: "application/json",
      body: JSON.stringify(body),
    });
  });
}

async function signIn(ctx: BrowserContext) {
  const csrf = (await (await ctx.request.get(`${BASE}/api/auth/csrf`)).json()) as {
    csrfToken: string;
  };
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

const browser = await chromium.launch();
for (const width of [375, 1280]) {
  const ctx = await browser.newContext({
    viewport: { width, height: width === 375 ? 812 : 900 },
  });
  await signIn(ctx);
  const page = await ctx.newPage();
  await stub(page);
  const file = (name: string) => path.join(OUT, `${name}-${width}.png`);

  await page.goto(`${BASE}/internal/sponsor-schedule`, {
    waitUntil: "networkidle",
  });
  await page.getByRole("button", { name: "Coffee chats", exact: true }).click();
  const table = page.getByRole("region", {
    name: "Coffee chats by sponsor and time",
  });
  await table.waitFor();
  await page.waitForTimeout(500);
  await page
    .getByRole("heading", { name: "Saturday coffee chats" })
    .scrollIntoViewIfNeeded();
  console.log(
    `width ${width}: on load`,
    await page.evaluate(() => {
      const wide = [...document.querySelectorAll("body *")]
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.right > window.innerWidth + 2 && !el.closest("[role=region]") && !el.closest("nav");
        })
        .slice(0, 8)
        .map((el) => `${el.tagName}.${String(el.className).slice(0, 60)}`);
      return [document.documentElement.scrollWidth, document.body.scrollWidth, ...wide];
    }),
  );
  await page.screenshot({ path: file("1-table") });

  // A cell: StarTech at 10:45 (one accepted, one declined).
  const cell = page.getByRole("button", { name: /^StarTech, 10:45 AM/ });
  await cell.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: "StarTech at 10:45 AM" });
  await dialog.waitFor();
  await page.waitForTimeout(400);
  await page.screenshot({ path: file("2-cell-panel") });

  // Add a chat here at StarTech 11:30 (10:45 is past its reply cutoff):
  // real search, stubbed offer (the offer reads the sheet).
  await page.keyboard.press("Escape");
  await dialog.waitFor({ state: "detached" });
  await page.getByRole("button", { name: /^StarTech, 11:30 AM/ }).click();
  const addDialog = page.getByRole("dialog", { name: "StarTech at 11:30 AM" });
  await addDialog.waitFor();
  await addDialog.getByLabel("Hacker").fill("otter");
  await addDialog.getByRole("button", { name: /Alex Example/ }).click();
  await addDialog.getByLabel("Rep name (optional)").fill("Dana");
  await addDialog.getByRole("heading", { name: "Add a chat here" }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: file("3-add-chat-here") });
  await addDialog.getByRole("button", { name: "Add chat" }).click();
  await addDialog.getByText("Sent Alex Example a request").waitFor();
  await page.screenshot({ path: file("4-add-chat-sent") });

  // Escape closes and returns focus to the cell.
  await page.keyboard.press("Escape");
  await addDialog.waitFor({ state: "detached" });
  await page.waitForTimeout(300);
  const focused = await page.evaluate(() => {
    const el = document.activeElement;
    return `${el?.tagName} ${el?.getAttribute("data-cell") ?? el?.id ?? ""}`;
  });
  console.log(`width ${width}: focus after Escape -> "${focused}"`);

  // Room clash: Northwind -> Rm 2241 overlaps StarTech.
  const room = page.locator("#board-room-33333333-3333-4333-8333-333333333333");
  await room.scrollIntoViewIfNeeded();
  await room.selectOption("Rm 2241");
  await page.getByText("StarTech already has Rm 2241").waitFor();
  await page.waitForTimeout(200);
  await page.screenshot({ path: file("5-room-clash") });

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
  console.log(`width ${width}: page horizontal overflow ${overflow}px`);
  await ctx.close();
}
await browser.close();
await sql.end();
