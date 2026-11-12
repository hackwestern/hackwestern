import { useState } from "react";
import { api } from "~/utils/api";
import {
  BTN_OUTLINE,
  CARD,
  CARD_TITLE,
  FIELD,
  type JudgeRow,
  MUTED,
  type QueueState,
  type Status,
  StatusLine,
  TD,
  TH,
  errorText,
  formatHold,
  judgeName,
} from "./control-shared";

export function ControlJudges({
  judges,
  queue,
  now,
  myId,
}: {
  judges: JudgeRow[] | undefined;
  queue: QueueState | undefined;
  now: number;
  myId: string | undefined;
}) {
  const utils = api.useUtils();
  const [picked, setPicked] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Status>(null);
  const assign = api.judging.admin.assignJudgeForTeam.useMutation();

  const teams = queue?.teams ?? [];
  const holdByJudge = new Map(
    teams.flatMap((t) =>
      t.currentJudgeId ? [[t.currentJudgeId, t] as const] : [],
    ),
  );
  const waiting = teams.filter((t) => !t.currentJudgeId);

  // Organizers first, then sponsors; by name so rows don't jump between polls.
  const rows = [...(judges ?? [])].sort(
    (a, b) =>
      (a.type === b.type ? 0 : a.type === "organizer" ? -1 : 1) ||
      judgeName(a).localeCompare(judgeName(b)),
  );

  return (
    <section className={CARD} aria-labelledby="judges-title">
      <h2 id="judges-title" className={CARD_TITLE}>
        Judges
      </h2>
      {!judges ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading judges…</p>
      ) : rows.length === 0 ? (
        <p className={`m-0 text-sm ${MUTED}`}>
          No judges yet. Add one below with their account email.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className={`text-left ${MUTED}`}>
                <th className={TH}>Judge</th>
                <th className={TH}>Marks</th>
                <th className={TH}>Judging now</th>
                <th className={TH}>Send a team</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((j) => {
                const name = judgeName(j);
                const hold = holdByJudge.get(j.id);
                // Sponsor judges only score teams in their own tracks.
                const options =
                  j.type === "sponsored"
                    ? waiting.filter((t) =>
                        t.tracks?.some((tr) => j.track?.includes(tr)),
                      )
                    : waiting;
                const choice = options.find((t) => t.teamId === picked[j.id])
                  ? picked[j.id]!
                  : (options[0]?.teamId ?? "");
                const sending =
                  assign.isPending && assign.variables?.judgeId === j.id;

                return (
                  <tr key={j.id} className="border-t border-[#e3e7ef]">
                    <td className={TD}>
                      <div className="flex flex-col gap-0.5">
                        <span className="font-semibold">
                          {name}
                          {j.id === myId ? " (you)" : ""}
                        </span>
                        <span className={`text-xs ${MUTED}`}>
                          {j.type === "organizer"
                            ? "Organizer"
                            : `Sponsor · ${j.track?.join(", ") ?? "no track"}`}
                        </span>
                      </div>
                    </td>
                    <td className={`${TD} font-semibold tabular-nums`}>
                      {j.marksCount}
                    </td>
                    <td className={TD}>
                      {hold ? (
                        <>
                          <span className="font-semibold">{hold.teamName}</span>
                          <span
                            className={`whitespace-nowrap tabular-nums ${MUTED}`}
                          >
                            {" "}
                            ·{" "}
                            {hold.assignedAt
                              ? formatHold(
                                  now - new Date(hold.assignedAt).getTime(),
                                )
                              : "just now"}
                          </span>
                        </>
                      ) : (
                        <span className="rounded-full bg-[#e4effd] px-2 py-1 text-xs font-bold text-[#123d75]">
                          Free
                        </span>
                      )}
                    </td>
                    <td className={TD}>
                      <div className="flex gap-1.5">
                        <select
                          aria-label={`Team to send to ${name}`}
                          className={`${FIELD} max-w-[180px] text-sm`}
                          value={choice}
                          disabled={options.length === 0}
                          onChange={(e) =>
                            setPicked((p) => ({ ...p, [j.id]: e.target.value }))
                          }
                        >
                          {options.length === 0 ? (
                            <option value="">No teams waiting</option>
                          ) : (
                            options.map((t) => (
                              <option key={t.teamId} value={t.teamId}>
                                {t.teamName}
                              </option>
                            ))
                          )}
                        </select>
                        <button
                          type="button"
                          className={`${BTN_OUTLINE} text-sm`}
                          disabled={!choice || assign.isPending}
                          onClick={() => {
                            const team = options.find(
                              (t) => t.teamId === choice,
                            );
                            if (!team) return;
                            setStatus(null);
                            assign.mutate(
                              { judgeId: j.id, teamId: team.teamId },
                              {
                                onSuccess: () => {
                                  setStatus({
                                    tone: "ok",
                                    text: `Sent ${team.teamName} to ${name}.`,
                                  });
                                  void utils.judging.admin.invalidate();
                                },
                                onError: (e) =>
                                  setStatus({
                                    tone: "error",
                                    text: `Couldn't send ${team.teamName} to ${name}. ${errorText(e)}`,
                                  }),
                              },
                            );
                          }}
                        >
                          {sending ? "Sending…" : "Send"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <StatusLine status={status} />
      <p className={`m-0 text-[13px] ${MUTED}`}>
        Send overrides the queue: use it when a judge is free and a team is
        waiting, or to swap a long hold.
      </p>
    </section>
  );
}
