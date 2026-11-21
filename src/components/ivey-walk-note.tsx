import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { iveyWalkCopy } from "~/content/ivey-walk";
import { cn } from "~/lib/utils";

/**
 * The Ivey walk disclaimer under an Ivey coffee chat room: a warning icon,
 * the text (not colour alone) and a "Check map" link that opens the map on
 * the Ivey building. `who` picks the wording (src/content/ivey-walk.ts).
 */
export function IveyWalkNote({
  who,
  mapHref,
  className,
}: {
  who: "hacker" | "sponsor";
  /** Where Check map goes; no link when null. */
  mapHref: string | null;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "m-0 flex items-start gap-1.5 text-sm font-medium text-dashboard-text-warning",
        className,
      )}
    >
      <TriangleAlert aria-hidden className="mt-0.5 size-4 flex-none" />
      <span className="min-w-0">
        {iveyWalkCopy[who]}{" "}
        {mapHref && (
          <Link
            href={mapHref}
            className="font-semibold text-dashboard-text-link underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
          >
            {iveyWalkCopy.mapLink}
          </Link>
        )}
      </span>
    </p>
  );
}
