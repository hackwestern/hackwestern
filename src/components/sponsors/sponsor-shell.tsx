import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import * as Popover from "@radix-ui/react-popover";
import {
  CircleHelp,
  Clock,
  Coffee,
  House,
  Lock,
  MapPin,
  ScanLine,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import SEO from "~/components/seo";
import {
  SponsorHelp,
  SponsorHelpProvider,
} from "~/components/sponsors/help-button";
import { VenueMapButton } from "~/components/sponsors/venue-map";
import {
  SponsorTour,
  startSponsorTour,
} from "~/components/sponsors/tour/sponsor-tour";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorPortalCopy } from "~/content/sponsor-portal";
import { sponsorVenueCopy } from "~/content/sponsor-venue";
import { judgingUnlocked } from "~/lib/sponsor-judging-unlock";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { WELCOME_TOUR_ID } from "~/lib/sponsor-tours";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";
import { hoverTint, pressable } from "./sponsor-shell-styles";

export { pressable, hoverTint } from "./sponsor-shell-styles";

const copy = sponsorPortalCopy.nav;

type NavId = "home" | "scan" | "chats" | "schedule" | "judging" | "venue";

/** Which nav item a sponsor route belongs to. */
const NAV_BY_PATH: Record<string, NavId> = {
  "/sponsors/[uuid]": "home",
  "/sponsors/[uuid]/scan": "scan",
  "/sponsors/[uuid]/coffee-chats": "chats",
  "/sponsors/[uuid]/schedule": "schedule",
  "/sponsors/[uuid]/picks": "judging",
};

type NavItem = {
  id: NavId;
  label: string;
  icon: LucideIcon;
  href: string;
  /** Judging before Sunday 9:00 AM: greyed, says when it opens on tap. */
  locked?: boolean;
  /** Small status beside the label in the side nav ("Sun 9 AM", "Sent"). */
  note?: string;
  /** Side nav only (phones reach the venue through the Map button). */
  sideOnly?: boolean;
};

/** "Sat 2:14 PM", in the event's time zone. */
const whenFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "America/Toronto",
});

/**
 * The frame every sponsor page sits in: one nav, never two (Jazz,
 * 2026-11-18). Tablets and up get a side nav (logo, sections, Need help,
 * How this works); phones get a bottom tab bar with the same icons and
 * labels instead. A slim top bar carries the day and time, the "?" tour
 * menu and the Map. The active section comes from the route.
 *
 * Judging only shows for prize track sponsors, greyed and locked until
 * Sunday 9:00 AM (or with ?preview=judging, which the nav links keep).
 */
export function SponsorShell({
  title,
  wide = false,
  children,
}: {
  title: string;
  /** A wider column on big screens, for pages with a grid (the schedule). */
  wide?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const raw = router.query.uuid;
  const id = typeof raw === "string" && uuidRegex.test(raw) ? raw : "";
  const preview = router.query.preview === "judging";
  const now = useNow();

  const info = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    { enabled: !!id, refetchOnWindowFocus: false, retry: false },
  );
  const sponsorName = info.data?.sponsorName ?? null;

  // Venue is a section of Home, not a page: Home stays the current page
  // there, and Venue is marked as the current location while the URL
  // points at it.
  const hash = router.asPath.split("#")[1] ?? "";
  const active = NAV_BY_PATH[router.pathname] ?? null;
  const currentOf = (item: NavId): "page" | "location" | undefined =>
    item === active
      ? "page"
      : item === "venue" && active === "home" && hash === "venue"
        ? "location"
        : undefined;

  const base = `/sponsors/${id}`;
  const withPreview = (href: string) => {
    if (!preview) return href;
    const [path, frag] = href.split("#");
    return `${path}?preview=judging${frag ? `#${frag}` : ""}`;
  };

  // Hidden for sponsors without a prize track, and while we don't know yet,
  // so it never flashes in for someone who doesn't judge.
  const showJudging = info.data?.hasPrizeTrack === true;
  const judgingOpen = preview || judgingUnlocked(now) || active === "judging";

  const items: NavItem[] = id
    ? [
        { id: "home", label: copy.home, icon: House, href: base },
        { id: "scan", label: copy.scan, icon: ScanLine, href: `${base}/scan` },
        {
          id: "chats",
          label: copy.chats,
          icon: Coffee,
          href: `${base}/coffee-chats`,
        },
        {
          id: "schedule",
          label: copy.schedule,
          icon: Clock,
          href: `${base}/schedule`,
        },
        ...(showJudging
          ? [
              {
                id: "judging" as const,
                label: copy.judging,
                icon: judgingOpen ? Trophy : Lock,
                href: `${base}/picks`,
                locked: !judgingOpen,
                note: !judgingOpen
                  ? sponsorVenueCopy.judgingLocked.short
                  : (info.data?.picksCount ?? 0) > 0
                    ? copy.judgingSent
                    : copy.judgingNotSent,
              },
            ]
          : []),
        {
          id: "venue",
          label: copy.venue,
          icon: MapPin,
          href: `${base}#venue`,
          sideOnly: true,
        },
      ]
    : [];
  const tabs = items.filter((i) => !i.sideOnly);

  const frame = (
    <>
      <SEO title={title} noindex />
      <div
        className={cn(
          "min-h-dvh bg-dashboard-bg-page font-figtree font-medium leading-default text-dashboard-text-heavy",
          // No side rail for a missing or invalid link.
          id && "md:grid md:grid-cols-[232px_minmax(0,1fr)]",
          // Sticky bars at the bottom of a page (judging's send bar) sit
          // above the phone tab bar.
          id &&
            "[--sponsor-tabbar:calc(4rem+env(safe-area-inset-bottom))] md:[--sponsor-tabbar:0px]",
        )}
      >
        <a
          href="#sponsor-main"
          className="sr-only z-50 rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-3 text-sm font-semibold text-dashboard-text-link shadow-dashboard-card focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          {sponsorPortalCopy.skipToContent}
        </a>

        {/* Side nav: tablets and up */}
        {id && (
          <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:flex-col md:gap-4 md:overflow-y-auto md:border-r md:border-dashboard-border-subtle md:bg-dashboard-bg-surface md:px-3 md:py-5">
            <SponsorMark name={sponsorName} loading={info.isLoading} />
            <nav aria-label={copy.label}>
              <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
                {items.map((item) => (
                  <li key={item.id}>
                    <SideNavItem
                      item={{ ...item, href: withPreview(item.href) }}
                      current={currentOf(item.id)}
                    />
                  </li>
                ))}
              </ul>
            </nav>
            <div className="mt-auto flex flex-col gap-1 pt-4">
              <SponsorHelp variant="nav" />
              <button
                type="button"
                onClick={() => startSponsorTour(WELCOME_TOUR_ID)}
                className={cn(
                  "flex min-h-11 w-full items-center gap-2.5 rounded-dashboard-lg px-3 text-left text-sm font-semibold text-dashboard-text-light focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                  hoverTint,
                  pressable,
                )}
              >
                <CircleHelp aria-hidden className="size-4 shrink-0" />
                {copy.howItWorks}
              </button>
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-col">
          <header className="flex min-h-14 items-center gap-2 border-b border-dashboard-border-subtle bg-dashboard-bg-surface px-4 py-2 sm:px-5 md:px-8">
            <TopBarWhen />
            <SponsorTour
              offerWelcome={active === "home"}
              hasPrizeTrack={info.data?.hasPrizeTrack}
            />
            <VenueMapButton />
          </header>

          <main
            id="sponsor-main"
            tabIndex={-1}
            className={cn(
              "flex-1 px-4 pt-5 focus:outline-none sm:px-5 md:px-8 md:pb-12 md:pt-6",
              id
                ? "pb-[calc(6rem+env(safe-area-inset-bottom))]"
                : "pb-[max(3rem,env(safe-area-inset-bottom))]",
            )}
          >
            <div
              className={cn(
                "mx-auto flex w-full flex-col gap-5",
                wide ? "max-w-[1040px]" : "max-w-[640px]",
              )}
            >
              {children}
            </div>
          </main>
        </div>

        {/* Bottom tab bar: phones only */}
        {tabs.length > 0 && (
          <nav
            aria-label={copy.label}
            data-sponsor-tabbar=""
            className="fixed inset-x-0 bottom-0 z-30 border-t border-dashboard-border-subtle bg-dashboard-bg-surface pb-[env(safe-area-inset-bottom)] md:hidden"
          >
            <ul
              className={cn(
                "m-0 grid list-none p-0 px-1",
                tabs.length === 5 ? "grid-cols-5" : "grid-cols-4",
              )}
            >
              {tabs.map((item) => (
                <li key={item.id} className="flex">
                  <TabItem
                    item={{ ...item, href: withPreview(item.href) }}
                    current={currentOf(item.id)}
                  />
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );

  // One help request for the whole page, shared by the side nav and the
  // page's own card on phones.
  return id ? (
    <SponsorHelpProvider sponsor={id} boothLocation={info.data?.boothLocation}>
      {frame}
    </SponsorHelpProvider>
  ) : (
    frame
  );
}

/** The sponsor's own logo at the top of the side nav, else their name. */
function SponsorMark({
  name,
  loading,
}: {
  name: string | null;
  loading: boolean;
}) {
  const logo = name ? sponsorLogo(name) : null;
  return (
    <div className="flex h-11 items-center px-3">
      {loading ? (
        <span className="h-6 w-28 animate-pulse rounded-dashboard-sm bg-dashboard-bg-nav motion-reduce:animate-none" />
      ) : logo && name ? (
        // eslint-disable-next-line @next/next/no-img-element -- small static logo
        <img
          src={logo}
          alt={sponsorPortalCopy.welcome.logoAlt(name)}
          width={160}
          height={28}
          className="h-7 w-auto max-w-[160px] object-contain object-left"
        />
      ) : name ? (
        <span className="truncate text-base font-bold tracking-tight">
          {name}
        </span>
      ) : (
        <span className="text-sm font-semibold text-dashboard-text-light">
          {sponsorPortalCopy.brand}
        </span>
      )}
    </div>
  );
}

/** "Hack Western 13 · Sat 2:14 PM" (just the day and time on phones, so it
 * fits beside the buttons). The time only renders on the client so server
 * and client markup match. */
function TopBarWhen() {
  const now = useNow(30_000);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const when = mounted ? whenFormat.format(now) : null;
  return (
    <p className="m-0 min-w-0 flex-1 truncate text-sm font-semibold text-dashboard-text-light">
      {when ? (
        <>
          <span className="hidden sm:inline">{copy.now(when)}</span>
          <span className="sm:hidden">{when}</span>
        </>
      ) : (
        sponsorPortalCopy.brand
      )}
    </p>
  );
}

type Current = "page" | "location" | undefined;

function SideNavItem({ item, current }: { item: NavItem; current: Current }) {
  const Icon = item.icon;
  const row =
    "flex min-h-11 w-full items-center gap-2.5 rounded-dashboard-lg px-3 text-left text-[15px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";
  const inner = (
    <>
      <Icon aria-hidden className="size-[18px] shrink-0" strokeWidth={1.75} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.note && (
        <span
          className={cn(
            "shrink-0 text-xs font-medium",
            !item.locked && "text-dashboard-text-light",
          )}
        >
          {item.note}
        </span>
      )}
    </>
  );
  if (item.locked) {
    return (
      <LockedJudging side="right">
        <button
          type="button"
          data-tour={`nav-${item.id}`}
          aria-label={copy.judgingLocked(sponsorVenueCopy.judgingLocked.badge)}
          className={cn(
            row,
            "text-dashboard-text-placeholder [@media(hover:hover)]:hover:bg-dashboard-bg-inset",
            pressable,
          )}
        >
          {inner}
        </button>
      </LockedJudging>
    );
  }
  return (
    <Link
      href={item.href}
      data-tour={`nav-${item.id}`}
      aria-current={current}
      className={cn(
        row,
        current === "page"
          ? "bg-dashboard-bg-nav text-dashboard-text-active"
          : current === "location"
            ? "text-dashboard-text-active [@media(hover:hover)]:hover:bg-dashboard-bg-inset"
            : "text-dashboard-text-medium [@media(hover:hover)]:hover:bg-dashboard-bg-inset",
        pressable,
      )}
    >
      {inner}
    </Link>
  );
}

function TabItem({ item, current }: { item: NavItem; current: Current }) {
  const Icon = item.icon;
  const cell =
    "flex min-h-14 w-full flex-col items-center justify-center gap-0.5 rounded-dashboard-lg px-1 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary";
  const inner = (
    <>
      <Icon aria-hidden className="size-5" strokeWidth={1.75} />
      <span className="max-w-full truncate">{item.label}</span>
    </>
  );
  if (item.locked) {
    return (
      <LockedJudging side="top">
        <button
          type="button"
          data-tour={`nav-${item.id}`}
          aria-label={copy.judgingLocked(sponsorVenueCopy.judgingLocked.badge)}
          className={cn(cell, "text-dashboard-text-placeholder", pressable)}
        >
          {inner}
        </button>
      </LockedJudging>
    );
  }
  return (
    <Link
      href={item.href}
      data-tour={`nav-${item.id}`}
      aria-current={current}
      className={cn(
        cell,
        current ? "text-dashboard-action-primary" : "text-dashboard-text-light",
        pressable,
      )}
    >
      {inner}
    </Link>
  );
}

/** Judging before it opens: tapping says when, instead of going anywhere. */
function LockedJudging({
  side,
  children,
}: {
  side: "right" | "top";
  children: React.ReactNode;
}) {
  return (
    <Popover.Root>
      <Popover.Trigger asChild>{children}</Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          side={side}
          align={side === "top" ? "end" : "start"}
          sideOffset={8}
          collisionPadding={16}
          aria-label={copy.judgingLockedTitle}
          className="z-50 w-[min(280px,calc(100vw-32px))] rounded-dashboard-lg bg-dashboard-bg-surface p-4 font-figtree text-sm font-medium leading-relaxed text-dashboard-text-medium shadow-dashboard-card duration-150 ease-out data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 motion-reduce:animate-none"
        >
          <p role="status" className="m-0">
            {sponsorVenueCopy.judgingLocked.message}
          </p>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
