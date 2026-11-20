import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  Calendar,
  Coffee,
  House,
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
import { SponsorTour } from "~/components/sponsors/tour/sponsor-tour";
import { sponsorPortalCopy } from "~/content/sponsor-portal";
import { sponsorVenueCopy } from "~/content/sponsor-venue";
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

const NAV_LABELS: Record<NavId, string> = {
  home: copy.home,
  chats: copy.chats,
  scan: copy.scan,
  schedule: copy.schedule,
  judging: copy.judging,
  map: copy.map,
};

type NavItem = {
  id: NavId;
  label: string;
  icon: LucideIcon;
  href: string;
  /** The tour's target name (defaults to nav-<id>). */
  tour?: string;
  /** Judging before Sunday 9:00 AM: greyed, says when it opens on tap. */
  locked?: boolean;
  /** Small status beside the label in the side nav ("Sun 9 AM", "Sent"). */
  note?: string;
};

/**
 * The frame every sponsor page sits in, in the hacker /live look (design:
 * mocks/sponsor-portal-flow-hacker-v6; the side nav reuses /live's sidebar
 * style). One nav, never two: tablets and up get the side nav (Hack
 * Western 13, the sponsor's logo card, the sections); phones get a top bar
 * with the page title and a bottom tab bar. Help is a button in the
 * header on every page and opens a dialog over the page you're on.
 *
 * The header is one element for both: the sticky top bar on phones (logo,
 * title, Help, like the mock; the How to guides sit inside Help there),
 * the page's title row (big heading, How to, Help) from tablets up, so the
 * tour and Help mount once.
 *
 * Judging only shows for prize-track sponsors.
 */
export function SponsorShell({
  title,
  heading,
  barTitle,
  headerStart,
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
  /** Desktop only, left of How to and Help when there's no heading (the
   * flows' "Back to Chats"). */
  headerStart?: React.ReactNode;
  /** One line under the heading, tablets and up. */
  lead?: string;
  /** The display size heading (Today's "Hi, Sun Life!"). */
  display?: boolean;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const raw = router.query.uuid;
  const id = typeof raw === "string" && uuidRegex.test(raw) ? raw : "";

  const info = api.sponsorPortal.getSponsorPortalInfo.useQuery(
    { sponsor: id },
    { enabled: !!id, refetchOnWindowFocus: false, retry: false },
  );
  const sponsorName = info.data?.sponsorName ?? null;

  const active = NAV_BY_PATH[router.pathname] ?? null;
  const base = `/sponsors/${id}`;

  // Hidden for sponsors without a prize track, and while we don't know yet,
  // so it never flashes in for someone who doesn't judge.
  const showJudging = info.data?.hasPrizeTrack === true;

  const items: NavItem[] = id
    ? [
        { id: "home", label: copy.home, icon: House, href: base },
        {
          id: "chats",
          label: copy.chats,
          icon: Coffee,
          href: `${base}/coffee-chats`,
        },
        { id: "scan", label: copy.scan, icon: ScanLine, href: `${base}/scan` },
        {
          id: "schedule",
          label: copy.schedule,
          icon: Calendar,
          href: `${base}/schedule`,
        },
        ...(showJudging
          ? [
              {
                id: "judging" as const,
                label: copy.judging,
                icon: Trophy,
                href: `${base}/picks`,
                note: (info.data?.picksCount ?? 0) > 0
                  ? copy.judgingSent
                  : copy.judgingNotSent,
              },
            ]
          : []),
        {
          id: "map",
          label: copy.map,
          icon: MapIcon,
          href: `${base}/map`,
          // The map tour starts from the Map button it used to have.
          tour: "map",
        },
      ]
    : [];
  // The section's name, even when its nav item is hidden (Judging for a
  // sponsor without a prize track).
  const activeLabel = active ? NAV_LABELS[active] : undefined;
  const topTitle =
    barTitle ?? heading ?? activeLabel ?? sponsorPortalCopy.brand;

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
                href={base}
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
              <nav aria-label={copy.label} className="mt-9">
                <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                  {items.map((item) => (
                    <li key={item.id}>
                      <SideNavItem
                        item={item}
                        current={item.id === active}
                      />
                    </li>
                  ))}
                </ul>
              </nav>
            </div>
            <p className="m-0 pt-6 text-dashboard-caption text-dashboard-text-light">
              {copy.footer}
            </p>
          </aside>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header
            className={cn(
              "sticky top-0 z-30 flex min-h-16 items-center gap-2 border-b border-dashboard-border-default bg-dashboard-bg-nav px-4 pt-[env(safe-area-inset-top)]",
              "md:static md:min-h-0 md:items-start md:gap-4 md:border-0 md:bg-transparent md:px-8 md:pt-12 lg:px-12",
            )}
          >
            {id && (
              <Link
                href={base}
                aria-label={copy.homeLink}
                className="flex min-h-11 min-w-11 shrink-0 items-center px-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:hidden"
              >
                <Image src="/shared/horse.svg" alt="" width={26} height={38} />
              </Link>
            )}
            {heading ? (
              <h1
                className={cn(
                  "m-0 min-w-0 flex-1 truncate text-base font-semibold leading-default",
                  // The mock's display (48px) and h1 (32px) from tablets up.
                  "md:whitespace-normal md:font-bold",
                  display ? "md:text-md-display" : "md:text-sm-display",
                )}
              >
                {barTitle && barTitle !== heading ? (
                  <>
                    <span className="md:hidden">{barTitle}</span>
                    <span className="hidden md:inline">{heading}</span>
                  </>
                ) : (
                  heading
                )}
              </h1>
            ) : (
              <>
                <p
                  aria-hidden={barTitle ? true : undefined}
                  className="m-0 min-w-0 flex-1 truncate text-base font-semibold md:hidden"
                >
                  {topTitle}
                </p>
                <div className="hidden min-w-0 flex-1 md:block">
                  {headerStart}
                </div>
              </>
            )}
            {id && (
              <div className="flex shrink-0 items-center gap-2 md:mt-1.5">
                <SponsorTour
                  offerWelcome={active === "home"}
                  hasPrizeTrack={info.data?.hasPrizeTrack}
                />
                <SponsorHelp variant="header" />
              </div>
            )}
          </header>

          {/* A div, not <main>: the app root (_app.tsx) is already the one
              main landmark, and two read as a nesting error. The skip link
              still lands here. */}
          <div
            id="sponsor-main"
            tabIndex={-1}
            className={cn(
              "flex-1 px-4 pt-5 focus:outline-none md:px-8 md:pb-12 md:pt-8 lg:px-12",
              id
                ? "pb-[calc(6rem+env(safe-area-inset-bottom))]"
                : "pb-[max(3rem,env(safe-area-inset-bottom))]",
            )}
          >
            <div className="mx-auto flex w-full max-w-[1040px] flex-col gap-6 md:gap-8">
              {lead && (
                <p className="m-0 hidden max-w-[62ch] text-base text-dashboard-text-medium md:block">
                  {lead}
                </p>
              )}
              {children}
            </div>
          </div>
        </div>

        {/* Bottom tab bar: phones only */}
        {items.length > 0 && (
          <nav
            aria-label={copy.label}
            data-sponsor-tabbar=""
            className="fixed inset-x-0 bottom-0 z-30 border-t border-dashboard-border-default bg-dashboard-bg-nav px-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] pt-1.5 md:hidden"
          >
            <ul className="m-0 grid list-none auto-cols-fr grid-flow-col gap-0.5 p-0">
              {items.map((item) => (
                <li key={item.id} className="flex min-w-0">
                  <TabItem
                    item={item}
                    current={item.id === active}
                  />
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>
    </>
  );

  // One help dialog for the whole page, opened from the header.
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
  const tour = item.tour ?? `nav-${item.id}`;
  const inner = (
    <>
      <Icon
        aria-hidden
        className={cn(
          "size-5 shrink-0 transition-colors",
          current
            ? "text-dashboard-text-active"
            : item.locked
              ? "text-dashboard-text-placeholder"
              : "text-dashboard-text-light group-hover:text-dashboard-text-heavy",
        )}
      />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
      {item.note && (
        <span className="shrink-0 text-xs font-medium text-dashboard-text-light">
          {item.note}
        </span>
      )}
    </>
  );
  const ring =
    "w-full text-left text-base focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";
  return (
    <Link
      href={item.href}
      data-tour={tour}
      aria-current={current ? "page" : undefined}
      className={cn(navLinkClass(current), ring)}
    >
      {inner}
    </Link>
  );
}

function TabItem({ item, current }: { item: NavItem; current: boolean }) {
  const Icon = item.icon;
  const tour = item.tour ?? `nav-${item.id}`;
  const cell =
    "flex w-full min-w-0 flex-col items-center justify-center gap-0.5 rounded-dashboard-lg px-0.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary";
  const cellClass = cn(cell, tapRow);
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
      <span className="max-w-full truncate">{item.label}</span>
    </>
  );
  return (
    <Link
      href={item.href}
      data-tour={tour}
      aria-current={current ? "page" : undefined}
      className={cn(
        cellClass,
        current
          ? "bg-dashboard-bg-navSelected font-semibold text-dashboard-text-active"
          : "font-medium text-dashboard-text-medium",
        pressable,
      )}
    >
      {inner}
    </Link>
  );
}

