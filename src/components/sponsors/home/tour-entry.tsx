import { Compass } from "lucide-react";
import { btn } from "~/components/sponsors/portal-ui";
import { startSponsorTour } from "~/components/sponsors/tour/sponsor-tour";
import { sponsorTourCopy } from "~/content/sponsor-tour";
import { cn } from "~/lib/utils";

const copy = sponsorTourCopy.homeEntry;

/** Home's "Take the tour" line, under Up next: replays the portal tour. */
export function TourEntry() {
  return (
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-2.5 shadow-dashboard-card">
      <p className="m-0 text-sm text-dashboard-text-medium">{copy.text}</p>
      <button
        type="button"
        onClick={() => startSponsorTour()}
        className={cn(btn.outline, btn.sm, "[&_svg]:size-[18px]")}
      >
        <Compass aria-hidden className="text-dashboard-action-primary" />
        {copy.button}
      </button>
    </div>
  );
}
