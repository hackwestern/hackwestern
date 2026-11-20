import { useEffect, useState } from "react";
import { targetSelector } from "~/lib/sponsor-tour";

// Finding a tour step's target on the live page, shared by the sponsor
// portal's tour and the organizer dashboard's per-tab tours.

/** How long a step waits for its target to render before centring. */
const TARGET_GRACE_MS = 1200;

const isShown = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 || r.height > 0;
};

/** The first visible element for the first `data-tour` name that has one. */
function findTarget(targets: readonly string[]): Element | null {
  for (const target of targets) {
    for (const el of document.querySelectorAll(targetSelector(target))) {
      if (isShown(el)) return el;
    }
  }
  return null;
}

/**
 * Watch for a step's target: it may render late (data loading, a dialog
 * opening, a tab switch) or go away (a dialog closing). With several
 * names (a step's variants) the first one on the page wins. The page is
 * only searched when the DOM changes and the current target is gone or
 * hidden; the overlay tracks the found element's position itself.
 * `settled` turns true once the grace time is up, so a missing target
 * becomes a centred callout (or a skipped step) instead of an endless
 * wait. Both values belong to `stepKey`: right after the step changes they
 * read empty, never the previous step's.
 */
export function useTarget(
  target: string | readonly string[] | undefined,
  stepKey: string,
  graceMs: number = TARGET_GRACE_MS,
) {
  const names: readonly string[] =
    target === undefined ? [] : typeof target === "string" ? [target] : target;
  const namesKey = names.join("\n");
  const key = `${stepKey}\n${namesKey}`;
  const [state, setState] = useState<{
    key: string;
    el: Element | null;
    settled: boolean;
  }>({ key: "", el: null, settled: false });

  useEffect(() => {
    const list = namesKey ? namesKey.split("\n") : [];
    if (list.length === 0) {
      setState({ key, el: null, settled: true });
      return;
    }
    let current: Element | null = null;
    let settled = false;
    const publish = () => setState({ key, el: current, settled });
    const look = () => {
      if (current?.isConnected && isShown(current)) return;
      const next = findTarget(list);
      if (next === current) return;
      current = next;
      publish();
    };
    current = findTarget(list);
    publish();
    const observer = new MutationObserver(look);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      // Tab panels and dialogs show and hide through these.
      attributes: true,
      attributeFilter: ["hidden", "class", "style", "data-state"],
    });
    const grace = setTimeout(() => {
      settled = true;
      publish();
    }, graceMs);
    return () => {
      observer.disconnect();
      clearTimeout(grace);
    };
  }, [key, namesKey, graceMs]);

  const fresh = state.key === key;
  const el = fresh ? state.el : null;
  return { el, settled: fresh && (state.settled || !!el) };
}
