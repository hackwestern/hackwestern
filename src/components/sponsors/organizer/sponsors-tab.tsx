import { Fragment, useEffect, useMemo, useState } from "react";
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
  RefreshCw,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { hover, press } from "~/components/internals/interaction";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { WatcherInput } from "~/components/sponsors/coffee-chat-fields";
import { requestSummary } from "~/components/sponsors/chat-request-form";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { DayPicker } from "~/components/sponsors/day-picker";
import {
  ChatSlotsCell,
  LinkGivenToggle,
  Round1Cell,
  Round2Cell,
  SponsorLogo,
  WhereCell,
} from "~/components/sponsors/organizer/day-cells";
import { JudgingStatusPill } from "~/components/sponsors/organizer/judging-panel";
import {
  MySponsors,
  type MySponsor,
  type MySponsorData,
} from "~/components/sponsors/organizer/my-sponsors";
import { useSponsorWrites } from "~/components/sponsors/organizer/use-sponsor-writes";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import {
  formatClock,
  type RunOfShowDay,
  type RunOfShowItem,
  type WorkshopInfo,
} from "~/lib/run-of-show";
import {
  hasArrived,
  parseDayParam,
  round1State,
  slotTotals,
  sponsorBoardDefaultDay,
} from "~/lib/sponsor-day-board";
import {
  MAX_SPONSOR_PICKS,
  MIN_SPONSOR_PICKS,
} from "~/lib/sponsor-judging-rooms";
import { SPONSOR_FINAL_TOP } from "~/lib/sponsor-scoring";
import { SPONSOR_STATUS_VALUES } from "~/lib/sponsor-status";
import {
  leadsSponsor,
  type OrganizerContact,
  organizerHomeHref,
  sponsorRowId,
  statusAfterPill,
  type SponsorSummary,
} from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";

// Lucas's sponsor board (status, rooms, judging picks, private links), now
// the Sponsors tab of /internal/sponsors, merged with each sponsor's coffee
// chats and room holds (sponsorOrganizer.summary) into one table. A
// row opens to its chats, holds, chat room and watcher (editable) and the
// rest of Lucas's details; a totals row sums what the filter shows. Each
// row has an anchor (#sponsor-<id>) the other tabs link back to. One
// compact card per sponsor under 640px. Above it, for an organizer who
// leads sponsors, My sponsors (my-sponsors.tsx) with a switch to this
// board ("All sponsors"). No help requests (decisions 2026-11-19).

const copy = sponsorOrganizerCopy.board;
const judgingCopy = sponsorOrganizerCopy.judging;
const dayCopy = sponsorOrganizerCopy.day;
const mineCopy = sponsorOrganizerCopy.mine;

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

export function CopyLinkButton({
  sponsorId,
  name,
  showUrl = false,
}: {
  sponsorId: string | null;
  name: string;
  showUrl?: boolean;
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
  const absoluteUrl =
    typeof window === "undefined"
      ? url
      : `${window.location.origin}${url}`;

  const copyUrl = async () => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(absoluteUrl);
      } else {
        const input = document.createElement("textarea");
        input.value = absoluteUrl;
        input.style.position = "fixed";
        input.style.opacity = "0";
        document.body.appendChild(input);
        input.select();
        document.execCommand("copy");
        input.remove();
      }
      setCopied(true);
    } catch {
      // Clipboard access can be denied by the browser or an insecure context.
      // The visible URL and external-link button remain usable.
    }
  };

  return (
    <div
      data-tour="org-copy-link"
      className="inline-flex flex-wrap items-center gap-1.5"
    >
      {showUrl && (
        <code className="max-w-full break-all rounded-dashboard-sm bg-dashboard-bg-inset px-2 py-1 text-xs text-dashboard-text-medium">
          {absoluteUrl}
        </code>
      )}
      <DashboardButton
        variant="small"
        onClick={() => void copyUrl()}
        aria-label={copied ? copy.copiedLabel(name) : copy.copyLabel(name)}
        title={copied ? copy.copiedLabel(name) : copy.copyLabel(name)}
        // Icon only (Jazz, 2026-11-20): the check swaps in once copied.
        className={iconButton}
      >
        {copied ? (
          <Check aria-hidden className="size-4 text-dashboard-status-live" />
        ) : (
          <Copy aria-hidden className="size-4 text-dashboard-text-light" />
        )}
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

/** A board row: the sheet's sponsor, or a registered one without it. */
type BoardSponsor = Sponsor & { fromSheet: boolean };

/** A registered sponsor's row when the sheet didn't load. */
function withoutSheet(s: SponsorSummary): BoardSponsor {
  return {
    name: s.name,
    tier: "",
    amount: "",
    companyContact: "",
    hwContact: "",
    notes: "",
    sponsorId: s.sponsorId,
    teamIds: [],
    // Never shown: the status cell says the sheet didn't load.
    status: "Not arrived",
    roomNumber: "",
    boothLocation: "",
    atCcWorkshop: null,
    onMasterSheet: true,
    fromSheet: false,
  };
}

/** One of the picked day's columns: a table cell and a phone card field. */
type DayColumn = {
  key: string;
  header: string;
  className?: string;
  cell: (
    sponsor: BoardSponsor,
    summary: SponsorSummary | undefined,
  ) => React.ReactNode;
};

export function SponsorsTab({
  summaries,
  summaryLoading,
  summaryFailed,
  round2Open,
  items,
  workshops,
  now,
  me,
  contactNames,
  contactsError,
  mine,
  view,
  onView,
}: {
  summaries: ReadonlyMap<string, SponsorSummary>;
  summaryLoading: boolean;
  summaryFailed: boolean;
  /** Organizers have opened round 2 (Sunday top 5). */
  round2Open: boolean;
  /** Run-of-show blocks for Sunday's "Where now"; null if not loaded. */
  items: readonly RunOfShowItem[] | null;
  /** Run-of-show workshops for My sponsors; null if not loaded. */
  workshops: readonly WorkshopInfo[] | null;
  now: Date;
  /** The signed-in organizer's HW Contacts row; null = no match. */
  me: OrganizerContact | null;
  /** HW Contacts names in row order (`me.row` indexes it). */
  contactNames: readonly string[];
  /** HW Contacts has never been read, so `me` is unknown (not "no match"). */
  contactsError: boolean;
  /** My sponsors' reps and chat progress by sponsor id. */
  mine: Record<string, MySponsorData> | undefined;
  /** My sponsors or All sponsors (only "all" without a match). */
  view: "mine" | "all";
  onView: (view: "mine" | "all") => void;
}) {
  const router = useRouter();
  // The day the board shows: picked, else ?day=, else today (Friday
  // outside the event). Only that day's columns and totals show.
  const [pickedDay, setPickedDay] = useState<RunOfShowDay | null>(null);
  const day =
    pickedDay ?? parseDayParam(router.query.day) ?? sponsorBoardDefaultDay(now);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | SponsorStatus>(
    "ALL",
  );

  const utils = api.useUtils();
  const sponsorsQ = api.sponsorDashboard.getSponsors.useQuery(undefined, {
    refetchInterval: 30000,
  });

  // Status and "At CC workshop" saves (shared with the Home).
  const { note, setNote, pending, changeStatus, changeCcWorkshop } =
    useSponsorWrites();

  const sync = api.sponsorDashboard.syncSponsors.useMutation({
    onSuccess: async (registered) => {
      setNote({ tone: "ok", text: copy.synced(registered.length) });
      await utils.sponsorDashboard.getSponsors.invalidate();
    },
    onError: (error) =>
      setNote({ tone: "error", text: copy.syncFailed(error.message) }),
  });

  // Friday: "Link given" saves at once and shows straight away.
  const [linkPending, setLinkPending] = useState<ReadonlySet<string>>(
    new Set(),
  );
  const setLinkGiven = api.sponsorOrganizer.setPortalLinkGiven.useMutation({
    onMutate: async ({ sponsorId, given }) => {
      setLinkPending((prev) => new Set(prev).add(sponsorId));
      await utils.sponsorOrganizer.summary.cancel();
      const prev = utils.sponsorOrganizer.summary.getData();
      utils.sponsorOrganizer.summary.setData(undefined, (old) =>
        old
          ? {
              ...old,
              sponsors: old.sponsors.map((s) =>
                s.sponsorId === sponsorId
                  ? {
                      ...s,
                      linkGivenAt: given ? new Date().toISOString() : null,
                    }
                  : s,
              ),
            }
          : old,
      );
      return { prev };
    },
    onError: (err, _input, context) => {
      if (context?.prev) {
        utils.sponsorOrganizer.summary.setData(undefined, context.prev);
      }
      setNote({ tone: "error", text: dayCopy.linkFailed(err.message) });
    },
    onSettled: async (_data, _err, { sponsorId }) => {
      setLinkPending((prev) => {
        const next = new Set(prev);
        next.delete(sponsorId);
        return next;
      });
      await utils.sponsorOrganizer.summary.invalidate();
    },
  });

  // Without the sheet (down, or not set up locally) the board still lists
  // every registered sponsor, so Saturday and Sunday (all from our
  // database) keep working. Sheet-only fields then read as unknown.
  const sheetDown = !sponsorsQ.data && !!sponsorsQ.error;
  const sponsors = useMemo<BoardSponsor[]>(
    () =>
      sponsorsQ.data
        ? sponsorsQ.data.map((s) => ({ ...s, fromSheet: true }))
        : sheetDown
          ? [...summaries.values()]
              .map(withoutSheet)
              .sort((a, b) => a.name.localeCompare(b.name))
          : [],
    [sponsorsQ.data, sheetDown, summaries],
  );

  const countsByStatus = useMemo(() => {
    const counts = Object.fromEntries(STATUS_FLOW.map((s) => [s, 0])) as Record<
      SponsorStatus,
      number
    >;
    for (const s of sponsors) {
      if (s.fromSheet && s.status in counts) counts[s.status] += 1;
    }
    return counts;
  }, [sponsors]);

  // The status filter is a Friday tool (arrivals); other days show all.
  const shownStatus = day === "Friday" ? statusFilter : "ALL";
  const filtered = useMemo(() => {
    return sponsors.filter((sponsor) => {
      if (shownStatus !== "ALL" && sponsor.status !== shownStatus) {
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
  }, [sponsors, shownStatus, query]);

  const updatedAt = sponsorsQ.dataUpdatedAt;
  const failed = sponsorsQ.error;
  const registered = [...summaries.values()];
  const of = dayCopy.stats.of;
  // Totals for the picked day only. `warn` turns a number orange while
  // someone still needs to act.
  type Stat = { label: string; value: string | number; warn: boolean };
  const stats: Stat[] =
    day === "Friday"
      ? [
          { label: copy.stats.total, value: sponsors.length, warn: false },
          {
            label: dayCopy.stats.Friday.arrived,
            value: sheetDown
              ? copy.none
              : of(
                  sponsors.filter((s) => hasArrived(s.status)).length,
                  sponsors.length,
                ),
            warn: false,
          },
          {
            label: dayCopy.stats.Friday.linkGiven,
            value: of(
              registered.filter((s) => s.linkGivenAt).length,
              registered.length,
            ),
            warn: false,
          },
          {
            label: copy.stats.unregistered,
            value: sponsors.filter((s) => !s.sponsorId).length,
            warn: true,
          },
        ]
      : day === "Saturday"
        ? (() => {
            const t = slotTotals(registered.flatMap((s) => s.chatSlots));
            return [
              {
                label: dayCopy.stats.Saturday.booked,
                value: of(t.booked, t.needed),
                warn: false,
              },
              {
                label: dayCopy.stats.Saturday.openSlots,
                value: t.open,
                warn: true,
              },
              {
                label: dayCopy.stats.Saturday.waiting,
                value: registered.reduce((n, s) => n + s.pending, 0),
                warn: false,
              },
            ];
          })()
        : [
            {
              label: dayCopy.stats.Sunday.shortlists,
              value: of(
                registered.filter((s) => round1State(s.sunday).kind === "sent")
                  .length,
                registered.length,
              ),
              warn: false,
            },
            {
              label: dayCopy.stats.Sunday.topSent(SPONSOR_FINAL_TOP),
              value: of(
                registered.filter((s) => s.sunday.finalSubmittedAt).length,
                registered.length,
              ),
              warn: false,
            },
            {
              label: dayCopy.stats.Sunday.round2,
              value: round2Open
                ? dayCopy.stats.round2Open
                : dayCopy.stats.round2Closed,
              warn: false,
            },
            {
              label: dayCopy.stats.Sunday.missingRooms,
              value: registered.filter((s) => s.judging?.missingRoom).length,
              warn: true,
            },
          ];
  const [target, clearTarget] = useTargetRow(sponsors.length > 0);
  const summaryOf = (sponsor: Sponsor) =>
    sponsor.sponsorId
      ? summaries.get(sponsor.sponsorId.toLowerCase())
      : undefined;
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
      isPending={pending(sponsor.name)}
    />
  );
  const clearFilters = () => {
    setQuery("");
    setStatusFilter("ALL");
  };
  const loading = sponsorsQ.isLoading;
  const emptyState = loading ? null : failed &&
    sponsors.length === 0 ? null : sponsors.length === 0 ? (
    <p className="m-0 text-dashboard-text-medium">{copy.empty}</p>
  ) : filtered.length === 0 ? (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="m-0 text-dashboard-text-medium">{copy.noMatch}</p>
      <DashboardButton variant="outline" onClick={clearFilters}>
        {copy.clearFilters}
      </DashboardButton>
    </div>
  ) : null;

  // The picked day's columns (after the sponsor). Each renders one cell for
  // the table and one field on the phone card.
  const muted = (text: string) => (
    <span className="text-dashboard-text-light">{text}</span>
  );
  // Day fields that need the sponsor's private link (and its summary).
  const registeredOnly = (
    render: (summary: SponsorSummary, sponsor: Sponsor) => React.ReactNode,
  ): DayColumn["cell"] => {
    const cell: DayColumn["cell"] = (sponsor, summary) =>
      summaryLoading && sponsor.sponsorId ? (
        <CellSkeleton />
      ) : summary ? (
        render(summary, sponsor)
      ) : (
        muted(copy.notRegistered)
      );
    return cell;
  };
  const columns: DayColumn[] =
    day === "Friday"
      ? [
          {
            key: "status",
            header: copy.columns.status,
            cell: (sponsor) =>
              sponsor.fromSheet
                ? statusPicker(sponsor)
                : muted(dayCopy.noSheet),
          },
          {
            key: "link",
            header: dayCopy.columns.link,
            cell: (sponsor, summary) => (
              <span className="flex flex-wrap items-center gap-1.5">
                {summary && sponsor.sponsorId && (
                  <LinkGivenToggle
                    name={sponsor.name}
                    given={summary.linkGivenAt !== null}
                    pending={linkPending.has(sponsor.sponsorId)}
                    onToggle={(given) =>
                      setLinkGiven.mutate({
                        sponsorId: sponsor.sponsorId!,
                        given,
                      })
                    }
                  />
                )}
                <CopyLinkButton
                  sponsorId={sponsor.sponsorId}
                  name={sponsor.name}
                />
              </span>
            ),
          },
          {
            key: "booth",
            header: copy.columns.booth,
            className: "text-dashboard-text-medium",
            cell: (sponsor) =>
              sponsor.fromSheet
                ? sponsor.boothLocation || copy.boothTbd
                : copy.none,
          },
          {
            key: "hwContact",
            header: copy.columns.hwContact,
            className: "text-dashboard-text-medium",
            cell: (sponsor) => sponsor.hwContact || copy.none,
          },
        ]
      : day === "Saturday"
        ? [
            {
              key: "chatType",
              header: copy.chatColumns.chatType,
              className: "text-dashboard-text-medium",
              cell: registeredOnly((summary) =>
                summary.request.source !== "none"
                  ? copy.chatType(
                      requestSummary(summary.request),
                      summary.request.durationMinutes,
                    )
                  : muted(requestSummary(summary.request)),
              ),
            },
            {
              key: "slots",
              header: dayCopy.columns.slots,
              cell: registeredOnly((summary) => (
                <ChatSlotsCell summary={summary} />
              )),
            },
            {
              key: "chats",
              header: copy.chatColumns.chats,
              className: "whitespace-nowrap tabular-nums",
              cell: registeredOnly((summary) =>
                copy.chatsCell(summary.accepted, summary.pending),
              ),
            },
          ]
        : [
            {
              key: "judging",
              header: judgingCopy.columns.room,
              cell: (_sponsor, summary) => <JudgingCell summary={summary} />,
            },
            {
              key: "round1",
              header: dayCopy.columns.round1,
              cell: registeredOnly((summary) => (
                <Round1Cell summary={summary} />
              )),
            },
            {
              key: "round2",
              header: dayCopy.columns.round2(SPONSOR_FINAL_TOP),
              cell: registeredOnly((summary) => (
                <Round2Cell summary={summary} round2Open={round2Open} />
              )),
            },
            {
              key: "where",
              header: dayCopy.columns.where,
              cell: registeredOnly((summary) => (
                <WhereCell summary={summary} items={items} now={now} />
              )),
            },
          ];

  const board = (
    <div className="flex flex-col gap-4 font-figtree text-dashboard-text-heavy">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <DayPicker
            value={day}
            onChange={setPickedDay}
            label={dayCopy.pickerLabel}
            dayLabel={(d) => dayCopy.short[d] ?? d}
            tourId="org-days"
          />
          <span className="text-xs tabular-nums text-dashboard-text-light">
            {updatedAt
              ? copy.updatedAgo(ago(now.getTime() - updatedAt))
              : failed
                ? null
                : copy.loading}
          </span>
        </div>
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
        data-tour="org-stats"
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
                stat.warn && typeof stat.value === "number" && stat.value > 0
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
        <div data-tour="org-search" className="relative w-full">
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

        {/* Friday only (arrivals). One row that scrolls sideways on
            phones, wraps on wider screens. */}
        {day === "Friday" && (
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
        )}
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

      {/* Phones (under 640px): one compact card per sponsor with the
          picked day's fields; tap the name to open its chats and details. */}
      {filtered.length > 0 && (
        <ul className="m-0 flex list-none flex-col gap-3 p-0 sm:hidden">
          {filtered.map((sponsor, i) => {
            const row = rowAttrs(sponsor);
            const key = rowKey(sponsor);
            const summary = summaryOf(sponsor);
            const open = isOpen(sponsor);
            const panelId = `sponsor-details-m-${key}`;
            return (
              <li
                key={key}
                data-row={row.dataRow}
                data-tour={i === 0 ? "org-sponsor-row" : undefined}
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
                    "-m-2 flex items-center justify-between gap-3 rounded-dashboard-md p-2 text-left",
                    press,
                    focusRing,
                  )}
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <SponsorLogo name={sponsor.name} />
                    <span className="min-w-0 break-words text-base font-semibold leading-snug">
                      {sponsor.name}
                    </span>
                  </span>
                  <ChevronDown
                    aria-hidden
                    className={cn(
                      "size-5 shrink-0 text-dashboard-text-light transition-transform duration-150 ease-out motion-reduce:transition-none",
                      open && "rotate-180",
                    )}
                  />
                  <span className="sr-only">
                    {open
                      ? copy.collapse(sponsor.name)
                      : copy.expand(sponsor.name)}
                  </span>
                </button>
                <dl className="m-0 grid grid-cols-1 gap-2 text-sm">
                  {columns.map((col) => (
                    <div
                      key={col.key}
                      className="grid grid-cols-[7.5rem_minmax(0,1fr)] items-center gap-2"
                    >
                      <dt className="text-xs text-dashboard-text-light">
                        {col.header}
                      </dt>
                      <dd className="m-0 min-w-0">
                        {col.cell(sponsor, summary)}
                      </dd>
                    </div>
                  ))}
                </dl>
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

      {/* 640px and up: one table with the picked day's columns, sponsor
          column pinned while it scrolls sideways inside its own box. A row
          opens to that sponsor's chats, holds and details. */}
      {filtered.length > 0 && (
        <div className="hidden overflow-x-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card sm:block">
          <table className="w-full min-w-max border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">{copy.tableLabel}</caption>
            <thead>
              <tr className="text-xs font-semibold text-dashboard-text-light">
                {[
                  { key: "sponsor", header: copy.chatColumns.sponsor },
                  ...columns,
                ].map((col, i) => (
                  <th
                    key={col.key}
                    scope="col"
                    className={cn(
                      "border-b border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-3 font-semibold",
                      i === 0 && "sticky left-0 z-10 min-w-56",
                    )}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((sponsor, i) => {
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
                    <tr
                      data-row={row.dataRow}
                      data-tour={i === 0 ? "org-sponsor-row" : undefined}
                      className="scroll-mt-4"
                    >
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
                          <SponsorName sponsor={sponsor} />
                        </span>
                      </th>
                      {columns.map((col) => (
                        <td key={col.key} className={cn(cell, col.className)}>
                          {col.cell(sponsor, summary)}
                        </td>
                      ))}
                    </tr>
                    {open && (
                      <tr id={panelId}>
                        <td
                          colSpan={columns.length + 1}
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
          </table>
        </div>
      )}
    </div>
  );

  // My sponsors: the sheet's sponsors whose HW lead is the signed-in
  // organizer. Without a match only All sponsors shows.
  const mySponsors: MySponsor[] = me
    ? sponsors.filter((s) => leadsSponsor(s.hwContact, me, contactNames))
    : [];
  const showMine = !!me && view === "mine";
  const mineView = (
    <MySponsors
      sponsors={mySponsors}
      data={mine}
      summaries={summaries}
      workshops={workshops}
      pending={pending}
      onPill={(sponsor, pill, done) =>
        changeStatus(
          sponsor.name,
          statusAfterPill(pill, done ? "undo" : "advance"),
        )
      }
      onCcWorkshop={(sponsor, attended) => changeCcWorkshop(sponsor.name, attended)}
      copyLink={(sponsor) => (
        <CopyLinkButton sponsorId={sponsor.sponsorId} name={sponsor.name} />
      )}
    />
  );

  return (
    <div className="flex flex-col gap-4 font-figtree text-dashboard-text-heavy">
      {me && (
        <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
          <p className="m-0 text-sm text-dashboard-text-medium">
            <span className="font-semibold text-dashboard-text-heavy">
              {me.ownName ? mineCopy.signedInWithView(me.ownName, me.name) : mineCopy.signedIn(me.name)}
            </span>
            {" · "}
            {mineCopy.leads(mySponsors.length)}
          </p>
          <div
            role="group"
            aria-label={mineCopy.viewLabel}
            data-tour="org-view"
            className="inline-flex rounded-full border border-dashboard-border-default bg-dashboard-bg-surface p-0.5"
          >
            {(["mine", "all"] as const).map((v) => (
              <button
                key={v}
                type="button"
                aria-pressed={view === v}
                onClick={() => onView(v)}
                className={cn(
                  "inline-flex min-h-11 items-center rounded-full px-4 text-sm font-semibold md:min-h-9",
                  press,
                  focusRing,
                  view === v
                    ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                    : cn("text-dashboard-text-medium", hover.highlight),
                )}
              >
                {v === "mine" ? mineCopy.title : mineCopy.all}
              </button>
            ))}
          </div>
        </div>
      )}
      {!me && contactsError && (
        <p
          role="status"
          data-hw-contacts="error"
          className="m-0 flex items-center gap-2 text-sm font-semibold text-dashboard-text-warning"
        >
          <TriangleAlert aria-hidden className="size-4 shrink-0" />
          {mineCopy.contactsError}
        </p>
      )}
      {note && showMine && (
        <p
          role={note.tone === "error" ? "alert" : "status"}
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {note.text}
        </p>
      )}
      {showMine ? mineView : board}
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

// The sponsor's logo (when we have one) and name. Registered sponsors
// link to the Coffee chats tab with their cells highlighted in the rooms
// table.
function SponsorName({ sponsor }: { sponsor: Sponsor }) {
  const name = (
    <span className="flex min-w-0 flex-col gap-1">
      <span className="flex min-w-0 items-center gap-2">
        <SponsorLogo name={sponsor.name} />
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
  const link = (tab: "schedule" | "coffee") =>
    organizerHomeHref({ tab, sponsor: sponsor.sponsorId });
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
