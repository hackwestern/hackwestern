import { DashboardButton } from "~/components/internals/dashboard-button";
import { VenueMap } from "~/components/judging/judge-app/judge-map";
import { card, fullWidth, touch } from "~/components/judging/shared/judge-ui";

interface JudgeNextProps {
  started: boolean;
  onStart: () => void;
  /** Table numbers this judge covers, in order. */
  tables: number[];
  /** Index into `tables` of the table to visit next. */
  currentIndex: number;
  /** Start scoring the table shown. */
  onJudge: () => void;
  /** Called when the map is tapped, to open the map page. */
  onOpenMap: () => void;
  /** Opens the full list of judged teams. */
  onReview: () => void;
  /** Set when the judge said they are at a different table than expected. */
  override: number | null;
  onWrongTable: () => void;
  onImpromptu: () => void;
}

/** The "Next" tab: a welcome first, then the next table once judging starts. */
export function JudgeNext({
  started,
  onStart,
  tables,
  currentIndex,
  override,
  onJudge,
  onOpenMap,
  onReview,
  onWrongTable,
  onImpromptu,
}: JudgeNextProps) {
  if (!started) {
    const first = tables[0];
    const last = tables[tables.length - 1];
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
            Welcome, judge
          </h1>
          <p className="text-base font-medium text-dashboard-text-light">
            No account needed
          </p>
        </section>
        <section
          className={`${card} flex items-baseline justify-between gap-3 px-4 py-3.5`}
        >
          <span className="text-base font-medium text-dashboard-text-heavy">
            Your tables
          </span>
          <span className="text-xl font-semibold tabular-nums text-dashboard-text-heavy">
            {first === undefined
              ? "None yet"
              : first === last
                ? first
                : `${first}–${last}`}
          </span>
        </section>
        <DashboardButton type="button" onClick={onStart} className={fullWidth}>
          Start judging
        </DashboardButton>
      </>
    );
  }

  const expected = tables[currentIndex];
  const table = override ?? expected;

  // Every assigned table is done. Another team can still be judged by number.
  if (table === undefined) {
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-3xl font-bold leading-tight text-dashboard-text-heavy">
            All done
          </h1>
          <p className="text-base font-medium text-dashboard-text-light">
            You&apos;ve judged all your tables. Thank you!
          </p>
        </section>
        <DashboardButton type="button" onClick={onReview} className={fullWidth}>
          Review all teams
        </DashboardButton>
        <DashboardButton
          type="button"
          variant="outline"
          onClick={onImpromptu}
          className={fullWidth}
        >
          Judge another team
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
        {/* Placeholder directions. */}
        <span className="mt-2 text-base font-medium text-dashboard-text-heavy">
          {override !== null && override !== expected
            ? `Changed from ${expected ?? "–"}`
            : "Row 2 · walk right"}
        </span>
      </section>

      <section aria-label="Floor map" className={`${card} p-3.5`}>
        <VenueMap tables={tables} current={table} onOpen={onOpenMap} />
      </section>

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
      <div className="flex flex-wrap gap-2">
        <DashboardButton
          type="button"
          variant="outline"
          onClick={onWrongTable}
          className={touch}
        >
          Wrong table?
        </DashboardButton>
        <DashboardButton
          type="button"
          variant="outline"
          onClick={onImpromptu}
          className={touch}
        >
          Judge another team
        </DashboardButton>
      </div>
    </>
  );
}
