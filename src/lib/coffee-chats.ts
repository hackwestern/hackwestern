/**
 * Shared constants and pure helpers for sponsor coffee-chat booking.
 *
 * The sponsoring flow is a Calendly-style grid: 3 rooms, each bookable
 * Saturday 10:00 - 16:00 in 15-minute blocks. Each sponsor has a max
 * allowance (minutes) in the "sponsor info" Google Sheet tab; blocks =
 * minutes / 15. Empty or non-numeric cells count as 0 (no booking).
 *
 * This module must stay dependency-free (no server imports): it backs both
 * the sponsor portal client pages and the sponsor-judging tRPC router, and
 * the sheet grid builder/parser.
 */

export const COFFEE_CHAT_TAB = "Coffee Chats";

export const COFFEE_CHAT_SLOT_MINUTES = 15;

// Saturday 10:00 - 16:00. The last slot starts at 15:45.
export const COFFEE_CHAT_DAY_LABEL = "Saturday";
export const COFFEE_CHAT_WINDOW_LABEL = "10:00 AM - 4:00 PM";

export const COFFEE_CHAT_ROOMS = [
  { id: 1, label: "Rm 2241" },
  { id: 2, label: "Rm 2242" },
  { id: 3, label: "Rm 2243" },
] as const;

function makeSlots(): string[] {
  const slots: string[] = [];
  for (let h = 10; h < 16; h += 1) {
    for (let m = 0; m < 60; m += COFFEE_CHAT_SLOT_MINUTES) {
      slots.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  return slots;
}

/** All 15-minute slot start times, in order ("10:00" ... "15:45"). */
export const COFFEE_CHAT_SLOTS: readonly string[] = makeSlots();

const COFFEE_CHAT_SLOT_SET = new Set<string>(COFFEE_CHAT_SLOTS);

export type CoffeeChatSlot = { room: number; time: string };
export type CoffeeChatBooking = CoffeeChatSlot & { sponsor: string };

/** Stable slot key, e.g. room 2 @ 10:15 -> "2:10:15". */
export function coffeeChatSlotKeyOf(slot: CoffeeChatSlot): string {
  return `${slot.room}:${slot.time}`;
}

/** True when the room/time pair is a real bookable slot. */
export function isCoffeeChatSlot(slot: CoffeeChatSlot): boolean {
  return (
    COFFEE_CHAT_ROOMS.some((room) => room.id === slot.room) &&
    COFFEE_CHAT_SLOT_SET.has(slot.time)
  );
}

/** Order index of a slot for stable sorting (rooms before times). */
export function coffeeChatSlotOrder(slot: CoffeeChatSlot): number {
  const timeIndex = COFFEE_CHAT_SLOTS.indexOf(slot.time);
  const roomIndex = COFFEE_CHAT_ROOMS.findIndex(
    (room) => room.id === slot.room,
  );
  if (timeIndex === -1 || roomIndex === -1) return Number.MAX_SAFE_INTEGER;
  return roomIndex * COFFEE_CHAT_SLOTS.length + timeIndex;
}

/** Sort slots into display order (by room, then time). */
export function sortCoffeeChatSlots<T extends CoffeeChatSlot>(
  slots: readonly T[],
): T[] {
  return [...slots].sort(
    (a, b) => coffeeChatSlotOrder(a) - coffeeChatSlotOrder(b),
  );
}

/**
 * Parse the "Coffee Chat Max Minutes" cell. Everything unparseable/empty
 * becomes 0 — a sponsor with no value has no coffee-chat allowance.
 */
export function normalizeCoffeeChatMinutes(
  val: string | number | undefined | null,
): number {
  if (typeof val === "number") {
    return Number.isFinite(val) && val > 0 ? Math.floor(val) : 0;
  }
  // Google Sheets sometimes emits invisible-formatting characters.
  const clean = String(val ?? "")
    .replace(/\p{Cf}/gu, "")
    .trim();
  if (!clean) return 0;
  const parsed = Number.parseFloat(clean.replace(/,/g, ""));
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

/** How many 15-minute blocks the sponsor's allowance covers. */
export function coffeeChatBlocksFor(maxMinutes: number): number {
  return maxMinutes > 0 ? Math.floor(maxMinutes / COFFEE_CHAT_SLOT_MINUTES) : 0;
}

/**
 * Fixed palette the sheet and the portal share, so a sponsor's cells are
 * recognizable in both places.
 */
const COFFEE_CHAT_PALETTE = [
  "#4f46e5",
  "#2563eb",
  "#0891b2",
  "#0d9488",
  "#16a34a",
  "#65a30d",
  "#ca8a04",
  "#d97706",
  "#ea580c",
  "#dc2626",
  "#db2777",
  "#9333ea",
  "#7c3aed",
  "#0e7490",
  "#b45309",
  "#4d7c0f",
] as const;

/** Deterministic hex color for a sponsor name (same name -> same color). */
export function coffeeChatColorFor(sponsorName: string): string {
  const name = canonicalName(sponsorName);
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) | 0;
  }
  const index = Math.abs(hash) % COFFEE_CHAT_PALETTE.length;
  return COFFEE_CHAT_PALETTE[index]!;
}

/** Hex #RRGGBB to 0-1 float channels, for Sheets CellFormat colors. */
export function hexColorToRgb01(hex: string): {
  red: number;
  green: number;
  blue: number;
} {
  const value = hex.replace("#", "").toLowerCase();
  const full =
    value.length === 3
      ? value
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : value;
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return { red: 0, green: 0, blue: 0 };
  return {
    red: ((int >> 16) & 0xff) / 255,
    green: ((int >> 8) & 0xff) / 255,
    blue: (int & 0xff) / 255,
  };
}

/** Strip invisible chars + whitespace for stored/compared names. */
function cleanCell(val: unknown): string {
  return String(val ?? "")
    .replace(/\p{Cf}/gu, "")
    .trim();
}

/** Canonical comparison key: invisible chars stripped, spaces collapsed. */
function canonicalName(val: string): string {
  return val
    .replace(/\p{Cf}/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function sameSponsor(a: string, b: string): boolean {
  return canonicalName(a) === canonicalName(b);
}

export function isBookedBy(
  booking: CoffeeChatBooking,
  sponsorName: string,
): boolean {
  return sameSponsor(booking.sponsor, sponsorName);
}

/** Group slots under an hour label for the portal grid, e.g. "10 AM". */
export function groupCoffeeChatSlotsByHour(
  slots: readonly string[],
): Array<{ label: string; slots: string[] }> {
  const groups: Array<{ label: string; slots: string[] }> = [];
  let current: { label: string; slots: string[] } | null = null;
  for (const slot of slots) {
    const [h] = slot.split(":").map((n) => parseInt(n, 10));
    const hour = h ?? 0;
    const labelAmPm = hour < 12 ? "AM" : "PM";
    const labelHour = hour % 12 === 0 ? 12 : hour % 12;
    const label = `${labelHour} ${labelAmPm}`;
    if (!current || current.label !== label) {
      current = { label, slots: [] };
      groups.push(current);
    }
    current.slots.push(slot);
  }
  return groups;
}

/** Display formatting: canonical "15:00" -> "3:00 PM" (sheet + portal). */
export function formatCoffeeChatTime(time: string): string {
  const parts = time.split(":").map((n) => parseInt(n, 10));
  const [h, m] = parts as [number, number];
  if (!Number.isFinite(h) || !Number.isFinite(m)) return time;
  const suffix = h < 12 ? "AM" : "PM";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/**
 * Canonical time for a sheet label: accepts "15:00" or 12-hour spellings
 * like "3:00 PM". Anything else (or outside the bookable window) is null.
 */
function canonicalTimeFromLabel(label: string): string | null {
  if (COFFEE_CHAT_SLOT_SET.has(label)) return label;
  const match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(label);
  if (!match) return null;
  const hour = parseInt(match[1]!, 10);
  const minute = parseInt(match[2]!, 10);
  if (hour < 1 || hour > 12 || minute > 59) return null;
  const hour24 = (hour % 12) + (match[3]!.toUpperCase() === "PM" ? 12 : 0);
  const canonical = `${String(hour24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  return COFFEE_CHAT_SLOT_SET.has(canonical) ? canonical : null;
}

/**
 * Parse the visual Coffee Chats grid into bookings.
 *
 * Canonical layout (created by the app): the room labels run across
 * columns B-D (room 1-3 in order) with every 15-minute slot start time
 * stacked down column A below the header row, spelled like "3:00 PM".
 * Parsing is forgiving about a preamble above the header and about room
 * labels being renamed: the three room columns are always B-D, counted by
 * position. Rows whose column A isn't a slot time (either spelling) are
 * skipped rather than aborting.
 */
export function parseCoffeeChatGrid(
  rows: readonly (readonly (string | undefined)[])[],
): CoffeeChatBooking[] {
  const bookings: CoffeeChatBooking[] = [];
  const seen = new Set<string>();

  // The first of two consecutive rows holding a slot time in column A
  // starts the grid. Two in a row distinguish real slot rows from a stray
  // "10:00" in a preamble title.
  let firstTimeRow = -1;
  for (let i = 0; i < rows.length; i++) {
    const time = canonicalTimeFromLabel(cleanCell(rows[i]?.[0]));
    const next = canonicalTimeFromLabel(cleanCell(rows[i + 1]?.[0]));
    if (time && next) {
      firstTimeRow = i;
      break;
    }
  }
  if (firstTimeRow === -1) return bookings;

  for (let i = firstTimeRow; i < rows.length; i++) {
    const time = canonicalTimeFromLabel(cleanCell(rows[i]?.[0]));
    if (!time) continue;

    // Rooms occupy columns B-D by canonical order.
    COFFEE_CHAT_ROOMS.forEach((room, roomIndex) => {
      const sponsor = cleanCell(rows[i]?.[1 + roomIndex]);
      if (!sponsor) return;
      const key = `${room.id}:${time}`;
      if (seen.has(key)) return;
      seen.add(key);
      bookings.push({ room: room.id, time, sponsor });
    });
  }

  return sortCoffeeChatSlots(bookings);
}

/** Requested slots that are already held by a different sponsor. */
export function findCoffeeChatConflicts(
  requested: readonly CoffeeChatSlot[],
  existing: readonly CoffeeChatBooking[],
  sponsorName: string,
): CoffeeChatSlot[] {
  const holders = new Map<string, CoffeeChatBooking>();
  for (const booking of existing) {
    holders.set(coffeeChatSlotKeyOf(booking), booking);
  }
  return requested.filter((slot) => {
    const booking = holders.get(coffeeChatSlotKeyOf(slot));
    return Boolean(booking && !isBookedBy(booking, sponsorName));
  });
}

/**
 * Slots the sponsor currently holds that they are keeping/rebooking, i.e. a
 * pure cancellation is still allowed even when their allowance was dropped
 * to zero or below their current booking count.
 */
export function isPureCancellation(
  requested: readonly CoffeeChatSlot[],
  existing: readonly CoffeeChatBooking[],
  sponsorName: string,
): boolean {
  const mine = new Set(
    existing
      .filter((b) => isBookedBy(b, sponsorName))
      .map((b) => coffeeChatSlotKeyOf(b)),
  );
  return requested.every((slot) => mine.has(coffeeChatSlotKeyOf(slot)));
}

/**
 * Final-state merge: everything not owned by the sponsor is kept, then the
 * sponsor's requested final set replaces their previous bookings.
 */
export function mergeCoffeeChatBookings(
  current: readonly CoffeeChatBooking[],
  sponsorName: string,
  requestedFinal: readonly CoffeeChatSlot[],
): CoffeeChatBooking[] {
  return [
    ...current.filter((b) => !isBookedBy(b, sponsorName)),
    ...requestedFinal.map((slot) => ({
      room: slot.room,
      time: slot.time,
      sponsor: sponsorName,
    })),
  ];
}

/**
 * One grid cell the save endpoint needs to write. `sponsor` "" clears the
 * cell. Positions are semantic indexes into the canonical grid: roomIndex
 * 0-2 (the room's column after the time label column), slotIndex 0-23
 * (the time's row after the header row). The caller maps them to row/
 * column offsets for the sheet.
 */
export type CoffeeChatCellChange = {
  roomIndex: number;
  slotIndex: number;
  sponsor: string;
};

export const COFFEE_CHAT_EMPTY_CELL = "";

/**
 * Only the cells that actually differ between the current grid and the
 * next grid. Writing per-cell lets two sponsors book simultaneously in
 * different rooms without one save clobbering the other's cells, and it
 * preserves anything organizers wrote manually into cells that aren't
 * part of any booking (e.g. "keep clear" notes).
 */
export function diffCoffeeChatGrid(
  current: readonly CoffeeChatBooking[],
  next: readonly CoffeeChatBooking[],
): CoffeeChatCellChange[] {
  const before = new Map(
    current.map((b) => [coffeeChatSlotKeyOf(b), b.sponsor]),
  );
  const after = new Map(next.map((b) => [coffeeChatSlotKeyOf(b), b.sponsor]));

  const changes: CoffeeChatCellChange[] = [];
  COFFEE_CHAT_ROOMS.forEach((room, roomIndex) => {
    COFFEE_CHAT_SLOTS.forEach((time, slotIndex) => {
      const key = `${room.id}:${time}`;
      const was = before.get(key) ?? "";
      const now = after.get(key) ?? "";
      if (canonicalName(was) !== canonicalName(now)) {
        changes.push({ roomIndex, slotIndex, sponsor: now });
      }
    });
  });

  return changes;
}
