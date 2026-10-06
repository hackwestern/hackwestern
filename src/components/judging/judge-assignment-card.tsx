import { useEffect, useState } from "react";

import { card, focusRing } from "~/components/judging/judge-ui";

const PITCH_MS = 4 * 60 * 1000;

const formatClock = (ms: number) => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
};

function PitchTimer({ assignedAt }: { assignedAt: Date }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = Math.max(0, now - assignedAt.getTime());
  const over = elapsed >= PITCH_MS;

  return (
    <div
      role="timer"
      aria-label="Pitch time"
      className={`flex min-w-[112px] shrink-0 flex-col items-end gap-0.5 rounded-xl px-2.5 py-2 ${
        over ? "bg-[#fdf0e3] text-[#8a3f05]" : "bg-[#eef1f6] text-[#0b2238]"
      }`}
    >
      <span className="text-[26px] font-bold tabular-nums leading-none">
        {formatClock(elapsed)}
      </span>
      <span className="text-xs font-semibold">
        {over ? "Time to wrap up" : `of ${formatClock(PITCH_MS)} pitch`}
      </span>
    </div>
  );
}

interface JudgeAssignmentCardProps {
  team: {
    name: string;
    tracks: string[] | null;
    devpostUrl: string | null;
    githubUrl: string | null;
  };
  assignedAt: Date | null;
}

const linkClass = `-my-3 inline-flex min-h-[44px] items-center px-1 text-[13px] font-semibold text-[#5b3fa0] underline underline-offset-2 hover:text-[#3f2a75] ${focusRing}`;

export function JudgeAssignmentCard({
  team,
  assignedAt,
}: JudgeAssignmentCardProps) {
  return (
    <section
      aria-labelledby="judge-team-name"
      className={`${card} flex flex-col gap-2 p-4`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] font-bold text-[#8a3f05]">GO TO</span>
          {/* Placeholder: teams have no table field yet. */}
          <span className="text-[34px] font-bold leading-none text-[#8a3f05]">
            Table —
          </span>
          <span className="text-xs text-[#4a5d73]">
            {"Teams don't have table numbers yet"}
          </span>
        </div>
        {assignedAt && <PitchTimer assignedAt={assignedAt} />}
      </div>
      <h1 id="judge-team-name" className="text-2xl font-bold leading-tight">
        {team.name}
      </h1>
      <div className="flex flex-wrap items-center gap-1.5">
        {team.tracks?.map((track) => (
          <span
            key={track}
            className="rounded-full bg-[#eef1f6] px-2 py-1 text-xs font-semibold text-[#2e4a66]"
          >
            {track}
          </span>
        ))}
        {(!!team.devpostUrl || !!team.githubUrl) && (
          <span className="ml-auto flex gap-2">
            {team.devpostUrl && (
              <a
                href={team.devpostUrl}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                Devpost
              </a>
            )}
            {team.githubUrl && (
              <a
                href={team.githubUrl}
                target="_blank"
                rel="noreferrer"
                className={linkClass}
              >
                GitHub
              </a>
            )}
          </span>
        )}
      </div>
    </section>
  );
}
