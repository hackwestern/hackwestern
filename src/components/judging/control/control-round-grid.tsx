import {
  CARD,
  CARD_TITLE,
  MUTED,
  type Progress,
  type RoundOverview,
} from "./control-shared";

type StopStatus = Progress["judges"][number]["stops"][number]["status"];

const CELL: Record<StopStatus, string> = {
  done: "border-[#8cc99a] bg-[#e3f4e6] text-[#14532d]",
  in_progress: "border-[#7aa7e6] bg-[#e4effd] text-[#123d75]",
  assigned: "border-[#d6dbe5] bg-white text-[#0b2238]",
  team_absent: "border-[#e7b4ad] bg-[#fdeceb] text-[#7a1a0f]",
  cancelled: "border-dashed border-[#d6dbe5] bg-[#f3f5f9] text-[#4a5d73]",
};

const LEGEND: { status: StopStatus; label: string }[] = [
  { status: "assigned", label: "To do" },
  { status: "in_progress", label: "Scoring now" },
  { status: "done", label: "Scored" },
  { status: "team_absent", label: "Team absent" },
];

/**
 * Every judge (rows) against every round (columns), with the team they see in
 * each. Round N is a judge's Nth stop. The open round's column is highlighted.
 */
export function ControlRoundGrid({
  progress,
  round,
}: {
  progress: Progress | undefined;
  round: RoundOverview | undefined;
}) {
  const teamAt = new Map(
    (progress?.tables ?? []).map((t) => [t.number, t.team?.name ?? null]),
  );
  const judges = (progress?.judges ?? []).filter((j) => j.stops.length > 0);
  const rounds = Math.max(
    0,
    ...judges.flatMap((j) => j.stops.map((s) => s.position)),
  );
  const current = round?.enabled && round.round > 0 ? round.round : null;

  return (
    <section className={CARD} aria-labelledby="round-grid-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="round-grid-title" className={CARD_TITLE}>
          Judges by round
          {progress ? ` · ${judges.length} judges, ${rounds} rounds` : ""}
        </h2>
        <ul className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs">
          {LEGEND.map((l) => (
            <li key={l.status} className="flex items-center gap-1.5">
              <span
                className={`size-3 rounded border ${CELL[l.status]}`}
                aria-hidden="true"
              />
              {l.label}
            </li>
          ))}
        </ul>
      </div>

      {!progress ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading…</p>
      ) : judges.length === 0 ? (
        <p className={`m-0 text-sm ${MUTED}`}>
          No judges have tables yet. Auto-assign judges first.
        </p>
      ) : (
        <div className="max-h-[70vh] overflow-auto rounded-xl border border-[#e3e7ef]">
          <table className="w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 min-w-[140px] border-b border-[#e3e7ef] bg-white px-3 py-2 text-left font-semibold">
                  Judge
                </th>
                {Array.from({ length: rounds }, (_, i) => i + 1).map((n) => (
                  <th
                    key={n}
                    scope="col"
                    aria-current={n === current ? "step" : undefined}
                    className={`sticky top-0 z-10 min-w-[120px] border-b border-[#e3e7ef] px-2 py-2 text-left font-semibold ${
                      n === current ? "bg-[#efe9fb] text-[#3f2a75]" : "bg-white"
                    }`}
                  >
                    Round {n}
                    {n === current ? " · now" : ""}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {judges.map((j) => {
                const byRound = new Map(j.stops.map((s) => [s.position, s]));
                return (
                  <tr key={j.id}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-[#eef0f5] bg-white px-3 py-1.5 text-left font-semibold"
                    >
                      <span className="block max-w-[180px] truncate">
                        {j.name}
                      </span>
                    </th>
                    {Array.from({ length: rounds }, (_, i) => i + 1).map(
                      (n) => {
                        const stop = byRound.get(n);
                        const team = stop ? teamAt.get(stop.tableNumber) : null;
                        return (
                          <td
                            key={n}
                            className={`border-b border-[#eef0f5] p-1 align-top ${
                              n === current ? "bg-[#f7f3fe]" : ""
                            }`}
                          >
                            {stop ? (
                              <div
                                className={`flex min-h-[44px] flex-col rounded-lg border px-2 py-1 ${CELL[stop.status]}`}
                                title={`${j.name}, round ${n}: table ${stop.tableNumber}${team ? ` · ${team}` : " · empty"}`}
                              >
                                <span className="line-clamp-2 text-xs font-semibold leading-tight">
                                  {team ?? "Empty table"}
                                </span>
                                <span className="text-[11px] tabular-nums opacity-70">
                                  Table {stop.tableNumber}
                                </span>
                              </div>
                            ) : (
                              <span className={`block px-2 py-1 ${MUTED}`}>
                                –
                              </span>
                            )}
                          </td>
                        );
                      },
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
