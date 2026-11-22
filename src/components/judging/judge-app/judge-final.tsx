import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  fullWidth,
  focusRing,
  infoBanner,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import {
  type JudgedTeam,
  type UpcomingTeam,
} from "~/components/judging/judge-app/judge-teams";
import { formatScore } from "~/components/judging/shared/rubric-scorer";
import { SuperLikeMark } from "~/components/judging/shared/super-like";

interface JudgeFinalProps {
  results: JudgedTeam[];
  /** Teams whose round ended before the judge sent a score. */
  unsent: UpcomingTeam[];
  error: string | null;
  /** Opens this mark for one more change; saving comes back here. */
  onEdit: (markId: number) => void;
  /** Opens the score form for an unsent team. */
  onScoreLate: (stopId: number) => void;
  onSubmit: () => void;
}

/**
 * The last step before the results: the judge's own re-scored teams, best
 * first, each still editable, and the Submit button. How the scores compare
 * with the other judges is only shown after submitting.
 */
export function JudgeFinal({
  results,
  unsent,
  error,
  onEdit,
  onScoreLate,
  onSubmit,
}: JudgeFinalProps) {
  const ranked = [...results].sort((a, b) => b.score - a.score);

  return (
    <>
      {unsent.length > 0 && (
        <section
          aria-label="Not sent yet"
          className={`${card} flex flex-col gap-2 p-4`}
        >
          <p className={warningBanner}>
            {unsent.length === 1
              ? "1 team hasn't got your score yet."
              : `${unsent.length} teams haven't got your score yet.`}{" "}
            Score them before you submit, or they won&apos;t count from you.
          </p>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {unsent.map((u) => (
              <li
                key={u.stopId}
                className="flex items-center justify-between gap-3"
              >
                <span className="min-w-0 truncate text-base font-semibold text-dashboard-text-heavy">
                  {u.table ?? "–"} · {u.teamName}
                </span>
                <DashboardButton
                  type="button"
                  variant="outline"
                  onClick={() => onScoreLate(u.stopId)}
                  className="shrink-0"
                >
                  Score now
                </DashboardButton>
              </li>
            ))}
          </ul>
        </section>
      )}
      <p className={infoBanner}>
        Your final scores, best first. Tap a team to change its score, and
        submit when you&apos;re happy. After you submit, you&apos;ll see how
        they compare with the other judges, and you won&apos;t be able to change
        them.
      </p>
      <section
        aria-label="Your final scores"
        className={`${card} overflow-hidden`}
      >
        <ol className="m-0 list-none p-0">
          {ranked.map((r, i) => (
            <li
              key={r.markId}
              className={i > 0 ? "border-t border-dashboard-border-subtle" : ""}
            >
              <button
                type="button"
                aria-label={`Edit score for ${r.teamName}, ${formatScore(r.score)}`}
                onClick={() => onEdit(r.markId)}
                className={`flex min-h-14 w-full cursor-pixel-hover items-center justify-between gap-3 px-4 text-left text-base font-medium text-dashboard-text-heavy hover:bg-dashboard-bg-highlightSubtle ${focusRing}`}
              >
                <span className="min-w-0 truncate">
                  <span className="mr-2 tabular-nums text-dashboard-text-light">
                    #{i + 1}
                  </span>
                  <SuperLikeMark on={r.superLike} /> {r.table ?? "–"} ·{" "}
                  {r.teamName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {formatScore(r.score)}
                </span>
              </button>
            </li>
          ))}
        </ol>
      </section>
      {error && (
        <p role="alert" className={warningBanner}>
          {error}
        </p>
      )}
      <DashboardButton type="button" onClick={onSubmit} className={fullWidth}>
        Submit
      </DashboardButton>
    </>
  );
}
