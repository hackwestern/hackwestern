import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SEO from "~/components/seo";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { cn } from "~/lib/utils";

/**
 * Press feedback for anything tappable on the sponsor pages and the hacker
 * coffee chats: a quick 0.97 scale on press (ease-out, 150ms), none when the
 * user asks for reduced motion. Transitions name their properties, never
 * `all`. (A shared token for the curve and scale would replace these
 * arbitrary values; see the redesign report.)
 */
export const pressable =
  "transition-[transform,background-color,border-color,color,box-shadow] duration-150 [transition-timing-function:cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:transition-colors motion-reduce:active:scale-100";

/** Hover tint only on devices that really hover, so taps don't stick. */
export const hoverTint =
  "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight";

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
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-light">
              {scheduleCopy.brand}
            </span>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
