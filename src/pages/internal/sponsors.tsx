import { useState } from "react";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

function PrivateLinkCell({ sponsorId }: { sponsorId: string | null }) {
  const [copied, setCopied] = useState(false);
  if (!sponsorId) {
    return (
      <span className="text-[13px] font-medium text-[#9a3412]">
        not registered
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard.writeText(sponsorId).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="cursor-pointer rounded-[6px] border border-slate-300 bg-white px-2 py-1 font-mono text-[12px] text-[#0b2238] hover:bg-slate-50"
      title={sponsorId}
    >
      {copied ? "copied!" : `${sponsorId.slice(0, 8)}…`}
    </button>
  );
}

export default function SponsorJudgingBoard() {
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncNote, setSyncNote] = useState<string | null>(null);
  const sponsorsQ = api.sponsorJudging.getSponsors.useQuery(undefined, {
    refetchInterval: 30000,
  });
  const utils = api.useUtils();
  const sync = api.sponsorJudging.syncSponsors.useMutation({
    onSuccess: async (registered) => {
      setSyncNote(`Synced ${registered.length} sponsor(s) from the master sheet.`);
      await utils.sponsorJudging.getSponsors.invalidate();
    },
    onError: (error) => setSyncNote(`Sync failed: ${error.message}`),
    onSettled: () => setSyncing(false),
  });

  const sponsors = sponsorsQ.data ?? [];
  const filtered = query
    ? sponsors.filter((sponsor) =>
        `${sponsor.name} ${sponsor.tier} ${sponsor.hwContact}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      )
    : sponsors;

  const updatedAt = sponsorsQ.dataUpdatedAt;
  const failed = sponsorsQ.error;
  const missingLinks = sponsors.filter((s) => !s.sponsorId).length;
  const withPicks = sponsors.filter((s) => s.teamIds.length > 0).length;

  return (
    <>
      <SEO title="Sponsor judging" noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-[#eef1f6] px-4 pb-12 pt-8 font-figtree text-[#0b2238] sm:px-5">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className="text-sm text-slate-500">
                Hack Western 13 · Organizers
              </span>
              <h1 className="m-0 text-[28px] font-bold leading-tight lg:text-[34px]">
                Sponsor judging
              </h1>
              <span className="text-[13px] tabular-nums text-slate-500">
                {updatedAt ? `Updated ${ago(Date.now() - updatedAt)} ago` : "Loading…"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search sponsors…"
                className="min-h-11 w-[220px] rounded-[10px] border border-slate-300 bg-white px-3 text-[15px]"
              />
              <button
                type="button"
                disabled={syncing}
                onClick={() => {
                  setSyncing(true);
                  setSyncNote(null);
                  sync.mutate();
                }}
                className="inline-flex min-h-11 cursor-pointer items-center rounded-[10px] bg-[#5b3fa0] px-4 text-[15px] font-bold text-white hover:bg-[#3f2a75] disabled:opacity-60"
              >
                {syncing ? "Syncing…" : "Sync from master sheet"}
              </button>
            </div>
          </header>

          {failed && (
            <p
              aria-live="polite"
              className="m-0 rounded-xl bg-[#fdecea] px-4 py-3 text-[15px] font-medium text-[#7a1a0f]"
            >
              Couldn&apos;t load sponsors ({failed.message}).
            </p>
          )}

          {syncNote && (
            <p
              aria-live="polite"
              className="m-0 rounded-xl bg-white px-4 py-3 text-[15px] font-medium"
            >
              {syncNote}
            </p>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { label: "Sponsors", value: sponsors.length },
              { label: "With picks", value: withPicks },
              { label: "Missing private link", value: missingLinks },
              {
                label: "Not on master sheet",
                value: sponsors.filter((s) => !s.onMasterSheet).length,
              },
            ].map((stat) => (
              <div
                key={stat.label}
                className="rounded-xl bg-white px-4 py-3 shadow-sm"
              >
                <div className="text-[22px] font-bold tabular-nums">
                  {stat.value}
                </div>
                <div className="text-[13px] text-slate-500">{stat.label}</div>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full border-collapse text-left text-[14px]">
              <thead>
                <tr className="border-b border-slate-200 text-[12px] uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-3">Company</th>
                  <th className="px-4 py-3">Tier</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">HW contact</th>
                  <th className="px-4 py-3">Picks</th>
                  <th className="px-4 py-3">Private link</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((sponsor) => (
                  <tr
                    key={sponsor.sponsorId ?? sponsor.name}
                    className="border-b border-slate-100 last:border-0"
                  >
                    <td className="px-4 py-3 font-semibold">
                      {sponsor.name}
                      {!sponsor.onMasterSheet && (
                        <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-medium text-amber-800">
                          not on master sheet
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{sponsor.tier || "—"}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {sponsor.amount || "—"}
                    </td>
                    <td className="px-4 py-3">
                      {sponsor.hwContact || sponsor.companyContact || "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {sponsor.teamIds.length > 0 ? (
                        sponsor.teamIds.length
                      ) : (
                        <span className="text-slate-400">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <PrivateLinkCell sponsorId={sponsor.sponsorId} />
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-slate-500"
                    >
                      {sponsorsQ.isLoading
                        ? "Loading…"
                        : "No sponsors match that search."}
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
