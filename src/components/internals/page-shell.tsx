import { type ReactNode } from "react";
import { InternalNavbar } from "~/components/internals/navbar";

/**
 * The common frame for organizer pages: navbar, page background, a centered
 * column, and a header with an eyebrow, title, optional subtitle and actions.
 */
export function InternalPage({
  title,
  subtitle,
  actions,
  wide = false,
  children,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Use most of the screen width (dashboards like the judging control room). */
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <>
      <InternalNavbar />
      <main className="min-h-screen bg-[#eef1f6] px-4 pb-12 pt-8 font-figtree text-[#0b2238] sm:px-5">
        <div
          className={`mx-auto flex flex-col gap-5 ${wide ? "max-w-[1920px]" : "max-w-[1280px]"}`}
        >
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-[#4a5d73]">
                Hack Western 13 · Organizers
              </span>
              <h1 className="m-0 text-[28px] font-bold leading-tight lg:text-[34px]">
                {title}
              </h1>
              {subtitle && (
                <span className="text-[13px] tabular-nums text-[#4a5d73]">
                  {subtitle}
                </span>
              )}
            </div>
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
          </header>
          {children}
        </div>
      </main>
    </>
  );
}
