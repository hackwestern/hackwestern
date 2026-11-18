import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SEO from "~/components/seo";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { VenueMapButton } from "~/components/sponsors/venue-map";
import { cn } from "~/lib/utils";
import { pressable } from "./sponsor-shell-styles";

export { pressable, hoverTint } from "./sponsor-shell-styles";

// Page frame for sponsor sub-pages: same look as the sponsor portal home
// (phone-first, 640px column), with a way back to the portal. `wide` gives
// pages with a grid (the schedule) a wider column on big screens.
export function SponsorShell({
  title,
  backHref,
  wide = false,
  children,
}: {
  title: string;
  backHref?: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <>
      <SEO title={title} noindex />
      <div className="min-h-dvh bg-dashboard-bg-page px-4 pb-[max(3rem,env(safe-area-inset-bottom))] pt-4 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5 sm:pt-6">
        <div
          className={cn(
            "mx-auto flex w-full flex-col gap-5",
            wide ? "max-w-[1040px]" : "max-w-[640px]",
          )}
        >
          <header className="flex min-h-11 items-center justify-between gap-3">
            {backHref ? (
              <Link
                href={backHref}
                className={cn(
                  "-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-dashboard-lg px-2 text-sm font-semibold text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                  pressable,
                )}
              >
                <ArrowLeft aria-hidden className="size-4" />
                {scheduleCopy.back}
              </Link>
            ) : (
              <span />
            )}
            <div className="flex items-center gap-3">
              <span className="hidden text-sm font-semibold tracking-tight text-dashboard-text-light sm:inline">
                {scheduleCopy.brand}
              </span>
              <VenueMapButton />
            </div>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
