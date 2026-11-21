// Pure logic for the guided tours (the sponsor portal's, and the organizer
// dashboard's per-tab tours in organizer-tours.ts): which page a step lives
// on, whether its target is there, where the callout goes, and saving
// progress so a tour survives moving between pages. No React, no DOM
// globals: the component passes in storage and a "is this target here?"
// check, so all of it is unit-tested in sponsor-tour.test.ts.

/** Sponsor pages a tour step can live on (Next.js route patterns). */
export const TOUR_PAGES = {
  home: "/sponsors/[uuid]",
  scan: "/sponsors/[uuid]/scan",
  coffeeChats: "/sponsors/[uuid]/coffee-chats",
  schedule: "/sponsors/[uuid]/schedule",
  map: "/sponsors/[uuid]/map",
  picks: "/sponsors/[uuid]/picks",
} as const;

export type TourPage = keyof typeof TOUR_PAGES;

export type TourPlacement = "top" | "bottom" | "left" | "right" | "center";

/** One of a step's alternative targets, with its own words (both default
 * to the step's). The Chats page shows one stage at a time, so its step
 * points at whichever stage card is there. */
export interface TourVariant {
  target: string;
  title?: string;
  body?: string;
}

export interface TourStep {
  id: string;
  /** A `data-tour` value on the page; none = a centred callout. */
  target?: string;
  /** Targets tried in order, instead of `target`; the first one on the
   * page is shown. None there = the step is skipped. */
  variants?: readonly TourVariant[];
  /** Skip the step when its target isn't on the page (data not loaded,
   * a feature this sponsor doesn't have), instead of centring it. */
  optional?: boolean;
  /** The page the step lives on; "any" = wherever the tour is running. */
  page: TourPage | "any";
  placement?: TourPlacement;
  /** Advance when the sponsor clicks the target (the app still gets it). */
  waitForClick?: boolean;
  title: string;
  body: string;
}

export interface TourDef {
  id: string;
  steps: readonly TourStep[];
}

export interface TourProgress {
  tour: string;
  step: number;
  sponsor: string;
  /** The last move was Back: a skipped step keeps going back. */
  back?: boolean;
}

// ------------------------------------------------------------
// Pages
// ------------------------------------------------------------

/** The tour page for a Next.js pathname pattern, or null off the portal. */
export function pageOf(pathname: string): TourPage | null {
  const hit = (Object.keys(TOUR_PAGES) as TourPage[]).find(
    (p) => TOUR_PAGES[p] === pathname,
  );
  return hit ?? null;
}

export function pageHref(page: TourPage, sponsor: string): string {
  return TOUR_PAGES[page].replace("[uuid]", encodeURIComponent(sponsor));
}

/** The `[data-tour="..."]` selector for a target name. */
export function targetSelector(target: string): string {
  return `[data-tour="${target.replace(/["\\]/g, "\\$&")}"]`;
}

// ------------------------------------------------------------
// Step resolution
// ------------------------------------------------------------

export type ResolvedStep =
  | { kind: "done" }
  /** Its target isn't on the page and the step is optional: move on. */
  | { kind: "skip" }
  /** The step is on another page: go there first. */
  | { kind: "navigate"; href: string }
  /** Show it; `anchored` false = centred (no target, or target missing). */
  | { kind: "show"; step: TourStep; anchored: boolean };

/** The `data-tour` names a step looks for, in order (none for a centre step). */
export function stepTargets(step: TourStep): string[] {
  if (step.placement === "center") return [];
  if (step.variants?.length) return step.variants.map((v) => v.target);
  return step.target ? [step.target] : [];
}

/** Whether a missing target skips the step (optional, or has variants). */
export function isSkippable(step: TourStep): boolean {
  return step.optional === true || (step.variants?.length ?? 0) > 0;
}

/**
 * What to do for step `index` of `tour` while on `current`. A missing
 * target never breaks the tour: an optional step (or one with variants)
 * is skipped, any other shows as a centred callout. With variants, the
 * shown step carries the found variant's target and words.
 */
export function resolveStep(
  tour: TourDef,
  index: number,
  current: TourPage | null,
  sponsor: string,
  hasTarget: (target: string) => boolean,
): ResolvedStep {
  const step = tour.steps[index];
  if (!step || index < 0) return { kind: "done" };
  if (step.page !== "any" && step.page !== current) {
    return { kind: "navigate", href: pageHref(step.page, sponsor) };
  }
  const targets = stepTargets(step);
  const found = targets.find((t) => hasTarget(t));
  if (found === undefined) {
    if (targets.length > 0 && isSkippable(step)) {
      return { kind: "skip" };
    }
    return { kind: "show", step, anchored: false };
  }
  const variant = step.variants?.find((v) => v.target === found);
  const shown: TourStep = variant
    ? {
        ...step,
        target: found,
        title: variant.title ?? step.title,
        body: variant.body ?? step.body,
      }
    : step;
  return { kind: "show", step: shown, anchored: true };
}

/**
 * Where a skipped step `index` goes: on in the direction of the last move
 * (`back` = Back was pressed), but forward again when going back runs out
 * of steps, so the tour is never stuck. Null = past the last step (done).
 */
export function skipFrom(
  index: number,
  back: boolean,
  total: number,
): { step: number; back: boolean } | null {
  if (back && index - 1 >= 0) return { step: index - 1, back: true };
  if (index + 1 >= total) return null;
  return { step: index + 1, back: false };
}

/** The page a move to `index` needs, or null when it stays put. */
export function hrefForMove(
  tour: TourDef,
  index: number,
  current: TourPage | null,
  sponsor: string,
): string | null {
  const step = tour.steps[index];
  if (!step || step.page === "any" || step.page === current) return null;
  return pageHref(step.page, sponsor);
}

// ------------------------------------------------------------
// Progress (sessionStorage) and "seen" (localStorage)
// ------------------------------------------------------------

export type TourStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

export const TOUR_PROGRESS_KEY = "hw-sponsor-tour";
export const welcomeSeenKey = (sponsor: string) =>
  `hw-sponsor-tour-seen:${sponsor}`;

/** Parse saved progress; anything malformed or for an unknown tour = null. */
export function parseProgress(
  raw: string | null,
  tours: Record<string, TourDef>,
): TourProgress | null {
  if (!raw) return null;
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!value || typeof value !== "object") return null;
  const { tour, step, sponsor, back } = value as Record<string, unknown>;
  if (typeof tour !== "string" || typeof sponsor !== "string") return null;
  if (typeof step !== "number" || !Number.isInteger(step)) return null;
  const def = tours[tour];
  if (!def || step < 0 || step >= def.steps.length) return null;
  return back === true
    ? { tour, step, sponsor, back }
    : { tour, step, sponsor };
}

/** Progress for this sponsor, or null. Storage that throws counts as empty. */
export function loadProgress(
  storage: TourStorage | null,
  tours: Record<string, TourDef>,
  sponsor: string,
): TourProgress | null {
  try {
    const p = parseProgress(storage?.getItem(TOUR_PROGRESS_KEY) ?? null, tours);
    return p && p.sponsor === sponsor ? p : null;
  } catch {
    return null;
  }
}

export function saveProgress(
  storage: TourStorage | null,
  progress: TourProgress | null,
): void {
  try {
    if (progress) {
      storage?.setItem(TOUR_PROGRESS_KEY, JSON.stringify(progress));
    } else {
      storage?.removeItem(TOUR_PROGRESS_KEY);
    }
  } catch {
    // Private mode or blocked storage: the tour still runs on this page.
  }
}

/**
 * Whether a "seen" flag is set under `key` (one per tour offer: a sponsor's
 * welcome tour, an organizer dashboard tab). Storage that throws counts as
 * seen, so a blocked browser is never nagged.
 */
export function hasSeen(storage: TourStorage | null, key: string): boolean {
  try {
    return storage?.getItem(key) === "1";
  } catch {
    // Can't remember, so don't nag: treat as seen.
    return true;
  }
}

export function markSeen(storage: TourStorage | null, key: string): void {
  try {
    storage?.setItem(key, "1");
  } catch {
    // Nothing to do: the offer may show again next visit.
  }
}

export function hasSeenWelcome(
  storage: TourStorage | null,
  sponsor: string,
): boolean {
  return hasSeen(storage, welcomeSeenKey(sponsor));
}

export function markWelcomeSeen(
  storage: TourStorage | null,
  sponsor: string,
): void {
  markSeen(storage, welcomeSeenKey(sponsor));
}

/** Safe getter: `window.localStorage` itself can throw when blocked. */
export function getStorage(kind: "local" | "session"): TourStorage | null {
  try {
    if (typeof window === "undefined") return null;
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

// ------------------------------------------------------------
// Callout placement
// ------------------------------------------------------------

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/** Space between the highlight ring and the callout, and the screen edge. */
export const CALLOUT_GAP = 12;
export const VIEWPORT_MARGIN = 16;

/**
 * Where a callout of `size` goes next to `target` in `viewport`: the asked
 * side if it fits, else the opposite side, else whichever side has the most
 * room; then clamped inside the viewport. Returns top-left in px.
 */
export function placeCallout(
  target: Rect,
  size: Size,
  viewport: Size,
  placement: Exclude<TourPlacement, "center"> = "bottom",
): { top: number; left: number; placement: TourPlacement } {
  const room = {
    top: target.top,
    bottom: viewport.height - (target.top + target.height),
    left: target.left,
    right: viewport.width - (target.left + target.width),
  };
  const need = (side: keyof typeof room) =>
    (side === "top" || side === "bottom" ? size.height : size.width) +
    CALLOUT_GAP +
    VIEWPORT_MARGIN;
  const opposite = {
    top: "bottom",
    bottom: "top",
    left: "right",
    right: "left",
  } as const;

  let side: keyof typeof room = placement;
  if (room[side] < need(side)) {
    if (room[opposite[side]] >= need(opposite[side])) side = opposite[side];
    else {
      side = (Object.keys(room) as (keyof typeof room)[]).reduce((a, b) =>
        room[b] - need(b) > room[a] - need(a) ? b : a,
      );
    }
  }

  const centreX = target.left + target.width / 2 - size.width / 2;
  const centreY = target.top + target.height / 2 - size.height / 2;
  let top: number;
  let left: number;
  if (side === "top") {
    top = target.top - CALLOUT_GAP - size.height;
    left = centreX;
  } else if (side === "bottom") {
    top = target.top + target.height + CALLOUT_GAP;
    left = centreX;
  } else if (side === "left") {
    top = centreY;
    left = target.left - CALLOUT_GAP - size.width;
  } else {
    top = centreY;
    left = target.left + target.width + CALLOUT_GAP;
  }

  const clamp = (v: number, max: number) =>
    Math.max(VIEWPORT_MARGIN, Math.min(v, max - VIEWPORT_MARGIN));
  return {
    top: clamp(top, viewport.height - size.height),
    left: clamp(left, viewport.width - size.width),
    placement: side,
  };
}

// ------------------------------------------------------------
// Click targets
// ------------------------------------------------------------

/** What a tour target can be clicked through: a link, button or tab. */
export const CLICKABLE_SELECTOR =
  'a[href], button, [role="tab"], input, select, textarea';

interface ClickableLike {
  matches(selector: string): boolean;
  querySelector(selector: string): ClickableLike | null;
}

/**
 * The element "Next" clicks on a waitForClick step: the target itself when
 * it's a link or button, else its first link or button inside. A `data-tour`
 * on a wrapper (the Scan a badge `<li>`) still opens the link, so keyboard
 * users get the same result as tapping.
 */
export function clickTargetOf<T extends ClickableLike>(el: T): T {
  if (el.matches(CLICKABLE_SELECTOR)) return el;
  return (el.querySelector(CLICKABLE_SELECTOR) as T | null) ?? el;
}

// ------------------------------------------------------------
// Phones: which edge the callout docks to, and where the target scrolls
// ------------------------------------------------------------

/** Space between the callout, the target and the screen edges on phones. */
export const PHONE_GAP = 12;

export type PhoneDock = "top" | "bottom";

export interface PhoneChrome {
  /** Height of the sticky top bar (0 when there's none). */
  topBar: number;
  /** Height of the fixed bottom tab bar (0 when there's none). */
  bottomBar: number;
}

/**
 * Which edge a phone callout docks to, given where the target is now (after
 * scrolling): the edge that covers less of it. A target too tall to clear
 * a callout either way gets the bottom, so its start (its heading) stays in
 * view; a tie goes away from the target (lower half: top). A tab bar
 * target always gets the top.
 */
export function phoneDock(
  target: Rect,
  calloutHeight: number,
  viewportHeight: number,
  inTabBar = false,
): PhoneDock {
  if (inTabBar) return "top";
  const room = viewportHeight - calloutHeight - PHONE_GAP * 2;
  if (target.height > room) return "bottom";
  const bottom = target.top + target.height;
  const underBottom = Math.max(
    0,
    bottom - (viewportHeight - calloutHeight - PHONE_GAP),
  );
  const underTop = Math.max(0, calloutHeight + PHONE_GAP - target.top);
  if (underTop !== underBottom)
    return underTop < underBottom ? "top" : "bottom";
  return target.top + target.height / 2 > viewportHeight / 2 ? "top" : "bottom";
}

/**
 * Where a target should scroll to on a phone so it sits in the part of the
 * screen the callout leaves free: scroll-margin above and below it, and
 * whether it fits (centre it) or not (show its start).
 */
export function phoneScrollPlan(
  targetHeight: number,
  calloutHeight: number,
  viewportHeight: number,
  chrome: PhoneChrome,
  dock: PhoneDock = "bottom",
): { marginTop: number; marginBottom: number; block: "center" | "start" } {
  const marginTop =
    dock === "bottom"
      ? chrome.topBar + PHONE_GAP
      : calloutHeight + PHONE_GAP * 2;
  const marginBottom =
    dock === "bottom"
      ? calloutHeight + PHONE_GAP * 2
      : chrome.bottomBar + PHONE_GAP;
  const room = viewportHeight - marginTop - marginBottom;
  return {
    marginTop,
    marginBottom,
    block: targetHeight <= room ? "center" : "start",
  };
}
