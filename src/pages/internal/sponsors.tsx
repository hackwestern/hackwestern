import { useState, useMemo } from "react";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";
import { CopyIcon, CheckIcon, ExternalLinkIcon } from "@radix-ui/react-icons";

export type SponsorStatus =
  | "Not arrived"
  | "Checked in"
  | "Booth set up"
  | "Workshop live"
  | "Left";

const STATUS_FLOW: SponsorStatus[] = [
  "Not arrived",
  "Checked in",
  "Booth set up",
  "Workshop live",
  "Left",
];

const STATUS_CONFIG: Record<
  SponsorStatus,
  {
    badge: string;
    dot: string;
    nextLabel: string | null;
  }
> = {
  "Not arrived": {
    badge: "bg-slate-100 text-slate-700 border-slate-300",
    dot: "bg-slate-400",
    nextLabel: "Check in →",
  },
  "Checked in": {
    badge: "bg-blue-50 text-blue-700 border-blue-300",
    dot: "bg-blue-500",
    nextLabel: "Booth set up →",
  },
  "Booth set up": {
    badge: "bg-amber-50 text-amber-800 border-amber-300",
    dot: "bg-amber-500",
    nextLabel: "Workshop live →",
  },
  "Workshop live": {
    badge: "bg-purple-100 text-purple-900 border-purple-300 font-bold",
    dot: "bg-purple-600",
    nextLabel: "Mark left →",
  },
  Left: {
    badge: "bg-zinc-100 text-zinc-500 border-zinc-300",
    dot: "bg-zinc-400",
    nextLabel: null,
  },
};

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
  label,
  className = "",
}: {
  sponsorId: string | null;
  label?: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);

  if (!sponsorId) {
    return (
      <span className="inline-flex items-center text-[12px] font-medium text-amber-700">
        Link pending sync
      </span>
    );
  }

  const url = `/sponsors/${sponsorId}`;

  return (
    <div className={`inline-flex items-center gap-1.5 ${className}`}>
      <button
        type="button"
        onClick={() => {
          void navigator.clipboard
            .writeText(`${window.location.origin}${url}`)
            .then(() => {
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            });
        }}
        className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[13px] font-semibold transition active:scale-95 ${
          copied
            ? "border-emerald-500 bg-emerald-50 text-emerald-800"
            : "border-slate-300 bg-white text-[#0b2238] hover:bg-slate-50"
        }`}
        title="Copy private sponsor portal link"
      >
        {copied ? (
          <>
            <CheckIcon className="h-4 w-4 text-emerald-600" />
            <span>Copied!</span>
          </>
        ) : (
          <>
            <CopyIcon className="h-3.5 w-3.5 text-slate-500" />
            <span>{label ?? "Copy link"}</span>
          </>
        )}
      </button>

      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-slate-300 bg-white p-2 text-slate-600 transition hover:bg-slate-50"
        title="Open sponsor portal in new tab"
      >
        <ExternalLinkIcon className="h-4 w-4" />
      </a>
    </div>
  );
}

function StatusPicker({
  sponsorName,
  currentStatus,
  onStatusChange,
  isPending,
}: {
  sponsorName: string;
  currentStatus: SponsorStatus;
  onStatusChange: (status: SponsorStatus) => void;
  isPending?: boolean;
}) {
  const config = STATUS_CONFIG[currentStatus] ?? STATUS_CONFIG["Not arrived"];
  const next = getNextStatus(currentStatus);

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Dropdown selector for any status */}
      <div className="relative inline-flex items-center">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[12px] font-semibold ${config.badge}`}
        >
          <span
            className={`h-2 w-2 rounded-full ${config.dot} ${
              currentStatus === "Workshop live" ? "animate-pulse" : ""
            }`}
          />
          <span>{currentStatus}</span>
          <span className="text-[10px] text-slate-400">▾</span>
        </span>
        <select
          value={currentStatus}
          disabled={isPending}
          onChange={(e) => onStatusChange(e.target.value as SponsorStatus)}
          aria-label={`Change status for ${sponsorName}`}
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {STATUS_FLOW.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
      </div>

      {/* Quick advance button for one-tap progression on mobile */}
      {next && config.nextLabel && (
        <button
          type="button"
          disabled={isPending}
          onClick={() => onStatusChange(next)}
          className="inline-flex min-h-7 items-center rounded-md border border-purple-200 bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700 transition hover:bg-purple-100 active:scale-95 disabled:opacity-50"
          title={`Advance to ${next}`}
        >
          {config.nextLabel}
        </button>
      )}
    </div>
  );
}

function RoomBadge({ roomNumber }: { roomNumber: string }) {
  const isTbd = !roomNumber || roomNumber === "TBD";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[12px] font-medium ${
        isTbd
          ? "border border-dashed border-amber-300 bg-amber-50/60 text-amber-800"
          : "border border-slate-200 bg-slate-50 text-[#0b2238]"
      }`}
    >
      <span className="text-[11px]">🚪</span>
      <span>{isTbd ? "Room: TBD" : `Room ${roomNumber}`}</span>
    </span>
  );
}

export default function SponsorJudgingBoard() {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);

  const utils = api.useUtils();
  const sponsorsQ = api.sponsorJudging.getSponsors.useQuery(undefined, {
    refetchInterval: 30000,
  });

  const updateStatus = api.sponsorJudging.setSponsorStatus.useMutation({
    onMutate: async ({ sponsorName, status }) => {
      await utils.sponsorJudging.getSponsors.cancel();
      const prev = utils.sponsorJudging.getSponsors.getData();
      utils.sponsorJudging.getSponsors.setData(undefined, (old) => {
        if (!old) return old;
        return old.map((s) =>
          s.name.toLowerCase() === sponsorName.toLowerCase()
            ? { ...s, status }
            : s,
        );
      });
      return { prev };
    },
    onError: (err, _vars, context) => {
      if (context?.prev) {
        utils.sponsorJudging.getSponsors.setData(undefined, context.prev);
      }
      setSyncNote(`Failed to update status: ${err.message}`);
    },
    onSettled: async () => {
      await utils.sponsorJudging.getSponsors.invalidate();
    },
  });

  const sync = api.sponsorJudging.syncSponsors.useMutation({
    onSuccess: async (registered) => {
      setSyncNote(
        `Synced ${registered.length} sponsor(s) from the master sheet.`,
      );
      await utils.sponsorJudging.getSponsors.invalidate();
    },
    onError: (error) => setSyncNote(`Sync failed: ${error.message}`),
    onSettled: () => setSyncing(false),
  });

  const sponsors = sponsorsQ.data ?? [];

  // Status counts for filter chips
  const countsByStatus = useMemo(() => {
    const counts: Record<string, number> = {
      ALL: sponsors.length,
      "Not arrived": 0,
      "Checked in": 0,
      "Booth set up": 0,
      "Workshop live": 0,
      Left: 0,
    };
    for (const s of sponsors) {
      if (s.status in counts) {
        counts[s.status] = (counts[s.status] ?? 0) + 1;
      }
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
  const missingLinks = sponsors.filter((s) => !s.sponsorId).length;
  const withPicks = sponsors.filter((s) => s.teamIds.length > 0).length;

  return (
    <>
      <SEO title="Sponsor dashboard" noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-[#eef1f6] px-3 pb-16 pt-5 font-figtree text-[#0b2238] sm:px-6">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-4">
          {/* Header */}
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-0.5">
              <span className="text-xs font-semibold uppercase tracking-wider text-purple-700">
                Hack Western 13 · Organizers
              </span>
              <h1 className="m-0 text-[24px] font-extrabold leading-tight text-[#0b2238] sm:text-[30px]">
                Sponsor dashboard
              </h1>
              <span className="text-[12px] tabular-nums text-slate-500">
                {updatedAt
                  ? `Updated ${ago(Date.now() - updatedAt)} ago`
                  : "Loading…"}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  setSyncNote(null);
                  sync.mutate();
                }}
                className="inline-flex min-h-10 cursor-pointer items-center justify-center rounded-xl bg-[#5b3fa0] px-3.5 text-[14px] font-bold text-white transition hover:bg-[#3f2a75] active:scale-95 disabled:opacity-60"
              >
                {syncing ? "Syncing…" : "Sync from master sheet"}
              </button>
            </div>
          </header>

          {/* Feedback banners */}
          {failed && (
            <p
              aria-live="polite"
              className="m-0 rounded-xl bg-[#fdecea] px-4 py-3 text-[14px] font-medium text-[#7a1a0f]"
            >
              Couldn&apos;t load sponsors: {failed.message}.
            </p>
          )}

          {syncNote && (
            <p
              aria-live="polite"
              className="m-0 flex items-center justify-between rounded-xl bg-white px-4 py-3 text-[14px] font-medium shadow-sm"
            >
              <span>{syncNote}</span>
              <button
                type="button"
                onClick={() => setSyncNote(null)}
                className="text-xs text-slate-400 hover:text-slate-700"
              >
                ✕
              </button>
            </p>
          )}

          {/* Mobile-Friendly Search & Quick Stats Bar */}
          <div className="flex flex-col gap-3">
            <div className="relative w-full">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search company, room, contact, or status…"
                className="min-h-11 w-full rounded-xl border border-slate-300 bg-white pl-10 pr-9 text-[15px] placeholder:text-slate-400 focus:border-purple-600 focus:outline-none focus:ring-2 focus:ring-purple-200"
              />
              <span className="pointer-events-none absolute left-3.5 top-3 text-[15px] text-slate-400">
                🔍
              </span>
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery("")}
                  className="absolute right-3 top-3 text-sm font-bold text-slate-400 hover:text-slate-700"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Status Filter Chips (horizontally scrollable on mobile) */}
            <div className="no-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1 pt-0.5">
              <button
                type="button"
                onClick={() => setStatusFilter("ALL")}
                className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[12px] font-bold transition active:scale-95 ${
                  statusFilter === "ALL"
                    ? "bg-[#5b3fa0] text-white shadow-sm"
                    : "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                All ({countsByStatus.ALL ?? 0})
              </button>

              {STATUS_FLOW.map((status) => {
                const count = countsByStatus[status] ?? 0;
                const active = statusFilter === status;
                const config = STATUS_CONFIG[status];
                return (
                  <button
                    key={status}
                    type="button"
                    onClick={() => setStatusFilter(status)}
                    className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-3 py-1.5 text-[12px] font-bold transition active:scale-95 ${
                      active
                        ? "border-purple-600 bg-purple-700 text-white shadow-sm"
                        : `${config.badge} hover:bg-white`
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        active ? "bg-white" : config.dot
                      }`}
                    />
                    <span>{status}</span>
                    <span
                      className={`ml-0.5 text-[11px] tabular-nums ${
                        active ? "text-purple-200" : "text-slate-500"
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick Stats Grid */}
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
            {[
              { label: "Total Sponsors", value: sponsors.length },
              { label: "Picks Received", value: withPicks },
              { label: "Unregistered", value: missingLinks },
              {
                label: "Not on Master Sheet",
                value: sponsors.filter((s) => !s.onMasterSheet).length,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl border border-slate-200/80 bg-white p-3 shadow-sm"
              >
                <div className="text-[20px] font-extrabold tabular-nums text-[#0b2238]">
                  {stat.value}
                </div>
                <div className="text-[11px] font-medium text-slate-500">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>

          {/* Mobile View: Single column cards (one card width) */}
          <div className="flex flex-col gap-3 md:hidden">
            {filtered.map((sponsor) => {
              return (
                <div
                  key={sponsor.sponsorId ?? sponsor.name}
                  className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div className="flex flex-col gap-3">
                    {/* Top: Name & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex flex-col">
                        <h2 className="m-0 text-[17px] font-bold leading-snug text-[#0b2238]">
                          {sponsor.name}
                        </h2>
                        {!sponsor.onMasterSheet && (
                          <span className="inline-self-start mt-0.5 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                            not on master sheet
                          </span>
                        )}
                      </div>

                      {sponsor.tier && (
                        <span className="shrink-0 rounded-md bg-purple-50 px-2 py-0.5 text-[11px] font-bold text-purple-700">
                          {sponsor.tier}
                        </span>
                      )}
                    </div>

                    {/* Status & Room Controls */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-y border-slate-100 py-2.5">
                      <StatusPicker
                        sponsorName={sponsor.name}
                        currentStatus={sponsor.status as SponsorStatus}
                        onStatusChange={(status) =>
                          updateStatus.mutate({
                            sponsorName: sponsor.name,
                            status,
                          })
                        }
                        isPending={updateStatus.isPending}
                      />

                      <RoomBadge roomNumber={sponsor.roomNumber} />
                    </div>

                    {/* Key Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[12px]">
                      <div>
                        <span className="block text-[11px] text-slate-400">
                          HW Contact
                        </span>
                        <span className="font-semibold text-slate-700">
                          {sponsor.hwContact || "—"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-400">
                          Booth
                        </span>
                        <span className="font-semibold text-slate-700">
                          {sponsor.boothLocation || "TBD"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-400">
                          Company Contact
                        </span>
                        <span className="font-semibold text-slate-700">
                          {sponsor.companyContact || "—"}
                        </span>
                      </div>

                      <div>
                        <span className="block text-[11px] text-slate-400">
                          Picks
                        </span>
                        <span
                          className={`font-bold tabular-nums ${
                            sponsor.teamIds.length > 0
                              ? "text-emerald-700"
                              : "text-slate-400"
                          }`}
                        >
                          {sponsor.teamIds.length > 0
                            ? `${sponsor.teamIds.length} teams selected`
                            : "No picks yet"}
                        </span>
                      </div>
                    </div>

                    {/* Notes snippet if present */}
                    {sponsor.notes && (
                      <p className="m-0 rounded-lg bg-slate-50 p-2 text-[11px] italic text-slate-600">
                        {sponsor.notes}
                      </p>
                    )}
                  </div>

                  {/* Bottom: Sponsor Page Action */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <span className="text-[11px] font-medium text-slate-500">
                      Sponsor Page
                    </span>
                    <CopyLinkButton
                      sponsorId={sponsor.sponsorId}
                      label="Copy link"
                    />
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="rounded-2xl bg-white p-8 text-center text-slate-500 shadow-sm">
                {sponsorsQ.isLoading
                  ? "Loading sponsors…"
                  : "No sponsors match your filter criteria."}
              </div>
            )}
          </div>

          {/* Desktop View: Table */}
          <div className="hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm md:block">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/60 text-[11px] uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Room</th>
                  <th className="px-4 py-3">Booth</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">HW Contact</th>
                  <th className="px-4 py-3">Picks</th>
                  <th className="px-4 py-3">Sponsor Page</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sponsor) => (
                  <tr
                    key={sponsor.sponsorId ?? sponsor.name}
                    className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50"
                  >
                    <td className="px-4 py-3 font-semibold text-[#0b2238]">
                      {sponsor.name}
                      {!sponsor.onMasterSheet && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800">
                          not on master
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <StatusPicker
                        sponsorName={sponsor.name}
                        currentStatus={sponsor.status as SponsorStatus}
                        onStatusChange={(status) =>
                          updateStatus.mutate({
                            sponsorName: sponsor.name,
                            status,
                          })
                        }
                        isPending={updateStatus.isPending}
                      />
                    </td>

                    <td className="px-4 py-3">
                      <RoomBadge roomNumber={sponsor.roomNumber} />
                    </td>

                    <td className="px-4 py-3 text-[13px] text-slate-600">
                      {sponsor.boothLocation || "TBD"}
                    </td>

                    <td className="px-4 py-3 text-[13px] text-slate-600">
                      {sponsor.tier || "—"}
                    </td>

                    <td className="px-4 py-3 text-[13px] text-slate-600">
                      {sponsor.hwContact || sponsor.companyContact || "—"}
                    </td>

                    <td className="px-4 py-3 font-semibold tabular-nums">
                      {sponsor.teamIds.length > 0 ? (
                        <span className="text-emerald-700">
                          {sponsor.teamIds.length}
                        </span>
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>

                    <td className="px-4 py-3">
                      <CopyLinkButton sponsorId={sponsor.sponsorId} />
                    </td>
                  </tr>
                ))}

                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      {sponsorsQ.isLoading
                        ? "Loading…"
                        : "No sponsors match your filter criteria."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
