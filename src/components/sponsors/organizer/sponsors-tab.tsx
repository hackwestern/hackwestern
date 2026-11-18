import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/router";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Copy,
  ExternalLink,
  RefreshCw,
  Search,
  X,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { SponsorStrip } from "~/components/sponsors/organizer/sponsor-strip";
import {
  addInFlight,
  removeInFlight,
  sponsorKey,
  sponsorStatusIn,
  withSponsorStatus,
} from "~/components/sponsors/organizer/status-writes";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";
import { sponsorRowId, type SponsorSummary } from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

// Lucas's sponsor board (status, rooms, judging picks, private links), now
// the Sponsors tab of /internal/sponsors. Each sponsor also gets a strip with
// its coffee chats and help (SponsorStrip) linking into the other tabs, and
// a row anchor (#sponsor-<id>) those tabs link back to. A table on wide
// screens, one card per sponsor on phones.

const copy = sponsorOrganizerCopy.board;

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

/** Hover only where there is a pointer that hovers (no sticky taps). */
const hoverHighlight = "[@media(hover:hover)]:hover:bg-dashboard-bg-highlight";
/** Press feedback: a quick, subtle scale-down. */
const press =
  "motion-safe:transition-transform motion-safe:duration-150 motion-safe:ease-out active:scale-[0.97]";
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";
/** Small outline control: 44px tall on touch screens, 36px on desktop. */
const smallControl = cn(
  "inline-flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-2.5 text-sm font-semibold text-dashboard-text-heavy md:min-h-9",
  hoverHighlight,
  press,
  focusRing,
  "disabled:pointer-events-none disabled:opacity-dashboard-disabled",
);

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
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(`${window.location.origin}${url}`)
            .then(() => setCopied(true));
        }}
        aria-label={copied ? copy.copiedLabel(name) : copy.copyLabel(name)}
        // Fixed width so "Copied" doesn't nudge the row.
        className={cn(smallControl, "min-w-28")}
      >
        {copied ? (
          <Check
            aria-hidden
            className="size-4 text-dashboard-status-live"
          />
        ) : (
          <Copy aria-hidden className="size-4 text-dashboard-text-light" />
        )}
        <span aria-hidden>{copied ? copy.copied : copy.copyLink}</span>
      </button>
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        aria-label={copy.openPage(name)}
        className={cn(smallControl, "min-w-11 px-0 md:min-w-9")}
      >
        <ExternalLink aria-hidden className="size-4 text-dashboard-text-light" />
      </a>
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
        <button
          type="button"
          disabled={isPending}
          onClick={() => onStatusChange(next)}
          aria-label={copy.advanceLabel(sponsorName, next)}
          className={cn(
            smallControl,
            "border-dashboard-border-outline px-2 text-xs text-dashboard-text-link md:min-h-8",
          )}
        >
          {nextLabel}
          <ArrowRight aria-hidden className="size-3.5" />
        </button>
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

/** The row a #sponsor-<id> hash points at, scrolled to and highlighted. */
function useTargetRow(ready: boolean): string | null {
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
  return target;
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
    const counts = Object.fromEntries(
      STATUS_FLOW.map((s) => [s, 0]),
    ) as Record<SponsorStatus, number>;
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
  const target = useTargetRow(sponsors.length > 0);
  const strip = (sponsor: Sponsor, className?: string) => (
    <SponsorStrip
      sponsorId={sponsor.sponsorId}
      name={sponsor.name}
      summary={
        sponsor.sponsorId
          ? summaries.get(sponsor.sponsorId.toLowerCase())
          : undefined
      }
      loading={summaryLoading}
      now={now}
      className={className}
    />
  );
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
          <button
            type="button"
            onClick={() => setNote(null)}
            aria-label={copy.dismiss}
            className={cn(
              "inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-md",
              "[@media(hover:hover)]:hover:bg-dashboard-bg-surface",
              focusRing,
            )}
          >
            <X aria-hidden className="size-4" />
          </button>
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
                "[@media(hover:hover)]:hover:text-dashboard-text-heavy",
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
                        hoverHighlight,
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

      {/* Phones: one card per sponsor. */}
      {filtered.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0 md:hidden">
          {filtered.map((sponsor) => {
            const row = rowAttrs(sponsor);
            return (
              <li
                key={sponsor.sponsorId ?? sponsor.name}
                data-row={row.dataRow}
                className={cn(
                  "flex scroll-mt-4 flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
                  row.targeted &&
                    "ring-2 ring-dashboard-action-primary ring-offset-2 ring-offset-dashboard-bg-page",
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 flex-col gap-1">
                    <h2 className="m-0 break-words text-base font-semibold leading-snug">
                      {sponsor.name}
                    </h2>
                    {!sponsor.onMasterSheet && <NotOnMaster />}
                  </div>
                  {sponsor.tier && (
                    <DashboardTag className="shrink-0">{sponsor.tier}</DashboardTag>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  {statusPicker(sponsor)}
                  <RoomBadge roomNumber={sponsor.roomNumber} />
                </div>

                <dl className="m-0 grid grid-cols-2 gap-x-3 gap-y-2 border-t border-dashboard-border-subtle pt-3 text-sm">
                  <Detail label={copy.columns.booth}>
                    {sponsor.boothLocation || copy.boothTbd}
                  </Detail>
                  <Detail label={copy.columns.hwContact}>
                    {sponsor.hwContact || copy.none}
                  </Detail>
                  <Detail label={copy.columns.companyContact}>
                    {sponsor.companyContact || copy.none}
                  </Detail>
                  <Detail label={copy.columns.picks}>
                    <Picks n={sponsor.teamIds.length} long />
                  </Detail>
                </dl>

                {sponsor.notes && (
                  <p className="m-0 break-words rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2 text-sm text-dashboard-text-medium">
                    {sponsor.notes}
                  </p>
                )}

                {strip(sponsor, "border-t border-dashboard-border-subtle pt-3")}

                <div className="flex items-center justify-between gap-2 border-t border-dashboard-border-subtle pt-3">
                  <span className="text-xs text-dashboard-text-light">
                    {copy.columns.page}
                  </span>
                  <CopyLinkButton
                    sponsorId={sponsor.sponsorId}
                    name={sponsor.name}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {/* Wider screens: a table, with each sponsor's chats and help strip
          on a second line under its row. */}
      {filtered.length > 0 && (
        <div className="hidden overflow-x-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card md:block">
          <table className="w-full border-collapse text-left text-sm">
            <caption className="sr-only">{copy.tableLabel}</caption>
            <thead>
              <tr className="border-b border-dashboard-border-subtle text-xs font-semibold text-dashboard-text-light">
                {[
                  copy.columns.company,
                  copy.columns.status,
                  copy.columns.room,
                  copy.columns.booth,
                  copy.columns.tier,
                  copy.columns.hwContact,
                  copy.columns.picks,
                  copy.columns.page,
                ].map((h) => (
                  <th key={h} scope="col" className="px-4 py-3 font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sponsor) => {
                const row = rowAttrs(sponsor);
                return (
                  <Fragment key={sponsor.sponsorId ?? sponsor.name}>
                    <tr
                      data-row={row.dataRow}
                      className={cn(
                        "scroll-mt-4 align-middle",
                        !sponsor.sponsorId &&
                          "border-b border-dashboard-border-subtle last:border-0",
                        row.targeted && "bg-dashboard-bg-highlight",
                      )}
                    >
                      <th
                        scope="row"
                        className="max-w-xs px-4 pb-2 pt-3 text-left font-semibold"
                      >
                        <span className="flex flex-col gap-1">
                          <span className="break-words">{sponsor.name}</span>
                          {!sponsor.onMasterSheet && <NotOnMaster />}
                        </span>
                      </th>
                      <td className="px-4 pb-2 pt-3">{statusPicker(sponsor)}</td>
                      <td className="px-4 pb-2 pt-3">
                        <RoomBadge roomNumber={sponsor.roomNumber} />
                      </td>
                      <td className="px-4 pb-2 pt-3 text-dashboard-text-medium">
                        {sponsor.boothLocation || copy.boothTbd}
                      </td>
                      <td className="px-4 pb-2 pt-3 text-dashboard-text-medium">
                        {sponsor.tier || copy.none}
                      </td>
                      <td className="px-4 pb-2 pt-3 text-dashboard-text-medium">
                        {sponsor.hwContact || sponsor.companyContact || copy.none}
                      </td>
                      <td className="px-4 pb-2 pt-3">
                        <Picks n={sponsor.teamIds.length} />
                      </td>
                      <td className="px-4 pb-2 pt-3">
                        <CopyLinkButton
                          sponsorId={sponsor.sponsorId}
                          name={sponsor.name}
                        />
                      </td>
                    </tr>
                    {sponsor.sponsorId && (
                      <tr
                        className={cn(
                          "border-b border-dashboard-border-subtle last:border-0",
                          row.targeted && "bg-dashboard-bg-highlight",
                        )}
                      >
                        <td colSpan={8} className="px-4 pb-3 pt-0">
                          {strip(sponsor)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
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
