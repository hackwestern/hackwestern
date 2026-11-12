import { DashboardButton } from "~/components/internals/dashboard-button";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import {
  card,
  fullWidth,
  warningBanner,
} from "~/components/judging/shared/judge-ui";

export type NextPhase = "loading" | "welcome" | "team" | "none" | "finished";

interface JudgeNextProps {
  phase: NextPhase;
  /** The team the server gave this judge (phase "team"). */
  teamName: string | null;
  /** Its table, or null when the team isn't seated yet. */
  table: number | null;
  /** How many teams this judge has scored. */
  judged: number;
  /** Finding the next team. */
  busy: boolean;
  error: string | null;
  onStart: () => void;
  onJudge: () => void;
  onOpenMap: () => void;
  onReview: () => void;
  onCheckAgain: () => void;
}

/** The "Next" tab: a welcome first, then the team the server picked. */
export function JudgeNext({
  phase,
  teamName,
  table,
  judged,
  busy,
  error,
  onStart,
  onJudge,
  onOpenMap,
  onReview,
  onCheckAgain,
}: JudgeNextProps) {
  const errorBanner = error ? (
    <p role="alert" className={warningBanner}>
      {error}
    </p>
  ) : null;

  if (phase === "loading") {
    return (
      <p
        role="status"
        className="px-1 text-base font-medium text-dashboard-text-light"
      >
        Finding your next team…
      </p>
    );
  }

  if (phase === "welcome") {
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
            Welcome, judge
          </h1>
          <p className="text-base font-medium text-dashboard-text-light">
            Start judging to get your first team.
          </p>
        </section>
        {errorBanner}
        <DashboardButton
          type="button"
          disabled={busy}
          onClick={onStart}
          className={fullWidth}
        >
          {busy ? "Finding a team…" : "Start judging"}
        </DashboardButton>
      </>
    );
  }

  if (phase === "finished") {
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
            You&apos;re done judging
          </h1>
          <p className="text-base font-medium text-dashboard-text-light">
            {judged > 0
              ? `Thank you! Your ${judged} score${judged === 1 ? " is" : "s are"} submitted and locked.`
              : "Thank you!"}
          </p>
        </section>
        {judged > 0 && (
          <DashboardButton
            type="button"
            variant="outline"
            onClick={onReview}
            className={fullWidth}
          >
            Review all teams
          </DashboardButton>
        )}
      </>
    );
  }

  if (phase === "none") {
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
            {judged > 0 ? "All done for now" : "No teams yet"}
          </h1>
          <p className="text-base font-medium text-dashboard-text-light">
            {judged > 0
              ? `You've judged ${judged}. No other team is waiting for you right now.`
              : "No team is waiting for you right now."}
          </p>
        </section>
        {errorBanner}
        {judged > 0 && (
          <DashboardButton
            type="button"
            onClick={onReview}
            className={fullWidth}
          >
            Review all teams
          </DashboardButton>
        )}
        <DashboardButton
          type="button"
          variant="outline"
          disabled={busy}
          onClick={onCheckAgain}
          className={fullWidth}
        >
          {busy ? "Checking…" : "Check again"}
        </DashboardButton>
      </>
    );
  }

  return (
    <>
      <section
        aria-labelledby="next-table-label"
        className={`${card} flex flex-col gap-2 p-4`}
      >
        <span
          id="next-table-label"
          className="text-base font-medium text-dashboard-text-light"
        >
          Next table
        </span>
        <span className="text-6xl font-bold tabular-nums leading-none text-dashboard-text-heavy">
          {table ?? "–"}
        </span>
        <span className="mt-2 text-base font-medium text-dashboard-text-heavy">
          {table === null
            ? `${teamName ?? "This team"} has no table yet. Ask an organizer.`
            : teamName}
        </span>
      </section>

      {table !== null && (
        <section aria-label="Floor map" className={`${card} p-3.5`}>
          <VenueMap tables={[]} current={table} onOpen={onOpenMap} />
        </section>
      )}

      {/* Placeholder clock: static until the pitch timer is wired up. */}
      <section
        aria-label="Presentation time"
        className={`${card} flex items-center justify-between gap-3 px-4 py-3`}
      >
        <span className="text-base font-medium text-dashboard-text-heavy">
          Presentation
        </span>
        <span className="font-mono text-3xl font-bold tabular-nums text-dashboard-text-heavy">
          02:41
        </span>
      </section>

      <DashboardButton type="button" onClick={onJudge} className={fullWidth}>
        Judge this team
      </DashboardButton>
    </>
  );
}
