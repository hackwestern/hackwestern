import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ChevronDown, Wrench } from "lucide-react";
import { hover, press } from "~/components/internals/interaction";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { organizerHomeHref, type OrganizerTab } from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";

const copy = sponsorOrganizerCopy.home.nav;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";

/** The tools behind the Tools menu, in menu order. */
const TOOLS = ["coffee", "judging", "schedule"] as const satisfies readonly OrganizerTab[];

/**
 * The dashboard's nav (mock organizer-sponsors-home-v3): Home and a small
 * Tools menu (Coffee chat board, Judging board, Full run of show). On a
 * tool, Home reads as a back link so the way back to the day view is
 * always one tap. The menu closes on Escape, an outside click, or a pick.
 */
export function OrganizerNav({
  tab,
  sponsor,
}: {
  tab: OrganizerTab;
  /** The focused sponsor, kept when switching tools. */
  sponsor: string | null;
}) {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);
  const button = useRef<HTMLButtonElement | null>(null);
  const onHome = tab === "sponsors";

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const item = (active: boolean) =>
    cn(
      "inline-flex min-h-11 items-center gap-2 rounded-dashboard-md px-3 text-sm font-semibold md:min-h-9",
      press,
      focusRing,
      active
        ? "bg-dashboard-bg-navSelected text-dashboard-text-active"
        : cn("text-dashboard-text-medium", hover.nav),
    );

  return (
    <nav aria-label={copy.label} className="flex flex-wrap items-center gap-1">
      <Link
        href={organizerHomeHref({ tab: "sponsors", sponsor: onHome ? null : sponsor })}
        shallow
        scroll={false}
        aria-current={onHome ? "page" : undefined}
        className={item(onHome)}
      >
        {!onHome && <ArrowLeft aria-hidden className="size-4" />}
        {onHome ? copy.home : copy.back}
      </Link>
      <div ref={wrap} className="relative">
        <button
          ref={button}
          type="button"
          aria-expanded={open}
          aria-haspopup="true"
          aria-controls="organizer-tools-menu"
          onClick={() => setOpen((o) => !o)}
          className={item(!onHome)}
        >
          <Wrench aria-hidden className="size-4" />
          {tab === "sponsors" ? copy.tools : `${copy.tools} · ${copy[tab]}`}
          <ChevronDown
            aria-hidden
            className={cn(
              "size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
              open && "rotate-180",
            )}
          />
        </button>
        {open && (
          <ul
            id="organizer-tools-menu"
            className="absolute left-0 top-full z-30 m-0 mt-1 flex min-w-56 list-none flex-col gap-0.5 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface p-1 shadow-dashboard-card"
          >
            {TOOLS.map((t) => (
              <li key={t}>
                <Link
                  href={organizerHomeHref({ tab: t, sponsor })}
                  shallow
                  scroll={false}
                  aria-current={tab === t ? "page" : undefined}
                  onClick={() => setOpen(false)}
                  className={cn(item(tab === t), "w-full")}
                >
                  {copy[t]}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  );
}
