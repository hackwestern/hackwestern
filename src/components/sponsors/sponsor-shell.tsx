import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import * as Popover from "@radix-ui/react-popover";
import {
  Calendar,
  Coffee,
  House,
  Lock,
  Map as MapIcon,
  ScanLine,
  Trophy,
  type LucideIcon,
} from "lucide-react";
import SEO from "~/components/seo";
import { navLinkClass } from "~/components/live/navlinks";
import {
  SponsorHelp,
  SponsorHelpProvider,
} from "~/components/sponsors/help-button";
import { PageTourButton } from "~/components/sponsors/tour/page-tour-button";
import { SponsorTour } from "~/components/sponsors/tour/sponsor-tour";
import { useNow } from "~/components/sponsors/use-now";
import { sponsorPortalCopy } from "~/content/sponsor-portal";
import { sponsorVenueCopy } from "~/content/sponsor-venue";
import { judgingUnlocked } from "~/lib/sponsor-judging-unlock";
import { pageOf } from "~/lib/sponsor-tour";
import { pageTourId, toursFor } from "~/lib/sponsor-tours";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { uuidRegex } from "~/utils/urls";
import { pressable, tapRow } from "./sponsor-shell-styles";

export { pressable, hoverTint } from "./sponsor-shell-styles";

const copy = sponsorPortalCopy.nav;

type NavId = "home" | "chats" | "scan" | "schedule" | "judging" | "map";

/** Which nav item a sponsor route belongs to. */
const NAV_BY_PATH: Record<string, NavId> = {
  "/sponsors/[uuid]": "home",
  "/sponsors/[uuid]/scan": "scan",
  "/sponsors/[uuid]/coffee-chats": "chats",
  "/sponsors/[uuid]/schedule": "schedule",
  "/sponsors/[uuid]/picks": "judging",
  "/sponsors/[uuid]/map": "map",
};

type NavItem = {
  id: NavId;
  label: string;
  icon: LucideIcon;
  href: string;
  /** The phone tab's label when it differs ("Judge"). */
  tabLabel?: string;
  /** Judging before Sunday 9:00 AM: a lock beside it; tapping says when it opens. */
  locked?: boolean;
};

/**
 * The frame every sponsor page sits in (design: mocks/sponsor-chats-v3,
 * the side nav reuses /live's sidebar style). One nav, never two: tablets
 * and up get the side nav (Hack Western 13, the sponsor's logo card, Home ·
 * Schedule · Map, then "Your tasks", Help at the bottom left); phones get a
 * top bar (logo, the section's title, Help) and a bottom tab bar with Scan
 * as a raised round button in the middle. Help opens one dialog over the
 * page you're on.
 *
 * Judging only shows for prize track sponsors, greyed and locked until
 * Sunday 9:00 AM (or with ?preview=judging, which the nav links keep).
 */
export function SponsorShell({
  title,
  heading,
  barTitle,
  headerStart,
  headerEnd,
  lead,
  display = false,
  children,
}: {
  /** The browser tab title. */
  title: string;
  /** The page's h1: the phone top bar's title and the big desktop heading.
   * Leave it out when the page has its own h1 (the coffee chat flows). */
  heading?: string;
  /** The phone top bar's title when it should differ from the heading (or
   * there's none); defaults to the heading, else the nav section's name.
   * Passed without a heading, it's hidden from screen readers: those pages
   * (the coffee chat flows) have their own h1 saying the same. */
  barTitle?: string;
  /** Desktop only, above the heading (the flows' and Scan's "Back to
   * Coffee chats"). */
  headerStart?: React.ReactNode;
  /** Desktop only, right of the heading (Chats' "Scan a hacker"). */
  headerEnd?: React.ReactNode;
  /** One line under the heading, tablets and up. */
  lead?: string;
  /** The display size heading. */
  display?: boolean;
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

  const active = NAV_BY_PATH[router.pathname] ?? null;
  // Before the router reads the URL (first render of these statically
  // optimised pages) the id is empty: never build "/sponsors//scan".
  const base = id ? `/sponsors/${id}` : "/sponsors";
  const withPreview = (href: string) => {
    if (!preview) return href;
    const [path, frag] = href.split("#");
    return `${path}?preview=judging${frag ? `#${frag}` : ""}`;
  };

  // Hidden for sponsors without a prize track, and while we don't know yet,
  // so it never flashes in for someone who doesn't judge.
  const showJudging = info.data?.hasPrizeTrack === true;
  // Same rule as the Judging page, so the nav shows it locked while the page is.
  const judgingOpen = preview || judgingUnlocked(now);

  const scanItem: NavItem = {
    id: "scan",
    label: copy.scan,
    icon: ScanLine,
    href: `${base}/scan`,
  };
  const judgingItem: NavItem | null = showJudging
    ? {
        id: "judging",
        label: copy.judging,
        tabLabel: copy.judgingTab,
        icon: Trophy,
        href: `${base}/picks`,
        locked: !judgingOpen,
      }
    : null;
  const home: NavItem = {
    id: "home",
    label: copy.home,
    icon: House,
    href: base,
  };
  const chats: NavItem = {
    id: "chats",
    label: copy.chats,
    icon: Coffee,
    href: `${base}/coffee-chats`,
  };
  const schedule: NavItem = {
    id: "schedule",
    label: copy.schedule,
    icon: Calendar,
    href: `${base}/schedule`,
  };
  const map: NavItem = {
    id: "map",
    label: copy.map,
    icon: MapIcon,
    href: `${base}/map`,
  };
  // Side nav (mock sponsor-chats-v2): Home · Schedule · Map, then "Your
  // tasks": Chats · Judging. Scan lives in the Chats header and on Home.
  const sideMain = id ? [home, schedule, map] : [];
  const sideTasks = id ? [chats, ...(judgingItem ? [judgingItem] : [])] : [];
  // Phone tab bar: Home · Chats · [Scan] · Schedule · Map (· Judge). Scan
  // is the exact centre of five; with Judging it's third of six.
  const tabs = id
    ? [
        home,
        chats,
        scanItem,
        schedule,
        map,
        ...(judgingItem ? [judgingItem] : []),
      ]
    : [];
  const topTitle =
    barTitle ?? (active ? copy.titles[active] : sponsorPortalCopy.brand);
  const hasDeskHeader = !!(heading ?? headerStart ?? headerEnd);
  // "Tour this page": on every sponsor page that has a page tour, except
  // inside the coffee chat forms (?flow=), whose steps aren't toured.
  const tourPage = id ? pageOf(router.pathname) : null;
  const pageTour =
    tourPage &&
    !router.query.flow &&
    toursFor(info.data?.hasPrizeTrack)[pageTourId(tourPage)]
      ? tourPage
      : null;
  const pageName = active ? copy.titles[active] : sponsorPortalCopy.brand;

  const frame = (
    <>
      <SEO title={title} noindex />
      <div
        className={cn(
          "min-h-dvh bg-dashboard-bg-page font-figtree font-medium leading-default text-dashboard-text-heavy",
          // No side nav for a missing or invalid link.
          id && "md:flex",
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

        {/* Side nav: tablets and up (the /live sidebar's look) */}
        {id && (
          <aside className="hidden md:sticky md:top-0 md:flex md:h-dvh md:w-[300px] md:shrink-0 md:flex-col md:justify-between md:overflow-y-auto md:rounded-r-dashboard-lg md:border-r md:border-dashboard-border-default md:bg-dashboard-bg-nav md:px-6 md:py-12">
            <div className="flex flex-col">
              <Link
                href={withPreview(base)}
                aria-label={copy.homeLink}
                className="flex items-center gap-3 text-xl leading-default text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              >
                <Image
                  src="/shared/horse.svg"
                  alt=""
                  width={34}
                  height={50}
                  // The /live sidebar's nudge (sidebar.tsx has no shared
                  // logo block to reuse).
                  className="-my-[2.5px] mx-[7px] shrink-0"
                />
                {sponsorPortalCopy.brand}
              </Link>
              <SponsorCard name={sponsorName} loading={info.isLoading} />
              <nav aria-label={copy.label} className="mt-9 flex flex-col">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {sideMain.map((item) => (
                    <li key={item.id}>
                      <SideNavItem
                        item={{ ...item, href: withPreview(item.href) }}
                        current={item.id === active}
                      />
                    </li>
                  ))}
                </ul>
                <p
                  id="sponsor-nav-tasks"
                  className="m-0 mt-7 px-4 pb-2 text-xs font-bold uppercase tracking-wider text-dashboard-text-light"
                >
                  {copy.tasks}
                </p>
                <ul
                  aria-labelledby="sponsor-nav-tasks"
                  className="m-0 flex list-none flex-col gap-1.5 p-0"
                >
                  {sideTasks.map((item) => (
                    <li key={item.id}>
                      <SideNavItem
                        item={{ ...item, href: withPreview(item.href) }}
                        current={item.id === active}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <div className="flex flex-col items-start gap-4 pt-6">
              <SponsorHelp variant="header" />
              <p className="m-0 text-dashboard-caption text-dashboard-text-light">
                {copy.footer}
              </p>
            </div>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          {/* Phone top bar: logo, the section's title, Help. */}
          <header className="sticky top-0 z-30 flex min-h-16 items-center justify-between gap-2 border-b border-dashboard-border-default bg-dashboard-bg-nav px-4 pt-[env(safe-area-inset-top)] md:hidden">
            {id ? (
              <div className="flex shrink-0 items-center gap-1">
                <Link
                  href={withPreview(base)}
                  aria-label={copy.homeLink}
                  className="flex min-h-11 min-w-11 shrink-0 items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
                >
                  <Image
                    src="/shared/horse.svg"
                    alt=""
                    width={26}
                    height={38}
                  />
                </Link>
                {pageTour && (
                  <PageTourButton page={pageTour} pageName={pageName} compact />
                )}
              </div>
            ) : (
              <span />
            )}
            <p
              aria-hidden
              // A flex item, not absolutely centred: with "Tour" beside the
              // logo, a long title ("Scan a hacker") truncates instead of
              // running into it on narrow phones.
              className="pointer-events-none m-0 min-w-0 flex-1 truncate text-center text-base font-semibold"
            >
              {topTitle}
            </p>
            {id && <SponsorHelp variant="header" />}
          </header>

          {/* A div, not <main>: the app root (_app.tsx) is already the one
              main landmark, and two read as a nesting error. The skip link
              still lands here. */}
          <div
            id="sponsor-main"
            tabIndex={-1}
            className={cn(
              "flex-1 px-4 pt-5 focus:outline-none md:px-8 md:pb-12 md:pt-12 lg:px-12",
              id
                ? "pb-[calc(6rem+env(safe-area-inset-bottom))]"
                : "pb-[max(3rem,env(safe-area-inset-bottom))]",
            )}
          >
            <div className="mx-auto flex w-full max-w-[884px] flex-col gap-6 md:gap-8">
              {/* Tablets and up: "Tour this page" at the top right of the
                  page, above its heading (phones have it in the top bar). */}
              {pageTour && (
                <div className="hidden justify-end md:-mb-4 md:-mt-6 md:flex">
                  <PageTourButton page={pageTour} pageName={pageName} />
                </div>
              )}
              {hasDeskHeader && (
                <div className="flex flex-col gap-6">
                  {headerStart && (
                    <div className="hidden md:block">{headerStart}</div>
                  )}
                  {(heading ?? headerEnd) && (
                    <div className="flex items-start justify-between gap-4">
                      {heading && (
                        <h1
                          className={cn(
                            "m-0 min-w-0 font-bold leading-[1.2] tracking-tight",
                            display
                              ? "text-[34px] md:text-md-display"
                              : "text-[28px] md:text-sm-display",
                          )}
                        >
                          {heading}
                        </h1>
                      )}
                      {headerEnd && (
                        <div className="hidden shrink-0 md:block">
                          {headerEnd}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {lead && (
                <p className="m-0 max-w-[62ch] text-sm text-dashboard-text-medium md:text-base">
                  {lead}
                </p>
              )}
              {children}
            </div>
          </div>
        </div>

        {/* Bottom tab bar: phones only */}
        {tabs.length > 0 && (
          <nav
            aria-label={copy.label}
            data-sponsor-tabbar=""
            className="fixed inset-x-0 bottom-0 z-30 border-t border-dashboard-border-default bg-dashboard-bg-nav px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 md:hidden"
          >
            <ul className="m-0 grid list-none auto-cols-fr grid-flow-col gap-0.5 p-0">
              {tabs.map((item) => (
                <li key={item.id} className="flex min-w-0">
                  <TabItem
                    item={{ ...item, href: withPreview(item.href) }}
                    current={item.id === active}
                  />
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {/* The portal tour: one per page, carries on across pages. The
          first-visit offer only shows on Home. */}
      {id && (
        <SponsorTour
          offerWelcome={active === "home"}
          hasPrizeTrack={info.data?.hasPrizeTrack}
        />
      )}
    </>
  );

  // One help dialog for the whole page.
  return id ? (
    <SponsorHelpProvider
      sponsor={id}
      boothLocation={info.data?.boothLocation}
      hasPrizeTrack={info.data?.hasPrizeTrack}
    >
      {frame}
    </SponsorHelpProvider>
  ) : (
    frame
  );
}

/** The sponsor's logo (else their name, on one line) and "Sponsor portal",
 * in a white card under Hack Western 13. */
function SponsorCard({
  name,
  loading,
}: {
  name: string | null;
  loading: boolean;
}) {
  const logo = name ? sponsorLogo(name) : null;
  return (
    <div className="mt-7 flex min-h-11 items-center gap-2.5 rounded-dashboard-lg bg-dashboard-bg-surface px-3 py-2.5 shadow-dashboard-card">
      {loading ? (
        <span className="h-[22px] w-24 animate-pulse rounded-dashboard-sm bg-dashboard-bg-nav motion-reduce:animate-none" />
      ) : logo && name ? (
        // eslint-disable-next-line @next/next/no-img-element -- small static logo
        <img
          src={logo}
          alt={sponsorPortalCopy.welcome.logoAlt(name)}
          width={120}
          height={22}
          className="h-[22px] w-auto max-w-[120px] shrink-0 object-contain object-left"
        />
      ) : name ? (
        <span className="min-w-0 truncate whitespace-nowrap text-sm font-bold">
          {name}
        </span>
      ) : null}
      <span className="whitespace-nowrap text-dashboard-caption text-dashboard-text-light">
        {copy.portal}
      </span>
    </div>
  );
}

function SideNavItem({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  const inner = (
    <>
      <Icon
        aria-hidden
        className={cn(
          "size-5 shrink-0 transition-colors",
          current
            ? "text-dashboard-text-active"
            : "text-dashboard-text-light group-hover:text-dashboard-text-heavy",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.locked && (
        <Lock
          aria-hidden
          className="size-4 shrink-0 text-dashboard-text-light"
        />
      )}
    </>
  );
  const ring =
    "w-full text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";
  if (item.locked) {
    return (
      <LockedJudging side="right">
        <button
          type="button"
          data-tour={`nav-${item.id}`}
          aria-label={copy.judgingLocked(sponsorVenueCopy.judgingLocked.short)}
          className={cn(navLinkClass(current), ring)}
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
      aria-current={current ? "page" : undefined}
      className={cn(navLinkClass(current), ring)}
    >
      {inner}
    </Link>
  );
}

function TabItem({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  const label = item.tabLabel ?? item.label;
  // Scan: a raised 56 px round button in the middle of the bar.
  if (item.id === "scan") {
    return (
      <Link
        href={item.href}
        data-tour={`nav-${item.id}`}
        aria-current={current ? "page" : undefined}
        className={cn(
          "group flex w-full min-w-0 flex-col items-center justify-end gap-0.5 rounded-dashboard-lg px-0.5 pb-0.5 text-xs font-semibold text-dashboard-text-active focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary",
          tapRow,
          pressable,
        )}
      >
        <span className="-mt-7 flex size-14 items-center justify-center rounded-full bg-dashboard-action-primary text-dashboard-text-inverse shadow-dashboard-card ring-4 ring-dashboard-bg-nav">
          <Icon aria-hidden className="size-6" strokeWidth={1.8} />
        </span>
        <span className="max-w-full truncate">{label}</span>
      </Link>
    );
  }
  const cellClass = cn(
    "flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-dashboard-lg px-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary",
    tapRow,
    pressable,
  );
  const inner = (
    <>
      <Icon
        aria-hidden
        className={cn(
          "size-5",
          current ? "text-dashboard-text-active" : "text-dashboard-text-light",
        )}
        strokeWidth={1.8}
      />
      <span className="flex max-w-full items-center gap-0.5 truncate">
        {label}
        {item.locked && <Lock aria-hidden className="size-3 shrink-0" />}
      </span>
    </>
  );
  if (item.locked) {
    return (
      <LockedJudging side="top">
        <button
          type="button"
          data-tour={`nav-${item.id}`}
          aria-label={copy.judgingLocked(sponsorVenueCopy.judgingLocked.short)}
          className={cn(cellClass, "font-medium text-dashboard-text-medium")}
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
      aria-current={current ? "page" : undefined}
      aria-label={item.tabLabel ? item.label : undefined}
      className={cn(
        cellClass,
        current
          ? "bg-dashboard-bg-navSelected font-semibold text-dashboard-text-active"
          : "font-medium text-dashboard-text-medium",
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
