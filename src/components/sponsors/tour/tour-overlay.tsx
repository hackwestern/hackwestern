import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { pressable } from "~/components/sponsors/sponsor-shell-styles";
import { sponsorTourCopy } from "~/content/sponsor-tour";
import {
  placeCallout,
  type Rect,
  type TourPlacement,
  type TourStep,
} from "~/lib/sponsor-tour";
import { cn } from "~/lib/utils";

const copy = sponsorTourCopy.callout;

/** Space between the target and the highlight ring. */
const RING_PAD = 6;
/** Below this the callout is a bottom sheet (Tailwind's `sm`). */
const NARROW_QUERY = "(max-width: 639px)";

function useMediaQuery(query: string) {
  const [matches, setMatches] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setMatches(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [query]);
  return matches;
}

/** Inside a dialog other than the tour's own callout (e.g. the map). */
function insideOtherDialog(el: Element): boolean {
  return !!el.closest('[role="dialog"]:not([data-tour-callout])');
}

const sameRect = (a: Rect | null, b: Rect | null) =>
  a === b ||
  (!!a &&
    !!b &&
    a.top === b.top &&
    a.left === b.left &&
    a.width === b.width &&
    a.height === b.height);

/**
 * One tour step drawn over the live page: the page dims, the target gets a
 * ring through a cutout, and a callout explains the step. `anchor` null =
 * a centred callout. Clicks outside the cutout are blocked; inside it they
 * reach the app only on `waitForClick` steps.
 */
export function TourOverlay({
  step,
  index,
  total,
  anchor,
  onBack,
  onNext,
  onClose,
  nextLabel,
}: {
  step: TourStep;
  index: number;
  total: number;
  anchor: Element | null;
  onBack: () => void;
  onNext: () => void;
  onClose: () => void;
  /** Overrides Next / Done (e.g. "Take me there"). */
  nextLabel?: string;
}) {
  const titleId = useId();
  const calloutRef = useRef<HTMLDivElement>(null);
  const narrow = useMediaQuery(NARROW_QUERY);
  const reduceMotion = useMediaQuery("(prefers-reduced-motion: reduce)");
  const [rect, setRect] = useState<Rect | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(
    null,
  );
  const [viewport, setViewport] = useState({ width: 0, height: 0 });
  const [announcement, setAnnouncement] = useState("");

  // Follow the target every frame: covers scroll (of the page or a dialog),
  // resize, data loading in, and a dialog's open animation.
  useEffect(() => {
    if (!anchor) {
      setRect(null);
      return;
    }
    let frame = 0;
    const tick = () => {
      const r = anchor.getBoundingClientRect();
      const next = {
        top: r.top,
        left: r.left,
        width: r.width,
        height: r.height,
      };
      setRect((prev) => (sameRect(prev, next) ? prev : next));
      setViewport((prev) =>
        prev.width === window.innerWidth && prev.height === window.innerHeight
          ? prev
          : { width: window.innerWidth, height: window.innerHeight },
      );
      frame = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(frame);
  }, [anchor]);

  // Bring the target into view once per step.
  useEffect(() => {
    anchor?.scrollIntoView({
      block: "center",
      inline: "nearest",
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, [anchor, step.id, reduceMotion]);

  useLayoutEffect(() => {
    const el = calloutRef.current;
    if (!el) return;
    const measure = () =>
      setSize({ width: el.offsetWidth, height: el.offsetHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [step.id, narrow]);

  // Each step: focus the callout (without scrolling) and announce it.
  useEffect(() => {
    calloutRef.current?.focus({ preventScroll: true });
    setAnnouncement("");
    const id = requestAnimationFrame(() =>
      setAnnouncement(copy.announce(index + 1, total, step.title, step.body)),
    );
    return () => cancelAnimationFrame(id);
  }, [index, total, step.title, step.body]);

  // Escape closes the innermost thing only: when focus is inside another
  // dialog (the venue map, even with the tour drawn inside it), that dialog
  // closes first and the next Escape closes the tour.
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (e.target instanceof Element && insideOtherDialog(e.target)) return;
      closeRef.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const hole = rect && {
    top: rect.top - RING_PAD,
    left: rect.left - RING_PAD,
    width: rect.width + RING_PAD * 2,
    height: rect.height + RING_PAD * 2,
  };

  // A target in the sponsor shell's bottom tab bar (below md, which is
  // wider than this overlay's own phone breakpoint) always gets its
  // callout above it, whatever the step asks for: beside a bottom tab
  // there's no room.
  const inTabBar = !!anchor?.closest("[data-sponsor-tabbar]");

  let calloutStyle: React.CSSProperties | undefined;
  if (!narrow && hole && size && viewport.width) {
    const placed = placeCallout(
      hole,
      size,
      viewport,
      inTabBar
        ? "top"
        : ((step.placement ?? "bottom") as Exclude<TourPlacement, "center">),
    );
    calloutStyle = { top: placed.top, left: placed.left };
  }
  const centred = !narrow && !hole;
  // Phones dock the callout as a bottom sheet; for a tab bar target, or
  // any target down where that sheet would cover it, dock it to the top.
  const dockTop =
    narrow &&
    !!hole &&
    (inTabBar ||
      (viewport.height > 0 &&
        hole.top + hole.height > viewport.height - (size?.height ?? 0)));
  const waiting = step.waitForClick && !!hole;
  const last = index === total - 1;

  // Stays above Radix dialogs (z-50) and every sticky header.
  const layer = "fixed z-[60] pointer-events-auto";

  const content = (
    <div data-sponsor-tour="" className="font-figtree">
      <p role="status" className="sr-only">
        {announcement}
      </p>

      {hole ? (
        <>
          {/* The dim, as a huge shadow around the ring. */}
          <div
            aria-hidden
            className="pointer-events-none fixed z-[60] rounded-dashboard-lg outline outline-2 outline-offset-0 outline-dashboard-action-primary"
            style={{
              ...hole,
              boxShadow: "0 0 0 9999px rgb(4 34 57 / 0.55)",
            }}
          />
          {/* Click blockers around the cutout (and over it unless the step
              waits for a click on the target). */}
          <div
            aria-hidden
            className={layer}
            style={{ top: 0, left: 0, right: 0, height: Math.max(0, hole.top) }}
          />
          <div
            aria-hidden
            className={layer}
            style={{
              top: hole.top + hole.height,
              left: 0,
              right: 0,
              bottom: 0,
            }}
          />
          <div
            aria-hidden
            className={layer}
            style={{
              top: hole.top,
              left: 0,
              width: Math.max(0, hole.left),
              height: hole.height,
            }}
          />
          <div
            aria-hidden
            className={layer}
            style={{
              top: hole.top,
              left: hole.left + hole.width,
              right: 0,
              height: hole.height,
            }}
          />
          {!waiting && <div aria-hidden className={layer} style={hole} />}
        </>
      ) : (
        <div
          aria-hidden
          className={cn(layer, "inset-0")}
          style={{ background: "rgb(4 34 57 / 0.55)" }}
        />
      )}

      <div
        ref={calloutRef}
        data-tour-callout=""
        role="dialog"
        aria-modal="false"
        aria-labelledby={titleId}
        tabIndex={-1}
        style={calloutStyle}
        className={cn(
          layer,
          "flex flex-col gap-3 bg-dashboard-bg-surface p-5 font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
          "duration-200 ease-out animate-in fade-in-0 motion-reduce:animate-none",
          narrow && dockTop
            ? "inset-x-0 top-0 rounded-b-dashboard-2xl pt-[max(1.25rem,env(safe-area-inset-top))] slide-in-from-top-4"
            : narrow
              ? "inset-x-0 bottom-0 rounded-t-dashboard-2xl pb-[max(1.25rem,env(safe-area-inset-bottom))] slide-in-from-bottom-4"
              : "w-[min(340px,calc(100vw-32px))] rounded-dashboard-2xl zoom-in-95",
          centred && "inset-0 m-auto h-fit",
          // Hidden until measured, so it never flashes at 0,0.
          !narrow && hole && !calloutStyle && "invisible",
        )}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
            {copy.progress(index + 1, total)}
          </span>
          <button
            type="button"
            aria-label={copy.close}
            onClick={onClose}
            className={cn(
              "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
              pressable,
            )}
          >
            <X aria-hidden className="size-5" />
          </button>
        </div>
        <div className="flex flex-col gap-1">
          <h2 id={titleId} className="m-0 text-lg font-semibold">
            {step.title}
          </h2>
          <p className="m-0 text-base text-dashboard-text-medium">
            {step.body}
          </p>
        </div>
        {waiting && (
          <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-highlight px-3 py-2 text-sm font-medium text-dashboard-text-active">
            {copy.clickHint}
          </p>
        )}
        <div className="flex items-center justify-between gap-2">
          <DashboardButton
            variant="link"
            onClick={onClose}
            className="-ml-2 min-h-11"
          >
            {copy.skip}
          </DashboardButton>
          <div className="flex items-center gap-2">
            {index > 0 && (
              <DashboardButton
                variant="small"
                onClick={onBack}
                className="min-h-11 px-3"
              >
                {copy.back}
              </DashboardButton>
            )}
            <DashboardButton
              onClick={onNext}
              className={cn("h-auto min-h-11 w-auto py-2", pressable)}
            >
              {nextLabel ?? (last ? copy.done : copy.next)}
            </DashboardButton>
          </div>
        </div>
      </div>
    </div>
  );

  // Inside a Radix dialog (the map), render into it: its focus trap and
  // outside-click dismiss then treat the tour as part of the dialog.
  const container = anchor?.closest('[role="dialog"]') ?? document.body;
  return createPortal(content, container);
}
