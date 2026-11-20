import { sponsorVenueCopy as copy } from "~/content/sponsor-venue";
import { SPONSOR_BAY_BOOTHS, boothFor } from "~/lib/sponsor-bay-layout";
import { cn } from "~/lib/utils";
import { sponsorCard, tapRow } from "./sponsor-shell-styles";

/**
 * The Sponsor Bay floor: booths around the projector screen, with the
 * viewer's own booth highlighted (Jazz, 2026-11-18).
 */
export function BoothLayout({
  sponsorName,
  title,
  lead,
}: {
  sponsorName?: string | null;
  /** A heading inside the card (the Map page's "Your booth"). */
  title?: React.ReactNode;
  /** Under the heading, in place of the caption (the Map page's
   * "Right wall, middle booth, between …"); the own booth then says "· you". */
  lead?: React.ReactNode;
}) {
  const mine = boothFor(sponsorName);
  return (
    <figure className={cn("m-0 flex flex-col gap-3", sponsorCard)}>
      {title}
      {lead}
      <div
        role="img"
        aria-label={
          mine ? copy.booths.labelMine(mine.sponsor) : copy.booths.label
        }
        className="flex flex-col gap-1.5 sm:gap-2"
      >
        {/* The projector screen spans the three top booths. */}
        <div className="mx-[20%] flex min-h-11 items-center justify-center rounded-dashboard-lg border border-dashed border-dashboard-border-control bg-dashboard-bg-inset text-xs font-semibold text-dashboard-text-medium sm:text-sm">
          {copy.booths.screen}
        </div>
        <div
          aria-hidden
          className="grid grid-cols-5 grid-rows-[repeat(5,minmax(2.75rem,auto))] gap-1.5 sm:gap-2"
        >
          {SPONSOR_BAY_BOOTHS.map((b) => {
            const isMine = mine?.sponsor === b.sponsor;
            return (
              <div
                key={b.sponsor}
                style={{ gridColumn: b.col, gridRow: b.row }}
                className={cn(
                  // Company names stay on one line (Jazz, v6).
                  "flex min-w-0 items-center justify-center whitespace-nowrap rounded-dashboard-lg border px-0.5 text-center text-[length:theme(fontSize.dashboard-micro)] font-semibold leading-tight sm:text-xs",
                  tapRow,
                  isMine
                    ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse shadow-dashboard-card"
                    : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-medium",
                )}
              >
                {isMine && lead ? copy.booths.you(b.sponsor) : b.sponsor}
              </div>
            );
          })}
        </div>
      </div>
      {mine && !lead && (
        <figcaption className="m-0 text-sm font-medium text-dashboard-text-light">
          {copy.booths.yours(mine.sponsor)}
        </figcaption>
      )}
    </figure>
  );
}
