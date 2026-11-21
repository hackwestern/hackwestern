import { useEffect, useState } from "react";
import { api } from "~/utils/api";
import {
  BTN_DARK,
  BTN_OUTLINE,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type Status,
  StatusLine,
  errorText,
  formatHold,
} from "./control-shared";

const STATUS_LABEL = {
  idle: "Not started",
  running: "Running",
  paused: "Paused",
  closed: "Time's up",
} as const;

const STATUS_TONE = {
  idle: "bg-[#eceff4] text-[#4a5d73]",
  running: "bg-[#e4effd] text-[#123d75]",
  paused: "bg-[#fff3d6] text-[#7a5200]",
  closed: "bg-[#fdecea] text-[#7a1a0f]",
} as const;

/**
 * The timed rounds. Round N is every judge's Nth stop. Judges can only score
 * the current round while its timer runs; at 0 the round closes and an
 * organizer starts the next one here.
 */
export function ControlRoundsBar({ now }: { now: number }) {
  const utils = api.useUtils();
  const roundQ = api.judging.admin.getRound.useQuery(undefined, {
    refetchInterval: 3000,
  });
  const [status, setStatus] = useState<Status>(null);
  const [minutes, setMinutes] = useState("10");

  const r = roundQ.data;
  useEffect(() => {
    if (r) setMinutes(String(Math.round(r.roundSeconds / 60)));
  }, [r?.roundSeconds]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = (what: string) => ({
    onSuccess: () => {
      setStatus(null);
      void utils.judging.admin.invalidate();
    },
    onError: (e: { message: string }) =>
      setStatus({ tone: "error", text: `Couldn't ${what}. ${errorText(e)}` }),
  });
  const start = api.judging.admin.startRound.useMutation(
    run("start the round"),
  );
  const pause = api.judging.admin.pauseRound.useMutation(
    run("pause the round"),
  );
  const resume = api.judging.admin.resumeRound.useMutation(
    run("resume the round"),
  );
  const end = api.judging.admin.endRound.useMutation(run("end the round"));
  const reset = api.judging.admin.resetRounds.useMutation(run("reset"));
  const config = api.judging.admin.setRoundConfig.useMutation(
    run("save the settings"),
  );
  const busy = [start, pause, resume, end, reset, config].some(
    (m) => m.isPending,
  );

  if (!r) {
    return (
      <section className={CARD} aria-labelledby="rounds-title">
        <h2 id="rounds-title" className={CARD_TITLE}>
          Rounds
        </h2>
        <p className={`m-0 text-sm ${MUTED}`}>Loading…</p>
      </section>
    );
  }

  // Count down against the server's clock, not this device's.
  const skew = r.serverNow.getTime() - roundQ.dataUpdatedAt;
  const left =
    r.status === "running" && r.endsAt
      ? Math.max(0, r.endsAt.getTime() - (now + skew))
      : (r.remainingMs ?? 0);
  // A running timer that reached 0 here is closed, even before the next poll.
  const shownStatus =
    r.status === "running" && left === 0 ? "closed" : r.status;
  const open = shownStatus === "running" || shownStatus === "paused";
  const next = r.round + 1;
  const noMore = next > r.totalRounds;

  return (
    <section className={CARD} aria-labelledby="rounds-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rounds-title" className={CARD_TITLE}>
          Rounds
          {r.totalRounds > 0
            ? ` · ${r.round === 0 ? "none yet" : `round ${r.round}`} of ${r.totalRounds}`
            : ""}
        </h2>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_TONE[shownStatus]}`}
        >
          {r.enabled ? STATUS_LABEL[shownStatus] : "Rounds off: judges free"}
        </span>
      </div>

      {r.enabled && r.round > 0 && (
        <div className="flex flex-wrap items-baseline gap-x-6 gap-y-1">
          <span
            className="text-5xl font-semibold tabular-nums text-[#0b2238]"
            aria-label="Time left in the round"
          >
            {formatHold(left)}
          </span>
          <span className={`text-sm ${MUTED}`}>
            {r.stops.done} of {r.stops.total} judges done
            {r.stops.inProgress > 0
              ? ` · ${r.stops.inProgress} scoring now`
              : ""}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        {!open && (
          <button
            type="button"
            className={BTN_DARK}
            disabled={busy || !r.enabled || noMore || r.totalRounds === 0}
            onClick={() => start.mutate()}
          >
            {start.isPending
              ? "Starting…"
              : noMore && r.totalRounds > 0
                ? "All rounds done"
                : `Start round ${next}`}
          </button>
        )}
        {shownStatus === "running" && (
          <button
            type="button"
            className={BTN_OUTLINE}
            disabled={busy}
            onClick={() => pause.mutate()}
          >
            Pause timer
          </button>
        )}
        {shownStatus === "paused" && (
          <button
            type="button"
            className={BTN_DARK}
            disabled={busy}
            onClick={() => resume.mutate()}
          >
            Resume timer
          </button>
        )}
        {open && (
          <button
            type="button"
            className={BTN_OUTLINE}
            disabled={busy}
            onClick={() => {
              if (
                window.confirm(
                  `End round ${r.round} now? Judges can't submit any more scores in it.`,
                )
              )
                end.mutate();
            }}
          >
            End round now
          </button>
        )}

        <label className={`ml-auto flex flex-col gap-1 text-sm ${MUTED}`}>
          Minutes per round
          <span className="flex gap-1.5">
            <input
              type="number"
              min={1}
              max={60}
              className={`${FIELD} w-20`}
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
            />
            <button
              type="button"
              className={BTN_OUTLINE}
              disabled={
                busy ||
                Number(minutes) * 60 === r.roundSeconds ||
                !(Number(minutes) >= 1)
              }
              onClick={() =>
                config.mutate({
                  roundSeconds: Math.round(Number(minutes) * 60),
                })
              }
            >
              Save
            </button>
          </span>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={r.enabled}
            disabled={busy}
            onChange={(e) => config.mutate({ roundsEnabled: e.target.checked })}
          />
          Judges follow the rounds
        </label>
        <button
          type="button"
          className="text-[#4a5d73] underline disabled:opacity-50"
          disabled={busy || r.round === 0}
          onClick={() => {
            if (
              window.confirm(
                "Go back to before round 1? Scores already given are kept.",
              )
            )
              reset.mutate();
          }}
        >
          Reset to before round 1
        </button>
      </div>
      <StatusLine status={status} />
    </section>
  );
}
