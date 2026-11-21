import { useMemo, useState } from "react";

import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { api } from "~/utils/api";
import {
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type QueueState,
  TD,
  TH,
} from "./control-shared";

const one = (n: number) => n.toFixed(1);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/**
 * Look back at a finished (or running) round. The engine stores no round, so
 * round N is each team's Nth mark in the order they were submitted, the same
 * rule the progress tiles use.
 */
export function ControlRounds({ queue }: { queue: QueueState | undefined }) {
  const total = queue?.round.total ?? 3;
  const currentRound = queue?.round.current ?? 1;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<number | "all">(currentRound);
  const round = picked === "all" ? "all" : Math.min(picked, total);

  const resultsQ = api.judging.admin.getTeamResults.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const rows = useMemo(() => {
    const out: {
      teamId: string;
      team: string;
      table: number | null;
      round: number;
      judge: string;
      score: number;
      ratings: Record<string, number>;
    }[] = [];
    for (const r of resultsQ.data ?? []) {
      r.regular.marks.forEach((m, i) => {
        out.push({
          teamId: r.team.id,
          team: r.team.name,
          table: r.team.table,
          round: i + 1,
          judge: m.judgeName,
          score: m.score,
          ratings: m.ratings,
        });
      });
    }
    return out;
  }, [resultsQ.data]);

  const q = query.trim().toLowerCase();
  const inRound = rows.filter((r) => round === "all" || r.round === round);
  const shown = inRound
    .filter(
      (r) =>
        !q ||
        r.team.toLowerCase().includes(q) ||
        r.judge.toLowerCase().includes(q) ||
        String(r.table ?? "") === q.replace(/^table\s*/, ""),
    )
    // By round, then best score first.
    .sort(
      (a, b) =>
        a.round - b.round || b.score - a.score || a.team.localeCompare(b.team),
    );
  const teamsInRound = new Set(shown.map((r) => r.teamId)).size;

  return (
    <section className={CARD} aria-labelledby="rounds-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 id="rounds-title" className={CARD_TITLE}>
            Round history
          </h2>
          <p className={`m-0 text-sm ${MUTED}`}>
            Round N is each team&apos;s Nth judge to score it.
          </p>
        </div>
        <div role="group" aria-label="Round" className="flex flex-wrap gap-1">
          {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
            <button
              key={n}
              type="button"
              aria-pressed={round === n}
              onClick={() => setPicked(n)}
              className={`min-h-10 rounded-lg px-3.5 text-[15px] font-bold ${
                round === n
                  ? "bg-[#5b3fa0] text-white"
                  : "border border-[#c3cad8] bg-white text-[#4a5d73]"
              }`}
            >
              Round {n}
              {n === currentRound ? " (now)" : ""}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={round === "all"}
            onClick={() => setPicked("all")}
            className={`min-h-10 rounded-lg px-3.5 text-[15px] font-bold ${
              round === "all"
                ? "bg-[#5b3fa0] text-white"
                : "border border-[#c3cad8] bg-white text-[#4a5d73]"
            }`}
          >
            All
          </button>
        </div>
      </div>

      {resultsQ.isLoading ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading…</p>
      ) : resultsQ.isError ? (
        <p role="alert" className="m-0 text-sm text-[#7a1a0f]">
          Couldn&apos;t load round data.
        </p>
      ) : inRound.length === 0 ? (
        <p className="m-0 rounded-xl bg-[#eef1f6] px-4 py-3 text-sm text-[#2e4a66]">
          No scores in {round === "all" ? "any round" : `round ${round}`} yet.
        </p>
      ) : (
        <>
          <input
            aria-label="Search rounds"
            placeholder="Search team, judge or table…"
            className={`${FIELD} w-full px-3 sm:max-w-xs`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <dl className="m-0 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { label: "Teams scored", value: String(teamsInRound) },
              { label: "Marks", value: String(shown.length) },
              {
                label: "Average score",
                value: one(mean(shown.map((r) => r.score))),
              },
              {
                label: "Highest",
                value: one(Math.max(...shown.map((r) => r.score))),
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

          {shown.length === 0 ? (
            <p className={`m-0 text-sm ${MUTED}`}>No marks match.</p>
          ) : (
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full min-w-[640px] border-collapse text-sm">
                <thead>
                  <tr className={`sticky top-0 bg-white text-left ${MUTED}`}>
                    <th className={TH}>Team</th>
                    <th className={TH}>Table</th>
                    {round === "all" && <th className={TH}>Round</th>}
                    <th className={TH}>Judge</th>
                    <th className={TH}>Score</th>
                    {DEFAULT_RUBRIC.criteria.map((c) => (
                      <th key={c.id} className={TH}>
                        {c.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((r) => (
                    <tr
                      key={`${r.teamId}-${r.round}`}
                      className="border-t border-[#e3e7ef]"
                    >
                      <td className={`${TD} font-semibold`}>{r.team}</td>
                      <td className={`${TD} tabular-nums`}>{r.table ?? "–"}</td>
                      {round === "all" && (
                        <td className={`${TD} tabular-nums`}>{r.round}</td>
                      )}
                      <td className={TD}>{r.judge}</td>
                      <td className={`${TD} font-semibold tabular-nums`}>
                        {one(r.score)}
                      </td>
                      {DEFAULT_RUBRIC.criteria.map((c) => (
                        <td key={c.id} className={`${TD} tabular-nums`}>
                          {r.ratings[c.id] ?? "–"}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </section>
  );
}
