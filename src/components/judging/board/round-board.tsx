import { useMemo, useState } from "react";

import { RoundClock } from "~/components/judging/judge-app/judge-round";
import {
  card,
  field,
  warningBanner,
} from "~/components/judging/shared/judge-ui";
import { api, type RouterOutputs } from "~/utils/api";

type Board = RouterOutputs["judging"]["board"]["get"];
type Stop = Board["stops"][number];
type Status = Stop["status"];
type View = "team" | "judge";

const POLL_MS = 5000;

const CELL: Record<Status, string> = {
  done: "border-[#8cc99a] bg-[#e3f4e6] text-[#14532d]",
  now: "border-[#7aa7e6] bg-[#e4effd] text-[#123d75]",
  upcoming:
    "border-dashboard-border-subtle bg-dashboard-bg-surface text-dashboard-text-heavy",
  skipped:
    "border-dashboard-border-default bg-dashboard-bg-inset text-dashboard-text-light",
};

const LEGEND: { status: Status; label: string }[] = [
  { status: "upcoming", label: "Coming up" },
  { status: "now", label: "Happening now" },
  { status: "done", label: "Done" },
  { status: "skipped", label: "Skipped" },
];

function Cell({
  status,
  title,
  sub,
}: {
  status: Status;
  title: string;
  sub?: string;
}) {
  return (
    <div
      className={`flex min-h-[44px] min-w-[104px] flex-col rounded-lg border px-2 py-1 ${CELL[status]}`}
    >
      <span className="line-clamp-2 text-xs font-semibold leading-tight">
        {title}
      </span>
      {sub && (
        <span className="text-[11px] tabular-nums opacity-70">{sub}</span>
      )}
    </div>
  );
}

interface Row {
  key: string;
  label: string;
  sub: string;
  /** Round number -> what happens in it. */
  cells: Map<number, { title: string; sub?: string; status: Status }>;
  search: string;
}

function buildRows(stops: Stop[], view: View): Row[] {
  const rows = new Map<string, Row>();
  for (const s of stops) {
    const key = view === "team" ? `t${s.table}` : `j${s.judge}`;
    let row = rows.get(key);
    if (!row) {
      row =
        view === "team"
          ? {
              key,
              label: s.team,
              sub: `Table ${s.table}`,
              cells: new Map(),
              search: `${s.team} ${s.table}`.toLowerCase(),
            }
          : {
              key,
              label: `Judge ${s.judge}`,
              sub: "",
              cells: new Map(),
              search: `judge ${s.judge}`,
            };
      rows.set(key, row);
    }
    row.cells.set(
      s.round,
      view === "team"
        ? { title: `Judge ${s.judge}`, status: s.status }
        : { title: s.team, sub: `Table ${s.table}`, status: s.status },
    );
    if (view === "judge") row.search += ` ${s.team} ${s.table}`.toLowerCase();
  }
  const list = [...rows.values()];
  // Teams by table number, judges by their number.
  const n = (r: Row) => Number(r.key.slice(1));
  return list.sort((a, b) => n(a) - n(b));
}

/**
 * The rounds board. Organizers see who judges whom, round by round. Hackers
 * only see their own team: its table and whether it's being judged now.
 */
export function RoundBoard({ isOrganizer = false }: { isOrganizer?: boolean }) {
  const accessQ = api.judging.board.getAccess.useQuery(undefined, {
    refetchInterval: POLL_MS,
  });
  const open = accessQ.data?.visible === true;
  const boardQ = api.judging.board.get.useQuery(undefined, {
    enabled: open && isOrganizer,
    refetchInterval: POLL_MS,
  });
  // A hacker's own team: its table, this round, and whether it was absent.
  const teamQ = api.judging.team.getMyJudging.useQuery(undefined, {
    enabled: open && !isOrganizer,
    refetchInterval: POLL_MS,
    retry: false,
  });
  const [view, setView] = useState<View>("team");
  const [query, setQuery] = useState("");

  const board = boardQ.data;
  const rounds = useMemo(
    () => Math.max(0, ...(board?.stops ?? []).map((s) => s.round)),
    [board],
  );
  const rows = useMemo(
    () => (board ? buildRows(board.stops, view) : []),
    [board, view],
  );
  const round = board?.round;
  const current = round?.enabled && round.round > 0 ? round.round : null;
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter((r) => r.search.includes(q)) : rows;

  if (accessQ.data && !open) {
    return (
      <div className="flex flex-col gap-4 font-figtree">
        <p className="m-0 text-base font-medium text-dashboard-text-light">
          The rounds aren&apos;t open yet. Check back soon.
        </p>
      </div>
    );
  }

  if (!isOrganizer) {
    const mine = teamQ.data;
    return (
      <div className="flex flex-col gap-4 font-figtree">
        {teamQ.isLoading || !accessQ.data ? (
          <p className="m-0 text-base font-medium text-dashboard-text-light">
            Loading…
          </p>
        ) : !mine ? (
          <p className="m-0 text-base font-medium text-dashboard-text-light">
            Join a team to see when it&apos;s being judged.
          </p>
        ) : mine.absent ? (
          <p role="status" className={warningBanner}>
            Your team was marked absent, so it&apos;s out of judging. If
            that&apos;s a mistake, find an organizer now.
          </p>
        ) : !mine.table ? (
          <p className="m-0 text-base font-medium text-dashboard-text-light">
            Your team doesn&apos;t have a table yet. Check back soon.
          </p>
        ) : (
          <section
            aria-label="Your team"
            className={`${card} flex flex-col gap-1 p-4`}
          >
            <span className="text-sm font-semibold text-dashboard-text-light">
              Your team · Table {mine.table.number}
            </span>
            <span className="text-2xl font-bold text-dashboard-text-heavy">
              {mine.thisRound === null
                ? "Judging hasn't started yet. Stay at your table."
                : mine.thisRound === "now"
                  ? "A judge is coming to your table now."
                  : mine.thisRound === "done"
                    ? `You've been judged in round ${mine.round}.`
                    : mine.thisRound === "over"
                      ? `Round ${mine.round} is over. Stay at your table.`
                      : `No judge at your table in round ${mine.round}.`}
            </span>
            <span className="text-sm font-medium text-dashboard-text-light">
              {mine.judges.done} of {mine.judges.total} judges done
            </span>
          </section>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 font-figtree">
      <header className="flex flex-col gap-2">
        <p className="m-0 text-base font-medium text-dashboard-text-light">
          {accessQ.data && !open
            ? "The rounds aren't open yet. Check back soon."
            : !round
              ? "Loading…"
              : !round.enabled
                ? "Judges are visiting tables in any order."
                : round.status === "idle"
                  ? "Judging hasn't started yet. Check back soon."
                  : `Round ${round.round} of ${round.totalRounds}`}
        </p>
        {isOrganizer && accessQ.data && (
          <p className="m-0 w-fit rounded-full bg-dashboard-bg-highlight px-3 py-1 text-sm font-semibold text-dashboard-text-active">
            {accessQ.data.shownToHackers
              ? "Hackers can see this page."
              : "Hidden from hackers. Use the eye button in the menu to show it."}
          </p>
        )}
      </header>

      {round?.enabled && round.round > 0 && (
        <div>
          <RoundClock
            view={{ state: round, fetchedAt: boardQ.dataUpdatedAt }}
            forJudge={false}
          />
        </div>
      )}

      <section className={`${card} flex flex-col gap-3 p-4`}>
        <div className="flex flex-wrap items-center gap-3">
          <div
            role="group"
            aria-label="View"
            className="inline-flex rounded-dashboard-lg border border-dashboard-border-default p-0.5"
          >
            {(
              [
                ["team", "By team"],
                ["judge", "By judge"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={view === id}
                onClick={() => setView(id)}
                className={`min-h-10 rounded-[10px] px-4 text-sm font-semibold ${
                  view === id
                    ? "bg-dashboard-action-primary text-dashboard-text-inverse"
                    : "text-dashboard-text-heavy"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            aria-label={view === "team" ? "Find your team" : "Find a judge"}
            placeholder={
              view === "team"
                ? "Find your team or table…"
                : "Find a judge or team…"
            }
            className={`${field} min-w-[200px] flex-1 sm:max-w-xs`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="m-0 ml-auto flex list-none flex-wrap gap-x-3 gap-y-1 p-0 text-xs text-dashboard-text-light">
            {LEGEND.map((l) => (
              <li key={l.status} className="flex items-center gap-1.5">
                <span
                  aria-hidden="true"
                  className={`size-3 rounded border ${CELL[l.status]}`}
                />
                {l.label}
              </li>
            ))}
          </ul>
        </div>

        {!board ? (
          <p className="m-0 text-base font-medium text-dashboard-text-light">
            Loading…
          </p>
        ) : board.stops.length === 0 ? (
          <p className="m-0 text-base font-medium text-dashboard-text-light">
            The rounds haven&apos;t been planned yet.
          </p>
        ) : shown.length === 0 ? (
          <p className="m-0 text-base font-medium text-dashboard-text-light">
            Nothing matches that.
          </p>
        ) : (
          <div className="max-h-[70vh] overflow-auto rounded-xl border border-dashboard-border-subtle">
            <table className="w-full border-separate border-spacing-0 text-sm">
              <thead>
                <tr>
                  <th className="sticky left-0 top-0 z-20 min-w-[150px] border-b border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-2 text-left font-semibold">
                    {view === "team" ? "Team" : "Judge"}
                  </th>
                  {Array.from({ length: rounds }, (_, i) => i + 1).map((n) => (
                    <th
                      key={n}
                      scope="col"
                      aria-current={n === current ? "step" : undefined}
                      className={`sticky top-0 z-10 min-w-[116px] border-b border-dashboard-border-subtle px-2 py-2 text-left font-semibold ${
                        n === current
                          ? "bg-dashboard-bg-highlight text-dashboard-text-active"
                          : "bg-dashboard-bg-surface"
                      }`}
                    >
                      Round {n}
                      {n === current ? " · now" : ""}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {shown.map((r) => (
                  <tr key={r.key}>
                    <th
                      scope="row"
                      className="sticky left-0 z-10 border-b border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-1.5 text-left"
                    >
                      <span className="block max-w-[200px] truncate font-semibold">
                        {r.label}
                      </span>
                      {r.sub && (
                        <span className="text-xs font-medium text-dashboard-text-light">
                          {r.sub}
                        </span>
                      )}
                    </th>
                    {Array.from({ length: rounds }, (_, i) => i + 1).map(
                      (n) => {
                        const cell = r.cells.get(n);
                        return (
                          <td
                            key={n}
                            className={`border-b border-dashboard-border-subtle p-1 align-top ${
                              n === current
                                ? "bg-dashboard-bg-highlight/40"
                                : ""
                            }`}
                          >
                            {cell ? (
                              <Cell
                                status={cell.status}
                                title={cell.title}
                                sub={cell.sub}
                              />
                            ) : (
                              <span className="block px-2 py-1 text-dashboard-text-light">
                                –
                              </span>
                            )}
                          </td>
                        );
                      },
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
