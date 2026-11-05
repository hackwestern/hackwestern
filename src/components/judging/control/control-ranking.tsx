import {
  CARD,
  CARD_TITLE,
  MUTED,
  type QueueState,
  type RankingRow,
  TD,
  TH,
} from "./control-shared";

/** z-score to 2 decimals with an explicit sign; "—" when it can't be computed. */
function formatScore(raw: RankingRow["normalized_score"]): string {
  if (raw === null || raw === undefined) return "—";
  const z = Math.round(Number(raw) * 100) / 100;
  if (!Number.isFinite(z)) return "—";
  const sign = z > 0 ? "+" : z < 0 ? "−" : "";
  return `${sign}${Math.abs(z).toFixed(2)}`;
}

export function ControlRanking({
  ranking,
  queue,
}: {
  ranking: RankingRow[] | undefined;
  queue: QueueState | undefined;
}) {
  const queued = new Set(queue?.teams.map((t) => t.teamId));

  return (
    <section className={CARD} aria-labelledby="ranking-title">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="ranking-title" className={CARD_TITLE}>
          Live ranking
        </h2>
        <span className={`text-[13px] ${MUTED}`}>
          Top 3 are picked by organizers only
        </span>
      </div>
      <p className={`m-0 text-[13px] leading-[1.45] ${MUTED}`}>
        Organizer judges only. Each judge&apos;s scores are normalized
        (z-score), then averaged per team, so a strict judge and a generous one
        count the same.
      </p>
      {!ranking ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading the ranking…</p>
      ) : ranking.length === 0 ? (
        <p className="m-0 rounded-xl bg-[#eef1f6] px-4 py-3 text-sm text-[#2e4a66]">
          No marks yet. Teams show up here as soon as organizer judges score
          them.
        </p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[460px] border-collapse text-sm">
              <thead>
                <tr className={`text-left ${MUTED}`}>
                  <th className={TH}>#</th>
                  <th className={TH}>Team</th>
                  <th className={TH}>Score</th>
                  <th className={TH}>Marks</th>
                  <th className={TH}>Cheat check</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r, i) => {
                  const marks = Number(r.num_marks);
                  return (
                    <tr key={r.team_id} className="border-t border-[#e3e7ef]">
                      <td className={`${TD} font-bold`}>{i + 1}</td>
                      <td className={`${TD} font-semibold`}>{r.team_name}</td>
                      <td className={`${TD} tabular-nums`}>
                        {formatScore(r.normalized_score)}
                      </td>
                      <td className={TD}>
                        {queued.has(r.team_id) ? (
                          <span className="font-semibold text-[#8a3f05]">
                            {marks} · not final
                          </span>
                        ) : (
                          marks
                        )}
                      </td>
                      <td className={`${TD} ${MUTED}`}>Not wired yet</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className={`m-0 text-[13px] ${MUTED}`}>
            {ranking.length} team{ranking.length === 1 ? "" : "s"} ranked. A
            team is final once it has all its marks.
          </p>
        </>
      )}
    </section>
  );
}
