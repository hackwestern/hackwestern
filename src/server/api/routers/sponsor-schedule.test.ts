import { afterAll, beforeAll, describe, expect, test, vi } from "vitest";
import { inArray } from "drizzle-orm";
import { db } from "~/server/db";
import { createCaller } from "~/server/api/root";
import { createInnerTRPCContext } from "~/server/api/trpc";
import { sponsorJudgingSponsors } from "~/server/db/schema";
import type { RunOfShowItem } from "~/lib/run-of-show";

const { alphaName, betaName } = vi.hoisted(() => {
  const stamp = Date.now();
  return { alphaName: `AlphaCo${stamp}`, betaName: `BetaCo${stamp}` };
});

vi.mock("~/server/api/utils/run-of-show-sheet", () => {
  const item = (
    column: RunOfShowItem["column"],
    start: string,
    title: string,
    location: string | null = null,
  ) => ({
    id: `Saturday-${start}-${column}`,
    day: "Saturday",
    start,
    end: "11:00",
    column,
    title,
    location,
    sponsors: [],
  });
  return {
    runOfShowSheetUrl: () => "https://docs.google.com/spreadsheets/d/fake/edit",
    getRunOfShow: () =>
      Promise.resolve({
        readAt: "2026-11-15T12:00:00.000Z",
        items: [
          item("big-event", "09:00", "Opening Ceremony"),
          item("food", "12:00", "Lunch"),
          item("sponsor-workshop", "10:00", `${alphaName} Workshop`, "Rm 101"),
          item("sponsor-workshop", "11:00", `${betaName} Workshop`, "Rm 202"),
          {
            ...item(
              "sponsor-workshop",
              "13:00",
              "Shared Panel",
              `${alphaName}: Rm 2110, ${betaName}: Rm 2230`,
            ),
            sponsors: [alphaName, betaName],
          },
        ],
        tasks: [
          {
            day: "Saturday",
            start: "08:00",
            task: "Set up registration",
            owner: "Sam",
          },
        ],
        coffeeChats: [],
      }),
  };
});

let alphaId: string;

const publicCaller = createCaller(createInnerTRPCContext({ session: null }));

beforeAll(async () => {
  const rows = await db
    .insert(sponsorJudgingSponsors)
    .values([{ name: alphaName }, { name: betaName }])
    .returning({ id: sponsorJudgingSponsors.id, name: sponsorJudgingSponsors.name });
  alphaId = rows.find((r) => r.name === alphaName)!.id;
});

afterAll(async () => {
  await db
    .delete(sponsorJudgingSponsors)
    .where(inArray(sponsorJudgingSponsors.name, [alphaName, betaName]));
});

describe("sponsorSchedule input checks", () => {
  test("rejects a non-UUID sponsor", async () => {
    await expect(
      publicCaller.sponsorSchedule.get({ sponsor: "not-a-uuid" }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  test("unknown sponsor UUID is NOT_FOUND", async () => {
    const unknown = "00000000-0000-4000-8000-000000000000";
    await expect(
      publicCaller.sponsorSchedule.get({ sponsor: unknown }),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });
});

describe("sponsorSchedule.get", () => {
  test("returns all-hands items, never sheetUrl or tasks", async () => {
    const result = await publicCaller.sponsorSchedule.get({ sponsor: alphaId });
    const titles = result.items.map((i) => i.title);
    expect(titles).toContain("Opening Ceremony");
    expect(titles).toContain("Lunch");
    expect(result).not.toHaveProperty("sheetUrl");
    expect(result).not.toHaveProperty("tasks");
  });

  test("includes this sponsor's own items but not other companies'", async () => {
    const result = await publicCaller.sponsorSchedule.get({ sponsor: alphaId });
    const titles = result.items.map((i) => i.title);
    expect(titles).toContain(`${alphaName} Workshop`);
    expect(titles).not.toContain(`${betaName} Workshop`);
    expect(result.sponsorName).toBe(alphaName);
  });
});

describe("sponsorSchedule.get shared rooms", () => {
  test("trims a shared location to the sponsor's own room", async () => {
    const result = await publicCaller.sponsorSchedule.get({ sponsor: alphaId });
    const shared = result.items.find((i) => i.title === "Shared Panel");
    expect(shared?.location).toBe("Rm 2110");
    expect(shared?.sponsors).toEqual([alphaName]);
    expect(JSON.stringify(result)).not.toContain(betaName + ": ");
    expect(JSON.stringify(result)).not.toContain("Rm 2230");
  });
});

describe("sponsorSchedule.companies", () => {
  test("no longer exists as a public procedure", () => {
    expect(publicCaller.sponsorSchedule).not.toHaveProperty("companies");
  });
});

describe("sponsorSchedule.organizerCompanies", () => {
  test("rejects a logged-out caller", async () => {
    await expect(
      publicCaller.sponsorSchedule.organizerCompanies(),
    ).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });
});

describe("sponsorSchedule.organizer", () => {
  test("rejects a logged-out caller", async () => {
    await expect(publicCaller.sponsorSchedule.organizer()).rejects.toMatchObject(
      { code: "UNAUTHORIZED" },
    );
  });
});
