import { DashboardButton } from "~/components/internals/dashboard-button";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import { walkHint } from "~/components/judging/judge-app/judge-directions";
import { type ReactNode } from "react";
import {
  RoundClock,
  RoundWait,
  type RoundView,
} from "~/components/judging/judge-app/judge-round";
import {
  card,
  fullWidth,
  infoBanner,
  warningBanner,
} from "~/components/judging/shared/judge-ui";

export type NextPhase =
  | "loading"
  | "welcome"
  | "team"
  | "none"
  | "waitRound"
  | "rescoreReady"
  | "finished";

interface JudgeNextProps {
  phase: NextPhase;
  /** The team the server gave this judge (phase "team"). */
  teamName: string | null;
  /** Its table, or null when the team isn't seated yet. */
  table: number | null;
  /** Who is on the team, so the judge knows who to look for. */
  members?: string[];
  /** Its round already ended: the judge is finishing it late. */
  late?: boolean;
  /** The other tables in this judge's queue, marked on the map. */
  tables: number[];
  /** The table the judge just finished, where the walk hint starts. Null for their first team. */
  fromTable: number | null;
  /** Tables this judge has already scored, greyed on the map. */
  seen: number[];
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
  /** Starts the second pass (phase "rescoreReady"). */
  onStartRescore: () => void;
  /** Starting the second pass is in progress. */
  starting: boolean;
  /** Shown on the welcome screen above Start judging: the teams lined up. */
  queueList?: ReactNode;
  /** The timed round, when rounds are on. */
  round?: RoundView | null;
  /** This judge's next table and its round, for the waiting screen. */
  upcoming?: { table: number; round: number } | null;
  /** This judge already scored their table in the open round. */
  scoredRound?: boolean;
  /** This round's table, when its team was marked absent. */
  absentTable?: number | null;
}

/** The "Next" tab: a welcome first, then the team the server picked. */
export function JudgeNext({
  phase,
  teamName,
  table,
  members = [],
  late = false,
  tables,
  fromTable,
  seen,
  judged,
  busy,
  error,
  onStart,
  onJudge,
  onOpenMap,
  onReview,
  onCheckAgain,
  onStartRescore,
  starting,
  queueList,
  round,
  upcoming = null,
  scoredRound = false,
  absentTable = null,
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

  if (phase === "waitRound" && round) {
    return (
      <RoundWait
        view={round}
        upcoming={upcoming}
        scored={scoredRound}
        absentTable={absentTable}
      />
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
        {queueList}
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

  if (phase === "rescoreReady") {
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
            Time for re-scoring
          </h1>
          <p className="text-base font-medium text-dashboard-text-light">
            You&apos;ve judged all {judged} {judged === 1 ? "team" : "teams"} in
            your queue. Now go back through each one and settle on your final
            scores. Once every team is re-scored, you can submit.
          </p>
        </section>
        {errorBanner}
        <DashboardButton
          type="button"
          disabled={starting}
          onClick={onStartRescore}
          className={`${fullWidth} disabled:opacity-dashboard-disabled`}
        >
          {starting ? "Starting…" : "Start re-scoring"}
        </DashboardButton>
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
              ? `You've judged ${judged}. Other judges are still finishing teams in your queue. Check again in a minute.`
              : "No team is waiting for you right now."}
          </p>
        </section>
        {errorBanner}
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

  const hint = table !== null ? walkHint(fromTable, table) : null;

  return (
    <>
      <section
        aria-labelledby="next-table-label"
        className={`${card} flex flex-col gap-2 p-4`}
      >
        <div className="flex items-center justify-between gap-3">
          <span
            id="next-table-label"
            className="text-base font-medium text-dashboard-text-light"
          >
            {round ? "Your table" : "Next table"}
          </span>
          {hint && (
            <span className="rounded-full bg-dashboard-bg-highlight px-3 py-1 text-sm font-semibold text-dashboard-text-active">
              {hint}
            </span>
          )}
        </div>
        <span className="text-6xl font-bold tabular-nums leading-none text-dashboard-text-heavy">
          {table ?? "–"}
        </span>
        <span className="mt-2 text-base font-medium text-dashboard-text-heavy">
          {table === null
            ? `${teamName ?? "This team"} has no table yet. Ask an organizer.`
            : teamName}
        </span>
        <span className="text-sm leading-snug text-dashboard-text-light">
          {members.length > 0 ? members.join(", ") : "No members listed"}
        </span>
      </section>

      {/* Table, time, then the action: on a phone these stay above the fold. */}
      {late ? (
        <p role="status" className={infoBanner}>
          Time ran out for this team. You can still score it now.
        </p>
      ) : (
        round && <RoundClock view={round} nextTable={upcoming?.table ?? null} />
      )}

      <DashboardButton type="button" onClick={onJudge} className={fullWidth}>
        Judge this team
      </DashboardButton>

      {table !== null && (
        <section aria-label="Floor map" className={`${card} p-3.5`}>
          <VenueMap
            tables={tables}
            current={table}
            seen={seen}
            onOpen={onOpenMap}
          />
        </section>
      )}
    </>
  );
}
