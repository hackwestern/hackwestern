import { type GetServerSidePropsContext } from "next";
import { type ReactNode, useMemo, useState } from "react";
import SEO from "~/components/seo";
import { InternalPage } from "~/components/internals/page-shell";
import { pingLogsCopy as copy } from "~/content/ping-logs";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";
import {
  PING_KINDS,
  type PingKind,
  type PingTone,
} from "~/server/api/utils/ping-log-sources";

type Show = "past" | "upcoming" | "all";

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const seconds = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  hour: "numeric",
  minute: "2-digit",
  second: "2-digit",
});

const TONE_STYLE: Record<PingTone, string> = {
  ok: "bg-emerald-50 text-emerald-800 border-emerald-200",
  waiting: "bg-sky-50 text-sky-800 border-sky-200",
  problem: "bg-amber-50 text-amber-900 border-amber-300",
  done: "bg-slate-100 text-slate-600 border-slate-200",
};

/** A filter button: navy when on, outlined when off (organizer page style). */
function Toggle({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      onClick={onClick}
      className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${
        on
          ? "border-[#0b2238] bg-[#0b2238] text-white"
          : "border-[#d6dbe5] bg-white text-[#0b2238] hover:bg-slate-50"
      }`}
    >
      {children}
    </button>
  );
}

const GRID = "md:grid-cols-[8rem_8rem_10rem_1fr_10rem]";

export default function PingLogs() {
  const log = api.organizerPings.log.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const [kind, setKind] = useState<PingKind | "all">("all");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("past");
  const [problemsOnly, setProblemsOnly] = useState(false);

  const data = log.data;
  const now = data ? +data.now : 0;
  const byKind = useMemo(() => {
    const counts = new Map<PingKind, number>();
    for (const e of data?.entries ?? [])
      counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    return counts;
  }, [data]);

  const needle = search.trim().toLowerCase();
  const scoped = (data?.entries ?? []).filter(
    (e) =>
      (kind === "all" || e.kind === kind) &&
      (show === "all" || (show === "past" ? +e.at <= now : +e.at > now)) &&
      (!needle ||
        `${e.to} ${e.about} ${e.detail ?? ""}`.toLowerCase().includes(needle)),
  );
  const problems = scoped.filter((e) => e.tone === "problem").length;
  const rows = (
    problemsOnly ? scoped.filter((e) => e.tone === "problem") : scoped
  ).sort((a, b) => (show === "upcoming" ? +a.at - +b.at : +b.at - +a.at));

  return (
    <>
      <SEO title={copy.seoTitle} description={copy.subtitle} noindex />
      <InternalPage title={copy.title} subtitle={copy.subtitle}>
        {log.isLoading && <p className="text-slate-500">{copy.loading}</p>}
        {log.error && (
          <p className="text-red-700">{copy.error(log.error.message)}</p>
        )}

        {data?.bot && (
          <section
            className={`mb-4 rounded-2xl border p-5 ${
              data.bot.healthy
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-300 bg-red-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                aria-hidden
                className={`h-3 w-3 rounded-full ${data.bot.healthy ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <h2 className="text-lg font-semibold text-slate-900">
                {data.bot.healthy ? copy.bot.healthy : copy.bot.down}
              </h2>
              <span className="text-sm text-slate-600">
                {data.bot.lastCheckIn
                  ? copy.bot.lastCheckIn(seconds.format(data.bot.lastCheckIn))
                  : copy.bot.never}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {data.bot.healthy ? copy.bot.healthyHelp : copy.bot.downHelp}
            </p>
          </section>
        )}
        {data?.organizerError && (
          <p className="mb-4 rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            {copy.bot.unavailable(data.organizerError)}
          </p>
        )}
        {data && data.failed.length > 0 && (
          <p className="mb-4 text-sm text-amber-800">
            {copy.failed(data.failed.map((k) => copy.kinds[k]).join(", "))}
          </p>
        )}

        {data && (
          <>
            <div className="mb-3 flex flex-wrap gap-2">
              {(["all", ...PING_KINDS] as const).map((k) => (
                <Toggle key={k} on={kind === k} onClick={() => setKind(k)}>
                  {copy.kinds[k]}
                  <span className="ml-1 opacity-70">
                    {k === "all" ? data.entries.length : (byKind.get(k) ?? 0)}
                  </span>
                </Toggle>
              ))}
            </div>
            {kind !== "all" && (
              <p className="mb-3 text-sm text-slate-600">
                {copy.kindHelp[kind]}
              </p>
            )}

            <div className="mb-4 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                {copy.search.label}
                <input
                  className="w-64 max-w-full rounded-md border border-[#d6dbe5] bg-white px-3 py-2 text-slate-900"
                  placeholder={copy.search.placeholder}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </label>
              <div className="flex flex-col gap-1 text-sm text-slate-600">
                {copy.show.label}
                <div className="flex gap-2">
                  {(["past", "upcoming", "all"] as const).map((s) => (
                    <Toggle key={s} on={show === s} onClick={() => setShow(s)}>
                      {copy.show[s]}
                    </Toggle>
                  ))}
                </div>
              </div>
              <Toggle
                on={problemsOnly}
                disabled={!problems && !problemsOnly}
                onClick={() => setProblemsOnly((v) => !v)}
              >
                {copy.problemsOnly(problems)}
              </Toggle>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d6dbe5] bg-white">
              <div
                className={`hidden gap-4 border-b border-[#d6dbe5] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid ${GRID}`}
              >
                <span>{copy.table.time}</span>
                <span>{copy.table.kind}</span>
                <span>{copy.table.to}</span>
                <span>{copy.table.what}</span>
                <span>{copy.table.status}</span>
              </div>
              {rows.length === 0 && (
                <p className="px-4 py-6 text-slate-500">{copy.table.empty}</p>
              )}
              {rows.map((e, i) => (
                <div
                  key={`${e.kind}-${e.to}-${+e.at}-${i}`}
                  className={`grid grid-cols-1 gap-1 border-b border-[#eef0f4] px-4 py-3 last:border-b-0 md:gap-4 ${GRID}`}
                >
                  <span className="text-sm text-slate-700">
                    {time.format(e.at)}
                  </span>
                  <span className="text-sm text-slate-500">
                    {copy.kinds[e.kind]}
                  </span>
                  <span className="break-words font-medium text-slate-900">
                    {e.to}
                  </span>
                  {e.detail ? (
                    <details className="min-w-0 text-sm text-slate-800">
                      <summary className="cursor-pointer break-words">
                        {e.about}
                      </summary>
                      <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 font-figtree text-xs text-slate-700">
                        {e.detail}
                      </pre>
                    </details>
                  ) : (
                    <span className="min-w-0 break-words text-sm text-slate-800">
                      {e.about}
                    </span>
                  )}
                  <span>
                    <span
                      title={copy.statusHelp[e.status]}
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_STYLE[e.tone]}`}
                    >
                      {copy.status[e.status] ?? e.status}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {copy.footnote} {copy.refreshed(seconds.format(data.now))}
            </p>
          </>
        )}
      </InternalPage>
    </>
  );
}

export const getServerSideProps = (ctx: GetServerSidePropsContext) =>
  authRedirectOrganizer(ctx);
