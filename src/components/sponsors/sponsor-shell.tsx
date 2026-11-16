import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import SEO from "~/components/seo";
import { scheduleCopy } from "~/content/sponsor-schedule";

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
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div
          className={`mx-auto flex w-full flex-col gap-5 ${wide ? "max-w-[1040px]" : "max-w-[640px]"}`}
        >
          <header className="flex min-h-11 items-center justify-between gap-3">
            {backHref ? (
              <Link
                href={backHref}
                className="-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-dashboard-sm px-2 text-sm font-semibold text-dashboard-text-medium hover:text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              >
                <ArrowLeft aria-hidden className="size-4" />
                {scheduleCopy.back}
              </Link>
            ) : (
              <span />
            )}
            <span className="text-sm font-semibold tracking-tight text-dashboard-text-medium">
              {scheduleCopy.brand}
            </span>
          </header>
          {children}
        </div>
      </div>
    </>
  );
}
