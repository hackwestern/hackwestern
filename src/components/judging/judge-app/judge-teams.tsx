import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  focusRing,
  fullWidth,
  infoBanner,
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
  /** True once the judge has finished: scores are locked. */
  finished: boolean;
  /** Finishing is in progress. */
  finishing: boolean;
  error: string | null;
  onEdit: (markId: number) => void;
  onFinish: () => void;
}

/**
 * The "My teams" tab: every score the judge has submitted. Tap one to change
 * it, until the judge taps "Finish judging".
 */
export function JudgeTeams({
  results,
  finished,
  finishing,
  error,
  onEdit,
  onFinish,
}: JudgeTeamsProps) {
  if (results.length === 0) {
    return (
      <p className="px-1 text-base font-medium text-dashboard-text-light">
        No teams yet. They show up here as you score them.
      </p>
    );
  }

  return (
    <>
      {finished ? (
        <p role="status" className={infoBanner}>
          You&apos;ve finished judging. Your scores are locked. Thank you!
        </p>
      ) : (
        <p className="m-0 px-1 text-sm text-dashboard-text-light">
          Tap a team to change its score.
        </p>
      )}
      <section
        aria-label="Teams you've judged"
        className={`${card} overflow-hidden`}
      >
        <ul className="m-0 list-none p-0">
          {results.map((r, i) => (
            <li
              key={r.markId}
              className={i > 0 ? "border-t border-dashboard-border-subtle" : ""}
            >
              <button
                type="button"
                disabled={finished}
                onClick={() => onEdit(r.markId)}
                aria-label={`${r.table ?? "No table"} ${r.teamName}, score ${r.score}.${finished ? "" : " Edit."}`}
                className={`flex min-h-14 w-full cursor-pixel-hover items-center justify-between gap-3 px-4 text-left text-base font-medium text-dashboard-text-heavy enabled:hover:bg-dashboard-bg-highlight ${focusRing}`}
              >
                <span className="min-w-0 truncate">
                  {r.table ?? "–"} · {r.teamName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {r.score}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <p role="alert" className={warningBanner}>
          {error}
        </p>
      )}
      {!finished && (
        <DashboardButton
          type="button"
          disabled={finishing}
          onClick={onFinish}
          className={`${fullWidth} disabled:opacity-dashboard-disabled`}
        >
          {finishing ? "Finishing…" : "Finish judging"}
        </DashboardButton>
      )}
    </>
  );
}
