import { useEffect, useRef, useState } from "react";

import { TourOverlay } from "~/components/sponsors/tour/tour-overlay";
import { type TourPlacement } from "~/lib/sponsor-tour";

/** One stop of a spotlight tour: what to say, and where to point. */
export interface SpotStep {
  id: string;
  title: string;
  body: string;
  placement?: TourPlacement;
  /** The element to spotlight; none (or not found) = a centred callout. */
  find?: () => Element | null;
}

const isShown = (el: Element) => {
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/** The part of the tour stage one screen lives in. */
const stage = (side: string) =>
  document.querySelector(`[data-tour-stage="${side}"]`);

/**
 * The innermost visible element in `side` whose text includes `text`,
 * optionally only among `selector` matches. Screens are the real app's,
 * so the tour finds things by what they say rather than adding hooks to
 * the app.
 */
export function byText(side: string, text: string, selector = "*") {
  const root = stage(side);
  if (!root) return null;
  const hits = [...root.querySelectorAll(selector)].filter(
    (el) => el.textContent?.includes(text) && isShown(el),
  );
  return (
    hits.find((el) => !hits.some((o) => o !== el && el.contains(o))) ?? null
  );
}

/** The card (bordered, rounded box) around the text. */
export function cardWith(side: string, text: string) {
  const el = byText(side, text);
  return (
    el?.closest('section, [class*="rounded"][class*="border"]') ?? el ?? null
  );
}

/** The smallest element in `side` that holds every one of `texts`. */
export function around(side: string, ...texts: string[]) {
  let el: Element | null = byText(side, texts[0] ?? "");
  while (el && !texts.every((t) => el?.textContent?.includes(t))) {
    el = el.parentElement;
  }
  return el;
}

/** The first visible element in `side` matching `selector`. */
export function bySelector(side: string, selector: string) {
  const root = stage(side);
  if (!root) return null;
  return [...root.querySelectorAll(selector)].find(isShown) ?? null;
}

/** Finds the step's element once its screen has rendered, and scrolls to it. */
function useAnchor(find: (() => Element | null) | undefined, key: string) {
  const [el, setEl] = useState<Element | null>(null);
  const findRef = useRef(find);
  findRef.current = find;
  useEffect(() => {
    setEl(null);
    if (!findRef.current) return;
    let tries = 0;
    const id = setInterval(() => {
      const found = findRef.current?.() ?? null;
      if (found) {
        clearInterval(id);
        found.scrollIntoView({ block: "center", inline: "nearest" });
        setEl(found);
      } else if (++tries > 25) {
        clearInterval(id);
      }
    }, 80);
    return () => clearInterval(id);
  }, [key]);
  return el;
}

/** The sponsor portal's tour callout and dim, over the tour's own screens. */
export function Spotlight({
  steps,
  at,
  onMove,
  onClose,
}: {
  steps: readonly SpotStep[];
  at: number;
  onMove: (index: number) => void;
  onClose: () => void;
}) {
  const step = steps[at];
  const anchor = useAnchor(step?.find, `${at}:${step?.id}`);
  if (!step) return null;
  return (
    <TourOverlay
      step={{
        id: step.id,
        page: "any",
        title: step.title,
        body: step.body,
        placement: step.placement,
      }}
      index={at}
      total={steps.length}
      anchor={anchor}
      onBack={() => onMove(Math.max(0, at - 1))}
      onNext={() => (at >= steps.length - 1 ? onClose() : onMove(at + 1))}
      onClose={onClose}
    />
  );
}
