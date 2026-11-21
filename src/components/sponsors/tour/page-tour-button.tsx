import { Compass } from "lucide-react";
import {
  hoverTint,
  pressable,
} from "~/components/sponsors/sponsor-shell-styles";
import { startSponsorTour } from "~/components/sponsors/tour/sponsor-tour";
import { sponsorTourCopy } from "~/content/sponsor-tour";
import type { TourPage } from "~/lib/sponsor-tour";
import { pageTourId } from "~/lib/sponsor-tours";
import { cn } from "~/lib/utils";

const copy = sponsorTourCopy.pageTour;

/**
 * "Tour this page": runs only the steps on the page you're on. Phones show
 * "Tour" (the top bar is narrow), tablets and up "Tour this page"; the
 * accessible name always says which page.
 */
export function PageTourButton({
  page,
  pageName,
  compact = false,
}: {
  page: TourPage;
  /** The page's name, for the accessible label ("Schedule"). */
  pageName: string;
  /** The phone top bar's short version. */
  compact?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={copy.label(pageName)}
      onClick={() => startSponsorTour(pageTourId(page))}
      className={cn(
        "inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface text-sm font-semibold text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
        compact ? "px-2.5" : "px-3",
        hoverTint,
        pressable,
      )}
    >
      <Compass
        aria-hidden
        className="size-[18px] shrink-0 text-dashboard-text-active"
      />
      {compact ? copy.short : copy.button}
    </button>
  );
}
