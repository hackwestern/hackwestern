import {
  CARD,
  CARD_TITLE,
  MUTED,
  type QueueState,
  TD,
  TH,
  formatHold,
} from "./control-shared";

export function ControlQueueTable({
  queue,
  now,
}: {
  queue: QueueState | undefined;
  now: number;
}) {
  const teams = queue?.teams ?? [];

  return (
    <section className={CARD} aria-labelledby="queue-table-title">
      <h2 id="queue-table-title" className={CARD_TITLE}>
        Still in the queue
        {queue ? ` · ${teams.length} team${teams.length === 1 ? "" : "s"}` : ""}
      </h2>
      {!queue ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading the queue…</p>
      ) : teams.length === 0 ? (
        <p className={`m-0 text-sm ${MUTED}`}>
          No teams in the queue. Load it above to start judging.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] border-collapse text-sm">
            <thead>
              <tr className={`text-left ${MUTED}`}>
                <th className={TH}>Team</th>
                <th className={TH}>Marks</th>
                <th className={TH}>Status</th>
              </tr>
            </thead>
            <tbody>
              {teams.map((t) => (
                <tr key={t.teamId} className="border-t border-[#e3e7ef]">
                  <td className={`${TD} font-semibold`}>{t.teamName}</td>
                  <td className={`${TD} tabular-nums`}>
                    {t.seenJudges} of {t.seenJudges + t.roundsRemaining}
                  </td>
                  <td className={`${TD} tabular-nums ${MUTED}`}>
                    {t.currentJudgeId
                      ? `${t.currentJudgeName ?? "A judge"} · ${
                          t.assignedAt
                            ? formatHold(now - new Date(t.assignedAt).getTime())
                            : "just now"
                        }`
                      : "Waiting"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
