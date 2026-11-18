import { describe, expect, it } from "vitest";
import type { CompanyLocations, RunOfShowItem } from "~/lib/run-of-show";
import { runOfShowInstant } from "~/lib/run-of-show-time";
import { sponsorMapOccupancy } from "~/lib/sponsor-map";
import { mapRoomFor, SPONSOR_MAP_ROOMS } from "~/lib/sponsor-map-rooms";

const item = (over: Partial<RunOfShowItem>): RunOfShowItem => ({
  id: "x",
  day: "Saturday",
  start: "10:00",
  end: "11:00",
  column: "sponsor-workshop",
  title: "Workshop",
  location: null,
  sponsors: [],
  ...over,
});

describe("mapRoomFor", () => {
  it("matches room numbers first, then names", () => {
    expect(mapRoomFor("Rm 2230 (50)")?.id).toBe("2230");
    expect(mapRoomFor("Grand Hall (Rm 1110)")?.id).toBe("1110");
    expect(mapRoomFor("SM Atrium")?.id).toBe("1235");
    expect(mapRoomFor("rm 2242")?.id).toBe("2242");
    expect(mapRoomFor("Somewhere else")).toBeNull();
    expect(mapRoomFor(null)).toBeNull();
  });

  it("every pin is on its image and ids are unique", () => {
    for (const r of SPONSOR_MAP_ROOMS) {
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x).toBeLessThanOrEqual(100);
      expect(r.y).toBeGreaterThanOrEqual(0);
      expect(r.y).toBeLessThanOrEqual(100);
    }
    const ids = SPONSOR_MAP_ROOMS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("sponsorMapOccupancy", () => {
  const data: Pick<CompanyLocations, "companies" | "sponsorBay"> = {
    sponsorBay: [
      item({
        column: "spon-booth",
        start: "09:00",
        end: "18:00",
        title: "Sponsor Bay",
        location: "SM Atrium",
      }),
    ],
    companies: [
      {
        name: "Scotiabank",
        items: [
          item({
            title: "Scotiabank Workshop",
            location: "Scotiabank: Rm 2110, Canada Life: Rm 2230",
            sponsors: ["Scotiabank", "Canada Life"],
          }),
        ],
        coffeeChat: null,
      },
      {
        name: "Canada Life",
        items: [
          item({
            title: "Scotiabank Workshop",
            location: "Scotiabank: Rm 2110, Canada Life: Rm 2230",
            sponsors: ["Scotiabank", "Canada Life"],
          }),
        ],
        coffeeChat: null,
      },
      {
        name: "Acme",
        items: [],
        coffeeChat: {
          sponsor: "Acme",
          windowStart: "10:30",
          windowEnd: "12:00",
          durationMinutes: 15,
          groupSize: 1,
          chattingHours: null,
          slots: null,
          hackers: null,
          format: null,
          notes: null,
          room: "Rm 2241",
        },
      },
      { name: "Quiet", items: [], coffeeChat: null },
    ],
  };

  it("places each sponsor by item, then coffee chat, then the bay", () => {
    const at = runOfShowInstant("Saturday", "10:45");
    const { byRoom, unplaced } = sponsorMapOccupancy(
      data,
      { Acme: "Wendy" },
      at,
    );
    expect(byRoom["2110"]?.map((e) => e.sponsor)).toEqual(["Scotiabank"]);
    expect(byRoom["2230"]?.map((e) => e.sponsor)).toEqual(["Canada Life"]);
    expect(byRoom["2241"]).toEqual([
      {
        sponsor: "Acme",
        kind: "coffee",
        title: "",
        location: "Rm 2241",
        watcher: "Wendy",
      },
    ]);
    expect(byRoom["1235"]?.map((e) => e.sponsor)).toEqual(["Quiet"]);
    expect(unplaced).toEqual([]);
  });

  it("outside every block, nobody is placed", () => {
    const at = runOfShowInstant("Sunday", "23:00");
    expect(sponsorMapOccupancy(data, {}, at)).toEqual({
      byRoom: {},
      unplaced: [],
    });
  });

  it("coffee chats without a room are listed as unplaced", () => {
    const at = runOfShowInstant("Saturday", "11:30");
    const noRoom = {
      ...data,
      companies: data.companies.map((c) =>
        c.coffeeChat
          ? { ...c, coffeeChat: { ...c.coffeeChat, room: null } }
          : c,
      ),
    };
    expect(
      sponsorMapOccupancy(noRoom, {}, at).unplaced.map((e) => e.sponsor),
    ).toEqual(["Acme"]);
  });
});
