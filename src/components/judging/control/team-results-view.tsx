import { useState } from "react";

import { BTN_OUTLINE, CARD, FIELD, MUTED } from "./control-shared";
import { api } from "~/utils/api";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { SearchAutocomplete } from "~/components/internals/search-autocomplete";
import {
  type RoundSummary,
  type TeamResult,
} from "~/server/api/utils/team-results";

const RUBRIC = DEFAULT_RUBRIC;

const one = (n: number) => n.toFixed(1);

/** The average, plus a bar for each criterion out of 10. */
function RoundCard({ title, round }: { title: string; round: RoundSummary }) {
  return (
    <section aria-label={title} className={`${CARD} gap-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-bold text-[#0b2238]">{title}</h2>
        <span className="text-sm font-medium text-[#4a5d73]">
          {round.count} {round.count === 1 ? "judge" : "judges"}
        </span>
      </div>

      {round.average === null ? (
        <p className="m-0 text-base font-medium text-[#4a5d73]">
          No scores yet.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold tabular-nums text-[#5b3fa0]">
              {one(round.average)}
            </span>
            <span className="text-base font-medium text-[#4a5d73]">
              raw average
            </span>
          </div>

          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {RUBRIC.criteria.map((c) => {
              const value = round.criteria[c.id];
              return (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-[#0b2238]">
                      {c.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-[#0b2238]">
                      {value === undefined ? "–" : one(value)}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-2 w-full overflow-hidden rounded-full bg-[#e3e7ef]"
                  >
                    <div
                      className="h-full rounded-full bg-[#5b3fa0]"
                      style={{ width: `${((value ?? 0) / 10) * 100}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          {round.marks.some((m) => m.notes) && (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-sm font-semibold text-[#4a5d73]">
                Notes
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {round.marks
                  .filter((m) => m.notes)
                  .map((m) => (
                    <li key={m.judgeId} className="text-sm text-[#0b2238]">
                      <span className="font-semibold">{m.judgeName}:</span>{" "}
                      {m.notes}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  );
}

const TOP_N = 10;
const COUNT_METRICS = new Set(["judges", "superlikes"]);

type Metric = {
  id: string;
  label: string;
  of: (r: TeamResult) => number | null;
};
const METRICS: Metric[] = [
  {
    id: "normalized",
    label: "Normalized score",
    of: (r) => r.team.normalized ?? null,
  },
  {
    id: "adventure",
    label: "Adventure score",
    of: (r) => r.team.adventure ?? null,
  },
  { id: "overall", label: "Raw average", of: (r) => r.regular.average },
  { id: "superlikes", label: "Super likes", of: (r) => r.team.superLikes ?? 0 },
  ...RUBRIC.criteria.map((c) => ({
    id: c.id,
    label: c.name,
    of: (r: TeamResult) => r.regular.criteria[c.id] ?? null,
  })),
  { id: "judges", label: "Judges scored", of: (r) => r.regular.count },
];

/** Link preview of the team's Devpost (Devpost blocks framing, so no iframe). */
function DevpostPreviewCard({
  teamId,
  href,
}: {
  teamId: string;
  href: string;
}) {
  const q = api.judging.admin.getDevpostPreview.useQuery(
    { teamId },
    { staleTime: 5 * 60_000 },
  );
  const p = q.data;
  const failed = !q.isLoading && !p?.title;
  return (
    <section
      aria-label="Devpost preview"
      className="flex min-w-0 flex-col overflow-hidden rounded-2xl border border-[#d6dbe5] bg-white"
    >
      {q.isLoading ? (
        <div className="h-44 animate-pulse bg-[#eef0f6]" aria-hidden="true" />
      ) : p?.image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={p.image}
          alt=""
          referrerPolicy="no-referrer"
          className="h-44 w-full bg-[#eef0f6] object-cover"
        />
      ) : null}
      <div className="flex flex-col gap-2 p-4 sm:p-5">
        <span className="text-xs font-bold uppercase tracking-wide text-[#5b3fa0]">
          Devpost
        </span>
        {q.isLoading ? (
          <p className={`m-0 text-sm ${MUTED}`}>Loading preview…</p>
        ) : (
          <>
            <p className="m-0 text-lg font-bold text-[#0b2238]">
              {p?.title ?? "No preview available"}
            </p>
            {p?.description && (
              <p className={`m-0 text-sm leading-relaxed ${MUTED}`}>
                {p.description}
              </p>
            )}
            {failed && (
              <p className={`m-0 text-sm ${MUTED}`}>
                Devpost didn&apos;t return a preview. The project may be private
                or the link may be wrong.
              </p>
            )}
          </>
        )}
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className={`${BTN_OUTLINE} mt-1 inline-flex w-fit items-center no-underline`}
        >
          Open on Devpost
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      </div>
    </section>
  );
}

const MEDAL = [
  "bg-[#f5c542] text-[#4a3500]",
  "bg-[#cfd6e0] text-[#2c3e55]",
  "bg-[#e0a878] text-[#4a2a0c]",
];

/**
 * Organizer page: the top teams by a chosen metric, and a detail view (scores
 * and Devpost) for whichever team is selected. A snapshot from page load.
 */
export function TeamResultsView({ results }: { results: TeamResult[] }) {
  const [metricId, setMetricId] = useState("normalized");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (results.length === 0) {
    return (
      <p className="font-figtree text-base font-medium text-[#4a5d73]">
        No teams yet.
      </p>
    );
  }

  const metric = METRICS.find((m) => m.id === metricId) ?? METRICS[0]!;
  const ranked = results
    .flatMap((r) => {
      const v = metric.of(r);
      return v === null || r.regular.count === 0 ? [] : [{ r, v }];
    })
    // Ties (the top teams can all cap at 10.0) break on the value before the
    // cap, then by name.
    .sort(
      (a, b) =>
        b.v - a.v ||
        (metric.id === "normalized"
          ? (b.r.team.normalizedQ ?? -Infinity) -
              (a.r.team.normalizedQ ?? -Infinity) || 0
          : 0) ||
        a.r.team.name.localeCompare(b.r.team.name),
    )
    .slice(0, TOP_N);

  const current =
    results.find((r) => r.team.id === selectedId) ??
    ranked[0]?.r ??
    results[0]!;
  const { team } = current;
  const fmt = (v: number) =>
    COUNT_METRICS.has(metric.id) ? String(v) : one(v);
  const max = COUNT_METRICS.has(metric.id)
    ? Math.max(1, ...ranked.map((x) => x.v))
    : 10;

  return (
    <div className="flex flex-col gap-4 font-figtree">
      <section aria-labelledby="top-teams" className={CARD}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="top-teams" className="m-0 text-lg font-bold">
              Top {TOP_N} teams
            </h2>
            <p className={`m-0 text-sm ${MUTED}`}>
              Pick a team to see its scores and Devpost.
            </p>
          </div>
          <label className={`flex items-center gap-2 text-sm ${MUTED}`}>
            Rank by
            <select
              className={`${FIELD} text-sm`}
              value={metric.id}
              onChange={(e) => setMetricId(e.target.value)}
            >
              {METRICS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>
        {ranked.length === 0 ? (
          <p className={`m-0 text-sm ${MUTED}`}>No scores yet.</p>
        ) : (
          <ol className="m-0 flex list-none flex-col gap-1.5 p-0">
            {ranked.map(({ r, v }, i) => {
              const active = r.team.id === team.id;
              return (
                <li key={r.team.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.team.id)}
                    aria-current={active}
                    className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors ${
                      active
                        ? "border-[#5b3fa0] bg-[#f4f1fb]"
                        : "border-transparent hover:bg-[#f6f7fb]"
                    }`}
                  >
                    <span
                      className={`flex size-7 shrink-0 items-center justify-center rounded-full text-sm font-bold tabular-nums ${
                        MEDAL[i] ?? "bg-[#eef0f6] text-[#4a5d73]"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col gap-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-semibold text-[#0b2238]">
                          {r.team.name}
                        </span>
                        <span className={`shrink-0 text-xs ${MUTED}`}>
                          {r.team.table !== null
                            ? `Table ${r.team.table}`
                            : "No table"}
                          {" · "}
                          {r.regular.count}{" "}
                          {r.regular.count === 1 ? "judge" : "judges"}
                          {metric.id === "normalized" &&
                          r.team.normalizedQ != null
                            ? ` · before cap ${r.team.normalizedQ.toFixed(2)}`
                            : ""}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-1.5 w-full overflow-hidden rounded-full bg-[#e3e7ef]"
                      >
                        <span
                          className="block h-full rounded-full bg-[#5b3fa0]"
                          style={{
                            width: `${Math.min(100, (v / max) * 100)}%`,
                          }}
                        />
                      </span>
                    </span>
                    <span className="w-12 shrink-0 text-right text-lg font-semibold tabular-nums text-[#5b3fa0]">
                      {fmt(v)}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="flex flex-col gap-3 rounded-2xl border border-[#d6dbe5] bg-white p-4 sm:p-5">
        <SearchAutocomplete
          className="min-w-0"
          placeholder="Search any team…"
          emptyMessage="No teams match."
          value={team.name}
          options={results.map((r) => ({
            id: r.team.id,
            label: r.team.name,
            description:
              r.team.table !== null ? `Table ${r.team.table}` : "No table",
          }))}
          onSelect={(option) => setSelectedId(option.id)}
        />
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="m-0 text-sm font-semibold text-[#4a5d73]">
              {team.table !== null ? `Table ${team.table}` : "No table"}
            </p>
            <h1 className="m-0 text-3xl font-semibold text-[#0b2238]">
              {team.name}
            </h1>
          </div>
          {team.github && (
            <a
              href={team.github}
              target="_blank"
              rel="noopener noreferrer"
              className={`${BTN_OUTLINE} inline-flex items-center no-underline`}
            >
              GitHub
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          )}
        </header>
        <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            {
              label: "Normalized",
              value: team.normalized == null ? "–" : one(team.normalized),
            },
            {
              label: "Adventure",
              value: team.adventure == null ? "–" : one(team.adventure),
            },
            { label: "Super likes", value: String(team.superLikes ?? 0) },
            {
              label: "Raw average",
              value:
                current.regular.average === null
                  ? "–"
                  : one(current.regular.average),
            },
          ].map((t) => (
            <div
              key={t.label}
              className="flex flex-col gap-0.5 rounded-xl bg-[#f6f7fb] px-3 py-2"
            >
              <dt className={`text-xs font-semibold ${MUTED}`}>{t.label}</dt>
              <dd className="m-0 text-2xl font-semibold tabular-nums text-[#5b3fa0]">
                {t.value}
              </dd>
            </div>
          ))}
        </dl>
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <RoundCard title="Judging round" round={current.regular} />
        {team.devpost ? (
          <DevpostPreviewCard
            key={team.id}
            teamId={team.id}
            href={team.devpost}
          />
        ) : (
          <section className={CARD}>
            <h2 className="m-0 text-lg font-bold">Devpost</h2>
            <p className={`m-0 text-sm ${MUTED}`}>
              This team hasn&apos;t added a Devpost link.
            </p>
          </section>
        )}
      </div>
    </div>
  );
}
