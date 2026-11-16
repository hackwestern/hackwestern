import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  fullWidth,
  focusRing,
  infoBanner,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import { type JudgedTeam } from "~/components/judging/judge-app/judge-teams";
import { formatScore } from "~/components/judging/shared/rubric-scorer";
import { SuperLikeMark } from "~/components/judging/shared/super-like";

interface JudgeFinalProps {
  results: JudgedTeam[];
  error: string | null;
  /** Opens this mark for one more change; saving comes back here. */
  onEdit: (markId: number) => void;
  onSubmit: () => void;
}

/**
 * The last step before the results: the judge's own re-scored teams, best
 * first, each still editable, and the Submit button. How the scores compare
 * with the other judges is only shown after submitting.
 */
export function JudgeFinal({
  results,
  error,
  onEdit,
  onSubmit,
}: JudgeFinalProps) {
  const ranked = [...results].sort((a, b) => b.score - a.score);

  return (
    <>
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
