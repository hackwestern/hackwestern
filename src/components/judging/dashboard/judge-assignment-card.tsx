import { useEffect, useState } from "react";

import { DashboardTag } from "~/components/internals/dashboard-tag";
import { card, focusRing } from "../shared/judge-ui";

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
      className={`rounded-dashboard-xl flex min-w-28 shrink-0 flex-col items-end gap-0.5 px-2.5 py-2 ${
        over
          ? "bg-dashboard-status-iconBadge text-dashboard-text-warning"
          : "bg-dashboard-bg-inset text-dashboard-text-heavy"
      }`}
    >
      <span className="text-2xl font-semibold tabular-nums leading-none">
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

const linkClass = `-my-3 inline-flex min-h-11 items-center px-1 text-sm font-semibold text-dashboard-text-link underline underline-offset-2 hover:text-dashboard-text-active ${focusRing}`;

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
          <span className="text-xs font-semibold text-dashboard-text-warning">
            GO TO
          </span>
          {/* Placeholder: teams have no table field yet. */}
          <span className="text-4xl font-bold leading-none text-dashboard-text-warning">
            Table —
          </span>
          <span className="text-xs text-dashboard-text-light">
            {"Teams don't have table numbers yet"}
          </span>
        </div>
        {assignedAt && <PitchTimer assignedAt={assignedAt} />}
      </div>
      <h1
        id="judge-team-name"
        className="text-2xl font-semibold leading-tight text-dashboard-text-heavy"
      >
        {team.name}
      </h1>
      <div className="flex flex-wrap items-center gap-1.5">
        {team.tracks?.map((track) => (
          <DashboardTag key={track}>{track}</DashboardTag>
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
