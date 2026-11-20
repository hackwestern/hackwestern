import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import { TourOffer } from "~/components/sponsors/tour/tour-offer";
import { TourOverlay } from "~/components/sponsors/tour/tour-overlay";
import { useTarget } from "~/components/sponsors/tour/use-tour-target";
import { sponsorTourCopy as copy } from "~/content/sponsor-tour";
import {
  clickTargetOf,
  getStorage,
  hasSeenWelcome,
  hrefForMove,
  isSkippable,
  loadProgress,
  markWelcomeSeen,
  pageOf,
  resolveStep,
  saveProgress,
  skipFrom,
  stepTargets,
  type TourDef,
  type TourProgress,
} from "~/lib/sponsor-tour";
import {
  toursFor,
  WELCOME_TOUR_ID,
  type SponsorTourId,
} from "~/lib/sponsor-tours";
import { uuidRegex } from "~/utils/urls";

/** Window event the entry points (Home's and Help's "Take the tour") fire
 * to start a tour, so the page keeps a single tour instance. */
const START_EVENT = "sponsor-tour:start";

/** Start a tour from anywhere on a sponsor page. */
export function startSponsorTour(id: SponsorTourId = WELCOME_TOUR_ID) {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: id }));
}

/** How long to wait for a click's own navigation before offering a link. */
const AWAY_GRACE_MS = 900;
/** How long an optional step waits for its target (the page's data may
 * still be loading) before it's skipped. */
const SKIP_GRACE_MS = 2500;

/**
 * The sponsor portal tour, drawn over the live page, and on the portal
 * home a one-time "New here?" offer. Progress lives in sessionStorage so
 * the tour carries on across pages; the sponsor shell mounts one copy of
 * this on every sponsor page. Started by `startSponsorTour()`.
 */
export function SponsorTour({
  offerWelcome = false,
  hasPrizeTrack,
}: {
  offerWelcome?: boolean;
  /** False drops the Judging step (no Judging in the nav). */
  hasPrizeTrack?: boolean;
}) {
  const router = useRouter();
  const tours = useMemo(() => toursFor(hasPrizeTrack), [hasPrizeTrack]);
  const sponsor =
    typeof router.query.uuid === "string" && uuidRegex.test(router.query.uuid)
      ? router.query.uuid
      : "";
  const current = pageOf(router.pathname);
  const [progress, setProgress] = useState<TourProgress | null>(null);
  const [offer, setOffer] = useState(false);
  /** What had focus before the tour, to give it back after. */
  const returnFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!sponsor) return;
    const saved = loadProgress(
      getStorage("session"),
      tours as Record<string, TourDef>,
      sponsor,
    );
    setProgress(saved);
    setOffer(
      offerWelcome && !saved && !hasSeenWelcome(getStorage("local"), sponsor),
    );
  }, [sponsor, offerWelcome, tours]);

  const update = useCallback((next: TourProgress | null) => {
    saveProgress(getStorage("session"), next);
    setProgress(next);
  }, []);

  const def = progress ? tours[progress.tour as SponsorTourId] : undefined;
  const step = def && progress ? def.steps[progress.step] : undefined;
  const targets = useMemo(() => (step ? stepTargets(step) : []), [step]);
  const skippable = !!step && isSkippable(step);
  const { el, settled } = useTarget(
    targets,
    // The route is in the key so a new page always gets a fresh search.
    `${progress?.tour}:${progress?.step}:${router.asPath}`,
    skippable ? SKIP_GRACE_MS : undefined,
  );

  const close = useCallback(() => {
    markWelcomeSeen(getStorage("local"), sponsor);
    update(null);
    const back = returnFocus.current;
    returnFocus.current = null;
    if (back?.isConnected) back.focus({ preventScroll: true });
    else
      document.getElementById("sponsor-main")?.focus({ preventScroll: true });
  }, [sponsor, update]);

  /** Move to step `index`; `navigate` false when the app is already going. */
  const moveTo = useCallback(
    (index: number, opts: { back?: boolean; navigate?: boolean } = {}) => {
      if (!progress || !def) return;
      if (index < 0) return;
      if (index >= def.steps.length) {
        close();
        return;
      }
      const next: TourProgress = { ...progress, step: index };
      if (opts.back) next.back = true;
      else delete next.back;
      update(next);
      const href =
        opts.navigate === false
          ? null
          : hrefForMove(def, index, current, sponsor);
      if (href) void router.push(href);
    },
    [progress, def, close, update, current, sponsor, router],
  );

  const start = (id: SponsorTourId) => {
    const tourDef = tours[id];
    if (!tourDef) return;
    setOffer(false);
    markWelcomeSeen(getStorage("local"), sponsor);
    if (document.activeElement instanceof HTMLElement) {
      returnFocus.current = document.activeElement;
    }
    update({ tour: id, step: 0, sponsor });
    const href = hrefForMove(tourDef, 0, current, sponsor);
    if (href) void router.push(href);
  };
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    const onStart = (e: Event) => {
      const id = (e as CustomEvent<unknown>).detail;
      if (typeof id === "string") startRef.current(id as SponsorTourId);
    };
    window.addEventListener(START_EVENT, onStart);
    return () => window.removeEventListener(START_EVENT, onStart);
  }, []);

  // waitForClick: advance on the sponsor's own click on the target. The
  // listener only watches; the click still reaches the app (a link
  // navigates, a tab switches), so the next step doesn't navigate again.
  const waitingOn = step?.waitForClick ? el : null;
  useEffect(() => {
    if (!waitingOn || !progress) return;
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && waitingOn.contains(e.target)) {
        const at = progress.step + 1;
        setTimeout(() => moveTo(at, { navigate: false }), 0);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [waitingOn, progress, moveTo]);

  const found = el?.getAttribute("data-tour") ?? null;
  const resolved =
    def && progress
      ? resolveStep(def, progress.step, current, sponsor, (t) => t === found)
      : null;

  // A step whose target never showed up: skip it, the same way the sponsor
  // was going (Back keeps going back).
  const skipNow = resolved?.kind === "skip" && settled;
  useEffect(() => {
    if (!skipNow || !progress || !def) return;
    const next = skipFrom(progress.step, !!progress.back, def.steps.length);
    if (next) moveTo(next.step, { back: next.back });
    else close();
  }, [skipNow, progress, def, moveTo, close]);

  // A step on another page with no navigation under way (a click that
  // didn't navigate, or the sponsor wandered off): after a moment, offer
  // to take them there.
  const [away, setAway] = useState(false);
  const awayHref = resolved?.kind === "navigate" ? resolved.href : null;
  useEffect(() => {
    setAway(false);
    if (!awayHref) return;
    const id = setTimeout(() => setAway(true), AWAY_GRACE_MS);
    return () => clearTimeout(id);
  }, [awayHref]);

  let overlay: React.ReactNode = null;
  if (def && progress && step && resolved) {
    const common = {
      index: progress.step,
      total: def.steps.length,
      onBack: () => moveTo(progress.step - 1, { back: true }),
      onClose: close,
    };
    if (resolved.kind === "navigate") {
      if (away && awayHref) {
        overlay = (
          <TourOverlay
            {...common}
            step={step}
            anchor={null}
            nextLabel={copy.callout.goThere}
            onNext={() => void router.push(awayHref)}
          />
        );
      }
    } else if (resolved.kind === "show" && settled) {
      const shown = resolved.step;
      overlay = (
        <TourOverlay
          {...common}
          step={shown}
          anchor={resolved.anchored ? el : null}
          onNext={() => {
            // Next on a click step does the click for them, so keyboard
            // users get the same result (the link opens, the map opens).
            const clickable = el && clickTargetOf(el);
            if (shown.waitForClick && clickable instanceof HTMLElement) {
              clickable.click();
            } else moveTo(progress.step + 1);
          }}
        />
      );
    }
  }

  if (!sponsor) return null;

  return (
    <>
      {offer && !progress && (
        <TourOffer
          text={copy.offer}
          onStart={() => start(WELCOME_TOUR_ID)}
          onDismiss={() => {
            setOffer(false);
            markWelcomeSeen(getStorage("local"), sponsor);
          }}
        />
      )}
      {overlay}
    </>
  );
}
