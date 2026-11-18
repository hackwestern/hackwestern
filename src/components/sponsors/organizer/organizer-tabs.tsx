import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { ArrowLeft } from "lucide-react";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import {
  ORGANIZER_TABS,
  organizerHomeHref,
  parseOrganizerLocation,
  type OrganizerLocation,
  type OrganizerTab,
} from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";

const copy = sponsorOrganizerCopy;

export const tabId = (t: OrganizerTab) => `organizer-tab-${t}`;
export const panelId = (t: OrganizerTab) => `organizer-panel-${t}`;

/**
 * The tab, sponsor focus and rooms jump from the URL (?tab=, ?sponsor=,
 * #rooms), and a way to change tab that writes the URL (shallow, so the
 * page doesn't refetch its props). Switching tab keeps the sponsor focus,
 * except Sponsors, which scrolls to that sponsor's row instead.
 */
export function useOrganizerLocation() {
  const router = useRouter();
  const [hash, setHash] = useState("");
  useEffect(() => {
    setHash(window.location.hash);
  }, [router.asPath]);
  const location: OrganizerLocation = parseOrganizerLocation(
    router.query,
    hash,
  );
  // The rooms jump fires once per URL that asks for it.
  const [jumpToRooms, setJumpToRooms] = useState(false);
  useEffect(() => {
    if (location.jumpToRooms) setJumpToRooms(true);
  }, [location.jumpToRooms, router.asPath]);
  const onJumped = useCallback(() => setJumpToRooms(false), []);

  const go = useCallback(
    (href: string) => {
      void router.push(href, undefined, { shallow: true, scroll: false });
    },
    [router],
  );
  const selectTab = useCallback(
    (tab: OrganizerTab) =>
      go(organizerHomeHref({ tab, sponsor: location.sponsor })),
    [go, location.sponsor],
  );
  return { ...location, jumpToRooms, onJumped, selectTab, go };
}

/**
 * The page's tabs as a WAI-ARIA tablist: arrow keys move between tabs
 * (Home/End jump to the ends) and activate them; only the selected tab is in
 * the Tab order. Scrolls sideways on narrow phones.
 */
export function OrganizerTabList({
  tab,
  onSelect,
  openHelp,
}: {
  tab: OrganizerTab;
  onSelect: (tab: OrganizerTab) => void;
  /** Unclaimed help requests, shown as a count on the Help tab. */
  openHelp: number;
}) {
  const refs = useRef<Partial<Record<OrganizerTab, HTMLButtonElement | null>>>(
    {},
  );
  const move = (to: OrganizerTab) => {
    onSelect(to);
    refs.current[to]?.focus();
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    const i = ORGANIZER_TABS.indexOf(tab);
    const last = ORGANIZER_TABS.length - 1;
    const to =
      e.key === "ArrowRight"
        ? ORGANIZER_TABS[i === last ? 0 : i + 1]
        : e.key === "ArrowLeft"
          ? ORGANIZER_TABS[i === 0 ? last : i - 1]
          : e.key === "Home"
            ? ORGANIZER_TABS[0]
            : e.key === "End"
              ? ORGANIZER_TABS[last]
              : undefined;
    if (!to) return;
    e.preventDefault();
    move(to);
  };
  return (
    <div
      role="tablist"
      aria-label={copy.tabsLabel}
      onKeyDown={onKeyDown}
      className="-mx-1 flex gap-1 overflow-x-auto border-b border-dashboard-border-default px-1"
    >
      {ORGANIZER_TABS.map((t) => {
        const selected = t === tab;
        return (
          <button
            key={t}
            ref={(el) => {
              refs.current[t] = el;
            }}
            type="button"
            role="tab"
            id={tabId(t)}
            aria-selected={selected}
            aria-controls={panelId(t)}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelect(t)}
            className={cn(
              "-mb-px inline-flex min-h-11 shrink-0 cursor-pixel-hover items-center gap-2 whitespace-nowrap rounded-t-dashboard-md border-b-2 px-3 font-figtree text-sm font-semibold transition-colors",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary",
              selected
                ? "border-dashboard-action-primary text-dashboard-text-active"
                : "border-transparent text-dashboard-text-light hover:bg-dashboard-bg-nav hover:text-dashboard-text-heavy",
            )}
          >
            {copy.tabs[t]}
            {t === "help" && openHelp > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-dashboard-status-iconBadge px-1.5 text-xs font-bold leading-5 text-dashboard-text-warning">
                {openHelp}
                <span className="sr-only">
                  , {copy.openHelpCount(openHelp)}
                </span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

const linkClass =
  "inline-flex min-h-11 items-center gap-1.5 rounded-dashboard-sm text-sm font-semibold text-dashboard-text-link underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";

/**
 * Shown on Run of show, Coffee chats and Help when they're focused on one
 * sponsor: who, a link back to that sponsor's row, and a way to see everyone.
 */
export function SponsorFocusBar({
  tab,
  sponsorId,
  name,
}: {
  tab: OrganizerTab;
  sponsorId: string;
  name: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-dashboard-lg bg-dashboard-bg-highlight px-4 py-1">
      <span className="text-sm font-semibold text-dashboard-text-heavy">
        {name ? copy.focus.showing(name) : copy.focus.showingUnknown}
      </span>
      <Link
        href={organizerHomeHref({ tab: "sponsors", sponsor: sponsorId })}
        scroll={false}
        shallow
        className={linkClass}
      >
        <ArrowLeft aria-hidden className="size-4" />
        {name ? copy.focus.backTo(name) : copy.focus.back}
      </Link>
      <Link
        href={organizerHomeHref({ tab })}
        scroll={false}
        shallow
        className={linkClass}
      >
        {copy.focus.clear}
      </Link>
    </div>
  );
}
