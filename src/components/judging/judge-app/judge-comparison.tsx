import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  fullWidth,
  infoBanner,
  touch,
} from "~/components/judging/shared/judge-ui";
import {
  type Rubric,
} from "~/components/judging/shared/rubric-scorer";
import {
  type ComparisonData,
  type ComparisonTeam,
} from "~/server/api/utils/judge-comparison";

/** A gap this big or more gets the warning colour. Words carry it too, not just colour. */
const BIG_GAP = 15;

const round = (n: number) => Math.round(n);

/** "+7", "−3" or "0". Rounds first, so 0.4 reads as 0. */
function signed(diff: number): string {
  const d = round(diff);
  if (d > 0) return `+${d}`;
  if (d < 0) return `−${Math.abs(d)}`;
  return "0";
}

function gapWords(diff: number): string {
  const d = round(diff);
  if (d === 0) return "same as the average";
  return `${Math.abs(d)} ${d > 0 ? "above" : "below"} the average`;
}

interface RowProps {
  label: string;
  mine: number | undefined;
  average: number | undefined;
  /** False when only the viewer has marked this team, so there is nothing to compare. */
  comparable: boolean;
  strong?: boolean;
}

function CompareRow({ label, mine, average, comparable, strong }: RowProps) {
  const hasBoth = mine !== undefined && average !== undefined;
  const diff = hasBoth ? mine - average : undefined;
  const big = comparable && diff !== undefined && Math.abs(diff) >= BIG_GAP;

  return (
    <div className="flex items-baseline justify-between gap-3">
      <span
        className={
          strong
            ? "text-base font-semibold text-dashboard-text-heavy"
            : "text-sm font-medium text-dashboard-text-heavy"
        }
      >
        {label}
      </span>
      <span className="flex items-baseline gap-3 tabular-nums">
        <span className="text-sm text-dashboard-text-light">
          You{" "}
          <span className="font-semibold text-dashboard-text-heavy">
            {mine === undefined ? "–" : round(mine)}
          </span>
        </span>
        <span className="text-sm text-dashboard-text-light">
          Others{" "}
          <span className="font-semibold text-dashboard-text-heavy">
            {average === undefined || !comparable ? "–" : round(average)}
          </span>
        </span>
        <span
          className={`min-w-[3ch] text-right text-sm font-semibold ${
            big ? "text-dashboard-text-warning" : "text-dashboard-text-active"
          }`}
          aria-label={
            comparable && diff !== undefined ? gapWords(diff) : "no comparison yet"
          }
        >
          {comparable && diff !== undefined ? signed(diff) : "–"}
        </span>
      </span>
    </div>
  );
}

function TeamCard({
  rank,
  team,
  table,
  rubric,
}: {
  rank: number;
  team: ComparisonTeam;
  table: number | null;
  rubric: Rubric;
}) {
  const comparable = team.others !== null;
  return (
    <section
      aria-label={`${team.teamName} comparison`}
      className={`${card} flex flex-col gap-2 px-3.5 py-3`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="m-0 min-w-0 truncate text-lg font-semibold text-dashboard-text-heavy">
          <span className="mr-2 tabular-nums text-dashboard-text-light">
            #{rank}
          </span>
          {team.teamName}
        </h2>
        <span className="shrink-0 text-xs font-medium text-dashboard-text-light">
          {table !== null ? `Table ${table} · ` : ""}
          {comparable
            ? `${team.otherCount} other ${team.otherCount === 1 ? "judge" : "judges"}`
            : "No other judges yet"}
        </span>
      </div>
      <CompareRow
        strong
        label="Overall"
        mine={team.mine.score}
        average={team.others?.score}
        comparable={comparable}
      />
      {rubric.criteria.map((c) => (
        <CompareRow
          key={c.id}
          label={c.name}
          mine={team.mine.ratings[c.id]}
          average={team.others?.ratings[c.id]}
          comparable={comparable}
        />
      ))}
    </section>
  );
}

/** Your average gap per criterion, over the teams where other judges have marked too. */
function biasLines(data: ComparisonData, rubric: Rubric) {
  const compared = data.teams.flatMap((t) => (t.others ? [{ ...t, others: t.others }] : []));
  const lines: { id: string; label: string; avg: number; n: number }[] = [];

  const overall = compared.map((t) => t.mine.score - t.others.score);
  if (overall.length > 0) {
    lines.push({
      id: "overall",
      label: "Overall",
      avg: overall.reduce((a, b) => a + b, 0) / overall.length,
      n: overall.length,
    });
  }
  for (const c of rubric.criteria) {
    const diffs = compared.flatMap((t) => {
      const m = t.mine.ratings[c.id];
      const a = t.others.ratings[c.id];
      return m !== undefined && a !== undefined ? [m - a] : [];
    });
    if (diffs.length > 0) {
      lines.push({
        id: c.id,
        label: c.name,
        avg: diffs.reduce((a, b) => a + b, 0) / diffs.length,
        n: diffs.length,
      });
    }
  }
  return lines;
}

interface JudgeComparisonProps {
  /** Null while the numbers are loading after submitting. */
  data: ComparisonData | null;
  rubric: Rubric;
  /** Team id -> table number. */
  tableByTeam: Record<string, number>;
  refreshing: boolean;
  onRefresh: () => void;
}

/**
 * The results, shown only after the judge has submitted: every team they scored,
 * ranked by their own score, next to the average of the other judges.
 */
export function JudgeComparison({
  data,
  rubric,
  tableByTeam,
  refreshing,
  onRefresh,
}: JudgeComparisonProps) {
  if (data === null) {
    return (
      <p role="status" className={infoBanner}>
        Submitted. Loading how your scores compare…
      </p>
    );
  }

  const bias = biasLines(data, rubric);
  const ranked = [...data.teams].sort((a, b) => b.mine.score - a.mine.score);

  return (
    <div className="flex flex-col gap-3">
      <p className={infoBanner}>
        {data.otherJudgeCount === 0
          ? "Submitted. No other judges have scored yet, so there is nothing to compare with. Check back with Refresh."
          : `Submitted. Your scores are locked. Your teams, best first, against the average of the other ${
              data.otherJudgeCount === 1
                ? "judge"
                : `${data.otherJudgeCount} judges`
            } who scored them. A plus means you scored higher than they did.`}
      </p>

      {ranked.length === 0 ? (
        <p className="m-0 text-base font-medium text-dashboard-text-light">
          Nothing to compare.
        </p>
      ) : (
        <>
          {bias.length > 0 && (
            <section
              aria-label="Your average gap"
              className={`${card} flex flex-col gap-1.5 px-3.5 py-3`}
            >
              <h2 className="m-0 text-base font-semibold text-dashboard-text-heavy">
                Your average gap
              </h2>
              {bias.map((b) => (
                <div
                  key={b.id}
                  className="flex items-baseline justify-between gap-3 text-sm"
                >
                  <span className="font-medium text-dashboard-text-heavy">
                    {b.label}
                  </span>
                  <span className="tabular-nums text-dashboard-text-light">
                    <span className="font-semibold text-dashboard-text-active">
                      {signed(b.avg)}
                    </span>{" "}
                    over {b.n} {b.n === 1 ? "team" : "teams"}
                  </span>
                </div>
              ))}
            </section>
          )}
          {ranked.map((t, i) => (
            <TeamCard
              key={t.teamId}
              rank={i + 1}
              team={t}
              table={tableByTeam[t.teamId] ?? null}
              rubric={rubric}
            />
          ))}
        </>
      )}

      <DashboardButton
        type="button"
        variant="outline"
        disabled={refreshing}
        onClick={onRefresh}
        className={`${touch} ${fullWidth}`}
      >
        {refreshing ? "Refreshing\u2026" : "Refresh"}
      </DashboardButton>
    </div>
  );
}