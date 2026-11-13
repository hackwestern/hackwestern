import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  fullWidth,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import { type Ratings } from "~/components/judging/shared/rubric-scorer";

/** One team this judge has scored. */
export interface JudgedTeam {
  markId: number;
  teamId: string;
  /** null when the team isn't seated at a table. */
  table: number | null;
  teamName: string;
  /** Slider values by criterion id (0-100). Empty until the mark is edited with the rubric. */
  ratings: Ratings;
  /** 0-100, as stored on the mark. */
  score: number;
  notes: string;
}

interface JudgeTeamsProps {
  results: JudgedTeam[];
  /** "first": first review. "rescore": the second pass. */
  stage: "first" | "rescore";
  /** Team ids already re-scored. */
  rescored: string[];
  /** Moving on to re-scoring is in progress. */
  starting: boolean;
  error: string | null;
  onStartRescore: () => void;
  onContinueRescore: () => void;
}

/**
 * The "My teams" tab during judging: every score the judge has submitted, read
 * only. First review ends with "Start re-scoring". Once the judge is re-scoring,
 * each row shows whether it has been done. After that this tab becomes the
 * final review and the results (see JudgeFinal and JudgeComparison).
 */
export function JudgeTeams({
  results,
  stage,
  rescored,
  starting,
  error,
  onStartRescore,
  onContinueRescore,
}: JudgeTeamsProps) {
  if (results.length === 0) {
    return (
      <p className="px-1 text-base font-medium text-dashboard-text-light">
        No teams yet. They show up here as you score them.
      </p>
    );
  }

  const rescoring = stage === "rescore";

  return (
    <>
      <p className="m-0 px-1 text-sm text-dashboard-text-light">
        {rescoring
          ? "Re-score every team, in the order you scored them."
          : "Your scores so far. They can't be changed until re-scoring."}
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
                <div
                  role="group"
                  aria-label={`${r.table ?? "No table"} ${r.teamName}, score ${r.score}.${
                    rescoring
                      ? done
                        ? " Re-scored."
                        : " Not re-scored yet."
                      : ""
                  }`}
                  className="flex min-h-14 w-full items-center justify-between gap-3 px-4 text-base font-medium text-dashboard-text-heavy"
                >
                  <span className="min-w-0 truncate">
                    {r.table ?? "–"} · {r.teamName}
                  </span>
                  <span className="flex shrink-0 items-baseline gap-2">
                    {rescoring && (
                      <span className="text-xs font-semibold text-dashboard-text-light">
                        {done ? "Re-scored" : "To do"}
                      </span>
                    )}
                    <span className="font-semibold tabular-nums">
                      {r.score}
                    </span>
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {error && (
        <p role="alert" className={warningBanner}>
          {error}
        </p>
      )}
      {rescoring ? (
        <DashboardButton
          type="button"
          onClick={onContinueRescore}
          className={fullWidth}
        >
          Continue re-scoring
        </DashboardButton>
      ) : (
        <DashboardButton
          type="button"
          disabled={starting}
          onClick={onStartRescore}
          className={`${fullWidth} disabled:opacity-dashboard-disabled`}
        >
          {starting ? "Starting…" : "Start re-scoring"}
        </DashboardButton>
      )}
    </>
  );
}
