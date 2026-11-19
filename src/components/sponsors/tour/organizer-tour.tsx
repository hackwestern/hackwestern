import { useCallback, useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import {
  hoverTint,
  pressable,
} from "~/components/sponsors/sponsor-shell-styles";
import { TourOffer } from "~/components/sponsors/tour/tour-offer";
import { TourOverlay } from "~/components/sponsors/tour/tour-overlay";
import { useTarget } from "~/components/sponsors/tour/use-tour-target";
import { organizerTourCopy as copy } from "~/content/organizer-tour";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import {
  markOrganizerTourSeen,
  ORGANIZER_TOURS,
  organizerStepAt,
  shouldOfferOrganizerTour,
  tourAfterTabChange,
  type OrganizerTourState,
} from "~/lib/organizer-tours";
import type { OrganizerTab } from "~/lib/sponsor-organizer";
import { clickTargetOf, getStorage, resolveStep } from "~/lib/sponsor-tour";
import { cn } from "~/lib/utils";

/**
 * The organizer dashboard's per-tab tours: a "Tour" button for the page
 * header that starts the tour for the open tab, a one-time "New here?"
 * offer the first time an organizer opens each tab, and the tour itself,
 * drawn with the sponsor portal's overlay. Answering the offer either way
 * (or starting the tour) is remembered per tab in localStorage. Every step
 * is on the open tab, so switching tabs ends a running tour.
 */
export function OrganizerTour({ tab }: { tab: OrganizerTab }) {
  const [state, setState] = useState<OrganizerTourState | null>(null);
  const [offer, setOffer] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const tabName = sponsorOrganizerCopy.tabs[tab];

  useEffect(() => {
    setState((s) => tourAfterTabChange(s, tab));
    setOffer(shouldOfferOrganizerTour(getStorage("local"), tab));
  }, [tab]);

  const def = state ? ORGANIZER_TOURS[state.tab] : undefined;
  const step = def && state ? def.steps[state.step] : undefined;
  const { el, settled } = useTarget(
    step?.placement === "center" ? undefined : step?.target,
    `${state?.tab}:${state?.step}`,
  );

  const close = useCallback(() => {
    setState(null);
    triggerRef.current?.focus({ preventScroll: true });
  }, []);

  const moveTo = useCallback(
    (index: number) => {
      if (!state || index < 0) return;
      const next = organizerStepAt(state, index);
      if (next) setState(next);
      else close();
    },
    [state, close],
  );

  const start = () => {
    markOrganizerTourSeen(getStorage("local"), tab);
    setOffer(false);
    setState({ tab, step: 0 });
  };

  // waitForClick steps advance on the organizer's own click on the target
  // (the click still reaches the app), as in the sponsor portal.
  const waitingOn = step?.waitForClick ? el : null;
  useEffect(() => {
    if (!waitingOn || !state) return;
    const onClick = (e: MouseEvent) => {
      if (e.target instanceof Node && waitingOn.contains(e.target)) {
        const at = state.step + 1;
        setTimeout(() => moveTo(at), 0);
      }
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [waitingOn, state, moveTo]);

  let overlay: React.ReactNode = null;
  if (def && state && step && settled) {
    // Every step is `page: "any"`, so this only decides anchored vs centred.
    const resolved = resolveStep(def, state.step, null, "", () => !!el);
    if (resolved.kind === "show") {
      overlay = (
        <TourOverlay
          step={step}
          index={state.step}
          total={def.steps.length}
          anchor={resolved.anchored ? el : null}
          onBack={() => moveTo(state.step - 1)}
          onClose={close}
          onNext={() => {
            const clickable = el && clickTargetOf(el);
            if (step.waitForClick && clickable instanceof HTMLElement) {
              clickable.click();
            } else moveTo(state.step + 1);
          }}
        />
      );
    }
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={start}
        aria-label={copy.buttonLabel(tabName)}
        className={cn(
          "inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-full border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm font-semibold text-dashboard-text-medium shadow-dashboard-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
          hoverTint,
          pressable,
        )}
      >
        <Compass aria-hidden className="size-4 shrink-0" />
        <span aria-hidden>{copy.button}</span>
      </button>

      {offer && !state && (
        <TourOffer
          text={{ ...copy.offer, body: copy.offer.body(tabName) }}
          onStart={start}
          onDismiss={() => {
            setOffer(false);
            markOrganizerTourSeen(getStorage("local"), tab);
          }}
          // No phone tab bar on the dashboard: sit at the bottom edge. z-50
          // clears the run of show's sticky grid header (z-40, later in
          // the page); Radix dialogs (z-50, portalled last) still cover it.
          className="bottom-[max(1rem,env(safe-area-inset-bottom))] z-50"
        />
      )}

      {overlay}
    </>
  );
}
