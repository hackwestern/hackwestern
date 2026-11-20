import { type GetServerSidePropsContext } from "next";
import { type ReactNode, useMemo, useState } from "react";
import SEO from "~/components/seo";
import { InternalPage } from "~/components/internals/page-shell";
import { pingLogsCopy as copy } from "~/content/ping-logs";
import { api, type RouterOutputs } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";
import {
  PING_KINDS,
  type PingKind,
  type PingTone,
} from "~/server/api/utils/ping-log-sources";

type Log = RouterOutputs["organizerPings"]["log"];
type Entry = Log["entries"][number];
type Show = "past" | "upcoming" | "all";

const time = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  weekday: "short",
  hour: "numeric",
  minute: "2-digit",
});
const clock = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/Toronto",
  hour: "numeric",
  minute: "2-digit",
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

/** One health question with a big green or red answer. */
function Check({
  question,
  good,
  answer,
  children,
}: {
  question: string;
  good: boolean;
  answer: string;
  children?: ReactNode;
}) {
  return (
    <section
      className={`flex flex-col gap-2 rounded-2xl border p-5 ${
        good ? "border-emerald-200 bg-white" : "border-red-300 bg-red-50"
      }`}
    >
      <h2 className="text-sm font-medium text-[#4a5d73]">{question}</h2>
      <p className="flex items-center gap-2 text-xl font-bold text-[#0b2238]">
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 rounded-full ${good ? "bg-emerald-500" : "bg-red-500"}`}
        />
        {answer}
      </p>
      <div className="flex flex-col gap-1 text-sm text-slate-700">
        {children}
      </div>
    </section>
  );
}

function HealthChecks({ data }: { data: Log }) {
  const { bot, health } = data;
  if (!bot || !health) return null;
  const people = health.people.filter((p) => !p.name.startsWith("#"));
  const unreachable = people.filter((p) => p.reach !== "ok");
  const missed = people.filter((p) => p.missed > 0);
  const missedTotal = missed.reduce((n, p) => n + p.missed, 0);
  const atRisk = people.reduce((n, p) => n + p.atRisk, 0);
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Check
        question={copy.goingOut.question}
        good={bot.healthy}
        answer={bot.healthy ? copy.goingOut.yes : copy.goingOut.no}
      >
        <span>
          {!bot.lastCheckIn
            ? copy.goingOut.botNever
            : bot.healthy
              ? copy.goingOut.botOk(clock.format(bot.lastCheckIn))
              : copy.goingOut.botDown(clock.format(bot.lastCheckIn))}
        </span>
        {!bot.healthy && (
          <code className="rounded bg-white px-2 py-1 text-xs">
            {copy.goingOut.fix}
          </code>
        )}
        {health.lastSent && (
          <span>
            {copy.goingOut.last(
              clock.format(health.lastSent.at),
              health.lastSent.to,
            )}
          </span>
        )}
        <span>
          {health.nextUp
            ? copy.goingOut.next(
                clock.format(health.nextUp.at),
                health.nextUp.to,
              )
            : copy.goingOut.noNext}
        </span>
        <span className="text-slate-500">
          {copy.goingOut.lastHour(health.sentLastHour)}
        </span>
      </Check>

      <Check
        question={copy.reach.question}
        good={unreachable.length === 0}
        answer={
          unreachable.length === 0
            ? copy.reach.allYes(people.length)
            : copy.reach.some(unreachable.length, people.length)
        }
      >
        {unreachable.map((p) => (
          <span key={p.name}>
            <strong>{p.name}</strong>:{" "}
            {p.reach === "noContact"
              ? copy.reach.noContact
              : copy.reach.noSlack}
          </span>
        ))}
        {unreachable.some((p) => p.reach === "noContact") && (
          <span className="text-slate-500">{copy.reach.fixNoContact}</span>
        )}
        {unreachable.some((p) => p.reach === "noSlack") && (
          <span className="text-slate-500">{copy.reach.fixNoSlack}</span>
        )}
      </Check>

      <Check
        question={copy.missed.question}
        good={missedTotal === 0 && atRisk === 0}
        answer={
          missedTotal === 0 ? copy.missed.none : copy.missed.some(missedTotal)
        }
      >
        {missed.map((p) => (
          <span key={p.name}>{copy.missed.person(p.name, p.missed)}</span>
        ))}
        {atRisk > 0 && (
          <>
            <span className="font-medium text-amber-900">
              {copy.missed.atRisk(atRisk)}
            </span>
            <span className="text-slate-500">{copy.missed.atRiskHelp}</span>
          </>
        )}
      </Check>
    </div>
  );
}

function Unpinged({ data }: { data: Log }) {
  if (!data.unpinged.length) return null;
  return (
    <details className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
      <summary className="cursor-pointer font-semibold text-amber-900">
        {copy.unpinged.title(data.unpinged.length)}
      </summary>
      <p className="mt-2 text-sm text-amber-900">{copy.unpinged.help}</p>
      <ul className="mt-2 flex flex-col gap-1 text-sm text-slate-800">
        {data.unpinged.map((t, i) => (
          <li key={`${+t.at}-${i}`}>
            {time.format(t.at)} · <strong>{t.title}</strong>:{" "}
            {t.unknownNames ? copy.unpinged.unknown(t.unknownNames) : t.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

function Others({ entries }: { entries: Entry[] }) {
  const of = (k: PingKind) => entries.filter((e) => e.kind === k);
  const pres = of("presentation");
  const presReached = pres.filter((e) => e.tone === "ok").length;
  const presMissed = pres.filter((e) => e.tone === "problem");
  const coffee = of("coffee");
  const count = (list: Entry[], status: string) =>
    list.filter((e) => e.status === status).length;
  const help = of("help");
  const helpFailed = count(help, "help.notPosted");

  const row = (label: string, line: string, bad?: ReactNode) => (
    <div className="flex flex-col gap-0.5 border-t border-[#eef0f4] py-2 first:border-t-0 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 font-medium text-slate-900">{label}</span>
      <span className="flex flex-col gap-0.5 text-slate-700">
        <span>{line}</span>
        {bad}
      </span>
    </div>
  );

  return (
    <section className="rounded-2xl border border-[#d6dbe5] bg-white p-5 text-sm">
      <h2 className="mb-2 text-base font-semibold text-[#0b2238]">
        {copy.others.title}
      </h2>
      {row(
        copy.others.presentation,
        pres.length
          ? copy.others.presentationLine(presReached, pres.length)
          : copy.others.presentationNone,
        presMissed.length > 0 && (
          <span className="font-medium text-amber-900">
            {copy.others.notReached(
              presMissed.map((e) => `${e.to} (${e.about})`).join(", "),
            )}
          </span>
        ),
      )}
      {row(
        copy.others.coffee,
        coffee.length
          ? copy.others.coffeeLine(
              coffee.length,
              count(coffee, "coffee.accepted"),
              count(coffee, "coffee.pending"),
              count(coffee, "coffee.expired"),
            )
          : copy.others.coffeeNone,
      )}
      {row(
        copy.others.help,
        help.length
          ? copy.others.helpLine(
              help.length - helpFailed,
              count(help, "help.open"),
            )
          : copy.others.helpNone,
        helpFailed > 0 && (
          <span className="font-medium text-amber-900">
            {copy.others.helpFailed(helpFailed)}
          </span>
        ),
      )}
    </section>
  );
}

function People({ data }: { data: Log }) {
  if (!data.health) return null;
  const cell = "px-3 py-2";
  return (
    <details className="rounded-2xl border border-[#d6dbe5] bg-white" open>
      <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-[#0b2238]">
        {copy.people.title} ({data.health.people.length})
      </summary>
      <div className="overflow-x-auto px-2 pb-3">
        <table className="w-full text-left text-sm">
          <thead className="text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className={cell}>{copy.people.name}</th>
              <th className={cell}>{copy.people.canGet}</th>
              <th className={cell}>{copy.people.received}</th>
              <th className={cell}>{copy.people.missed}</th>
              <th className={cell}>{copy.people.upcoming}</th>
              <th className={cell}>{copy.people.next}</th>
            </tr>
          </thead>
          <tbody>
            {data.health.people.map((p) => {
              const bad = p.reach !== "ok" || p.missed > 0 || p.atRisk > 0;
              return (
                <tr
                  key={p.name}
                  className={`border-t border-[#eef0f4] ${bad ? "bg-amber-50" : ""}`}
                >
                  <td className={`${cell} font-medium text-slate-900`}>
                    {p.name}
                  </td>
                  <td className={cell}>
                    {p.reach === "ok"
                      ? copy.people.yes
                      : p.reach === "noContact"
                        ? copy.reach.noContact
                        : copy.reach.noSlack}
                  </td>
                  <td className={cell}>{p.received}</td>
                  <td
                    className={`${cell} ${p.missed ? "font-semibold text-amber-900" : ""}`}
                  >
                    {p.missed || copy.people.none}
                  </td>
                  <td className={cell}>
                    {p.upcoming}
                    {p.atRisk > 0 && (
                      <span className="ml-1 font-semibold text-amber-900">
                        {copy.people.notQueued(p.atRisk)}
                      </span>
                    )}
                  </td>
                  <td className={cell}>
                    {p.nextAt ? time.format(p.nextAt) : copy.people.none}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const GRID = "md:grid-cols-[8rem_8rem_10rem_1fr_10rem]";

function Feed({ data }: { data: Log }) {
  const [kind, setKind] = useState<PingKind | "all">("all");
  const [search, setSearch] = useState("");
  const [show, setShow] = useState<Show>("past");
  const [problemsOnly, setProblemsOnly] = useState(false);
  const now = +data.now;
  const byKind = useMemo(() => {
    const counts = new Map<PingKind, number>();
    for (const e of data.entries)
      counts.set(e.kind, (counts.get(e.kind) ?? 0) + 1);
    return counts;
  }, [data]);

  const needle = search.trim().toLowerCase();
  const scoped = data.entries.filter(
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
    <details className="rounded-2xl border border-[#d6dbe5] bg-white">
      <summary className="cursor-pointer px-5 py-4 text-base font-semibold text-[#0b2238]">
        {copy.feed.title}
      </summary>
      <div className="px-5 pb-5">
        <p className="mb-3 text-sm text-slate-600">{copy.feed.help}</p>
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

        <div className="overflow-hidden rounded-xl border border-[#d6dbe5]">
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
                  className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_STYLE[e.tone]}`}
                >
                  {copy.status[e.status] ?? e.status}
                </span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </details>
  );
}

export default function PingLogs() {
  const log = api.organizerPings.log.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const data = log.data;

  return (
    <>
      <SEO title={copy.seoTitle} description={copy.subtitle} noindex />
      <InternalPage title={copy.title} subtitle={copy.subtitle}>
        {log.isLoading && <p className="text-slate-500">{copy.loading}</p>}
        {log.error && (
          <p className="text-red-700">{copy.error(log.error.message)}</p>
        )}
        {data && (
          <>
            {data.organizerError && (
              <p className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                {copy.organizerUnavailable(data.organizerError)}
              </p>
            )}
            {data.failed.length > 0 && (
              <p className="text-sm text-amber-800">
                {copy.failed(data.failed.map((k) => copy.kinds[k]).join(", "))}
              </p>
            )}
            <HealthChecks data={data} />
            <Unpinged data={data} />
            <Others entries={data.entries} />
            <People data={data} />
            <Feed data={data} />
            <p className="text-xs text-slate-500">
              {copy.footnote} {copy.refreshed(clock.format(data.now))}
            </p>
          </>
        )}
      </InternalPage>
    </>
  );
}

export const getServerSideProps = (ctx: GetServerSidePropsContext) =>
  authRedirectOrganizer(ctx);
