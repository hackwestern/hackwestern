import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  focusRing,
  fullWidth,
  infoBanner,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import {
  type Ratings,
  formatScore,
} from "~/components/judging/shared/rubric-scorer";
import { SuperLikeMark } from "~/components/judging/shared/super-like";

/** One team this judge has scored. */
export interface JudgedTeam {
  markId: number;
  teamId: string;
  /** null when the team isn't seated at a table. */
  table: number | null;
  teamName: string;
  /** Slider values by criterion id (0-10). Empty until the mark is edited with the rubric. */
  ratings: Ratings;
  /** 0-10, as stored on the mark. */
  score: number;
  notes: string;
  /** The judge gave this team a super like. */
  superLike: boolean;
}

/** A team still on this judge's route, in walking order. */
export interface UpcomingTeam {
  stopId: number;
  table: number | null;
  teamName: string;
  /** Member full names; empty when none are listed. */
  members: string[];
  /** The timed round it's in, or null when rounds are off. */
  round: number | null;
  /** The team was marked absent: it can't be judged. */
  absent: boolean;
}

interface JudgeTeamsProps {
  results: JudgedTeam[];
  /** Teams this judge still has to judge, in order. */
  upcoming: UpcomingTeam[];
  /** "first": first review. "rescore": the second pass. */
  stage: "first" | "rescore";
  /** Team ids already re-scored. */
  rescored: string[];
  /** Every team is re-scored, so the scores can be submitted. */
  canSubmit: boolean;
  error: string | null;
  /** Opens this mark to change it. */
  onEdit: (markId: number) => void;
  onSubmit: () => void;
}

/**
 * The "My teams" tab during judging: every score the judge has submitted. Tap a
 * team to change it. While re-scoring, each row shows whether it has been done.
 * Submit stays disabled until every team is re-scored. Re-scoring itself starts
 * from the Next tab. After submitting, this tab shows the results.
 */
export function JudgeTeams({
  results,
  upcoming,
  stage,
  rescored,
  canSubmit,
  error,
  onEdit,
  onSubmit,
}: JudgeTeamsProps) {
  const stillToJudge = upcoming.length > 0 && (
    <>
      <p className="m-0 px-1 text-sm text-dashboard-text-light">
        Your next tables, in order.
      </p>
      <section
        aria-label="Teams still to judge"
        className={`${card} overflow-hidden`}
      >
        <ul className="m-0 list-none p-0">
          {upcoming.map((u, i) => (
            <li
              key={u.stopId}
              className={`flex items-start justify-between gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-dashboard-border-subtle" : ""
              }`}
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-base font-semibold text-dashboard-text-heavy">
                  {u.table ?? "–"} · {u.teamName}
                </span>
                <span className="text-sm leading-snug text-dashboard-text-light">
                  {u.members.length > 0
                    ? u.members.join(", ")
                    : "No members listed"}
                </span>
              </span>
              {(u.absent || u.round !== null) && (
                <span className="shrink-0 text-xs font-semibold text-dashboard-text-light">
                  {u.absent ? "Absent" : `Round ${u.round}`}
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </>
  );

  if (results.length === 0) {
    return (
      <>
        <p className="px-1 text-base font-medium text-dashboard-text-light">
          No scores yet. Teams show up here as you score them.
        </p>
        {stillToJudge}
      </>
    );
  }

  const rescoring = stage === "rescore";

  return (
    <>
      <p className="m-0 px-1 text-sm text-dashboard-text-light">
        {rescoring
          ? "Re-score every team, in the order you scored them."
          : "Your scores so far. Tap a team to change its score."}
      </p>
      <section
        aria-label="Teams you've judged"
        className={`${card} overflow-hidden`}
      >
        <ul className="m-0 list-none p-0">
          {results.map((r, i) => {
            const done = rescored.includes(r.teamId);
            return (
              <li
                key={r.markId}
                className={
                  i > 0 ? "border-t border-dashboard-border-subtle" : ""
                }
              >
                <button
                  type="button"
                  onClick={() => onEdit(r.markId)}
                  aria-label={`Edit ${r.table ?? "No table"} ${r.teamName}, score ${formatScore(r.score)}.${r.superLike ? " Super liked." : ""}${
                    rescoring
                      ? done
                        ? " Re-scored."
                        : " Not re-scored yet."
                      : ""
                  }`}
                  className={`flex min-h-14 w-full cursor-pixel-hover items-center justify-between gap-3 px-4 text-left text-base font-medium text-dashboard-text-heavy hover:bg-dashboard-bg-highlightSubtle ${focusRing}`}
                >
                  <span className="min-w-0 truncate">
                    <SuperLikeMark on={r.superLike} /> {r.table ?? "–"} ·{" "}
                    {r.teamName}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {rescoring && (
                      <span className="text-xs font-semibold text-dashboard-text-light">
                        {done ? "Re-scored" : "To do"}
                      </span>
                    )}
                    <span className="font-semibold tabular-nums">
                      {formatScore(r.score)}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      {stillToJudge}

      {error && (
        <p role="alert" className={warningBanner}>
          {error}
        </p>
      )}
      {!canSubmit && (
        <p className={infoBanner}>
          {rescoring
            ? "Re-score every team to submit. Continue from the Next tab."
            : "Finish your queue and re-score every team to submit."}
        </p>
      )}
      <DashboardButton
        type="button"
        disabled={!canSubmit}
        onClick={onSubmit}
        className={`${fullWidth} disabled:opacity-dashboard-disabled`}
      >
        Submit
      </DashboardButton>
    </>
  );
}
