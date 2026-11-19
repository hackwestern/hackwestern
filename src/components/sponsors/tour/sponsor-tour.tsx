import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import * as Popover from "@radix-ui/react-popover";
import { Compass } from "lucide-react";
import {
  hoverTint,
  pressable,
} from "~/components/sponsors/sponsor-shell-styles";
import { TourOffer } from "~/components/sponsors/tour/tour-offer";
import { TourOverlay } from "~/components/sponsors/tour/tour-overlay";
import { useTarget } from "~/components/sponsors/tour/use-tour-target";
import { sponsorTourCopy as copy } from "~/content/sponsor-tour";
import {
  clickTargetOf,
  getStorage,
  hasSeenWelcome,
  hrefForMove,
  loadProgress,
  markWelcomeSeen,
  pageOf,
  resolveStep,
  saveProgress,
  type TourDef,
  type TourProgress,
} from "~/lib/sponsor-tour";
import {
  howToToursFor,
  toursFor,
  tourName,
  WELCOME_TOUR_ID,
  type SponsorTourId,
} from "~/lib/sponsor-tours";
import { uuidRegex } from "~/utils/urls";
import { cn } from "~/lib/utils";

/** Window event other controls (the side nav's "How this works") fire to
 * start a tour, so the page keeps a single tour instance. */
const START_EVENT = "sponsor-tour:start";

/** Start a tour from anywhere on a sponsor page. */
export function startSponsorTour(id: SponsorTourId) {
  window.dispatchEvent(new CustomEvent(START_EVENT, { detail: id }));
}

/** How long to wait for a click's own navigation before offering a link. */
const AWAY_GRACE_MS = 900;

/**
 * The sponsor portal's guided tours: a "How to" pill for the page header
 * (replay the portal tour or start a quick how-to), the tour itself drawn
 * over the live page, and on the portal home a one-time "Take the tour?"
 * offer. Progress lives in sessionStorage so a tour carries on across
 * pages; each sponsor page mounts its own copy of this.
 */
export function SponsorTour({
  offerWelcome = false,
  hasPrizeTrack,
}: {
  offerWelcome?: boolean;
  /** False drops the Judging steps and how-to (no Judging in the nav). */
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
  const [menuOpen, setMenuOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
  const { el, settled } = useTarget(
    step?.placement === "center" ? undefined : step?.target,
    // The route is in the key so a new page always gets a fresh search.
    `${progress?.tour}:${progress?.step}:${router.asPath}`,
  );

  const close = useCallback(() => {
    if (progress?.tour === WELCOME_TOUR_ID) {
      markWelcomeSeen(getStorage("local"), sponsor);
    }
    update(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, [progress?.tour, sponsor, update]);

  /** Move to step `index`; `navigate` false when the app is already going. */
  const moveTo = useCallback(
    (index: number, navigate = true) => {
      if (!progress || !def) return;
      if (index < 0) return;
      if (index >= def.steps.length) {
        close();
        return;
      }
      update({ ...progress, step: index });
      const href = navigate ? hrefForMove(def, index, current, sponsor) : null;
      if (href) void router.push(href);
    },
    [progress, def, close, update, current, sponsor, router],
  );

  const start = (id: SponsorTourId) => {
    const tourDef = tours[id];
    if (!tourDef) return;
    setOffer(false);
    setMenuOpen(false);
    if (id === WELCOME_TOUR_ID) markWelcomeSeen(getStorage("local"), sponsor);
    const next = { tour: id, step: 0, sponsor };
    update(next);
    const href = hrefForMove(tourDef, 0, current, sponsor);
    if (href) void router.push(href);
  };
  const startRef = useRef(start);
  startRef.current = start;
  useEffect(() => {
    const onStart = (e: Event) => {
      const id = (e as CustomEvent<unknown>).detail;
      if (typeof id === "string") {
        startRef.current(id as SponsorTourId);
      }
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
        setTimeout(() => moveTo(at, false), 0);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [waitingOn, progress, moveTo]);

  // A step on another page with no navigation under way (a click that
  // didn't navigate, or the sponsor wandered off): after a moment, offer
  // to take them there.
  const resolved =
    def && progress
      ? resolveStep(def, progress.step, current, sponsor, () => !!el)
      : null;
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
      step,
      index: progress.step,
      total: def.steps.length,
      onBack: () => moveTo(progress.step - 1),
      onClose: close,
    };
    if (resolved.kind === "navigate") {
      if (away && awayHref) {
        overlay = (
          <TourOverlay
            {...common}
            anchor={null}
            nextLabel={copy.callout.goThere}
            onNext={() => void router.push(awayHref)}
          />
        );
      }
    } else if (resolved.kind === "show" && settled) {
      overlay = (
        <TourOverlay
          {...common}
          anchor={resolved.anchored ? el : null}
          onNext={() => {
            // Next on a click step does the click for them, so keyboard
            // users get the same result (the link opens, the map opens).
            const clickable = el && clickTargetOf(el);
            if (step.waitForClick && clickable instanceof HTMLElement) {
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
      <Popover.Root open={menuOpen} onOpenChange={setMenuOpen}>
        <Popover.Trigger asChild>
          <button
            ref={triggerRef}
            type="button"
            aria-label={copy.menu.label}
            className={cn(
              "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface px-3 text-sm font-semibold text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
              hoverTint,
              pressable,
            )}
          >
            <Compass
              aria-hidden
              className="size-[18px] shrink-0 text-dashboard-text-active"
            />
            {/* Labelled on phones too: a bare compass reads as nothing. */}
            <span>{copy.menu.button}</span>
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            align="end"
            sideOffset={8}
            collisionPadding={16}
            // Starting a tour moves focus to the callout; don't pull it back.
            onCloseAutoFocus={(e) => progress && e.preventDefault()}
            className="z-50 flex w-[min(280px,calc(100vw-32px))] flex-col gap-1 rounded-dashboard-2xl bg-dashboard-bg-surface p-2 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card duration-150 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
          >
            <p className="dashboard-section-label m-0 px-3 pb-1 pt-2 text-dashboard-text-light">
              {copy.menu.heading}
            </p>
            <ul className="m-0 flex list-none flex-col p-0">
              {howToToursFor(hasPrizeTrack).map((id) => (
                <li key={id}>
                  <MenuItem onClick={() => start(id)}>{tourName(id)}</MenuItem>
                </li>
              ))}
              <li className="mt-1 border-t border-dashboard-border-subtle pt-1">
                <MenuItem onClick={() => start(WELCOME_TOUR_ID)}>
                  <Compass
                    aria-hidden
                    className="size-4 shrink-0 text-dashboard-action-primary"
                  />
                  {copy.menu.welcome}
                </MenuItem>
              </li>
            </ul>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>

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

function MenuItem({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex min-h-11 w-full items-center gap-2 rounded-dashboard-lg px-3 text-left text-base font-semibold text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
        hoverTint,
        pressable,
      )}
    >
      {children}
    </button>
  );
}
