import type { DaySchedule, ParsedScheduleEvent } from "~/types/schedule";
import { getTimeInMinutes } from "~/lib/schedule";

// Floor plans for the live map: the Schmeichel Building (SEI, floors 1 and 2)
// and the Ivey Business School ground floor ("floor" 3, its own plan space).
// SEI's long wing is a rectangle rotated about 31 degrees, so its rooms are
// placed in the wing's own axes.

export type Point = [number, number];
export type Zone =
  | "hack"
  | "help"
  | "learn"
  | "expo"
  | "lounge"
  | "stage"
  | "lab"
  | "staff";
/** 1 and 2 are SEI levels; 3 is the Ivey building */
export type Floor = 1 | 2 | 3;
export const IVEY: Floor = 3;
export const IVEY_ADDRESS =
  "Richard Ivey Building, 1255 Western Road. A separate building from the SEI.";

const P = (s: number, t: number): Point => [
  Math.round(325 + 0.858 * s + 0.513 * t),
  Math.round(990 - 0.513 * s + 0.858 * t),
];
const W = (s0: number, s1: number, t0: number, t1: number): Point[] => [
  P(s0, t0),
  P(s1, t0),
  P(s1, t1),
  P(s0, t1),
];
const B = (x0: number, y0: number, x1: number, y1: number): Point[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
];

export const ZONES: Record<Zone, { label: string; color: string }> = {
  hack: { label: "Hacking", color: "#2F6BDB" },
  help: { label: "Help desk", color: "#C2410C" },
  learn: { label: "Workshops", color: "#2E9E4F" },
  expo: { label: "Sponsors", color: "#E0702B" },
  lounge: { label: "Coffee chats", color: "#8B3FD9" },
  stage: { label: "Ceremonies", color: "#D4457A" },
  lab: { label: "Makerspace", color: "#0F8F86" },
  staff: { label: "Staff only", color: "#6B7A90" },
};

export interface Room {
  id: string;
  name: string;
  /** Shorter name for the map when the full name does not fit */
  short: string;
  zone: Zone;
  floor: Floor;
  poly: Point[];
  about: string;
  note?: string;
  /** Extra words people might search for */
  keywords?: string;
  /** Shown instead of "Room <id>" when the space has no room number */
  place?: string;
}

const room = (r: Omit<Room, "short"> & { short?: string }): Room => ({
  ...r,
  short: r.short ?? r.name,
});

export interface FloorPlan {
  outline: Point[];
  rooms: Room[];
  /** Washrooms, stairs, offices: drawn but not selectable */
  service: Point[][];
  /** Open to the floor below */
  voids: Point[][];
}

export const FLOORS: Record<Floor, FloorPlan> = {
  1: {
    outline: [
      [365, 967],
      [1335, 388],
      [1437, 555],
      [1398, 580],
      [1425, 625],
      [1470, 652],
      [1613, 655],
      [1613, 905],
      [1573, 905],
      [1573, 1198],
      [1340, 1198],
      [1340, 945],
      [1305, 915],
      [1230, 908],
      [1020, 908],
      [940, 915],
      [900, 935],
      [780, 1010],
      [520, 1172],
      [485, 1172],
      [480, 1160],
    ],
    rooms: [
      room({
        id: "1235",
        name: "Sponsor Bay",
        short: "Sponsors",
        zone: "expo",
        floor: 1,
        poly: W(46, 285, 0, 264),
        about: "Sponsor booths. Listed as the SM Atrium on the schedule.",
        keywords: "SM Atrium booths",
      }),
      room({
        id: "1230",
        name: "Hacker Workspace",
        short: "Hacking",
        zone: "hack",
        floor: 1,
        poly: W(285, 505, 0, 264),
        about: "Hacking space and activities, near the Founders Cafe.",
      }),
      room({
        id: "1110",
        name: "Grand Hall",
        zone: "hack",
        floor: 1,
        poly: B(1342, 760, 1565, 1195),
        about:
          "Registration, meals, hacking and activities. Main judging and the closing ceremony are here on Sunday.",
      }),
      room({
        id: "help",
        name: "Help Desk",
        short: "Help desk",
        zone: "help",
        floor: 1,
        poly: B(1262, 776, 1330, 856),
        place: "Table in front of the Grand Hall",
        about:
          "Late check-in, hardware (including MLH hardware), the scavenger hunt shop, lost Hacker ID cards and help from organizers.",
        keywords: "hardware MLH scavenger shop check-in lost found",
      }),
    ],
    service: [
      W(505, 572, 0, 205),
      W(572, 662, 0, 205),
      W(662, 790, 0, 205),
      W(790, 848, 0, 205),
      W(848, 905, 0, 192),
      W(905, 955, 0, 160),
      W(955, 1090, 0, 200),
      W(1090, 1180, 0, 200),
      B(1395, 655, 1613, 757),
      B(1343, 733, 1392, 757),
      B(1565, 760, 1613, 790),
      B(1565, 795, 1613, 905),
    ],
    voids: [],
  },
  2: {
    outline: [
      [325, 990],
      [1335, 386],
      [1425, 545],
      [1455, 600],
      [1500, 632],
      [1612, 622],
      [1612, 910],
      [1575, 902],
      [1575, 1207],
      [1330, 1207],
      [1340, 940],
      [1310, 910],
      [1010, 908],
      [940, 930],
      [460, 1217],
    ],
    rooms: [
      room({
        id: "2247",
        name: "3D Western Makerspace",
        short: "Makerspace",
        zone: "lab",
        floor: 2,
        poly: W(0, 200, 0, 264),
        about: "3D printing with 3D Western.",
        note: "Training is required before you use the makerspace.",
        keywords: "3D printing printer",
      }),
      room({
        id: "2244",
        name: "Sponsor Storage",
        short: "Storage",
        zone: "staff",
        floor: 2,
        poly: W(200, 268, 62, 112),
        about: "Sponsors only.",
      }),
      room({
        id: "2245",
        name: "Staff Storage",
        short: "Storage",
        zone: "staff",
        floor: 2,
        poly: W(200, 268, 112, 150),
        about:
          "Organizer, volunteer and mentor storage (rooms 2245 and 2246). Staff only.",
      }),
      room({
        id: "2243",
        name: "Coffee Chats",
        short: "Chats",
        zone: "lounge",
        floor: 2,
        poly: W(335, 392, 12, 65),
        about: "Coffee chats, interviews and lounging.",
        keywords: "interviews",
      }),
      room({
        id: "2242",
        name: "Coffee Chats",
        short: "Chats",
        zone: "lounge",
        floor: 2,
        poly: W(340, 392, 70, 132),
        about: "Coffee chats, interviews and lounging.",
        keywords: "interviews",
      }),
      room({
        id: "2241",
        name: "Coffee Chats",
        short: "Chats",
        zone: "lounge",
        floor: 2,
        poly: W(330, 392, 136, 196),
        about: "Coffee chats, interviews and lounging.",
        keywords: "interviews",
      }),
      room({
        id: "2235",
        name: "Workshop Room 2235",
        short: "Workshops",
        zone: "learn",
        floor: 2,
        poly: W(392, 502, 0, 188),
        about: "Workshops and activities.",
        note: "Women's sleeping room from 10 p.m. Friday and Saturday.",
        keywords: "sleep sleeping",
      }),
      room({
        id: "2230",
        name: "Workshop Room 2230",
        short: "Workshops",
        zone: "learn",
        floor: 2,
        poly: W(502, 614, 0, 188),
        about: "Workshops and activities.",
      }),
      room({
        id: "2110",
        name: "Alumni Commons",
        short: "Alumni Commons",
        zone: "hack",
        floor: 2,
        poly: B(1380, 760, 1565, 940),
        about:
          "Quiet hacking space. Part of the room is curtained off as a sponsor lounge (sponsors only).",
        note: "Men's and gender-neutral sleeping room from 10 p.m. Friday and Saturday.",
        keywords: "sleep sleeping quiet",
      }),
    ],
    service: [
      W(180, 245, 0, 58),
      W(200, 275, 150, 210),
      W(268, 392, 0, 264),
      W(614, 790, 0, 205),
      W(790, 848, 0, 205),
      W(848, 1062, 0, 84),
      W(862, 1048, 86, 140),
      W(962, 1090, 142, 190),
      W(858, 955, 145, 190),
      W(1065, 1174, 42, 182),
      W(1062, 1174, 0, 42),
      B(1380, 640, 1455, 725),
      B(1457, 630, 1520, 725),
      B(1522, 632, 1612, 722),
      B(1567, 805, 1612, 895),
    ],
    voids: [
      [
        [1130, 835],
        [1138, 790],
        [1185, 745],
        [1260, 712],
        [1318, 706],
        [1336, 740],
        [1340, 820],
        [1325, 858],
        [1290, 866],
        [1170, 864],
      ],
      B(1342, 942, 1573, 1205),
    ],
  },
  3: {
    outline: [
      [65, 318],
      [1175, 318],
      [1175, 255],
      [1090, 65],
      [1395, 88],
      [1400, 330],
      [1540, 360],
      [1620, 345],
      [1800, 340],
      [1930, 348],
      [1955, 375],
      [1950, 470],
      [1925, 560],
      [1850, 600],
      [1720, 615],
      [1715, 1280],
      [1520, 1285],
      [1520, 1210],
      [600, 1210],
      [565, 1212],
      [515, 1228],
      [435, 1228],
      [170, 1255],
      [205, 1000],
      [358, 1000],
      [358, 630],
      [125, 630],
      [125, 545],
      [358, 545],
      [358, 490],
      [218, 490],
      [218, 440],
      [65, 440],
    ],
    rooms: [
      room({
        id: "1100",
        name: "BMO Auditorium",
        short: "BMO",
        zone: "stage",
        floor: 3,
        poly: [
          [1540, 360],
          [1620, 345],
          [1800, 340],
          [1930, 348],
          [1955, 375],
          [1950, 470],
          [1925, 560],
          [1850, 600],
          [1720, 615],
          [1620, 618],
          [1570, 612],
          [1565, 420],
        ],
        about:
          "The opening ceremony is here on Friday. The closing ceremony is in the Grand Hall at the SEI.",
        keywords: "Ivey opening ceremony",
      }),
      room({
        id: "1354",
        name: "Coffee Chat Room",
        short: "Chat",
        zone: "lounge",
        floor: 3,
        poly: B(388, 458, 442, 512),
        about: "Coffee chats and interviews.",
        keywords: "Ivey interviews breakout",
      }),
      room({
        id: "1352",
        name: "Coffee Chat Room",
        short: "Chat",
        zone: "lounge",
        floor: 3,
        poly: B(445, 458, 498, 512),
        about: "Coffee chats and interviews.",
        keywords: "Ivey interviews breakout",
      }),
      room({
        id: "1348",
        name: "Coffee Chat Room",
        short: "Chat",
        zone: "lounge",
        floor: 3,
        poly: B(587, 452, 643, 497),
        about: "Coffee chats and interviews.",
        keywords: "Ivey interviews breakout",
      }),
      room({
        id: "1356",
        name: "Coffee Chat Room",
        short: "Chat",
        zone: "lounge",
        floor: 3,
        poly: B(450, 545, 497, 597),
        about: "Coffee chats and interviews.",
        keywords: "Ivey interviews breakout",
      }),
      room({
        id: "1358",
        name: "Coffee Chat Room",
        short: "Chat",
        zone: "lounge",
        floor: 3,
        poly: B(499, 545, 540, 597),
        about: "Coffee chats and interviews.",
        keywords: "Ivey interviews breakout",
      }),
    ],
    service: [
      B(68, 322, 202, 440),
      B(205, 322, 355, 440),
      B(220, 452, 278, 490),
      B(282, 452, 335, 490),
      B(360, 322, 525, 452),
      B(560, 322, 722, 450),
      B(647, 452, 703, 497),
      B(726, 322, 892, 450),
      B(765, 455, 865, 498),
      B(895, 322, 1050, 452),
      B(900, 455, 1005, 498),
      B(1055, 322, 1210, 452),
      B(1090, 460, 1195, 515),
      [
        [1090, 65],
        [1395, 88],
        [1400, 385],
        [1255, 385],
        [1255, 300],
        [1175, 255],
      ],
      B(125, 545, 250, 630),
      B(405, 545, 448, 597),
      B(385, 600, 512, 762),
      B(520, 598, 558, 735),
      B(358, 802, 500, 930),
      B(510, 800, 555, 930),
      B(608, 583, 662, 765),
      B(925, 545, 1135, 605),
      B(748, 922, 850, 980),
      B(883, 922, 935, 980),
      B(1145, 910, 1265, 975),
      B(1268, 910, 1360, 975),
      B(1383, 870, 1500, 975),
      B(1440, 1030, 1515, 1180),
      B(605, 1060, 765, 1205),
      B(770, 1060, 930, 1205),
      B(935, 1060, 1100, 1205),
      B(1100, 1060, 1265, 1205),
      B(1265, 1060, 1430, 1205),
      B(630, 1012, 750, 1058),
      B(795, 1012, 915, 1058),
      B(960, 1012, 1085, 1058),
      B(1125, 1012, 1230, 1058),
      B(1290, 1012, 1410, 1058),
      [
        [205, 1000],
        [515, 1000],
        [515, 1225],
        [435, 1228],
        [170, 1255],
      ],
      B(360, 1075, 432, 1200),
      B(432, 1075, 560, 1210),
      B(1565, 625, 1695, 775),
      B(1565, 790, 1715, 950),
      B(1565, 955, 1715, 1115),
      B(1565, 1120, 1715, 1280),
    ],
    voids: [B(730, 630, 990, 810)],
  },
};

/** The part of the plan to frame for each floor */
export const BOUNDS: Record<
  Floor,
  { x0: number; y0: number; x1: number; y1: number }
> = {
  1: { x0: 315, y0: 380, x1: 1625, y1: 1224 },
  2: { x0: 315, y0: 380, x1: 1625, y1: 1224 },
  3: { x0: 55, y0: 55, x1: 1965, y1: 1295 },
};

export const ROOMS: Room[] = [
  ...FLOORS[1].rooms,
  ...FLOORS[2].rooms,
  ...FLOORS[3].rooms,
];
const ROOM_IDS = new Set(ROOMS.map((r) => r.id));
const IVEY_CHAT_ROOMS = FLOORS[3].rooms
  .filter((r) => r.zone === "lounge")
  .map((r) => r.id);

// ---------- events from the live schedule ----------

export const DAYS = ["Friday", "Saturday", "Sunday"] as const;
export type DayIndex = 0 | 1 | 2;

export interface RoomEvent {
  day: DayIndex;
  /** Minutes after midnight; past-midnight slots stay on the day they're listed under */
  start: number;
  end: number;
  title: string;
  rooms: string[];
}

const SLOT_MINUTES = 30;

/** Which map rooms a schedule location points at ([] when it's off the map) */
export function roomsForLocation(location: string): string[] {
  const loc = location.trim();
  if (!loc) return [];
  // "Help Desk (in front of Grand Hall/Grand Hall)" is the help desk, not the hall
  if (/help desk/i.test(loc)) return ["help"];
  const found = new Set<string>();
  for (const m of loc.matchAll(/\b(\d{4})\b/g)) {
    if (ROOM_IDS.has(m[1]!)) found.add(m[1]!);
  }
  if (/grand hall/i.test(loc)) found.add("1110");
  if (/atrium/i.test(loc)) found.add("1235");
  if (/bmo auditorium/i.test(loc)) found.add("1100");
  if (/ivey breakout/i.test(loc))
    IVEY_CHAT_ROOMS.forEach((id) => found.add(id));
  return [...found];
}

const KINDS: (keyof Omit<ParsedScheduleEvent, "time">)[] = [
  "bigEvent",
  "sponsorWorkshop",
  "otherWorkshop",
  "activities1",
  "activities2",
  "food",
  "sponsorBooth",
  "scavengerHunt",
  "other",
  "other2",
  "other3",
];

// The sheet lists every 30-minute slot, so an hour-long workshop shows up
// twice in a row. Join back-to-back slots into one event per room.
export function eventsFromSchedule(days: DaySchedule[]): RoomEvent[] {
  const out: RoomEvent[] = [];
  // Ceremonies fill every column of a row; keep one copy
  const seen = new Set<string>();
  const push = (ev: RoomEvent) => {
    const key = `${ev.day}|${ev.start}|${ev.title}|${ev.rooms.join(",")}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(ev);
  };
  for (const day of days) {
    const dayIndex = DAYS.findIndex((d) => day.day.includes(d));
    if (dayIndex < 0) continue;
    // Slots after midnight are already listed under the day they fall on
    const slots = day.events.map((e) => ({ e, t: getTimeInMinutes(e.time) }));
    for (const kind of KINDS) {
      let run: RoomEvent | undefined;
      let prevT = -1;
      for (const { e, t } of slots) {
        const item = e[kind];
        const title = item?.title.trim() ?? "";
        const rooms = item ? roomsForLocation(item.location) : [];
        if (!title || !rooms.length) {
          if (run) push(run);
          run = undefined;
        } else if (
          run?.title === title &&
          run.rooms.join(",") === rooms.join(",") &&
          t === prevT + SLOT_MINUTES
        ) {
          run.end = t + SLOT_MINUTES;
        } else {
          if (run) push(run);
          run = {
            day: dayIndex as DayIndex,
            start: t,
            end: t + SLOT_MINUTES,
            title,
            rooms,
          };
        }
        prevT = t;
      }
      if (run) push(run);
    }
  }
  return out.sort((a, b) => a.day - b.day || a.start - b.start);
}

/** "5 pm", "10:30 am" (minutes may pass 24:00 for after-midnight slots) */
export function formatTime(minutes: number): string {
  const m = minutes % (24 * 60);
  const h24 = Math.floor(m / 60);
  const min = m % 60;
  const h = h24 % 12 || 12;
  const ap = h24 >= 12 ? "pm" : "am";
  return min ? `${h}:${String(min).padStart(2, "0")} ${ap}` : `${h} ${ap}`;
}

/** "10–11:30 am", "11:30 pm–12 am" */
export function formatRange(start: number, end: number): string {
  const a = formatTime(start);
  const b = formatTime(end);
  return a.slice(-2) === b.slice(-2) ? `${a.slice(0, -3)}–${b}` : `${a}–${b}`;
}

/**
 * The floor a map link asks for: ?building=ivey opens the Ivey building
 * (the Ivey walk disclaimer's "Check map"); anything else, the default.
 */
export function floorForQuery(
  building: string | string[] | undefined,
): Floor | undefined {
  return building === "ivey" ? IVEY : undefined;
}
