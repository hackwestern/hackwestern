import { useState } from "react";
import { api } from "~/utils/api";
import {
  BTN_DARK,
  BTN_OUTLINE,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type QueueState,
  type Status,
  StatusLine,
  errorText,
} from "./control-shared";

export function ControlQueue({ queue }: { queue: QueueState | undefined }) {
  const utils = api.useUtils();
  const [rounds, setRounds] = useState(3);
  const [confirmPurge, setConfirmPurge] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  const load = api.judging.admin.loadQueue.useMutation({
    onSuccess: ({ added }) => {
      setStatus({
        tone: "ok",
        text:
          added > 0
            ? `Added ${added} team${added === 1 ? "" : "s"} to the queue, ${rounds} marks each.`
            : queue?.submittedTeams === 0
              ? "No teams added: nobody has submitted a project yet."
              : "No teams added: every submitted team is already in the queue.",
      });
      void utils.judging.admin.invalidate();
    },
    onError: (e) =>
      setStatus({
        tone: "error",
        text: `Couldn't load the queue. ${errorText(e)}`,
      }),
  });

  const purge = api.judging.admin.purgeQueue.useMutation({
    onSuccess: () => {
      setConfirmPurge(false);
      setStatus({
        tone: "ok",
        text: "Queue purged. Marks are untouched; load the queue again to restart.",
      });
      void utils.judging.admin.invalidate();
    },
    onError: (e) =>
      setStatus({
        tone: "error",
        text: `Couldn't purge the queue. ${errorText(e)}`,
      }),
  });

  const queued = queue?.teams.length ?? 0;
  const pill = !queue
    ? "Loading…"
    : queued > 0
      ? `Loaded · ${queued} team${queued === 1 ? "" : "s"} in queue`
      : "Empty: load it to start judging";

  return (
    <section className={CARD} aria-labelledby="queue-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="queue-title" className={CARD_TITLE}>
            Queue
          </h2>
          <span className="rounded-full bg-[#ece7f7] px-2.5 py-1.5 text-[13px] font-semibold text-[#3f2a75]">
            {pill}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label htmlFor="rounds" className={`text-sm ${MUTED}`}>
            Marks per team
          </label>
          <select
            id="rounds"
            className={FIELD}
            value={rounds}
            onChange={(e) => setRounds(Number(e.target.value))}
          >
            {[1, 2, 3, 4, 5].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <button
            type="button"
            className={BTN_DARK}
            disabled={load.isPending}
            onClick={() => {
              setConfirmPurge(false);
              load.mutate({ roundsPerTeam: rounds });
            }}
          >
            {load.isPending ? "Loading…" : "Load queue"}
          </button>
          <button
            type="button"
            className="min-h-11 rounded-[10px] border-[1.5px] border-[#b42318] bg-white px-4 text-[15px] font-bold text-[#a1200f]"
            aria-expanded={confirmPurge}
            onClick={() => {
              setStatus(null);
              setConfirmPurge(true);
            }}
          >
            Purge queue
          </button>
        </div>
      </div>
      <p className={`m-0 text-sm ${MUTED}`}>
        Load adds every submitted team that isn&apos;t already in the queue.
        Judges get whichever team has the fewest marks.
      </p>
      {confirmPurge && (
        <div
          role="alertdialog"
          aria-labelledby="purge-warning"
          className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#fdecea] px-4 py-3.5 text-[#7a1a0f]"
        >
          <span id="purge-warning" className="text-[15px] font-medium">
            Purging removes every team from the queue and takes their current
            team away from each judge. Submitted marks stay.
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-11 rounded-[10px] bg-[#a1200f] px-4 text-[15px] font-bold text-white disabled:opacity-50"
              disabled={purge.isPending}
              onClick={() => purge.mutate()}
            >
              {purge.isPending ? "Purging…" : "Purge"}
            </button>
            <button
              type="button"
              className={BTN_OUTLINE}
              onClick={() => setConfirmPurge(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
      <StatusLine status={status} />
    </section>
  );
}
