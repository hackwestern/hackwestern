import { useState } from "react";

import { DashboardButton } from "~/components/internals/dashboard-button";
import { card, focusRing, touch } from "~/components/judging/shared/judge-ui";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { SearchAutocomplete } from "~/components/internals/search-autocomplete";
import {
  type RoundSummary,
  type TeamResult,
} from "~/server/api/utils/team-results";

const RUBRIC = DEFAULT_RUBRIC;

const one = (n: number) => n.toFixed(1);

/** The average, plus a bar for each criterion out of 100. */
function RoundCard({ title, round }: { title: string; round: RoundSummary }) {
  return (
    <section
      aria-label={title}
      className={`${card} flex flex-col gap-4 px-5 py-4`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 text-lg font-semibold text-dashboard-text-heavy">
          {title}
        </h2>
        <span className="text-sm font-medium text-dashboard-text-light">
          {round.count} {round.count === 1 ? "judge" : "judges"}
        </span>
      </div>

      {round.average === null ? (
        <p className="m-0 text-base font-medium text-dashboard-text-light">
          No scores yet.
        </p>
      ) : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-5xl font-semibold tabular-nums text-dashboard-text-active">
              {one(round.average)}
            </span>
            <span className="text-base font-medium text-dashboard-text-light">
              average overall
            </span>
          </div>

          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {RUBRIC.criteria.map((c) => {
              const value = round.criteria[c.id];
              return (
                <li key={c.id} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-sm font-medium text-dashboard-text-heavy">
                      {c.name}
                    </span>
                    <span className="text-sm font-semibold tabular-nums text-dashboard-text-heavy">
                      {value === undefined ? "–" : one(value)}
                    </span>
                  </div>
                  <div
                    aria-hidden="true"
                    className="h-2 w-full overflow-hidden rounded-full bg-dashboard-border-default"
                  >
                    <div
                      className="h-full rounded-full bg-dashboard-action-primary"
                      style={{ width: `${value ?? 0}%` }}
                    />
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] border-collapse text-left text-sm">
              <caption className="pb-1 text-left text-sm font-semibold text-dashboard-text-light">
                Scores by judge
              </caption>
              <thead>
                <tr className="border-b border-dashboard-border-subtle text-dashboard-text-light">
                  <th scope="col" className="py-1.5 pr-3 font-semibold">
                    Judge
                  </th>
                  <th scope="col" className="px-2 py-1.5 font-semibold">
                    Overall
                  </th>
                  {RUBRIC.criteria.map((c) => (
                    <th
                      key={c.id}
                      scope="col"
                      className="px-2 py-1.5 font-semibold"
                    >
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {round.marks.map((m) => (
                  <tr
                    key={m.judgeId}
                    className="border-b border-dashboard-border-subtle last:border-b-0"
                  >
                    <th
                      scope="row"
                      className="py-1.5 pr-3 font-medium text-dashboard-text-heavy"
                    >
                      {m.judgeName}
                    </th>
                    <td className="px-2 py-1.5 font-semibold tabular-nums">
                      {Math.round(m.score)}
                    </td>
                    {RUBRIC.criteria.map((c) => (
                      <td key={c.id} className="px-2 py-1.5 tabular-nums">
                        {m.ratings[c.id] ?? "–"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {round.marks.some((m) => m.notes) && (
            <div className="flex flex-col gap-1">
              <h3 className="m-0 text-sm font-semibold text-dashboard-text-light">
                Notes
              </h3>
              <ul className="m-0 flex list-none flex-col gap-1 p-0">
                {round.marks
                  .filter((m) => m.notes)
                  .map((m) => (
                    <li
                      key={m.judgeId}
                      className="text-sm text-dashboard-text-heavy"
                    >
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

/**
 * Organizer page: goes through the teams one at a time and shows the averages
 * of all the judges' scores for each. A snapshot from page load.
 */
export function TeamResultsView({ results }: { results: TeamResult[] }) {
  const [index, setIndex] = useState(0);

  if (results.length === 0) {
    return (
      <p className="font-figtree text-base font-medium text-dashboard-text-light">
        No teams yet.
      </p>
    );
  }

  const current = results[Math.min(index, results.length - 1)]!;
  const { team } = current;
  const last = results.length - 1;

  return (
    <div className="flex flex-col gap-4 font-figtree">
      <div className="flex flex-wrap items-center gap-2">
        <DashboardButton
          type="button"
          variant="outline"
          disabled={index === 0}
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          className={`${touch} px-4 disabled:opacity-dashboard-disabled`}
        >
          Previous
        </DashboardButton>
        <SearchAutocomplete
          className="min-w-0 flex-1"
          placeholder="Search teams…"
          emptyMessage="No teams match."
          value={team.name}
          options={results.map((r, i) => ({
            id: String(i),
            label: r.team.name,
            description:
              r.team.table !== null ? `Table ${r.team.table}` : "No table",
          }))}
          onSelect={(option) => setIndex(Number(option.id))}
        />
        <DashboardButton
          type="button"
          variant="outline"
          disabled={index === last}
          onClick={() => setIndex((i) => Math.min(last, i + 1))}
          className={`${touch} px-4 disabled:opacity-dashboard-disabled`}
        >
          Next
        </DashboardButton>
      </div>

      <header className="flex flex-col gap-2">
        <p className="m-0 text-sm font-semibold tabular-nums text-dashboard-text-light">
          Team {index + 1} of {results.length}
          {team.table !== null ? ` · Table ${team.table}` : " · No table"}
        </p>
        <h1 className="m-0 text-3xl font-semibold text-dashboard-text-heavy">
          {team.name}
        </h1>
        {(team.github ?? team.devpost) && (
          <div className="flex gap-2">
            {[
              { label: "GitHub", href: team.github },
              { label: "Devpost", href: team.devpost },
            ].map((l) =>
              l.href ? (
                <DashboardButton
                  key={l.label}
                  asChild
                  variant="outline"
                  className={touch}
                >
                  <a
                    href={l.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={focusRing}
                  >
                    {l.label}
                    <span className="sr-only"> (opens in a new tab)</span>
                  </a>
                </DashboardButton>
              ) : null,
            )}
          </div>
        )}
      </header>

      <RoundCard title="Judging round" round={current.regular} />
      {current.sponsored.count > 0 && (
        <RoundCard title="Sponsor round" round={current.sponsored} />
      )}
    </div>
  );
}
