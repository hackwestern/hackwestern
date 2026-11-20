import { useEffect, useState } from "react";
import { targetSelector } from "~/lib/sponsor-tour";

// Finding a tour step's target on the live page, shared by the sponsor
// portal's tours and the organizer dashboard's per-tab tours.

/** How long a step waits for its target to render before centring. */
const TARGET_GRACE_MS = 1200;

/** The first visible element for a `data-tour` name, if any. */
function findTarget(target: string): Element | null {
  for (const el of document.querySelectorAll(targetSelector(target))) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 || r.height > 0) return el;
  }
  return null;
}

const isShown = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
};

/**
 * Watch for a step's target: it may render late (data loading, a dialog
 * opening, a tab switch) or go away (a dialog closing). The page is only
 * searched when the DOM changes and the current target is gone or hidden;
 * the overlay tracks the found element's position itself. `settled` turns
 * true once the grace time is up, so a missing target becomes a centred
 * callout instead of an endless wait.
 */
export function useTarget(target: string | undefined, stepKey: string) {
  const [el, setEl] = useState<Element | null>(null);
  const [settled, setSettled] = useState(false);
  useEffect(() => {
    setEl(null);
    setSettled(!target);
    if (!target) return;
    let current: Element | null = null;
    const look = () => {
      if (current?.isConnected && isShown(current)) return;
      current = findTarget(target);
      setEl(current);
    };
    look();
    const observer = new MutationObserver(look);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // Tab panels and dialogs show and hide through these.
      attributes: true,
      attributeFilter: ["hidden", "class", "style", "data-state"],
    });
    const grace = setTimeout(() => setSettled(true), TARGET_GRACE_MS);
    return () => {
      observer.disconnect();
      clearTimeout(grace);
    };
  }, [target, stepKey]);
  return { el, settled: settled || !!el };
}
