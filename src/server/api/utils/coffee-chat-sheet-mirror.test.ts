import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
  vi,
} from "vitest";

import type * as Env from "~/env";
import type { CoffeeChatSetup } from "~/lib/run-of-show";
import type * as RunOfShowSheet from "~/server/api/utils/run-of-show-sheet";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import {
  BOOKINGS_TAB,
  MIRROR_TIMEOUT_MS,
  mirrorCoffeeChats,
} from "~/server/api/utils/coffee-chat-sheet-mirror";
import { db } from "~/server/db";
import {
  applications,
  coffeeChatHolds,
  sponsorJudgingSponsors,
  users,
} from "~/server/db/schema";

// A mocked Google Sheet: the bookings tab as an in-memory grid.
const sheet = vi.hoisted(() => ({
  tabs: ["RUN OF SHOW", "Coffee Chats"] as string[],
  grid: [] as string[][],
  fail: null as Error | null,
  scopes: [] as string[][],
  ranges: [] as string[],
}));

vi.mock("googleapis", () => {
  const guard = () => {
    if (sheet.fail) throw sheet.fail;
  };
  const sheets = {
    spreadsheets: {
      get: vi.fn(async () => {
        guard();
        return {
          data: {
            sheets: sheet.tabs.map((title) => ({ properties: { title } })),
          },
        };
      }),
      batchUpdate: vi.fn(
        async (req: {
          requestBody: {
            requests: { addSheet: { properties: { title: string } } }[];
          };
        }) => {
          guard();
          sheet.tabs.push(
            req.requestBody.requests[0]!.addSheet.properties.title,
          );
          return { data: {} };
        },
      ),
      values: {
        update: vi.fn(
          async (req: {
            range: string;
            requestBody: { values: string[][] };
          }) => {
            guard();
            sheet.ranges.push(req.range);
            req.requestBody.values.forEach((row, i) => (sheet.grid[i] = row));
            return { data: {} };
          },
        ),
        clear: vi.fn(async (req: { range: string }) => {
          guard();
          sheet.ranges.push(req.range);
          const from = Number(/!A(\d+):Z$/.exec(req.range)![1]);
          sheet.grid.length = Math.min(sheet.grid.length, from - 1);
          return { data: {} };
        }),
      },
    },
  };
  class JWT {
    constructor(opts: { scopes: string[] }) {
      sheet.scopes.push(opts.scopes);
    }
    async authorize() {
      guard();
    }
  }
  return { google: { auth: { JWT }, sheets: () => sheets } };
});

vi.mock("~/env", async (importOriginal) => {
  const original = await importOriginal<typeof Env>();
  return {
    env: {
      ...original.env,
      MAILJET_API_KEY: undefined,
      // Safe dummy so modules that read it at import load with no .env.
      R2_PUBLIC_BASE_URL:
        original.env.R2_PUBLIC_BASE_URL ?? "http://localhost:3024",
      SLACK_BOT_TOKEN: undefined,
      RUN_OF_SHOW_SHEET: "sheet-id",
      RUN_OF_SHOW_SHEETS_CLIENT_EMAIL: "bot@example.iam.gserviceaccount.com",
      RUN_OF_SHOW_SHEETS_PRIVATE_KEY: "not-a-real-key",
    },
  };
});

const setups: CoffeeChatSetup[] = [];
vi.mock("~/server/api/utils/run-of-show-sheet", async (importOriginal) => {
  const original = await importOriginal<typeof RunOfShowSheet>();
  return {
    ...original,
    getRunOfShow: vi.fn(async () => ({
      readAt: new Date().toISOString(),
      items: [],
      tasks: [],
      coffeeChats: setups,
    })),
  };
});

beforeAll(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
});
afterAll(() => {
  vi.useRealTimers();
});
beforeEach(() => {
  sheet.fail = null;
});

let n = 0;
function callerAs(userId: string | null) {
  return createCaller(
    createInnerTRPCContext({
      session: userId
        ? {
            user: { id: userId },
            expires: new Date(Date.now() + 60_000).toISOString(),
          }
        : null,
    }),
  );
}

async function makeSponsor() {
  const name = `Mirror Sponsor ${++n}`;
  const [row] = await db
    .insert(sponsorJudgingSponsors)
    .values({ name, coffeeChatStyle: "oneOnOne", coffeeChatPerSlot: 3 })
    .returning();
  setups.push({
    sponsor: name,
    windowStart: "10:00",
    windowEnd: "12:00",
    durationMinutes: 15,
    groupSize: 1,
    chattingHours: null,
    slots: null,
    hackers: null,
    format: "Individual (15 mins)",
    notes: null,
    room: "Rm 2241",
  });
  // Offers need a room block (blocks own rooms; v2). Its own room, so
  // sponsors from other tests never share it at the same time.
  const room = `Rm ${2300 + n}`;
  await db.insert(coffeeChatHolds).values({
    sponsorId: row!.id,
    room,
    startTime: "10:00",
    endTime: "11:30",
  });
  return { id: row!.id, name, room };
}

async function makeHacker(firstName: string) {
  const id = `mirror-hacker-${++n}`;
  await db.insert(users).values({
    id,
    email: `${id}@example.com`,
    name: firstName,
    type: "hacker",
  });
  await db.insert(applications).values({
    userId: id,
    status: "CONFIRMED",
    firstName,
    lastName: "Tester",
    githubLink: "",
    linkedInLink: "",
    devpostLink: "",
    resumeLink: "",
  });
  return id;
}

/** The bookings row for a chat, by its id in column A. */
function rowOf(chatId: string) {
  const index = sheet.grid.findIndex((row) => row[0] === chatId);
  return index < 0 ? null : { index, row: sheet.grid[index]! };
}

const STATUS = 6;

describe("coffee chat sheet mirror (T20)", () => {
  test("create, accept, decline, and expire each update the right row", async () => {
    const sponsor = await makeSponsor();
    const [ana, ben, cai] = await Promise.all([
      makeHacker("Ana"),
      makeHacker("Ben"),
      makeHacker("Cai"),
    ]);
    const sponsorCaller = callerAs(null);

    // Create: three offers, each its own row.
    const a = await sponsorCaller.coffeeChatRequests.offer({
      sponsor: sponsor.id,
      userId: ana,
      slotTime: "10:00",
    });
    const b = await sponsorCaller.coffeeChatRequests.offer({
      sponsor: sponsor.id,
      userId: ben,
      slotTime: "10:00",
    });
    const c = await sponsorCaller.coffeeChatRequests.offer({
      sponsor: sponsor.id,
      userId: cai,
      slotTime: "10:15",
    });
    await vi.waitFor(() => expect(rowOf(c.chatId)).not.toBeNull());
    await mirrorCoffeeChats(); // settle the queue

    expect(sheet.tabs).toContain(BOOKINGS_TAB);
    expect(sheet.grid[0]![0]).toBe("Chat ID");
    const rowA = rowOf(a.chatId)!;
    const rowB = rowOf(b.chatId)!;
    const rowC = rowOf(c.chatId)!;
    // One row per chat, under the header.
    expect([rowA.index, rowB.index, rowC.index].sort((x, y) => x - y)).toEqual([
      1, 2, 3,
    ]);
    expect(rowA.row).toEqual([
      a.chatId,
      sponsor.name,
      "Ana Tester",
      "10:00 AM",
      "15",
      sponsor.room,
      "Waiting for reply",
      "",
      expect.any(String),
      "",
    ]);

    // Accept: only Ana's row changes.
    await callerAs(ana).coffeeChatRequests.respond({
      chatId: a.chatId,
      answer: "accept",
    });
    await vi.waitFor(() =>
      expect(rowOf(a.chatId)!.row[STATUS]).toBe("Accepted"),
    );
    expect(rowOf(a.chatId)!.index).toBe(rowA.index);
    expect(rowOf(a.chatId)!.row[9]).not.toBe("");
    expect(rowOf(b.chatId)!.row[STATUS]).toBe("Waiting for reply");

    // Decline: only Ben's row changes.
    await callerAs(ben).coffeeChatRequests.respond({
      chatId: b.chatId,
      answer: "decline",
    });
    await vi.waitFor(() =>
      expect(rowOf(b.chatId)!.row[STATUS]).toBe("Declined"),
    );
    expect(rowOf(b.chatId)!.index).toBe(rowB.index);
    expect(rowOf(a.chatId)!.row[STATUS]).toBe("Accepted");
    expect(rowOf(c.chatId)!.row[STATUS]).toBe("Waiting for reply");

    // Expire: past 20 minutes before 10:15, Cai's unanswered request shows
    // as expired at the next write; the others keep their answers.
    vi.setSystemTime(new Date("2026-11-21T09:56:00-05:00"));
    await mirrorCoffeeChats();
    expect(rowOf(c.chatId)!.index).toBe(rowC.index);
    expect(rowOf(c.chatId)!.row[STATUS]).toBe("Expired");
    expect(rowOf(a.chatId)!.row[STATUS]).toBe("Accepted");
    expect(rowOf(b.chatId)!.row[STATUS]).toBe("Declined");
    vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
  });

  test("writes with the spreadsheets scope, not the read-only one", () => {
    expect(sheet.scopes).toContainEqual([
      "https://www.googleapis.com/auth/spreadsheets",
    ]);
  });

  test("a sheet failure never blocks the action and is logged once", async () => {
    const sponsor = await makeSponsor();
    const hacker = await makeHacker("Dee");
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    sheet.fail = new Error("The caller does not have permission");

    const offer = await callerAs(null).coffeeChatRequests.offer({
      sponsor: sponsor.id,
      userId: hacker,
      slotTime: "11:00",
    });
    const answer = await callerAs(hacker).coffeeChatRequests.respond({
      chatId: offer.chatId,
      answer: "accept",
    });
    await mirrorCoffeeChats();
    await mirrorCoffeeChats();

    expect(offer.status).toBe("pending");
    expect(answer.status).toBe("accepted");
    const mirrorLogs = log.mock.calls.filter((args) =>
      String(args[0]).startsWith("coffee chat sheet mirror failed"),
    );
    expect(mirrorLogs).toHaveLength(1);
    expect(String(mirrorLogs[0]![0])).toContain(
      "The caller does not have permission",
    );
    expect(String(mirrorLogs[0]![0])).not.toContain("not-a-real-key");
    log.mockRestore();
  });

  test("only the bookings tab is ever written or cleared", async () => {
    await mirrorCoffeeChats();
    expect(sheet.ranges.length).toBeGreaterThan(0);
    for (const range of sheet.ranges) {
      expect(range.startsWith(`'${BOOKINGS_TAB}'!`)).toBe(true);
    }
  });

  test("a hung Sheets call times out so later writes still run", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date", "setTimeout", "clearTimeout"] });
    vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));

    let done = false;
    const hung = mirrorCoffeeChats({
      sheet: () => new Promise(() => undefined),
    }).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(MIRROR_TIMEOUT_MS - 1);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await hung;
    expect(done).toBe(true);
    expect(String(log.mock.calls.at(-1)?.[0])).toContain(
      `timed out after ${MIRROR_TIMEOUT_MS} ms`,
    );

    vi.useRealTimers();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-21T08:00:00-05:00"));
    // The queue moved on: the next write goes through.
    sheet.grid.length = 0;
    await mirrorCoffeeChats();
    expect(sheet.grid[0]?.[0]).toBe("Chat ID");
    log.mockRestore();
  });
});
