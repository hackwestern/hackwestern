import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  Coffee,
  Copy,
  ExternalLink,
  LifeBuoy,
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { hover, press } from "~/components/internals/interaction";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import {
  WatcherInput,
} from "~/components/sponsors/coffee-chat-fields";
import { requestSummary } from "~/components/sponsors/chat-request-form";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { JudgingStatusPill } from "~/components/sponsors/organizer/judging-panel";
import {
  addInFlight,
  removeInFlight,
  sponsorKey,
  sponsorStatusIn,
  withSponsorStatus,
} from "~/components/sponsors/organizer/status-writes";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { COFFEE_CHAT_ROOMS } from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import {
  sponsorColor,
  sponsorColorIndexes,
  type SponsorColor,
} from "~/lib/sponsor-colors";
import {
  MAX_SPONSOR_PICKS,
  MIN_SPONSOR_PICKS,
} from "~/lib/sponsor-judging-rooms";
import { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";
import {
  organizerHomeHref,
  sponsorRowId,
  summaryTotals,
  type SponsorSummary,
} from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

// Lucas's sponsor board (status, rooms, judging picks, private links), now
// the Sponsors tab of /internal/sponsors, merged with each sponsor's coffee
// chats, room holds and help (sponsorOrganizer.summary) into one table. A
// row opens to its chats, holds, chat room and watcher (editable) and the
// rest of Lucas's details; a totals row sums what the filter shows. Each
// row has an anchor (#sponsor-<id>) the other tabs link back to. One
// compact card per sponsor under 640px.

const copy = sponsorOrganizerCopy.board;
const judgingCopy = sponsorOrganizerCopy.judging;

type SponsorStatus = (typeof SPONSOR_STATUS_VALUES)[number];
type Sponsor = RouterOutputs["sponsorDashboard"]["getSponsors"][number];

const STATUS_FLOW = SPONSOR_STATUS_VALUES;

/** Each status's pill and dot, on the dashboard palette. */
const STATUS_STYLE: Record<SponsorStatus, { badge: string; dot: string }> = {
  "Not arrived": {
    badge:
      "border-dashboard-border-muted bg-dashboard-bg-inset text-dashboard-text-medium",
    dot: "bg-dashboard-border-medium",
  },
  "Checked in": {
    badge:
      "border-dashboard-border-outline bg-dashboard-bg-highlight text-dashboard-text-active",
    dot: "bg-dashboard-action-primary",
  },
  "Booth set up": {
    badge:
      "border-dashboard-border-task bg-dashboard-bg-task text-dashboard-text-task",
    dot: "bg-dashboard-border-task",
  },
  "Workshop live": {
    badge:
      "border-dashboard-status-live bg-dashboard-schedule-green text-dashboard-text-heavy",
    dot: "bg-dashboard-status-live",
  },
  Left: {
    badge:
      "border-dashboard-border-muted bg-dashboard-bg-surface text-dashboard-text-light",
    dot: "bg-dashboard-border-muted",
  },
};

/**
 * Icon-only buttons: DashboardButton "small", square at the touch and
 * desktop heights (44px / 36px). Not internals/icon-button.tsx: that is the
 * promo site's grey button and can't take aria-label or aria-expanded.
 */
const iconButton = "size-11 shrink-0 px-0 md:size-9";

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

function getNextStatus(current: SponsorStatus): SponsorStatus | null {
  const idx = STATUS_FLOW.indexOf(current);
  if (idx >= 0 && idx < STATUS_FLOW.length - 1) {
    return STATUS_FLOW[idx + 1]!;
  }
  return null;
}

function CopyLinkButton({
  sponsorId,
  name,
}: {
  sponsorId: string | null;
  name: string;
}) {
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(t);
  }, [copied]);

  if (!sponsorId) {
    return (
      <span className="text-xs font-semibold text-dashboard-text-warning">
        {copy.linkPending}
      </span>
    );
  }

  const url = `/sponsors/${sponsorId}`;

  return (
    <div className="inline-flex items-center gap-1.5">
      <DashboardButton
        variant="small"
        onClick={() => {
          void navigator.clipboard
            .writeText(`${window.location.origin}${url}`)
            .then(() => setCopied(true));
        }}
        aria-label={copied ? copy.copiedLabel(name) : copy.copyLabel(name)}
        // Fixed width so "Copied" doesn't nudge the row.
        className="min-w-28"
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-dashboard-status-live" />
        ) : (
          <Copy aria-hidden className="size-4 text-dashboard-text-light" />
        )}
        <span aria-hidden>{copied ? copy.copied : copy.copyLink}</span>
      </DashboardButton>
      <DashboardButton
        variant="small"
        asChild
        className="min-w-11 px-0 md:min-w-9"
      >
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          aria-label={copy.openPage(name)}
        >
          <ExternalLink
            aria-hidden
            className="size-4 text-dashboard-text-light"
          />
        </a>
      </DashboardButton>
      <span aria-live="polite" className="sr-only">
        {copied ? copy.copiedLabel(name) : ""}
      </span>
    </div>
  );
}

// The status as a pill over a native select (any status, and the phone's own
// picker on touch), plus a one-tap button for the usual next step.
function StatusPicker({
  sponsorName,
  currentStatus,
  onStatusChange,
  isPending,
}: {
  sponsorName: string;
  currentStatus: SponsorStatus;
  onStatusChange: (status: SponsorStatus) => void;
  isPending: boolean;
}) {
  const style = STATUS_STYLE[currentStatus] ?? STATUS_STYLE["Not arrived"];
  const next = getNextStatus(currentStatus);
  const nextLabel = copy.advance[currentStatus];

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <div
        className={cn(
          "relative inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-xs font-semibold md:min-h-8",
          "has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-dashboard-action-primary has-[:focus-visible]:ring-offset-1",
          style.badge,
          isPending && "opacity-dashboard-disabled",
        )}
      >
        <span aria-hidden className={cn("size-2 rounded-full", style.dot)} />
        <span aria-hidden>{currentStatus}</span>
        <ChevronDown aria-hidden className="size-3.5 opacity-70" />
        <select
          value={currentStatus}
          disabled={isPending}
          onChange={(e) => onStatusChange(e.target.value as SponsorStatus)}
          aria-label={copy.changeStatus(sponsorName)}
          className="absolute inset-0 cursor-pixel-hover appearance-none rounded-full opacity-0 focus:outline-none"
        >
          {STATUS_FLOW.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {next && nextLabel && (
        <DashboardButton
          variant="small"
          disabled={isPending}
          onClick={() => onStatusChange(next)}
          aria-label={copy.advanceLabel(sponsorName, next)}
          className="border-dashboard-border-outline px-2 text-xs text-dashboard-text-link md:min-h-8"
        >
          {nextLabel}
          <ArrowRight aria-hidden />
        </DashboardButton>
      )}
    </div>
  );
}

function RoomBadge({ roomNumber }: { roomNumber: string }) {
  const tbd = !roomNumber || roomNumber === "TBD";
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-dashboard-sm border px-2 py-0.5 text-xs font-semibold leading-5",
        tbd
          ? "border-dashed border-dashboard-border-task text-dashboard-text-warning"
          : "border-dashboard-border-subtle bg-dashboard-bg-inset text-dashboard-text-heavy",
      )}
    >
      {tbd ? copy.roomTbd : copy.room(roomNumber)}
    </span>
  );
}

function NotOnMaster() {
  return (
    <DashboardTag className="w-fit bg-dashboard-bg-task px-1.5 py-0 text-dashboard-text-task">
      {copy.notOnMaster}
    </DashboardTag>
  );
}

/**
 * The row a #sponsor-<id> hash points at, scrolled to, highlighted and
 * opened, plus a way to let it go (when the organizer closes it).
 */
function useTargetRow(ready: boolean): [string | null, () => void] {
  const router = useRouter();
  const [target, setTarget] = useState<string | null>(null);
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    setTarget(hash.startsWith("sponsor-") ? hash : null);
  }, [router.asPath]);
  useEffect(() => {
    if (!target || !ready) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Both layouts render a row; scroll to the one that's showing.
    const row = [
      ...document.querySelectorAll<HTMLElement>(`[data-row="${target}"]`),
    ].find((el) => el.offsetParent !== null);
    row?.scrollIntoView({
      behavior: reduce.matches ? "auto" : "smooth",
      block: "center",
    });
  }, [target, ready]);
  return [target, () => setTarget(null)];
}

type Note = { tone: "ok" | "error"; text: string };

export function SponsorsTab({
  summaries,
  summaryLoading,
  summaryFailed,
  now,
}: {
  summaries: ReadonlyMap<string, SponsorSummary>;
  summaryLoading: boolean;
  summaryFailed: boolean;
  now: Date;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SponsorStatus>(
    "ALL",
  );
  const [note, setNote] = useState<Note | null>(null);

  const utils = api.useUtils();
  const sponsorsQ = api.sponsorDashboard.getSponsors.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Sponsors with a status write in flight: their row is locked until it
  // settles (a ref for the synchronous double-click check, state to render).
  const inFlightRef = useRef<ReadonlySet<string>>(new Set());
  const [inFlight, setInFlight] = useState<ReadonlySet<string>>(new Set());
  const setInFlightBoth = (next: ReadonlySet<string>) => {
    inFlightRef.current = next;
    setInFlight(next);
  };

  const updateStatus = api.sponsorDashboard.setSponsorStatus.useMutation({
    onMutate: async ({ sponsorName, status }) => {
      await utils.sponsorDashboard.getSponsors.cancel();
      const prevStatus = sponsorStatusIn(
        utils.sponsorDashboard.getSponsors.getData(),
        sponsorName,
      );
      utils.sponsorDashboard.getSponsors.setData(undefined, (old) =>
        withSponsorStatus(old, sponsorName, status),
      );
      return { prevStatus };
    },
    onError: (err, { sponsorName }, context) => {
      // Undo just this sponsor; others changed meanwhile keep theirs.
      const prevStatus = context?.prevStatus;
      if (prevStatus) {
        utils.sponsorDashboard.getSponsors.setData(undefined, (old) =>
          withSponsorStatus(old, sponsorName, prevStatus),
        );
      }
      setNote({ tone: "error", text: copy.statusFailed(err.message) });
    },
    onSettled: async (_data, _err, { sponsorName }) => {
      setInFlightBoth(removeInFlight(inFlightRef.current, sponsorName));
      // Refetch once nothing else is saving, so a refetch can't briefly
      // undo another sponsor's optimistic change.
      if (inFlightRef.current.size === 0) {
        await utils.sponsorDashboard.getSponsors.invalidate();
      }
    },
  });
  const changeStatus = (sponsorName: string, status: SponsorStatus) => {
    if (inFlightRef.current.has(sponsorKey(sponsorName))) return;
    setInFlightBoth(addInFlight(inFlightRef.current, sponsorName));
    updateStatus.mutate({ sponsorName, status });
  };

  const sync = api.sponsorDashboard.syncSponsors.useMutation({
    onSuccess: async (registered) => {
      setNote({ tone: "ok", text: copy.synced(registered.length) });
      await utils.sponsorDashboard.getSponsors.invalidate();
    },
    onError: (error) =>
      setNote({ tone: "error", text: copy.syncFailed(error.message) }),
  });

  const sponsors = useMemo(() => sponsorsQ.data ?? [], [sponsorsQ.data]);

  const countsByStatus = useMemo(() => {
    const counts = Object.fromEntries(STATUS_FLOW.map((s) => [s, 0])) as Record<
      SponsorStatus,
      number
    >;
    for (const s of sponsors) {
      if (s.status in counts) counts[s.status] += 1;
    }
    return counts;
  }, [sponsors]);

  const filtered = useMemo(() => {
    return sponsors.filter((sponsor) => {
      if (statusFilter !== "ALL" && sponsor.status !== statusFilter) {
        return false;
      }
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return (
        sponsor.name.toLowerCase().includes(q) ||
        sponsor.tier.toLowerCase().includes(q) ||
        sponsor.status.toLowerCase().includes(q) ||
        sponsor.roomNumber.toLowerCase().includes(q) ||
        sponsor.hwContact.toLowerCase().includes(q) ||
        sponsor.companyContact.toLowerCase().includes(q) ||
        sponsor.notes.toLowerCase().includes(q)
      );
    });
  }, [sponsors, statusFilter, query]);

  const totals = summaryTotals(
    filtered.flatMap((s) => {
      const summary = s.sponsorId
        ? summaries.get(s.sponsorId.toLowerCase())
        : undefined;
      return summary ? [summary] : [];
    }),
  );
  const updatedAt = sponsorsQ.dataUpdatedAt;
  const failed = sponsorsQ.error;
  const stats = [
    { label: copy.stats.total, value: sponsors.length, warn: false },
    {
      label: copy.stats.picks,
      value: sponsors.filter((s) => s.teamIds.length > 0).length,
      warn: false,
    },
    {
      label: copy.stats.unregistered,
      value: sponsors.filter((s) => !s.sponsorId).length,
      warn: true,
    },
    {
      label: copy.stats.offSheet,
      value: sponsors.filter((s) => !s.onMasterSheet).length,
      warn: true,
    },
  ];
  const [target, clearTarget] = useTargetRow(sponsors.length > 0);
  const summaryOf = (sponsor: Sponsor) =>
    sponsor.sponsorId
      ? summaries.get(sponsor.sponsorId.toLowerCase())
      : undefined;
  // Colours are assigned over every registered sponsor, the same set the
  // Coffee chats tab uses, so a sponsor has one colour everywhere.
  const colorIndexes = useMemo(
    () => sponsorColorIndexes([...summaries.values()].map((s) => s.name)),
    [summaries],
  );
  const colorOf = (sponsor: Sponsor) =>
    sponsorColor(colorIndexes, sponsor.name);
  const rowKey = (sponsor: Sponsor) => sponsor.sponsorId ?? sponsor.name;
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const isOpen = (sponsor: Sponsor) =>
    expanded.has(rowKey(sponsor)) ||
    (!!sponsor.sponsorId && sponsorRowId(sponsor.sponsorId) === target);
  const toggle = (sponsor: Sponsor) => {
    const key = rowKey(sponsor);
    const open = isOpen(sponsor);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (open) next.delete(key);
      else next.add(key);
      return next;
    });
    // A linked (#sponsor-) row stays open until toggled; drop the hash.
    if (
      open &&
      sponsor.sponsorId &&
      sponsorRowId(sponsor.sponsorId) === target
    ) {
      clearTarget();
    }
  };
  const rowAttrs = (sponsor: Sponsor) => {
    const id = sponsor.sponsorId ? sponsorRowId(sponsor.sponsorId) : undefined;
    return { dataRow: id, targeted: !!id && id === target };
  };
  const statusPicker = (sponsor: Sponsor) => (
    <StatusPicker
      sponsorName={sponsor.name}
      currentStatus={sponsor.status}
      onStatusChange={(status) => changeStatus(sponsor.name, status)}
      // Only sponsors being saved wait; the rest stay usable.
      isPending={inFlight.has(sponsorKey(sponsor.name))}
    />
  );
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };
  const loading = sponsorsQ.isLoading;
  const emptyState = loading ? null : failed ? null : sponsors.length === 0 ? (
    <p className="m-0 text-dashboard-text-medium">{copy.empty}</p>
  ) : filtered.length === 0 ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="m-0 text-dashboard-text-medium">{copy.noMatch}</p>
      <DashboardButton variant="outline" onClick={clearFilters}>
        {copy.clearFilters}
      </DashboardButton>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4 font-figtree text-dashboard-text-heavy">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-xs tabular-nums text-dashboard-text-light">
          {updatedAt
            ? copy.updatedAgo(ago(now.getTime() - updatedAt))
            : copy.loading}
        </span>
        <DashboardButton
          variant="outline"
          disabled={sync.isPending}
          onClick={() => {
            setNote(null);
            sync.mutate();
          }}
          className={cn("h-11 md:h-10", press)}
        >
          <RefreshCw
            aria-hidden
            className={cn(sync.isPending && "motion-safe:animate-spin")}
          />
          {sync.isPending ? copy.syncing : copy.sync}
        </DashboardButton>
      </div>

      {summaryFailed && (
        <p
          aria-live="polite"
          className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset px-4 py-3 text-sm text-dashboard-text-medium"
        >
          {sponsorOrganizerCopy.strip.loadError}
        </p>
      )}

      {failed && (
        <DashboardPanel className="flex-row flex-wrap items-center justify-between gap-3 p-4">
          <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
            {copy.loadFailed(failed.message)}
          </p>
          <DashboardButton
            variant="outline"
            onClick={() => void sponsorsQ.refetch()}
          >
            {copy.retry}
          </DashboardButton>
        </DashboardPanel>
      )}

      {note && (
        <div
          role={note.tone === "error" ? "alert" : "status"}
          className={cn(
            "flex items-center justify-between gap-3 rounded-dashboard-lg py-1 pl-4 pr-1 text-sm font-semibold",
            note.tone === "error"
              ? "bg-dashboard-status-iconBadge text-dashboard-text-warning"
              : "bg-dashboard-bg-highlight text-dashboard-text-active",
          )}
        >
          <span>{note.text}</span>
          <DashboardButton
            variant="small"
            onClick={() => setNote(null)}
            aria-label={copy.dismiss}
            className={iconButton}
          >
            <X aria-hidden />
          </DashboardButton>
        </div>
      )}

      {/* Totals: the two that need someone to act read in warning colour. */}
      <dl
        aria-label={copy.statsLabel}
        className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3"
      >
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="flex flex-col-reverse gap-0.5 rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-3 shadow-dashboard-card"
          >
            <dt className="text-xs text-dashboard-text-light">{stat.label}</dt>
            <dd
              className={cn(
                "m-0 text-xl font-semibold tabular-nums",
                stat.warn && stat.value > 0
                  ? "text-dashboard-text-warning"
                  : "text-dashboard-text-heavy",
              )}
            >
              {loading ? copy.none : stat.value}
            </dd>
          </div>
        ))}
      </dl>

      {/* Search and status filter */}
      <div className="flex flex-col gap-3">
        <div className="relative w-full">
          <Search
            aria-hidden
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-text-light"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape" && query) {
                e.preventDefault();
                setQuery("");
              }
            }}
            aria-label={copy.searchLabel}
            placeholder={copy.searchPlaceholder}
            // 16px text so phones don't zoom in on focus.
            className="h-11 w-full appearance-none rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface pl-9 pr-11 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [&::-webkit-search-cancel-button]:hidden"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label={copy.clearSearch}
              className={cn(
                "absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-dashboard-lg text-dashboard-text-light",
                hover.textHeavy,
                focusRing,
              )}
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </div>

        {/* One row that scrolls sideways on phones, wraps on wider screens. */}
        <div
          role="group"
          aria-label={copy.filtersLabel}
          className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0"
        >
          {(["ALL", ...STATUS_FLOW] as const).map((status) => {
            const active = statusFilter === status;
            const count =
              status === "ALL" ? sponsors.length : countsByStatus[status];
            return (
              <button
                key={status}
                type="button"
                aria-pressed={active}
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "inline-flex min-h-11 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3 text-sm font-semibold md:min-h-9",
                  press,
                  focusRing,
                  active
                    ? "border-dashboard-action-primary bg-dashboard-action-primary text-dashboard-text-inverse"
                    : cn(
                        "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-heavy",
                        hover.highlight,
                      ),
                )}
              >
                {status !== "ALL" && (
                  <span
                    aria-hidden
                    className={cn(
                      "size-2 rounded-full",
                      active
                        ? "bg-dashboard-text-inverse"
                        : STATUS_STYLE[status].dot,
                    )}
                  />
                )}
                {status === "ALL" ? copy.all : status}
                <span
                  className={cn(
                    "tabular-nums",
                    active
                      ? "text-dashboard-text-inverse"
                      : "text-dashboard-text-light",
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {loading && (
        <div aria-busy="true" className="flex flex-col gap-2">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="h-20 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-safe:animate-pulse"
            />
          ))}
        </div>
      )}

      {emptyState && <DashboardPanel>{emptyState}</DashboardPanel>}

      {/* Phones (under 640px): one compact card per sponsor; tap to open
          its chats and details. */}
      {filtered.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:hidden">
          {filtered.map((sponsor) => {
            const row = rowAttrs(sponsor);
            const key = rowKey(sponsor);
            const summary = summaryOf(sponsor);
            const open = isOpen(sponsor);
            const panelId = `sponsor-details-m-${key}`;
            return (
              <li
                key={key}
                data-row={row.dataRow}
                className={cn(
                  "flex scroll-mt-4 flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
                  row.targeted &&
                    "ring-2 ring-dashboard-action-primary ring-offset-2 ring-offset-dashboard-bg-page",
                )}
              >
                <button
                  type="button"
                  aria-expanded={open}
                  aria-controls={panelId}
                  onClick={() => toggle(sponsor)}
                  className={cn(
                    "-m-2 flex items-start justify-between gap-3 rounded-dashboard-md p-2 text-left",
                    press,
                    focusRing,
                  )}
                >
                  <span className="flex min-w-0 flex-col gap-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <ColorDot name={sponsor.name} color={colorOf(sponsor)} />
                      <span className="min-w-0 break-words text-base font-semibold leading-snug">
                        {sponsor.name}
                      </span>
                    </span>
                    <span className="text-sm text-dashboard-text-medium">
                      {summary
                        ? copy.chatsCell(summary.accepted, summary.pending)
                        : copy.notRegistered}
                    </span>
                    {summary && summary.needsHacker > 0 && (
                      <NeedsHackerPill n={summary.needsHacker} />
                    )}
                    {summary?.judging && (
                      <span
                        className={cn(
                          "text-sm text-dashboard-text-medium",
                          summary.judging.missingRoom &&
                            "text-dashboard-text-warning",
                        )}
                      >
                        {judgingCopy.labelled(
                          judgingCopy.column,
                          judgingCopy.cell(
                            summary.judging.room,
                            summary.judging.picks,
                            summary.judging.room !== null ||
                              summary.judging.missingRoom,
                          ),
                        )}
                      </span>
                    )}
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "mt-1 size-5 shrink-0 text-dashboard-text-light transition-transform duration-150 ease-out motion-reduce:transition-none",
                      open && "rotate-180",
                    )}
                  />
                  <span className="sr-only">
                    {open
                      ? copy.collapse(sponsor.name)
                      : copy.expand(sponsor.name)}
                  </span>
                </button>
                <div className="flex flex-wrap items-center gap-2">
                  {statusPicker(sponsor)}
                  {summary?.help && <HelpCell summary={summary} />}
                </div>
                {open && (
                  <div
                    id={panelId}
                    className="border-t border-dashboard-border-subtle pt-3"
                  >
                    <SponsorDetails
                      sponsor={sponsor}
                      summary={summary}
                      idPrefix="m"
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {/* 640px and up: one table, sponsor column pinned while it scrolls
          sideways inside its own box. A row opens to that sponsor's chats,
          holds and details; the totals row sums what the filter shows. */}
      {filtered.length > 0 && (
        <div className="hidden overflow-x-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card sm:block">
          <table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">{copy.tableLabel}</caption>
            <thead>
              <tr className="text-xs font-semibold text-dashboard-text-light">
                {[
                  copy.chatColumns.sponsor,
                  copy.columns.status,
                  copy.columns.booth,
                  copy.columns.tier,
                  copy.columns.hwContact,
                  copy.chatColumns.chatType,
                  copy.chatColumns.chatRoom,
                  copy.chatColumns.chats,
                  copy.chatColumns.needsHacker,
                  judgingCopy.column,
                  copy.chatColumns.help,
                ].map((h, i) => (
                  <th
                    key={h}
                    scope="col"
                    className={cn(
                      "border-b border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-3 font-semibold",
                      i === 0 && "sticky left-0 z-10 min-w-56",
                    )}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sponsor) => {
                const row = rowAttrs(sponsor);
                const key = rowKey(sponsor);
                const summary = summaryOf(sponsor);
                const open = isOpen(sponsor);
                const panelId = `sponsor-details-${key}`;
                const cell = cn(
                  "border-b border-dashboard-border-subtle px-3 py-2.5 align-middle",
                  open && "border-b-0",
                  row.targeted && "bg-dashboard-bg-highlight",
                );
                return (
                  <Fragment key={key}>
                    <tr data-row={row.dataRow} className="scroll-mt-4">
                      <th
                        scope="row"
                        className={cn(
                          cell,
                          "sticky left-0 z-10 bg-dashboard-bg-surface text-left font-semibold",
                          row.targeted && "bg-dashboard-bg-highlight",
                        )}
                      >
                        <span className="flex items-center gap-1">
                          <DashboardButton
                            variant="small"
                            aria-expanded={open}
                            aria-controls={panelId}
                            aria-label={
                              open
                                ? copy.collapse(sponsor.name)
                                : copy.expand(sponsor.name)
                            }
                            onClick={() => toggle(sponsor)}
                            className={iconButton}
                          >
                            <ChevronDown
                              aria-hidden
                              className={cn(
                                "size-4 transition-transform duration-150 ease-out motion-reduce:transition-none",
                                open && "rotate-180",
                              )}
                            />
                          </DashboardButton>
                          <SponsorName
                            sponsor={sponsor}
                            color={colorOf(sponsor)}
                          />
                        </span>
                      </th>
                      <td className={cell}>{statusPicker(sponsor)}</td>
                      <td className={cn(cell, "text-dashboard-text-medium")}>
                        {sponsor.boothLocation || copy.boothTbd}
                      </td>
                      <td className={cn(cell, "text-dashboard-text-medium")}>
                        {sponsor.tier || copy.none}
                      </td>
                      <td className={cn(cell, "text-dashboard-text-medium")}>
                        {sponsor.hwContact || copy.none}
                      </td>
                      <td className={cn(cell, "text-dashboard-text-medium")}>
                        {summaryLoading && sponsor.sponsorId ? (
                          <CellSkeleton />
                        ) : summary && summary.request.source !== "none" ? (
                          copy.chatType(
                            requestSummary(summary.request),
                            summary.request.durationMinutes,
                          )
                        ) : (
                          <span className="text-dashboard-text-light">
                            {summary ? requestSummary(summary.request) : copy.none}
                          </span>
                        )}
                      </td>
                      <td className={cell}>
                        {summary ? (
                          summary.rooms.length > 0 ? (
                            <span className="font-semibold">
                              {summary.rooms.join(", ")}
                            </span>
                          ) : (
                            <span className="text-dashboard-text-light">
                              {copy.unassigned}
                            </span>
                          )
                        ) : (
                          copy.none
                        )}
                      </td>
                      <td
                        className={cn(cell, "whitespace-nowrap tabular-nums")}
                      >
                        {summary
                          ? copy.chatsCell(summary.accepted, summary.pending)
                          : copy.none}
                      </td>
                      <td className={cell}>
                        {summary && summary.needsHacker > 0 ? (
                          <NeedsHackerPill n={summary.needsHacker} />
                        ) : (
                          <span className="text-dashboard-text-light">
                            {summary ? copy.needsHackerCell(0) : copy.none}
                          </span>
                        )}
                      </td>
                      <td className={cell}>
                        <JudgingCell summary={summary} />
                      </td>
                      <td className={cell}>
                        <HelpCell summary={summary} />
                      </td>
                    </tr>
                    {open && (
                      <tr id={panelId}>
                        <td
                          colSpan={11}
                          className={cn(
                            "border-b border-dashboard-border-subtle px-4 pb-4 pt-1",
                            row.targeted && "bg-dashboard-bg-highlight",
                          )}
                        >
                          <SponsorDetails
                            sponsor={sponsor}
                            summary={summary}
                            idPrefix="d"
                          />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold">
                <th
                  scope="row"
                  colSpan={5}
                  className="sticky left-0 bg-dashboard-bg-inset px-3 py-3 text-left"
                >
                  {copy.totalsLabel(filtered.length)}
                </th>
                <td
                  colSpan={2}
                  className="bg-dashboard-bg-inset px-3 py-3 tabular-nums"
                >
                  {copy.seatsLeft(totals.seatsLeft)}
                </td>
                <td className="whitespace-nowrap bg-dashboard-bg-inset px-3 py-3 tabular-nums">
                  {copy.chatsCell(totals.accepted, totals.pending)}
                </td>
                <td
                  className={cn(
                    "bg-dashboard-bg-inset px-3 py-3 tabular-nums",
                    totals.needsHacker > 0 && "text-dashboard-text-warning",
                  )}
                >
                  {totals.needsHacker}
                </td>
                <td
                  className={cn(
                    "whitespace-nowrap bg-dashboard-bg-inset px-3 py-3 tabular-nums",
                    totals.missingRooms > 0 && "text-dashboard-text-warning",
                  )}
                >
                  {judgingCopy.missingRooms(totals.missingRooms)}
                </td>
                <td
                  className={cn(
                    "bg-dashboard-bg-inset px-3 py-3 tabular-nums",
                    totals.openHelp > 0 && "text-dashboard-text-warning",
                  )}
                >
                  {copy.openHelp(totals.openHelp)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Phones: the totals as one line under the cards. */}
      {filtered.length > 0 && (
        <dl
          aria-label={copy.totalsLabel(filtered.length)}
          className="m-0 grid grid-cols-2 gap-2 rounded-dashboard-lg bg-dashboard-bg-inset p-3 text-sm sm:hidden"
        >
          <Detail label={copy.chatColumns.chats}>
            {copy.chatsCell(totals.accepted, totals.pending)}
          </Detail>
          <Detail label={copy.seatsLabel}>
            {copy.seatsLeft(totals.seatsLeft)}
          </Detail>
          <Detail label={copy.chatColumns.needsHacker}>
            {totals.needsHacker}
          </Detail>
          <Detail label={copy.chatColumns.help}>
            {copy.openHelp(totals.openHelp)}
          </Detail>
          <Detail label={judgingCopy.column}>
            {judgingCopy.missingRooms(totals.missingRooms)}
          </Detail>
        </dl>
      )}
    </div>
  );
}

function Detail({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col">
      <dt className="text-xs text-dashboard-text-light">{label}</dt>
      <dd className="m-0 break-words font-semibold text-dashboard-text-heavy">
        {children}
      </dd>
    </div>
  );
}

function Picks({ n, long = false }: { n: number; long?: boolean }) {
  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        n > 0 ? "text-dashboard-status-live" : "text-dashboard-text-light",
      )}
    >
      {long ? (n > 0 ? copy.picks(n) : copy.noPicks) : n}
    </span>
  );
}

function ColorDot({ name, color }: { name: string; color: SponsorColor }) {
  return <SponsorBadge name={name} color={color} />;
}

// The sponsor's name and colour dot. Registered sponsors link to the
// Coffee chats tab with their cells highlighted in the rooms table.
function SponsorName({
  sponsor,
  color,
}: {
  sponsor: Sponsor;
  color: SponsorColor;
}) {
  const name = (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-2">
        <ColorDot name={sponsor.name} color={color} />
        <span className="break-words">{sponsor.name}</span>
      </span>
      {!sponsor.onMasterSheet && <NotOnMaster />}
    </span>
  );
  if (!sponsor.sponsorId) return name;
  return (
    <Link
      href={organizerHomeHref({ tab: "coffee", sponsor: sponsor.sponsorId })}
      shallow
      scroll={false}
      aria-label={copy.highlight(sponsor.name)}
      className={cn(
        "-mx-1 min-w-0 rounded-dashboard-sm px-1 py-1 [@media(hover:hover)]:hover:underline",
        focusRing,
      )}
    >
      {name}
    </Link>
  );
}

function NeedsHackerPill({ n }: { n: number }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-dashboard-sm bg-dashboard-status-iconBadge px-2 py-0.5 text-xs font-semibold leading-5 text-dashboard-text-warning">
      <TriangleAlert aria-hidden className="size-3.5" />
      {sponsorOrganizerCopy.strip.needsHacker(n)}
    </span>
  );
}

function HelpCell({ summary }: { summary: SponsorSummary | undefined }) {
  const help = summary?.help;
  if (!summary) return <span>{copy.none}</span>;
  if (!help) {
    return <span className="text-dashboard-text-light">{copy.noHelp}</span>;
  }
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-dashboard-sm px-2 py-0.5 text-xs font-semibold leading-5",
        help.status === "open"
          ? "bg-dashboard-status-iconBadge text-dashboard-text-warning"
          : "bg-dashboard-bg-highlight text-dashboard-text-active",
      )}
    >
      <LifeBuoy aria-hidden className="size-3.5" />
      {help.status === "open"
        ? copy.helpOpen
        : (help.claimedByName ?? copy.helpClaimed)}
    </span>
  );
}

// Sunday judging: room (or Missing) and picks, warning text when a room
// is missing or picks are short.
function JudgingCell({ summary }: { summary: SponsorSummary | undefined }) {
  const j = summary?.judging;
  if (!summary || !j) return <span>{copy.none}</span>;
  return (
    <span className="flex flex-col whitespace-nowrap">
      <span
        className={cn(
          "font-semibold",
          j.missingRoom && "text-dashboard-text-warning",
        )}
      >
        {j.room ??
          (j.missingRoom ? judgingCopy.missing : judgingCopy.roomUnknown)}
      </span>
      <span
        className={cn(
          "text-xs tabular-nums text-dashboard-text-light",
          j.tooFewPicks && "font-semibold text-dashboard-text-warning",
        )}
      >
        {judgingCopy.columns.picks}{" "}
        {j.picks === null
          ? judgingCopy.picksUnknown
          : judgingCopy.picks(j.picks, MIN_SPONSOR_PICKS, MAX_SPONSOR_PICKS)}
      </span>
    </span>
  );
}

function JudgingDetail({
  judging,
}: {
  judging: NonNullable<SponsorSummary["judging"]>;
}) {
  return (
    <span className="flex flex-col items-start gap-1">
      <span>
        {(() => {
          const value = judgingCopy.cell(
            judging.room,
            judging.picks,
            judging.room !== null || judging.missingRoom,
          );
          return judging.source
            ? judgingCopy.withSource(value, judgingCopy.source[judging.source])
            : value;
        })()}
      </span>
      {judging.otherRoom && (
        <span className="text-xs font-medium text-dashboard-text-warning">
          {judgingCopy.otherRoom(judging.otherRoom)}
        </span>
      )}
      <JudgingStatusPill status={judging.status} />
    </span>
  );
}

function CellSkeleton() {
  return (
    <span
      aria-hidden
      className="block h-4 w-24 rounded-dashboard-xs bg-dashboard-bg-inset motion-safe:animate-pulse"
    />
  );
}

const detailCopy = copy.details;

// A sponsor's opened row: chat times with each hacker (photo and full
// name only when they agreed to share), room holds, the chat room and
// watcher (editable, same Save flows as the Coffee chats board), then
// Lucas's details and the links into the other tabs.
function SponsorDetails({
  sponsor,
  summary,
  idPrefix,
}: {
  sponsor: Sponsor;
  summary: SponsorSummary | undefined;
  idPrefix: string;
}) {
  // Help requests live on the Task pings tab (scrolled to help).
  const link = (tab: "schedule" | "coffee" | "help") =>
    tab === "help"
      ? organizerHomeHref({
          tab: "pings",
          sponsor: sponsor.sponsorId,
          help: true,
        })
      : organizerHomeHref({ tab, sponsor: sponsor.sponsorId });
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="m-0 text-sm font-semibold text-dashboard-text-heavy">
          {detailCopy.chatsHeading}
        </h3>
        {!summary || !sponsor.sponsorId ? (
          <p className="m-0 text-sm text-dashboard-text-medium">
            {detailCopy.notRegistered}
          </p>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <WatcherInput
                key={summary.watcher ?? ""}
                sponsorId={sponsor.sponsorId}
                watcher={summary.watcher}
                idPrefix={`${idPrefix}-watcher`}
              />
            </div>
            {summary.chats.length === 0 ? (
              <p className="m-0 text-sm text-dashboard-text-medium">
                {detailCopy.noChats}
              </p>
            ) : (
              <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                {summary.chats.map((c) => (
                  <li
                    key={c.chatId}
                    className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                  >
                    <span className="shrink-0 whitespace-nowrap font-semibold tabular-nums text-dashboard-text-medium">
                      {detailCopy.chat(formatClock(c.slotTime), c.room)}
                    </span>
                    <span className="flex min-w-0 items-center gap-2">
                      <HackerAvatar name={c.name} github={c.github} size="sm" />
                      <span className="min-w-0 break-words">{c.name}</span>
                    </span>
                    <span
                      className={cn(
                        "rounded-dashboard-sm px-1.5 py-0.5 text-xs font-semibold",
                        c.status === "accepted"
                          ? "bg-dashboard-bg-highlight text-dashboard-text-active"
                          : "bg-dashboard-bg-nav text-dashboard-text-heavy",
                      )}
                    >
                      {detailCopy.status[c.status]}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {summary.holds.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <h4 className="m-0 text-xs font-semibold text-dashboard-text-light">
                  {detailCopy.holdsHeading}
                </h4>
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {summary.holds.map((h) => (
                    <li
                      key={h.holdId}
                      className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm"
                    >
                      <span className="font-semibold tabular-nums">
                        {detailCopy.hold(
                          h.room,
                          formatClock(h.startTime),
                          formatClock(h.endTime),
                        )}
                      </span>
                      {h.needsHacker ? (
                        <NeedsHackerPill n={1} />
                      ) : (
                        <span className="text-dashboard-text-medium">
                          {detailCopy.holdBooked}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        )}
      </section>

      <section className="flex min-w-0 flex-col gap-3">
        <h3 className="m-0 text-sm font-semibold text-dashboard-text-heavy">
          {detailCopy.detailsHeading}
        </h3>
        <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
          <Detail label={detailCopy.roomLabel}>
            <RoomBadge roomNumber={sponsor.roomNumber} />
          </Detail>
          <Detail label={copy.columns.companyContact}>
            {sponsor.companyContact || copy.none}
          </Detail>
          <Detail label={copy.columns.picks}>
            <Picks n={sponsor.teamIds.length} long />
          </Detail>
          {summary?.judging && (
            <Detail label={judgingCopy.detailLabel}>
              <JudgingDetail judging={summary.judging} />
            </Detail>
          )}
          <Detail label={copy.columns.page}>
            <CopyLinkButton sponsorId={sponsor.sponsorId} name={sponsor.name} />
          </Detail>
        </dl>
        {sponsor.notes && (
          <p className="m-0 break-words rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2 text-sm text-dashboard-text-medium">
            {sponsor.notes}
          </p>
        )}
        {sponsor.sponsorId && (
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                [
                  "schedule",
                  CalendarDays,
                  sponsorOrganizerCopy.strip.viewSchedule,
                ],
                ["coffee", Coffee, sponsorOrganizerCopy.strip.coffeeChats],
                ["help", LifeBuoy, sponsorOrganizerCopy.strip.help],
              ] as const
            ).map(([tab, Icon, label]) => (
              <DashboardButton
                key={tab}
                variant="link"
                asChild
                className="border border-transparent text-xs"
              >
                <Link href={link(tab)} shallow scroll={false}>
                  <Icon aria-hidden />
                  {label}
                  <span className="sr-only"> {sponsor.name}</span>
                </Link>
              </DashboardButton>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
