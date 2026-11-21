import { type ReactNode } from "react";
import {
  LONG_HOLD_MS,
  type JudgeRow,
  MUTED,
  type QueueState,
  type RoundOverview,
  formatHold,
} from "./control-shared";

const ROUND_STATUS = {
  idle: "Waiting to start",
  running: "Running",
  paused: "Paused",
  closed: "Time's up",
} as const;

function Tile({
  label,
  value,
  warn = false,
  children,
}: {
  label: string;
  value: string;
  warn?: boolean;
  children?: ReactNode;
}) {
  return (
    <div
      className={`flex min-w-0 flex-col gap-2 rounded-2xl bg-white p-[18px] ${
        warn ? "border-[1.5px] border-[#b4570b]" : "border border-[#d6dbe5]"
      }`}
    >
      <span className={`text-sm ${warn ? "text-[#8a3f05]" : MUTED}`}>
        {label}
      </span>
      <span className="text-[30px] font-bold tabular-nums leading-tight">
        {value}
      </span>
      {children}
    </div>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div aria-hidden className="h-2 overflow-hidden rounded-full bg-[#e3e7ef]">
      <div className="h-2 bg-[#5b3fa0]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ControlProgress({
  queue,
  judges,
  round: timed,
  now,
}: {
  queue: QueueState | undefined;
  judges: JudgeRow[] | undefined;
  /** The timed rounds. Rounds off or not loaded: the tile falls back to the old count. */
  round: RoundOverview | undefined;
  now: number;
}) {
  if (!queue || !judges) {
    return (
      <section
        aria-label="Progress"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
      >
        {[
          "Judging round",
          "Teams fully judged",
          "Marks submitted",
          "Judges",
          "Longest hold",
        ].map((label) => (
          <Tile key={label} label={label} value="…" />
        ))}
      </section>
    );
  }

  const queued = queue.teams.length;
  // An empty queue with no marks means judging hasn't started, not that
  // every team is done.
  const fullyJudged =
    queued === 0 && queue.regularMarks === 0
      ? 0
      : Math.max(0, queue.submittedTeams - queued);
  const remaining = queue.teams.reduce((n, t) => n + t.roundsRemaining, 0);
  const marksTotal = queue.regularMarks + remaining;

  const holders = new Set(
    queue.teams.flatMap((t) => (t.currentJudgeId ? [t.currentJudgeId] : [])),
  );
  // Judges marked no-show aren't judging, so they aren't counted.
  const organizers = judges.filter((j) => !j.noShow);
  const busy = organizers.filter((j) => holders.has(j.id)).length;

  let longest: { ms: number; judge: string; team: string } | null = null;
  for (const t of queue.teams) {
    if (!t.currentJudgeId || !t.assignedAt) continue;
    const ms = now - new Date(t.assignedAt).getTime();
    if (!longest || ms > longest.ms) {
      longest = {
        ms,
        judge: t.currentJudgeName ?? "A judge",
        team: t.teamName,
      };
    }
  }
  // With timed rounds a hold is only long once it passes the round length.
  const roundsOn = timed?.enabled === true;
  const holdLimit = roundsOn ? timed.roundSeconds * 1000 : LONG_HOLD_MS;
  const tooLong = !!longest && longest.ms > holdLimit;
  const limitText = `${Math.round(holdLimit / 60_000)} minute${
    holdLimit === 60_000 ? "" : "s"
  }`;
  const { round } = queue;
  const notStarted = !queue.started && queue.regularMarks === 0;
  const allRoundsDone =
    roundsOn &&
    timed.totalRounds > 0 &&
    timed.round === timed.totalRounds &&
    timed.status === "closed" &&
    timed.stops.done === timed.stops.total;

  return (
    <section
      aria-label="Progress"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5"
    >
      {roundsOn ? (
        <Tile
          label="Judging round"
          value={
            timed.totalRounds === 0
              ? "No plan yet"
              : timed.round === 0
                ? "Not started"
                : allRoundsDone
                  ? "All done"
                  : `Round ${timed.round} of ${timed.totalRounds}`
          }
        >
          {timed.round > 0 && !allRoundsDone && (
            <>
              <Bar done={timed.stops.done} total={timed.stops.total} />
              <span className={`text-[13px] ${MUTED}`}>
                {ROUND_STATUS[timed.status]} · {timed.stops.done} of{" "}
                {timed.stops.total} judges done with this round
              </span>
            </>
          )}
          {timed.round === 0 && timed.totalRounds > 0 && (
            <span className={`text-[13px] ${MUTED}`}>
              {timed.totalRounds} rounds planned. Start round 1 below.
              {queue.regularMarks > 0 &&
                ` Rounds were reset: the ${queue.regularMarks} scores already given are kept.`}
            </span>
          )}
        </Tile>
      ) : (
        <Tile
          label="Judging round"
          value={
            notStarted
              ? "Not started"
              : round.complete
                ? "All done"
                : `Round ${round.current} of ${round.total}`
          }
        >
          {!notStarted && !round.complete && (
            <>
              <Bar done={round.teamsDone} total={round.teamsSeated} />
              <span className={`text-[13px] ${MUTED}`}>
                {round.teamsDone} of {round.teamsSeated} teams done with this
                round
              </span>
            </>
          )}
        </Tile>
      )}
      <Tile
        label="Teams fully judged"
        value={`${fullyJudged} / ${queue.submittedTeams}`}
      >
        <Bar done={fullyJudged} total={queue.submittedTeams} />
      </Tile>
      <Tile
        label="Marks submitted"
        value={`${queue.regularMarks} / ${marksTotal}`}
      >
        <Bar done={queue.regularMarks} total={marksTotal} />
      </Tile>
      <Tile
        label="Judges"
        value={`${busy} ${roundsOn ? "scoring" : "judging"} · ${
          organizers.length - busy
        } ${roundsOn ? "waiting" : "free"}`}
      >
        <span className={`text-[13px] ${MUTED}`}>
          {organizers.length} judges.{" "}
          {roundsOn
            ? "Scoring = has a team open on their phone."
            : "Judging = holding a team."}
        </span>
      </Tile>
      <Tile
        label="Longest hold"
        value={longest ? formatHold(longest.ms) : "—"}
        warn={tooLong}
      >
        <span className={`text-[13px] ${tooLong ? "text-[#6b3a10]" : MUTED}`}>
          {longest
            ? `${longest.judge} on ${longest.team}.${tooLong ? ` Over ${limitText}` : ""}`
            : "No one is judging right now"}
        </span>
      </Tile>
    </section>
  );
}
