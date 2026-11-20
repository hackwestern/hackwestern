import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Drag a chat or booking on the Rooms grid (mock organizer-coffee-v9 to v12).
 * Cells carry data-cell="<key>"; draggable ones also carry data-drag. The
 * Remove zone carries data-remove-zone.
 * - Mouse and pen: press and move 5px. The click that ends a drag is
 *   swallowed, so it never opens the modal.
 * - Touch: press and hold 250 ms (a 10 ms buzz), then drag. Moving more
 *   than 8px first cancels the hold, so a quick swipe scrolls the grid.
 *   While dragging the page doesn't scroll by itself, the long-press menu
 *   is off, touchcancel ends with no change and touchend sends no click.
 * - A ghost copy follows the pointer; near an edge the grid scrolls sideways
 *   (40px) and the page up or down (50px), 6px a frame. Esc cancels.
 * The caller must not remove cell elements during a drag (touch events stop
 * when their target leaves the DOM): it freezes the board while `drag` is set.
 */
export type BoardDrag = {
  src: string;
  /** The cell key under the pointer, "remove" for the Remove zone, or null. */
  over: string | null;
  /** The Remove zone covers the whole bottom bar: max(80px, the bar's height). */
  zoneHeight: number;
};

type Pending = { src: string; el: HTMLElement; x: number; y: number; kind: "mouse" | "touch"; timer?: ReturnType<typeof setTimeout> };
type Live = {
  src: string;
  ghost: HTMLElement;
  style: HTMLStyleElement;
  el: HTMLElement;
  dx: number;
  dy: number;
  x: number;
  y: number;
  over: string | null;
  raf: number;
};

const EDGE_X = 40;
const EDGE_Y = 50;
const STEP = 6;

export function useBoardDrag({
  scrollRef,
  barSelector,
  enabled,
  onDrop,
}: {
  /** The grid's sideways scroll box. */
  scrollRef: React.RefObject<HTMLElement | null>;
  /** The sticky bar the Remove zone covers. */
  barSelector: string;
  enabled: boolean;
  /** `target` is a cell key or "remove"; never called for a cancelled drag or a drop on itself. */
  onDrop: (src: string, target: string) => void;
}) {
  const [drag, setDrag] = useState<BoardDrag | null>(null);
  const live = useRef<Live | null>(null);
  const pend = useRef<Pending | null>(null);
  const swallow = useRef(false);
  const onDropRef = useRef(onDrop);
  onDropRef.current = onDrop;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  const hitAt = (x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y)?.closest<HTMLElement>("[data-remove-zone], [data-cell]");
    if (!el) return null;
    return el.hasAttribute("data-remove-zone") ? "remove" : (el.dataset.cell ?? null);
  };

  const moveTo = useCallback((x: number, y: number) => {
    const d = live.current;
    if (!d) return;
    d.x = x;
    d.y = y;
    d.ghost.style.transform = `translate(${x - d.dx}px, ${y - d.dy}px) rotate(-2deg)`;
    const over = hitAt(x, y);
    if (over === d.over) return;
    d.over = over;
    setDrag((cur) => (cur ? { ...cur, over } : cur));
  }, []);

  const end = useCallback((drop: boolean) => {
    const d = live.current;
    if (!d) return;
    live.current = null;
    cancelAnimationFrame(d.raf);
    d.ghost.remove();
    d.style.remove();
    d.el.removeAttribute("data-dragging");
    setDrag(null);
    if (drop && d.over && d.over !== d.src) onDropRef.current(d.src, d.over);
  }, []);

  const start = useCallback(
    (p: Pending, x: number, y: number) => {
      pend.current = null;
      const r = p.el.getBoundingClientRect();
      const ghost = p.el.cloneNode(true) as HTMLElement;
      ghost.removeAttribute("data-cell");
      ghost.removeAttribute("data-drag");
      ghost.removeAttribute("id");
      ghost.setAttribute("aria-hidden", "true");
      Object.assign(ghost.style, {
        position: "fixed",
        left: "0",
        top: "0",
        width: `${r.width}px`,
        height: `${r.height}px`,
        margin: "0",
        zIndex: "45",
        pointerEvents: "none",
        opacity: "0.96",
        boxShadow: "0 10px 28px rgba(11,43,74,.28)",
        outline: "none",
      });
      document.body.appendChild(ghost);
      // "grabbing" everywhere and no text selection while dragging.
      const style = document.createElement("style");
      style.textContent = "body,body *{cursor:grabbing!important;-webkit-user-select:none!important;user-select:none!important}";
      document.head.appendChild(style);
      p.el.setAttribute("data-dragging", "");
      const bar = document.querySelector<HTMLElement>(barSelector);
      live.current = { src: p.src, ghost, style, el: p.el, dx: x - r.left, dy: y - r.top, x, y, over: null, raf: 0 };
      setDrag({ src: p.src, over: null, zoneHeight: Math.max(80, bar?.offsetHeight ?? 0) });
      try {
        navigator.vibrate?.(10);
      } catch {
        // Some browsers throw without a user gesture; the buzz is optional.
      }
      moveTo(x, y);
      const zoneH = Math.max(80, bar?.offsetHeight ?? 0);
      const tick = () => {
        const d = live.current;
        if (!d) return;
        const box = scrollRef.current;
        let moved = false;
        if (box) {
          const g = box.getBoundingClientRect();
          if (d.y > g.top && d.y < g.bottom) {
            if (d.x < g.left + EDGE_X && box.scrollLeft > 0) {
              box.scrollLeft -= STEP;
              moved = true;
            } else if (d.x > g.right - EDGE_X && box.scrollLeft < box.scrollWidth - box.clientWidth) {
              box.scrollLeft += STEP;
              moved = true;
            }
          }
        }
        const bottom = window.innerHeight - zoneH;
        if (d.y < EDGE_Y && window.scrollY > 0) {
          window.scrollBy(0, -STEP);
          moved = true;
        } else if (d.y > bottom - EDGE_Y && d.y < bottom) {
          window.scrollBy(0, STEP);
          moved = true;
        }
        // The content moved under a still pointer: hit-test again.
        if (moved) moveTo(d.x, d.y);
        d.raf = requestAnimationFrame(tick);
      };
      live.current.raf = requestAnimationFrame(tick);
    },
    [barSelector, moveTo, scrollRef],
  );

  useEffect(() => {
    const target = (e: Event) => {
      if (!enabledRef.current) return null;
      const el = (e.target as HTMLElement | null)?.closest?.<HTMLElement>("[data-drag][data-cell]");
      return el ?? null;
    };
    // Mouse and pen.
    const down = (e: PointerEvent) => {
      if (e.pointerType === "touch" || e.button !== 0) return;
      const el = target(e);
      if (el) pend.current = { src: el.dataset.cell!, el, x: e.clientX, y: e.clientY, kind: "mouse" };
    };
    const move = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      if (live.current) return moveTo(e.clientX, e.clientY);
      const p = pend.current;
      if (p?.kind === "mouse" && Math.hypot(e.clientX - p.x, e.clientY - p.y) > 5) start(p, e.clientX, e.clientY);
    };
    const up = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      pend.current = null;
      if (!live.current) return;
      // The click after a drag isn't a click.
      swallow.current = true;
      setTimeout(() => (swallow.current = false), 0);
      moveTo(e.clientX, e.clientY);
      end(true);
    };
    const click = (e: MouseEvent) => {
      if (!swallow.current) return;
      swallow.current = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // Touch: press and hold, then drag.
    const tStart = (e: TouchEvent) => {
      const old = pend.current;
      if (old?.timer) clearTimeout(old.timer);
      pend.current = null;
      if (e.touches.length !== 1) return;
      const el = target(e);
      if (!el) return;
      const t = e.touches[0]!;
      const p: Pending = { src: el.dataset.cell!, el, x: t.clientX, y: t.clientY, kind: "touch" };
      p.timer = setTimeout(() => {
        if (pend.current === p) start(p, p.x, p.y);
      }, 250);
      pend.current = p;
    };
    const tMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      if (live.current) {
        e.preventDefault();
        return moveTo(t.clientX, t.clientY);
      }
      const p = pend.current;
      if (p?.kind !== "touch") return;
      if (Math.hypot(t.clientX - p.x, t.clientY - p.y) > 8) {
        clearTimeout(p.timer);
        pend.current = null; // a swipe: let it scroll
      } else {
        p.x = t.clientX;
        p.y = t.clientY;
      }
    };
    const tEnd = (e: TouchEvent) => {
      const p = pend.current;
      if (p?.kind === "touch") {
        clearTimeout(p.timer);
        pend.current = null;
      }
      if (!live.current) return;
      e.preventDefault(); // no click after a drag
      const t = e.changedTouches[0];
      if (t) moveTo(t.clientX, t.clientY);
      end(true);
    };
    const tCancel = () => {
      const p = pend.current;
      if (p?.timer) clearTimeout(p.timer);
      pend.current = null;
      end(false);
    };
    const menu = (e: Event) => {
      if (live.current !== null || (pend.current !== null && target(e) !== null)) e.preventDefault();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape" && live.current) {
        e.preventDefault();
        e.stopPropagation();
        end(false);
      }
    };
    document.addEventListener("pointerdown", down);
    document.addEventListener("pointermove", move);
    document.addEventListener("pointerup", up);
    document.addEventListener("click", click, true);
    document.addEventListener("touchstart", tStart, { passive: true });
    document.addEventListener("touchmove", tMove, { passive: false });
    document.addEventListener("touchend", tEnd, { passive: false });
    document.addEventListener("touchcancel", tCancel);
    document.addEventListener("contextmenu", menu);
    window.addEventListener("keydown", key, true);
    return () => {
      document.removeEventListener("pointerdown", down);
      document.removeEventListener("pointermove", move);
      document.removeEventListener("pointerup", up);
      document.removeEventListener("click", click, true);
      document.removeEventListener("touchstart", tStart);
      document.removeEventListener("touchmove", tMove);
      document.removeEventListener("touchend", tEnd);
      document.removeEventListener("touchcancel", tCancel);
      document.removeEventListener("contextmenu", menu);
      window.removeEventListener("keydown", key, true);
      end(false);
    };
  }, [end, moveTo, start]);

  return drag;
}
