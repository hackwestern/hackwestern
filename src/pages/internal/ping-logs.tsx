import { type GetServerSidePropsContext } from "next";
import { useMemo, useState } from "react";
import SEO from "~/components/seo";
import { Button } from "~/components/ui/button";
import { InternalPage } from "~/components/internals/page-shell";
import { pingLogsCopy as copy } from "~/content/ping-logs";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";
import type { PingStatus } from "~/server/slack/organizer-ping-log";

type Show = "upcoming" | "sent" | "all";

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

const STATUS_STYLE: Record<PingStatus, string> = {
  queued: "bg-emerald-50 text-emerald-800 border-emerald-200",
  notQueued: "bg-amber-50 text-amber-900 border-amber-300",
  sent: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function PingLogs() {
  const log = api.organizerPings.log.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const [who, setWho] = useState("");
  const [show, setShow] = useState<Show>("upcoming");

  const pings = log.data?.pings;
  const people = useMemo(
    () => [...new Set((pings ?? []).map((p) => p.to))].sort(),
    [pings],
  );
  const mine = (pings ?? []).filter((p) => !who || p.to === who);
  const counts = {
    queued: mine.filter((p) => p.status === "queued").length,
    notQueued: mine.filter((p) => p.status === "notQueued").length,
    sent: mine.filter((p) => p.status === "sent").length,
  };
  const rows = mine.filter((p) =>
    show === "all"
      ? true
      : show === "sent"
        ? p.status === "sent"
        : p.status !== "sent",
  );
  // Most recent first for sent pings, soonest first for upcoming ones.
  if (show === "sent") rows.reverse();

  const bot = log.data?.bot;

  return (
    <>
      <SEO title={copy.seoTitle} description={copy.subtitle} noindex />
      <InternalPage title={copy.title} subtitle={copy.subtitle}>
        {log.isLoading && <p className="text-slate-500">{copy.loading}</p>}
        {log.error && (
          <p className="text-red-700">{copy.error(log.error.message)}</p>
        )}
        {bot && (
          <section
            className={`mb-6 rounded-2xl border p-5 ${
              bot.healthy
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-300 bg-red-50"
            }`}
          >
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              <span
                aria-hidden
                className={`h-3 w-3 rounded-full ${bot.healthy ? "bg-emerald-500" : "bg-red-500"}`}
              />
              <h2 className="text-lg font-semibold text-slate-900">
                {bot.healthy ? copy.bot.healthy : copy.bot.down}
              </h2>
              <span className="text-sm text-slate-600">
                {bot.lastCheckIn
                  ? copy.bot.lastCheckIn(seconds.format(bot.lastCheckIn))
                  : copy.bot.never}
              </span>
            </div>
            <p className="mt-2 text-sm text-slate-700">
              {bot.healthy ? copy.bot.healthyHelp : copy.bot.downHelp}
            </p>
          </section>
        )}

        {pings && (
          <>
            <div className="mb-4 flex flex-wrap items-end gap-4">
              <label className="flex flex-col gap-1 text-sm text-slate-600">
                {copy.filter.label}
                <select
                  className="rounded-md border border-[#d6dbe5] bg-white px-3 py-2 text-slate-900"
                  value={who}
                  onChange={(e) => setWho(e.target.value)}
                >
                  <option value="">{copy.filter.everyone}</option>
                  {people.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="flex flex-col gap-1 text-sm text-slate-600">
                {copy.show.label}
                <div className="flex gap-2">
                  {(["upcoming", "sent", "all"] as const).map((s) => (
                    <Button
                      key={s}
                      size="sm"
                      variant={show === s ? "primary" : "outline"}
                      onClick={() => setShow(s)}
                    >
                      {copy.show[s]}
                    </Button>
                  ))}
                </div>
              </div>
              <p className="text-sm text-slate-600">
                {copy.counts.queued(counts.queued)} ·{" "}
                <span
                  className={
                    counts.notQueued ? "font-semibold text-amber-800" : ""
                  }
                >
                  {copy.counts.notQueued(counts.notQueued)}
                </span>{" "}
                · {copy.counts.sent(counts.sent)}
              </p>
            </div>

            <div className="overflow-hidden rounded-2xl border border-[#d6dbe5] bg-white">
              <div className="hidden grid-cols-[9rem_8rem_1fr_9rem] gap-4 border-b border-[#d6dbe5] bg-slate-50 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500 md:grid">
                <span>{copy.table.time}</span>
                <span>{copy.table.to}</span>
                <span>{copy.table.what}</span>
                <span>{copy.table.status}</span>
              </div>
              {rows.length === 0 && (
                <p className="px-4 py-6 text-slate-500">{copy.table.empty}</p>
              )}
              {rows.map((p, i) => (
                <div
                  key={`${p.to}-${+p.postAt}-${i}`}
                  className="grid grid-cols-1 gap-1 border-b border-[#eef0f4] px-4 py-3 last:border-b-0 md:grid-cols-[9rem_8rem_1fr_9rem] md:gap-4"
                >
                  <span className="text-sm text-slate-700">
                    {time.format(p.postAt)}
                  </span>
                  <span className="font-medium text-slate-900">{p.to}</span>
                  <details className="min-w-0 text-sm text-slate-800">
                    <summary className="cursor-pointer break-words">
                      {p.title}
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 font-figtree text-xs text-slate-700">
                      {p.text}
                    </pre>
                  </details>
                  <span>
                    <span
                      title={
                        p.status === "notQueued"
                          ? copy.statusHelp.notQueued
                          : undefined
                      }
                      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[p.status]}`}
                    >
                      {copy.status[p.status]}
                    </span>
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {copy.footnote}{" "}
              {log.data && copy.refreshed(seconds.format(log.data.now))}
            </p>
            {counts.notQueued > 0 && (
              <p className="mt-1 text-xs text-amber-800">
                {copy.statusHelp.notQueued}
              </p>
            )}
          </>
        )}
      </InternalPage>
    </>
  );
}

export const getServerSideProps = (ctx: GetServerSidePropsContext) =>
  authRedirectOrganizer(ctx);
