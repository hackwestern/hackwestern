import { type ReactNode } from "react";
import {
  LONG_HOLD_MS,
  type JudgeRow,
  MUTED,
  type QueueState,
  formatHold,
} from "./control-shared";

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
      <span className="text-[30px] font-bold leading-tight tabular-nums">
        {value}
      </span>
      {children}
    </div>
  );
}

function Bar({ done, total }: { done: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (done / total) * 100) : 0;
  return (
    <div
      aria-hidden
      className="h-2 overflow-hidden rounded-full bg-[#e3e7ef]"
    >
      <div className="h-2 bg-[#5b3fa0]" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function ControlProgress({
  queue,
  judges,
  now,
}: {
  queue: QueueState | undefined;
  judges: JudgeRow[] | undefined;
  now: number;
}) {
  if (!queue || !judges) {
    return (
      <section
        aria-label="Progress"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
      >
        {[
          "Teams fully judged",
          "Marks submitted",
          "Organizer judges",
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
  const organizers = judges.filter((j) => j.type === "organizer");
  const busy = organizers.filter((j) => holders.has(j.id)).length;
  const sponsors = judges.length - organizers.length;

  let longest: { ms: number; judge: string; team: string } | null = null;
  for (const t of queue.teams) {
    if (!t.currentJudgeId || !t.assignedAt) continue;
    const ms = now - new Date(t.assignedAt).getTime();
    if (!longest || ms > longest.ms) {
      longest = { ms, judge: t.currentJudgeName ?? "A judge", team: t.teamName };
    }
  }
  const tooLong = !!longest && longest.ms > LONG_HOLD_MS;

  return (
    <section
      aria-label="Progress"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4"
    >
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
        label="Organizer judges"
        value={`${busy} judging · ${organizers.length - busy} free`}
      >
        <span className={`text-[13px] ${MUTED}`}>
          {sponsors === 0
            ? "No sponsor judges"
            : `Plus ${sponsors} sponsor judge${sponsors === 1 ? "" : "s"}`}
        </span>
      </Tile>
      <Tile
        label="Longest hold"
        value={longest ? formatHold(longest.ms) : "—"}
        warn={tooLong}
      >
        <span
          className={`text-[13px] ${tooLong ? "text-[#6b3a10]" : MUTED}`}
        >
          {longest
            ? `${longest.judge} on ${longest.team}.${tooLong ? " Over 5 minutes" : ""}`
            : "No one is judging right now"}
        </span>
      </Tile>
    </section>
  );
}
