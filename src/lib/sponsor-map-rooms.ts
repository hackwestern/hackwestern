/**
 * Floor plans and room pins for the organizer "Where is everyone" map.
 *
 * Pin positions are APPROXIMATE, read off the floor images by eye, as
 * percent of the image width (x) and height (y) from the top-left corner.
 * Adjust them here: nothing else hardcodes a position.
 *
 * Images are Pranav's floor plans (origin/pranav/live-site-sponsors-map),
 * copied to public/sponsor-map/ so they don't collide with his /live map.
 */

export const SPONSOR_MAP_FLOORS = [
  {
    id: "floor1",
    label: "Floor 1",
    image: "/sponsor-map/floor1.webp",
    width: 2400,
    height: 2029,
  },
  {
    id: "floor2",
    label: "Floor 2",
    image: "/sponsor-map/floor2.webp",
    width: 2400,
    height: 2223,
  },
] as const;

export type SponsorMapFloorId = (typeof SPONSOR_MAP_FLOORS)[number]["id"];

export type SponsorMapRoom = {
  /** Room number, or a name for spaces without one. Unique. */
  id: string;
  /** Short pin label. */
  label: string;
  floor: SponsorMapFloorId;
  /** Percent of the image width, 0-100. Approximate: adjust here. */
  x: number;
  /** Percent of the image height, 0-100. Approximate: adjust here. */
  y: number;
  /**
   * Text that means this room in a run-of-show location, lower case,
   * besides the room number itself (e.g. "grand hall").
   */
  aliases?: string[];
};

export const SPONSOR_MAP_ROOMS: SponsorMapRoom[] = [
  // Floor 1 (ground floor)
  {
    // Sponsor booths. The sheet calls it "SM Atrium" or "Sponsor Bay";
    // Pranav's plan marks it as 1235.
    id: "1235",
    label: "Sponsor Bay",
    floor: "floor1",
    x: 14.5,
    y: 61,
    aliases: ["sponsor bay", "sm atrium", "atrium"],
  },
  { id: "1230", label: "1230", floor: "floor1", x: 29, y: 50 },
  {
    id: "1110",
    label: "Grand Hall",
    floor: "floor1",
    x: 82.5,
    y: 66,
    aliases: ["grand hall"],
  },

  // Floor 2
  {
    // Sponsor lounge (Jazz, 2026-11-18). Also a judging room on Sunday.
    id: "2110",
    label: "Sponsor Lounge",
    floor: "floor2",
    x: 84,
    y: 43,
    aliases: ["alumni commons", "sponsor lounge"],
  },
  { id: "2230", label: "2230", floor: "floor2", x: 39.5, y: 37 },
  { id: "2235", label: "2235", floor: "floor2", x: 32, y: 40 },
  // Coffee chat rooms run diagonally, 2243 top-left to 2241 bottom-right.
  { id: "2243", label: "2243", floor: "floor2", x: 25.5, y: 43.5 },
  { id: "2242", label: "2242", floor: "floor2", x: 28, y: 47 },
  { id: "2241", label: "2241", floor: "floor2", x: 30.5, y: 50.5 },
  {
    // Where sponsors leave their things overnight (Jazz, 2026-11-18).
    id: "2244",
    label: "Belongings",
    floor: "floor2",
    x: 17.5,
    y: 50,
    aliases: ["belongings", "storage"],
  },
];

/**
 * The pin for a run-of-show location ("Rm 2230 (50)", "Grand Hall (Rm
 * 1110)", "SM Atrium"), or null when no pin matches. Room numbers win over
 * names.
 */
export function mapRoomFor(
  location: string | null | undefined,
  rooms: readonly SponsorMapRoom[] = SPONSOR_MAP_ROOMS,
): SponsorMapRoom | null {
  if (!location) return null;
  const text = location.toLowerCase();
  for (const number of text.match(/\b\d{4}\b/g) ?? []) {
    const room = rooms.find((r) => r.id === number);
    if (room) return room;
  }
  return (
    rooms.find((r) => r.aliases?.some((alias) => text.includes(alias))) ?? null
  );
}

/** A crop of a floor plan, in percent of the image (like room pins). */
export type SponsorMapFocus = {
  floor: SponsorMapFloorId;
  x: number;
  y: number;
  width: number;
  height: number;
};

/**
 * The part of floor 2 the Coffee chats tab zooms into: the coffee chat
 * rooms (2241-2243) with the rooms around them. Approximate: adjust here.
 */
export const COFFEE_CHAT_MAP_FOCUS: SponsorMapFocus = {
  floor: "floor2",
  // Narrow on purpose: the three rooms are ~2.5% apart, and each pin is a
  // two-line card. At this zoom they sit ~55px apart in a 345px panel.
  x: 20,
  y: 36,
  width: 20,
  height: 20,
};

/**
 * True when a pin sits inside a focus crop, clear of its edges, so it can
 * be drawn there without being cut off.
 */
export function inFocus(room: SponsorMapRoom, focus: SponsorMapFocus): boolean {
  const margin = 1.5;
  return (
    room.floor === focus.floor &&
    room.x >= focus.x + margin &&
    room.x <= focus.x + focus.width - margin &&
    room.y >= focus.y + margin &&
    room.y <= focus.y + focus.height - margin
  );
}
