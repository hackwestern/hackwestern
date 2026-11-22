import { type GetServerSidePropsContext } from "next";
import { type ReactNode, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, X } from "lucide-react";
import SEO from "~/components/seo";
import { InternalPage } from "~/components/internals/page-shell";
import { press } from "~/components/internals/interaction";
import { pingLogsCopy as copy } from "~/content/ping-logs";
import { api, type RouterOutputs } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";
import { type PingKind, type PingTone } from "~/lib/ping-log";
import {
  PING_SOURCES,
  PING_VIEWS,
  buildRows,
  chipCounts,
  filterRows,
  groupByBucket,
  healthSummary,
  minutesAway,
  nextSort,
  reachMap,
  sortRows,
  type PingBucket,
  type PingFilter,
  type PingRow,
  type PingSort,
} from "~/lib/ping-log-view";

type Log = RouterOutputs["organizerPings"]["log"];
type Entry = Log["entries"][number];

/** Rows shown before "Show more": a phone-sized page, not the whole weekend. */
const PAGE = 40;
const NO_FILTER: PingFilter = { search: "", view: "focus", source: "all" };
const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b2238] focus-visible:ring-offset-1";

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

/** A filter chip with its count: navy when on, outlined when off. */
function Chip({
  on,
  alert,
  count,
  onClick,
  children,
}: {
  on: boolean;
  /** Amber outline: this chip has problems in it. */
  alert?: boolean;
  count: number;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`inline-flex min-h-11 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold md:min-h-9 ${press} ${focusRing} ${
        on
          ? "border-[#0b2238] bg-[#0b2238] text-white"
          : alert
            ? "border-amber-400 bg-amber-50 text-amber-900"
            : "border-[#d6dbe5] bg-white text-[#0b2238] [@media(hover:hover)]:hover:bg-slate-50"
      }`}
    >
      {children}
      <span className="tabular-nums opacity-80">{count}</span>
    </button>
  );
}

/** One health question with a green or red answer. */
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
      className={`flex min-w-0 flex-col gap-1 rounded-2xl border p-4 ${
        good ? "border-emerald-200 bg-white" : "border-red-300 bg-red-50"
      }`}
    >
      <h2 className="m-0 text-sm font-medium text-[#4a5d73]">{question}</h2>
      <p className="m-0 flex items-center gap-2 text-lg font-bold text-[#0b2238]">
        <span
          aria-hidden
          className={`h-3 w-3 shrink-0 rounded-full ${good ? "bg-emerald-500" : "bg-red-500"}`}
        />
        {answer}
      </p>
      <div className="flex flex-col gap-1 break-words text-sm text-slate-700">
        {children}
      </div>
    </section>
  );
}

function SeeInList({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`mt-1 inline-flex min-h-11 items-center self-start rounded-md border border-[#0b2238] bg-white px-3 text-sm font-semibold text-[#0b2238] md:min-h-9 ${press} ${focusRing}`}
    >
      {copy.feed.seeProblems}
    </button>
  );
}

function HealthChecks({
  data,
  onSee,
}: {
  data: Log;
  onSee: (filter: PingFilter) => void;
}) {
  const { bot, health } = data;
  if (!bot || !health) return null;
  const { people, unreachable, missed, missedTotal, atRisk } = healthSummary(
    health.people,
  );
  const seeProblems = () =>
    onSee({ search: "", view: "problem", source: "organizer" });
  return (
    <div className="grid gap-3 lg:grid-cols-3">
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
          <code className="whitespace-pre-wrap break-words rounded bg-white px-2 py-1 text-xs">
            {copy.goingOut.fix}
          </code>
        )}
        <span>
          {health.nextUp
            ? copy.goingOut.next(
                clock.format(health.nextUp.at),
                health.nextUp.to,
              )
            : copy.goingOut.noNext}
        </span>
        {health.lastSent && (
          <span className="text-slate-500">
            {copy.goingOut.last(
              clock.format(health.lastSent.at),
              health.lastSent.to,
            )}
          </span>
        )}
        <span className="text-slate-500">
          {copy.goingOut.lastHour(health.sentLastHour)}
        </span>
      </Check>

      <Check
        question={copy.reach.question}
        good={unreachable.length === 0}
        answer={
          unreachable.length === 0
            ? copy.reach.allYes(people)
            : copy.reach.some(unreachable.length, people)
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
        {unreachable.length > 0 && <SeeInList onClick={seeProblems} />}
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
        {(missedTotal > 0 || atRisk > 0) && <SeeInList onClick={seeProblems} />}
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
      <ul className="mt-2 flex list-none flex-col gap-1 p-0 text-sm text-slate-800">
        {data.unpinged.map((t, i) => (
          <li key={`${+t.at}-${i}`} className="break-words">
            {time.format(t.at)} · <strong>{t.title}</strong>:{" "}
            {t.unknownNames ? copy.unpinged.unknown(t.unknownNames) : t.reason}
          </li>
        ))}
      </ul>
    </details>
  );
}

/** Coffee chats, judging times and sponsor help in one line each. */
function Hackers({ entries }: { entries: Entry[] }) {
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
    <div className="flex flex-col gap-0.5 border-t border-[#eef0f4] py-2 sm:flex-row sm:gap-4">
      <span className="w-40 shrink-0 font-medium text-slate-900">{label}</span>
      <span className="flex min-w-0 flex-col gap-0.5 break-words text-slate-700">
        <span>{line}</span>
        {bad}
      </span>
    </div>
  );

  return (
    <details className="rounded-2xl border border-[#d6dbe5] bg-white text-sm">
      <summary className="cursor-pointer px-4 py-4 text-base font-semibold text-[#0b2238]">
        {copy.hackers.title}
      </summary>
      <div className="px-4 pb-3">
        {row(
          copy.hackers.presentation,
          pres.length
            ? copy.hackers.presentationLine(presReached, pres.length)
            : copy.hackers.presentationNone,
          presMissed.length > 0 && (
            <span className="font-medium text-amber-900">
              {copy.hackers.notReached(
                presMissed.map((e) => `${e.to} (${e.about})`).join(", "),
              )}
            </span>
          ),
        )}
        {row(
          copy.hackers.coffee,
          coffee.length
            ? copy.hackers.coffeeLine(
                coffee.length,
                count(coffee, "coffee.accepted"),
                count(coffee, "coffee.pending"),
                count(coffee, "coffee.expired"),
              )
            : copy.hackers.coffeeNone,
        )}
        {row(
          copy.hackers.help,
          help.length
            ? copy.hackers.helpLine(
                help.length - helpFailed,
                count(help, "help.open"),
              )
            : copy.hackers.helpNone,
          helpFailed > 0 && (
            <span className="font-medium text-amber-900">
              {copy.hackers.helpFailed(helpFailed)}
            </span>
          ),
        )}
      </div>
    </details>
  );
}

/** Everyone with run-of-show pings, one line each; a name opens their pings. */
function People({
  data,
  onPick,
}: {
  data: Log;
  onPick: (name: string) => void;
}) {
  if (!data.health?.people.length) return null;
  return (
    <details className="rounded-2xl border border-[#d6dbe5] bg-white">
      <summary className="cursor-pointer px-4 py-4 text-base font-semibold text-[#0b2238]">
        {copy.people.title(data.health.people.length)}
      </summary>
      <p className="m-0 px-4 pb-2 text-sm text-slate-600">{copy.people.help}</p>
      <ul className="m-0 grid list-none gap-x-4 p-0 px-2 pb-3 md:grid-cols-2">
        {data.health.people.map((p) => {
          const bad = p.reach !== "ok" || p.missed > 0 || p.atRisk > 0;
          const facts = [
            copy.people.got(p.received),
            p.missed ? copy.people.missed(p.missed) : null,
            copy.people.queued(p.upcoming),
            p.atRisk ? copy.people.notQueued(p.atRisk) : null,
            p.nextAt ? copy.people.next(time.format(p.nextAt)) : null,
          ].filter(Boolean);
          return (
            <li key={p.name} className="min-w-0 border-t border-[#eef0f4]">
              <button
                type="button"
                onClick={() => onPick(p.name)}
                title={copy.people.see(p.name)}
                className={`flex min-h-11 w-full flex-col items-start gap-0.5 rounded-md px-2 py-2 text-left [@media(hover:hover)]:hover:bg-slate-50 ${focusRing} ${
                  bad ? "bg-amber-50" : ""
                }`}
              >
                <span className="break-words font-medium text-slate-900">
                  {p.name}
                </span>
                {p.reach !== "ok" && (
                  <span className="text-sm font-semibold text-amber-900">
                    {copy.people.cantGet(
                      p.reach === "noContact"
                        ? copy.reach.noContact
                        : copy.reach.noSlack,
                    )}
                  </span>
                )}
                <span
                  className={`text-sm tabular-nums ${bad ? "text-amber-900" : "text-slate-600"}`}
                >
                  {facts.join(" · ")}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </details>
  );
}

const GRID = "lg:grid-cols-[9.5rem_12rem_minmax(0,1fr)_12.5rem]";
const SORT_OPTIONS = [
  "time:desc",
  "time:asc",
  "to:asc",
  "to:desc",
  "status:asc",
  "status:desc",
] as const;

/** "in 12 min" / "12 min ago" for pings within the hour. */
function relative(at: Date, now: number): string | null {
  const minutes = minutesAway(at, now);
  if (Math.abs(minutes) >= 60) return null;
  if (minutes === 0) return copy.relative.now;
  return minutes > 0
    ? copy.relative.ahead(minutes)
    : copy.relative.ago(-minutes);
}

function Row({ row, now }: { row: PingRow; now: number }) {
  const near = relative(row.at, now);
  const source = row.group ?? copy.sources[row.sources[0] ?? "organizer"];
  const body =
    row.status === "autoPing.held" && row.detail
      ? copy.row.waitingOn(row.detail)
      : row.detail;
  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 border-b border-[#eef0f4] px-4 py-3 last:border-b-0 lg:gap-x-4 ${GRID} ${
        row.bucket === "problem" ? "bg-amber-50/60" : ""
      }`}
    >
      <span className="text-sm tabular-nums text-slate-700">
        {time.format(row.at)}
        {near && <span className="ml-1.5 text-slate-500">· {near}</span>}
      </span>
      <span className="lg:order-last">
        <span
          className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${TONE_STYLE[row.tone]}`}
        >
          {copy.status[row.status] ?? row.status}
        </span>
      </span>
      <span className="col-span-2 flex min-w-0 flex-wrap items-baseline gap-x-2 lg:col-span-1 lg:flex-col lg:flex-nowrap lg:gap-0">
        <span className="max-w-full break-words font-medium text-slate-900">
          {row.to}
        </span>
        <span className="text-xs text-slate-500">{source}</span>
      </span>
      {body ? (
        <details className="group col-span-2 min-w-0 text-sm text-slate-800 lg:col-span-1">
          <summary
            title={copy.row.toggleMessage}
            className={`flex cursor-pointer list-none items-start gap-1 rounded [&::-webkit-details-marker]:hidden ${focusRing}`}
          >
            <span className="min-w-0 break-words group-open:font-medium">
              {row.about}
            </span>
            <ChevronDown
              aria-hidden
              className="mt-0.5 size-4 shrink-0 text-slate-500 group-open:rotate-180"
            />
          </summary>
          <pre className="mb-0 mt-2 whitespace-pre-wrap break-words rounded-md bg-slate-50 p-3 font-figtree text-xs text-slate-700">
            {body}
          </pre>
        </details>
      ) : (
        <span className="col-span-2 min-w-0 break-words text-sm text-slate-800 lg:col-span-1">
          {row.about}
        </span>
      )}
    </li>
  );
}

function Feed({
  rows,
  now,
  filter,
  onFilter,
}: {
  rows: PingRow[];
  now: number;
  filter: PingFilter;
  onFilter: (filter: PingFilter) => void;
}) {
  const [sort, setSort] = useState<PingSort | null>(null);
  const [limit, setLimit] = useState(PAGE);
  const change = (next: Partial<PingFilter>) => {
    setLimit(PAGE);
    onFilter({ ...filter, ...next });
  };

  const counts = useMemo(
    () => chipCounts(rows, filter, now),
    [rows, filter, now],
  );
  const found = useMemo(
    () => sortRows(filterRows(rows, filter, now), sort, now),
    [rows, filter, sort, now],
  );
  const shown = found.slice(0, limit);
  const perBucket = useMemo(() => {
    const n: Record<PingBucket, number> = {
      problem: 0,
      upcoming: 0,
      sent: 0,
      off: 0,
    };
    for (const r of found) n[r.bucket]++;
    return n;
  }, [found]);
  const filtered =
    filter.search !== "" || filter.view !== "focus" || filter.source !== "all";
  // Matches hidden only by the Show chip: offer them instead of a dead end.
  const elsewhere = filter.view === "all" ? 0 : counts.views.all;

  const sortButton = (key: PingSort["key"], label: string) => {
    const Icon =
      sort?.key !== key
        ? ArrowUpDown
        : sort.dir === "asc"
          ? ArrowUp
          : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => setSort(nextSort(sort, key))}
        title={copy.sort.by(label)}
        className={`-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 text-left font-semibold uppercase tracking-wide [@media(hover:hover)]:hover:bg-slate-200 ${press} ${focusRing}`}
      >
        {label}
        <Icon
          aria-hidden
          className={`size-3.5 shrink-0 ${sort?.key === key ? "text-[#0b2238]" : "text-slate-400"}`}
        />
      </button>
    );
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="m-0 text-lg font-bold text-[#0b2238]">
        {copy.feed.title}
      </h2>
      <label className="flex flex-col gap-1 text-sm font-semibold text-[#0b2238]">
        {copy.search.label}
        <span className="relative flex w-full md:max-w-md">
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            className={`min-h-11 w-full min-w-0 rounded-md border border-[#d6dbe5] bg-white py-2 pl-3 pr-11 text-base font-normal text-slate-900 [&::-webkit-search-cancel-button]:hidden ${focusRing}`}
            placeholder={copy.search.placeholder}
            value={filter.search}
            onChange={(e) => change({ search: e.target.value })}
          />
          {filter.search && (
            <button
              type="button"
              aria-label={copy.search.clear}
              onClick={() => change({ search: "" })}
              className={`absolute right-0 top-0 inline-flex size-11 items-center justify-center rounded-md text-slate-500 ${focusRing}`}
            >
              <X aria-hidden className="size-4" />
            </button>
          )}
        </span>
      </label>

      <div
        role="group"
        aria-label={copy.views.label}
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 w-11 text-sm font-semibold text-[#0b2238]">
          {copy.views.label}
        </span>
        {PING_VIEWS.map((v) => (
          <Chip
            key={v}
            on={filter.view === v}
            alert={v === "problem" && counts.views.problem > 0}
            count={counts.views[v]}
            onClick={() => change({ view: v })}
          >
            {copy.views[v]}
          </Chip>
        ))}
      </div>
      <div
        role="group"
        aria-label={copy.sources.label}
        className="flex flex-wrap items-center gap-1.5"
      >
        <span className="mr-1 w-11 text-sm font-semibold text-[#0b2238]">
          {copy.sources.label}
        </span>
        <Chip
          on={filter.source === "all"}
          count={counts.allSources}
          onClick={() => change({ source: "all" })}
        >
          {copy.sources.all}
        </Chip>
        {PING_SOURCES.filter(
          (s) => counts.sources[s] > 0 || filter.source === s,
        ).map((s) => (
          <Chip
            key={s}
            on={filter.source === s}
            count={counts.sources[s]}
            onClick={() => change({ source: s })}
          >
            {copy.sources[s]}
          </Chip>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p role="status" className="m-0 text-sm tabular-nums text-slate-600">
          {copy.feed.showing(shown.length, found.length)}
          {(filtered || sort) && (
            <button
              type="button"
              onClick={() => {
                setSort(null);
                change(NO_FILTER);
              }}
              className={`ml-3 rounded font-semibold text-[#0b2238] underline underline-offset-2 ${focusRing}`}
            >
              {copy.feed.reset}
            </button>
          )}
        </p>
        {/* Phones have no column headers: a Sort by menu instead. */}
        <label className="flex min-w-0 items-center gap-2 text-sm font-semibold text-[#0b2238] lg:hidden">
          <span className="shrink-0">{copy.sort.label}</span>
          <select
            value={sort ? `${sort.key}:${sort.dir}` : ""}
            onChange={(e) => {
              const [key, dir] = e.target.value.split(":") as [
                PingSort["key"],
                PingSort["dir"],
              ];
              setSort(e.target.value ? { key, dir } : null);
            }}
            className={`min-h-11 min-w-0 rounded-md border border-[#d6dbe5] bg-white px-3 py-2 text-base font-normal text-slate-900 ${focusRing}`}
          >
            <option value="">{copy.sort.default}</option>
            {SORT_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {copy.sort[o]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-[#d6dbe5] bg-white">
        <div
          className={`hidden gap-4 border-b border-[#d6dbe5] bg-slate-50 px-4 py-2 text-xs text-slate-600 lg:grid ${GRID}`}
        >
          <span>{sortButton("time", copy.table.time)}</span>
          <span>{sortButton("to", copy.table.to)}</span>
          <span className="font-semibold uppercase tracking-wide">
            {copy.table.what}
          </span>
          <span>{sortButton("status", copy.table.status)}</span>
        </div>
        {found.length === 0 && (
          <div className="flex flex-col items-start gap-2 px-4 py-6 text-slate-600">
            <p className="m-0">
              {filtered ? copy.feed.empty : copy.feed.emptyFocus}
            </p>
            {elsewhere > 0 && (
              <button
                type="button"
                onClick={() => change({ view: "all" })}
                className={`inline-flex min-h-11 items-center rounded-md border border-[#0b2238] bg-white px-3 text-left text-sm font-semibold text-[#0b2238] md:min-h-9 ${press} ${focusRing}`}
              >
                {copy.feed.elsewhere(elsewhere)}
              </button>
            )}
          </div>
        )}
        {(sort ? [{ bucket: null, rows: shown }] : groupByBucket(shown)).map(
          (group, i) => (
            <div key={group.bucket ?? "sorted"}>
              {group.bucket && (
                <h3
                  className={`m-0 border-b border-[#eef0f4] px-4 py-1.5 text-xs font-semibold uppercase tracking-wide ${
                    group.bucket === "problem"
                      ? "bg-amber-100 text-amber-900"
                      : "bg-slate-50 text-slate-600"
                  } ${i > 0 ? "border-t border-t-[#d6dbe5]" : ""}`}
                >
                  {copy.sections[group.bucket]}{" "}
                  <span className="tabular-nums opacity-80">
                    {perBucket[group.bucket]}
                  </span>
                </h3>
              )}
              <ul className="m-0 list-none p-0">
                {group.rows.map((row) => (
                  <Row key={row.id} row={row} now={now} />
                ))}
              </ul>
            </div>
          ),
        )}
        {found.length > shown.length && (
          <div className="border-t border-[#d6dbe5] p-3">
            <button
              type="button"
              onClick={() => setLimit((n) => n + PAGE)}
              className={`inline-flex min-h-11 w-full items-center justify-center rounded-md border border-[#d6dbe5] bg-white px-3 text-sm font-semibold text-[#0b2238] [@media(hover:hover)]:hover:bg-slate-50 ${press} ${focusRing}`}
            >
              {copy.feed.more(Math.min(PAGE, found.length - shown.length))}
            </button>
          </div>
        )}
      </div>
    </section>
  );
}

export default function PingLogs() {
  const log = api.organizerPings.log.useQuery(undefined, {
    refetchInterval: 60_000,
  });
  const data = log.data;
  const [filter, setFilter] = useState<PingFilter>(NO_FILTER);
  const feed = useRef<HTMLDivElement>(null);
  const now = data ? +data.now : 0;
  const rows = useMemo(
    () =>
      data
        ? buildRows(data.entries, {
            now: +data.now,
            reach: reachMap(data.health?.people ?? []),
          })
        : [],
    [data],
  );
  /** Set the filters from a summary above or below the list, and go to it. */
  const see = (next: PingFilter) => {
    setFilter(next);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    feed.current?.scrollIntoView({
      behavior: reduce.matches ? "auto" : "smooth",
    });
  };

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
              <p className="m-0 break-words rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                {copy.organizerUnavailable(data.organizerError)}
              </p>
            )}
            {data.failed.length > 0 && (
              <p className="m-0 text-sm text-amber-800">
                {copy.failed(data.failed.map((k) => copy.kinds[k]).join(", "))}
              </p>
            )}
            <HealthChecks data={data} onSee={see} />
            <Unpinged data={data} />
            <div ref={feed} className="scroll-mt-4">
              <Feed
                rows={rows}
                now={now}
                filter={filter}
                onFilter={setFilter}
              />
            </div>
            <People
              data={data}
              onPick={(name) =>
                see({ search: name, view: "all", source: "all" })
              }
            />
            <Hackers entries={data.entries} />
            <p className="m-0 text-xs text-slate-500">
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
