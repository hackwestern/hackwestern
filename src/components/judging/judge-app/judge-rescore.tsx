import { DashboardButton } from "~/components/internals/dashboard-button";
import { card, fullWidth } from "~/components/judging/shared/judge-ui";
import { type JudgedTeam } from "~/components/judging/judge-app/judge-teams";

interface JudgeRescoreProps {
  /** Every team the judge scored, in the order they scored them. */
  results: JudgedTeam[];
  /** Team ids already re-scored. */
  rescored: string[];
  /** All teams are re-scored: time for the side-by-side check. */
  allDone: boolean;
  /** Opens the re-score screen for this mark. The screen then moves through the rest by itself. */
  onStart: (markId: number) => void;
  onFinal: () => void;
}

/**
 * The Next tab during the second pass: one intro that says what is left to do.
 * Its button goes straight into re-scoring, first team to last.
 */
export function JudgeRescore({
  results,
  rescored,
  allDone,
  onStart,
  onFinal,
}: JudgeRescoreProps) {
  const next = results.find((r) => !rescored.includes(r.teamId));
  const done = results.filter((r) => rescored.includes(r.teamId)).length;

  if (allDone || !next) {
    return (
      <section
        aria-label="Re-scoring done"
        className={`${card} flex flex-col gap-3 px-4 py-4`}
      >
        <h1 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
          All teams re-scored
        </h1>
        <p className="m-0 text-base font-medium text-dashboard-text-light">
          Next, review your final scores and submit them. After you submit,
          you&apos;ll see how they compare with the other judges.
        </p>
        <DashboardButton type="button" onClick={onFinal} className={fullWidth}>
          Review and submit
        </DashboardButton>
      </section>
    );
  }

  return (
    <section
      aria-label="Re-scoring"
      className={`${card} flex flex-col gap-3 px-4 py-4`}
    >
      <h1 className="m-0 text-xl font-semibold text-dashboard-text-heavy">
        Re-score your teams
      </h1>
      <p className="m-0 text-base font-medium text-dashboard-text-light">
        Go back through all {results.length}{" "}
        {results.length === 1 ? "team" : "teams"} you scored, in the order you
        scored them. This time you can open each team&apos;s GitHub and Devpost.
        Rethink every score, then save, even if nothing changes. Each team
        follows the last, and you can&apos;t skip one.
      </p>
      <p className="m-0 text-sm font-semibold tabular-nums text-dashboard-text-light">
        {done} of {results.length} re-scored
      </p>
      <DashboardButton
        type="button"
        onClick={() => onStart(next.markId)}
        className={fullWidth}
      >
        {done === 0 ? "Start re-scoring" : "Continue re-scoring"}
      </DashboardButton>
    </section>
  );
}