import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  fullWidth,
  infoBanner,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import { type JudgedTeam } from "~/components/judging/judge-app/judge-teams";

interface JudgeFinalProps {
  results: JudgedTeam[];
  error: string | null;
  onSubmit: () => void;
}

/**
 * The last step before the results: the judge's own re-scored teams, best
 * first, and the Submit button. How the scores compare with the other judges is
 * only shown after submitting.
 */
export function JudgeFinal({ results, error, onSubmit }: JudgeFinalProps) {
  const ranked = [...results].sort((a, b) => b.score - a.score);

  return (
    <>
      <p className={infoBanner}>
        Your final scores, best first. Submit when you&apos;re happy with them.
        After you submit, you&apos;ll see how they compare with the other
        judges, and you won&apos;t be able to change them.
      </p>
      <section
        aria-label="Your final scores"
        className={`${card} overflow-hidden`}
      >
        <ol className="m-0 list-none p-0">
          {ranked.map((r, i) => (
            <li
              key={r.markId}
              className={`flex min-h-14 items-center justify-between gap-3 px-4 text-base font-medium text-dashboard-text-heavy ${
                i > 0 ? "border-t border-dashboard-border-subtle" : ""
              }`}
            >
              <span className="min-w-0 truncate">
                <span className="mr-2 tabular-nums text-dashboard-text-light">
                  #{i + 1}
                </span>
                {r.table ?? "–"} · {r.teamName}
              </span>
              <span className="shrink-0 font-semibold tabular-nums">
                {r.score}
              </span>
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