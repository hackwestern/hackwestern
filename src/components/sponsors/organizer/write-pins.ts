import { sponsorKey } from "~/components/sponsors/organizer/status-writes";
import type { SponsorStatus } from "~/lib/sponsor-status";

// The organizer board keeps each Sponsor Day-Of value it just wrote
// ("pinned") for WRITE_PIN_MS, over whatever getSponsors answers. Each
// Vercel instance keeps its own one-minute copy of the sheet, so after a
// write, a poll or refetch served by another instance can still answer
// the old value; without the pin, the pill flipped back, then came right a
// minute later (Jazz, 2026-11-20). A pin is dropped when the write fails
// or wasn't written (sheet writes off), and when it runs out.

/** The server's shared copy lives 60 s; 30 s more for slow writes and clocks. */
export const WRITE_PIN_MS = 90_000;

export type PinValues = { status: SponsorStatus; atCcWorkshop: boolean };
export type PinField = keyof PinValues;
type Pin = { name: string; field: PinField; value: unknown; until: number };
export type Pins = ReadonlyMap<string, Pin>;

const pinKey = (name: string, field: PinField) =>
  `${field}:${sponsorKey(name)}`;

export function withPin<F extends PinField>(
  pins: Pins,
  name: string,
  field: F,
  value: PinValues[F],
  now: number,
): Pins {
  return new Map(pins).set(pinKey(name, field), {
    name,
    field,
    value,
    until: now + WRITE_PIN_MS,
  });
}

export function withoutPin(pins: Pins, name: string, field: PinField): Pins {
  const key = pinKey(name, field);
  if (!pins.has(key)) return pins;
  const next = new Map(pins);
  next.delete(key);
  return next;
}

/** Pins still running at `now` (the same map when none ran out). */
export function livePins(pins: Pins, now: number): Pins {
  const live = [...pins].filter(([, pin]) => pin.until > now);
  return live.length === pins.size ? pins : new Map(live);
}

/**
 * The list with every running pin applied. The same list (and the same
 * rows) when nothing differs, so React Query's select stays cheap.
 */
export function applyPins<
  T extends { name: string; status: string; atCcWorkshop: boolean | null },
>(list: T[], pins: Pins, now: number): T[] {
  if (pins.size === 0) return list;
  let changed = false;
  const out = list.map((row) => {
    let next = row;
    for (const field of ["status", "atCcWorkshop"] as const) {
      const pin = pins.get(pinKey(row.name, field));
      if (!pin || pin.until <= now || next[field] === pin.value) continue;
      next = { ...next, [field]: pin.value };
    }
    if (next !== row) changed = true;
    return next;
  });
  return changed ? out : list;
}

// One set of pins for the page: the Home's writes and the page's
// getSponsors query are in different components.
let current: Pins = new Map();
const listeners = new Set<() => void>();
let pruneTimer: ReturnType<typeof setTimeout> | null = null;

function setPins(next: Pins) {
  if (next === current) return;
  current = next;
  if (pruneTimer) clearTimeout(pruneTimer);
  pruneTimer = null;
  if (current.size > 0) {
    // Drop pins as they run out, so the board shows the server's value
    // even if no new data arrives.
    const soonest = Math.min(...[...current.values()].map((p) => p.until));
    pruneTimer = setTimeout(
      () => setPins(livePins(current, Date.now())),
      Math.max(0, soonest - Date.now()) + 50,
    );
  }
  for (const listener of listeners) listener();
}

export const sponsorWritePins = {
  get: (): Pins => current,
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  pin: <F extends PinField>(name: string, field: F, value: PinValues[F]) => {
    const now = Date.now();
    setPins(withPin(livePins(current, now), name, field, value, now));
  },
  unpin: (name: string, field: PinField) => {
    setPins(withoutPin(current, name, field));
  },
};
