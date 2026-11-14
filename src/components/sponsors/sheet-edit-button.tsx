import { ExternalLink, Lock } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { cn } from "~/lib/utils";

// The run-of-show sheet is the single source of truth (docs/decisions.md,
// 2026-11-14): organizer info is read-only on the site, and this is the one
// way to change it. Organizer views only; sponsors never get the sheet link.
export function SheetEditButton({
  href,
  className,
}: {
  /** The Google Sheets URL. Renders nothing when missing. */
  href: string | null | undefined;
  className?: string;
}) {
  if (!href) return null;

  return (
    <div
      className={cn(
        "flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <p className="m-0 flex items-center gap-1.5 text-sm text-dashboard-text-light">
        <Lock aria-hidden className="size-3.5 shrink-0" />
        Read-only here. Make changes in the sheet.
      </p>
      <DashboardButton
        variant="outline"
        asChild
        className="h-11 w-full sm:h-10 sm:w-auto"
      >
        <a href={href} target="_blank" rel="noopener noreferrer">
          Edit in Google Sheets
          <ExternalLink aria-hidden />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      </DashboardButton>
    </div>
  );
}
