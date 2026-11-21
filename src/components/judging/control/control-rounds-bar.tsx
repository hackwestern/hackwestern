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
  const reset = api.judging.admin.resetRounds.useMutation(
    run("reset the rounds"),
  );
  const clear = api.judging.admin.clearAssignments.useMutation(
    run("clear the assignments"),
  );
  const config = api.judging.admin.setRoundConfig.useMutation(
    run("save the settings"),
  );
  const busy = [start, pause, resume, end, reset, clear, config].some(
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

  const total = Math.max(1, r.roundSeconds * 1000);
  const timePct = Math.min(100, (left / total) * 100);
  const donePct = r.stops.total
    ? Math.round((r.stops.done / r.stops.total) * 100)
    : 0;
  const urgent = shownStatus === "closed" || (open && left <= 60_000);
  const showClock = r.enabled && r.round > 0;

  return (
    <section className={CARD} aria-labelledby="rounds-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="rounds-title" className={CARD_TITLE}>
          Rounds
        </h2>
        <span
          className={`rounded-full px-3 py-1 text-xs font-bold ${
            r.enabled ? STATUS_TONE[shownStatus] : "bg-[#fff3d6] text-[#7a5200]"
          }`}
        >
          {r.enabled
            ? STATUS_LABEL[shownStatus]
            : "Rounds off · judges are free"}
        </span>
      </div>

      {r.totalRounds > 0 && r.totalRounds <= 40 && (
        <ol
          aria-label="Rounds"
          className="m-0 flex list-none flex-wrap gap-1 p-0"
        >
          {Array.from({ length: r.totalRounds }, (_, i) => {
            const n = i + 1;
            const state =
              n < r.round ||
              (n === r.round && !open && shownStatus === "closed")
                ? "past"
                : n === r.round
                  ? "now"
                  : "next";
            return (
              <li
                key={n}
                aria-current={state === "now" ? "step" : undefined}
                className={`flex size-7 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                  state === "now"
                    ? "bg-[#5b3fa0] text-white ring-2 ring-[#5b3fa0]/25"
                    : state === "past"
                      ? "bg-[#e3f4e6] text-[#1b5e2b]"
                      : "bg-[#eceff4] text-[#4a5d73]"
                }`}
              >
                {n}
              </li>
            );
          })}
        </ol>
      )}

      {showClock ? (
        <div className="grid gap-4 rounded-xl bg-[#f6f7fb] p-4 sm:grid-cols-2">
          <div className="flex flex-col gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}
            >
              Round {r.round} · time left
            </span>
            <span
              role="timer"
              className={`text-5xl font-semibold tabular-nums leading-none ${
                urgent ? "text-[#b42318]" : "text-[#0b2238]"
              }`}
            >
              {formatHold(left)}
            </span>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#dde2ec]"
              aria-hidden="true"
            >
              <div
                className={`h-full rounded-full transition-[width] duration-500 ease-linear ${
                  urgent ? "bg-[#b42318]" : "bg-[#5b3fa0]"
                } ${shownStatus === "paused" ? "opacity-50" : ""}`}
                style={{ width: `${timePct}%` }}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <span
              className={`text-xs font-semibold uppercase tracking-wide ${MUTED}`}
            >
              Judges done
            </span>
            <span className="text-5xl font-semibold tabular-nums leading-none text-[#0b2238]">
              {r.stops.done}
              <span className={`text-2xl ${MUTED}`}> / {r.stops.total}</span>
            </span>
            <div
              className="h-2 overflow-hidden rounded-full bg-[#dde2ec]"
              aria-hidden="true"
            >
              <div
                className="h-full rounded-full bg-[#1f8a3a] transition-[width] duration-500"
                style={{ width: `${donePct}%` }}
              />
            </div>
            {r.stops.inProgress > 0 && (
              <span className={`text-xs ${MUTED}`}>
                {r.stops.inProgress} scoring right now
              </span>
            )}
          </div>
        </div>
      ) : (
        <p className={`m-0 text-sm ${MUTED}`}>
          {r.enabled
            ? r.totalRounds === 0
              ? "No stops yet. Auto-assign judges first."
              : `${r.totalRounds} rounds planned. Judges are waiting for round 1.`
            : "Judges can go to any table in any order."}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-3">
        {!open && (
          <button
            type="button"
            className={`${BTN_DARK} px-6`}
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
            className={`${BTN_DARK} px-6`}
            disabled={busy}
            onClick={() => resume.mutate()}
          >
            Resume timer
          </button>
        )}
        {open && (
          <button
            type="button"
            className="min-h-11 rounded-[10px] border-[1.5px] border-[#e7b4ad] bg-white px-3.5 text-[15px] font-semibold text-[#b42318] disabled:opacity-50"
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
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[#e3e7ef] pt-3">
        <span className={`text-sm font-semibold ${MUTED}`}>Reset</span>
        <button
          type="button"
          className={BTN_OUTLINE}
          disabled={busy || r.round === 0}
          title="Back to before round 1. Scores already given are kept."
          onClick={() => {
            if (
              window.confirm(
                "Go back to before round 1? Scores already given are kept.",
              )
            )
              reset.mutate();
          }}
        >
          Rounds: back to round 1
        </button>
        <button
          type="button"
          className="min-h-11 rounded-[10px] border-[1.5px] border-[#e7b4ad] bg-white px-3.5 text-[15px] font-semibold text-[#b42318] disabled:cursor-not-allowed disabled:opacity-50"
          disabled={busy || r.judgingStarted || r.totalRounds === 0}
          title={
            r.judgingStarted
              ? "Judging has started, so the assignments are locked."
              : "Remove every judge's tables. Teams stay seated."
          }
          onClick={() => {
            if (
              window.confirm(
                "Clear every judge's tables? Teams stay seated and the rounds go back to the start. You'll need to Auto-assign judges again.",
              )
            )
              clear.mutate();
          }}
        >
          {clear.isPending ? "Clearing…" : "Assignments: clear all"}
        </button>
        {r.judgingStarted && (
          <span className={`text-xs ${MUTED}`}>
            Assignments are locked once judging starts.
          </span>
        )}
      </div>

      <details className="group rounded-xl border border-[#e3e7ef] px-4 py-2 text-sm">
        <summary
          className={`cursor-pointer select-none font-semibold ${MUTED}`}
        >
          Round settings
        </summary>
        <div className="flex flex-wrap items-end gap-x-6 gap-y-3 py-3">
          <label className={`flex flex-col gap-1 ${MUTED}`}>
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
          <label className="flex min-h-11 items-center gap-2">
            <input
              type="checkbox"
              checked={r.enabled}
              disabled={busy}
              onChange={(e) =>
                config.mutate({ roundsEnabled: e.target.checked })
              }
            />
            Judges follow the rounds
          </label>
        </div>
      </details>
      <StatusLine status={status} />
    </section>
  );
}
