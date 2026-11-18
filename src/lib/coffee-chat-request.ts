/**
 * A sponsor's coffee chat request (docs/flows/coffee-chat-room-blocks.md
 * v2): how they run chats and how many hackers each slot takes.
 *
 * - 1-on-1: "N reps doing 1-on-1 chats" -> N hackers per slot.
 * - Group: "one group chat with M hackers" -> M hackers per slot.
 * - "Ask for fewer": a lower count for a stretch of time (a slot or an
 *   hour), down to 0 = no chat then. The lowest ask covering a slot wins.
 *
 * A slot has at most 3 hackers (Jazz, 2026-11-18): 3 hackers + 3 reps
 * side by side, or a group of 3 with 1 rep. Every sponsor is assumed to
 * bring 3-4 reps, so until they answer the request is 3 per slot: 1-on-1
 * with 3 reps when the Coffee Chats sheet says "Individual", else a group
 * of 3. A blank row is "no request yet", still booked as 3. The only count
 * is hackers booked vs hackers asked for.
 *
 * Dependency-free (shared by server, organizer and sponsor pages).
 */
import { coffeeChatMinutesOf } from "~/lib/coffee-chat-requests";
import type { CoffeeChatSetup } from "~/lib/run-of-show";

/** The parts of a Coffee Chats sheet row a request reads. */
export type SetupLike = Partial<
  Pick<
    CoffeeChatSetup,
    | "windowStart"
    | "windowEnd"
    | "durationMinutes"
    | "groupSize"
    | "format"
    | "notes"
    | "slots"
    | "hackers"
    | "chattingHours"
  >
>;

export const CHAT_STYLES = ["oneOnOne", "group"] as const;
export type ChatStyle = (typeof CHAT_STYLES)[number];

/** Hackers per slot a sponsor can ask for: 1 to 3 (fewer per slot via asks). */
export const MIN_PER_SLOT = 1;
export const MAX_PER_SLOT = 3;
/** Hackers per slot until the sponsor answers. */
export const DEFAULT_PER_SLOT = 3;

/** What a sponsor saved (both null = not answered yet). */
export type SavedChatRequest = {
  style: string | null;
  perSlot: number | null;
};

export type ChatRequest = {
  style: ChatStyle;
  /** Reps (1-on-1) or group size (group): hackers per slot. */
  perSlot: number;
  /** Chat length from the sheet's FORMAT (15 when missing). */
  durationMinutes: number;
  /** sponsor = they answered; sheet = sheet default; none = blank row. */
  source: "sponsor" | "sheet" | "none";
};

/** An "Ask for fewer": at most `hackers` per slot starting in the span. */
export type SlotLimit = {
  sponsorId: string;
  /** "HH:MM"; end exclusive. */
  startTime: string;
  endTime: string;
  hackers: number;
};

function clampPerSlot(n: number): number {
  return Math.min(MAX_PER_SLOT, Math.max(MIN_PER_SLOT, Math.floor(n)));
}

/** True when the sheet row says nothing about chats (name only). */
function blankRow(setup: SetupLike | null | undefined): boolean {
  return !setup || (!setup.format && !setup.windowStart && !setup.windowEnd);
}

/** The sheet's starting request, or null for a blank row. */
export function sheetChatRequest(
  setup: SetupLike | null | undefined,
): Omit<ChatRequest, "source"> | null {
  if (!setup || blankRow(setup)) return null;
  const durationMinutes = setup.durationMinutes ?? 15;
  const individual = /individual/i.test(setup.format ?? "");
  return {
    style: individual ? "oneOnOne" : "group",
    perSlot: DEFAULT_PER_SLOT,
    durationMinutes,
  };
}

function isStyle(style: string | null): style is ChatStyle {
  return (CHAT_STYLES as readonly string[]).includes(style ?? "");
}

/**
 * The request in force: the sponsor's answer, else the sheet's default,
 * else 1-on-1 with 3 reps ("No chat request yet"; organizers can still
 * give a room).
 */
export function chatRequestOf(
  setup: SetupLike | null | undefined,
  saved?: SavedChatRequest | null,
): ChatRequest {
  const durationMinutes = setup?.durationMinutes ?? 15;
  if (saved && isStyle(saved.style) && saved.perSlot !== null) {
    return {
      style: saved.style,
      perSlot: clampPerSlot(saved.perSlot),
      durationMinutes,
      source: "sponsor",
    };
  }
  const sheet = sheetChatRequest(setup);
  return sheet
    ? { ...sheet, source: "sheet" }
    : {
        style: "oneOnOne",
        perSlot: DEFAULT_PER_SLOT,
        durationMinutes,
        source: "none",
      };
}

/** The lowest ask covering a slot start, or null when none does. */
export function limitAt(
  limits: readonly SlotLimit[],
  sponsorId: string,
  slotTime: string,
): number | null {
  const t = coffeeChatMinutesOf(slotTime);
  if (t === null) return null;
  const covering = limits.filter((l) => {
    const start = coffeeChatMinutesOf(l.startTime);
    const end = coffeeChatMinutesOf(l.endTime);
    return (
      l.sponsorId === sponsorId &&
      start !== null &&
      end !== null &&
      t >= start &&
      t < end
    );
  });
  return covering.length === 0
    ? null
    : Math.max(0, Math.min(...covering.map((l) => l.hackers)));
}

/**
 * Hackers asked for at a slot: the request, lowered by any ask covering
 * it. `lowered` when an ask made it smaller.
 */
export function askedAt(
  request: Pick<ChatRequest, "perSlot">,
  limits: readonly SlotLimit[],
  sponsorId: string,
  slotTime: string,
): { asked: number; lowered: boolean } {
  const limit = limitAt(limits, sponsorId, slotTime);
  const asked =
    limit === null ? request.perSlot : Math.min(request.perSlot, limit);
  return { asked, lowered: asked < request.perSlot };
}

/**
 * Where the sheet's numbers disagree with each other, for a quiet note to
 * organizers (never "fixed"): SLOTS x hackers per slot vs HACKERS
 * CHATTING, and CHATTING HOURS of chats vs SLOTS.
 */
export function sheetMismatch(
  setup: SetupLike | null | undefined,
): ("hackers" | "hours")[] {
  const sheet = sheetChatRequest(setup);
  if (!setup || !sheet) return [];
  const out: ("hackers" | "hours")[] = [];
  const { slots, hackers, chattingHours } = setup;
  if (slots != null && hackers != null && slots * sheet.perSlot !== hackers) {
    out.push("hackers");
  }
  if (
    slots != null &&
    chattingHours != null &&
    (chattingHours * 60) / sheet.durationMinutes !== slots
  ) {
    out.push("hours");
  }
  return out;
}
