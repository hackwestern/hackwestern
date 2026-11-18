import { sponsorVenueCopy as copy } from "~/content/sponsor-venue";
import { SPONSOR_BAY_BOOTHS, boothFor } from "~/lib/sponsor-bay-layout";
import { cn } from "~/lib/utils";

/**
 * The Sponsor Bay floor: booths around the projector screen, with the
 * viewer's own booth highlighted (Jazz, 2026-11-18).
 */
export function BoothLayout({ sponsorName }: { sponsorName?: string | null }) {
  const mine = boothFor(sponsorName);
  return (
    <figure className="m-0 flex flex-col gap-3">
      <div
        role="img"
        aria-label={
          mine ? copy.booths.labelMine(mine.sponsor) : copy.booths.label
        }
        className="flex flex-col gap-3 rounded-dashboard-2xl bg-dashboard-bg-surface p-4 shadow-dashboard-card sm:p-5"
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-xs font-semibold uppercase tracking-wide text-dashboard-text-light">
            {copy.booths.screen}
          </span>
          <span
            aria-hidden
            className="h-1 w-3/4 rounded-full bg-dashboard-text-heavy"
          />
        </div>
        <div
          aria-hidden
          className="grid grid-cols-5 grid-rows-[repeat(5,minmax(2.75rem,auto))] gap-1.5 sm:gap-2"
        >
          {SPONSOR_BAY_BOOTHS.map((b) => {
            const isMine = mine?.sponsor === b.sponsor;
            const vertical = b.side === "left" || b.side === "right";
            return (
              <div
                key={b.sponsor}
                style={{ gridColumn: b.col, gridRow: b.row }}
                className={cn(
                  "flex items-center justify-center rounded-dashboard-sm border px-1 py-1.5 text-center text-xs font-semibold leading-tight",
                  isMine
                    ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse shadow-dashboard-card"
                    : "border-dashboard-border-subtle bg-dashboard-bg-inset text-dashboard-text-medium",
                  vertical && "min-h-16",
                )}
              >
                <span
                  className={cn(
                    vertical && "[writing-mode:vertical-rl]",
                    b.side === "left" && "rotate-180",
                  )}
                >
                  {b.sponsor}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      {mine && (
        <figcaption className="m-0 text-sm font-medium text-dashboard-text-light">
          {copy.booths.yours(mine.sponsor)}
        </figcaption>
      )}
    </figure>
  );
}
