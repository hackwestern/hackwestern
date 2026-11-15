import { describe, expect, it } from "vitest";
import {
  defaultRunOfShowDay,
  isHappeningNow,
  runOfShowInstant,
} from "./run-of-show-time";

describe("run of show times", () => {
  it("places a day + time in Eastern time", () => {
    expect(runOfShowInstant("Saturday", "10:00").toISOString()).toBe(
      "2026-11-21T15:00:00.000Z",
    );
    expect(runOfShowInstant("Friday", "24:00").toISOString()).toBe(
      "2026-11-21T05:00:00.000Z",
    );
  });

  it("knows what's happening now (end is exclusive)", () => {
    const lunch = { day: "Saturday" as const, start: "12:00", end: "13:00" };
    expect(isHappeningNow(lunch, new Date("2026-11-21T17:30:00Z"))).toBe(true);
    expect(isHappeningNow(lunch, new Date("2026-11-21T18:00:00Z"))).toBe(false);
  });

  it("opens on today during the event, Friday before it", () => {
    expect(defaultRunOfShowDay(new Date("2026-11-14T12:00:00Z"))).toBe("Friday");
    expect(defaultRunOfShowDay(new Date("2026-11-21T16:00:00Z"))).toBe("Saturday");
    expect(defaultRunOfShowDay(new Date("2026-11-30T16:00:00Z"))).toBe("Sunday");
  });
});

describe("locationFor", () => {
  it("picks a sponsor's own room out of a shared location", async () => {
    const { locationFor } = await import("./run-of-show");
    const loc = "Scotiabank: Rm 2110, Canada Life: Rm 2230, QNX: Rm 2235";
    expect(locationFor(loc, "Scotiabank")).toBe("Rm 2110");
    expect(locationFor(loc, "canada life")).toBe("Rm 2230");
    expect(locationFor("Rm 1230", "Scotiabank")).toBe("Rm 1230");
  });
});
