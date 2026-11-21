import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "~/components/ui/dialog";
import { DEFAULT_RUBRIC } from "~/components/judging/shared/rubric-scorer";
import { api } from "~/utils/api";
import {
  BTN_DARK,
  BTN_OUTLINE,
  CARD,
  CARD_TITLE,
  FIELD,
  MUTED,
  type Progress,
  type QueueState,
  type RoundOverview,
  type Status,
  StatusLine,
  errorText,
  formatHold,
} from "./control-shared";

type Spot = Progress["tables"][number];
type Kind = "judging" | "waiting" | "finished" | "free" | "empty" | "off";

/** Physical tables drawn, even before the DB has rows for all of them. */
const MIN_PHYSICAL_TABLES = 70;
/** In the DB a "table" is one team's spot; a physical table holds two. */
const SPOTS_PER_TABLE = 2;
/** DB tables the room needs: one per team spot. */
const SPOT_COUNT = MIN_PHYSICAL_TABLES * SPOTS_PER_TABLE;
/** Tables per row, in snake order. Sized so the whole room fits on screen. */
const COLS = 10;

const KINDS: Record<Kind, { label: string; box: string; dot: string }> = {
  judging: {
    label: "Being judged",
    box: "border-[#7aa7e6] bg-[#e4effd]",
    dot: "bg-[#2f6fd0]",
  },
  waiting: {
    label: "Waiting for a judge",
    box: "border-[#e5c36a] bg-[#fff3d6]",
    dot: "bg-[#c78a00]",
  },
  finished: {
    label: "All judges done",
    box: "border-[#8cc99a] bg-[#e3f4e6]",
    dot: "bg-[#1f8a3a]",
  },
  free: {
    label: "No judge this round",
    box: "border-[#d6dbe5] bg-white",
    dot: "bg-[#8a96a8]",
  },
  empty: {
    label: "No team",
    box: "border-[#d6dbe5] bg-white",
    dot: "bg-[#c3cad8]",
  },
  off: {
    label: "Not in use",
    box: "border-dashed border-[#d6dbe5] bg-[#f3f5f9]",
    dot: "bg-[#d6dbe5]",
  },
};

/** With timed rounds, what the waiting and done colours mean. */
const ROUND_LABELS: Partial<Record<Kind, string>> = {
  waiting: "Waiting for this round's judge",
  finished: "Scored this round",
};

/** A kind's colours, with labels for the current round when rounds are on. */
function styleOf(kind: Kind, round: number | null) {
  const label = round !== null ? ROUND_LABELS[kind] : undefined;
  return label ? { ...KINDS[kind], label } : KINDS[kind];
}

/**
 * With timed rounds (`round` set), only this round's stop counts: a table
 * goes green once its judge submits, and every table resets when the next
 * round starts. Without rounds, green means all its judges are done.
 */
function kindOf(s: Spot | undefined, round: number | null = null): Kind {
  if (!s?.isActive) return "off";
  if (!s.team) return "empty";
  if (round !== null) {
    const stop = s.judges.find(
      (j) => j.position === round && j.status !== "cancelled",
    );
    if (!stop) return "free";
    if (stop.status === "in_progress") return "judging";
    return stop.status === "assigned" ? "waiting" : "finished";
  }
  if (s.judges.some((j) => j.status === "in_progress")) return "judging";
  const open = s.judges.some((j) => j.status === "assigned");
  if (s.judges.length > 0 && !open) return "finished";
  return "waiting";
}

function SpotBox({
  number,
  spot,
  now,
  round,
  onOpen,
}: {
  number: number;
  spot: Spot | undefined;
  now: number;
  round: number | null;
  onOpen: () => void;
}) {
  const kind = kindOf(spot, round);
  const style = styleOf(kind, round);
  const current = spot?.judges.find((j) => j.status === "in_progress");
  const held = current?.startedAt
    ? formatHold(now - new Date(current.startedAt).getTime())
    : null;
  return (
    <button
      type="button"
      onClick={onOpen}
      disabled={!spot}
      aria-label={`Table ${number}${spot?.team ? `, ${spot.team.name}` : ""}: ${style.label}. Show details`}
      className={`flex min-h-[72px] min-w-0 flex-1 flex-col gap-0.5 border-[1.5px] p-1 text-left first:rounded-l-lg last:rounded-r-lg enabled:cursor-pointer enabled:hover:brightness-95 enabled:focus-visible:outline enabled:focus-visible:outline-2 enabled:focus-visible:outline-[#5b3fa0] ${style.box}`}
      title={[
        `Table ${number}`,
        spot?.team?.name,
        style.label,
        current ? `${current.name} (${held})` : null,
      ]
        .filter(Boolean)
        .join(" · ")}
    >
      <div className="flex items-center justify-between gap-1">
        <span className="text-sm font-bold tabular-nums">{number}</span>
        <span
          className={`size-2.5 shrink-0 rounded-full ${style.dot}`}
          aria-label={style.label}
        />
      </div>
      <span className="hidden break-words text-[10px] font-semibold leading-tight md:line-clamp-2">
        {spot?.team?.name ?? ""}
      </span>
      {spot?.team && (
        <span className={`mt-auto truncate text-[10px] tabular-nums ${MUTED}`}>
          {spot.judgesDone}/{spot.judges.length}
          {current ? ` · ${held}` : ""}
        </span>
      )}
    </button>
  );
}

const JUDGE_STATUS: Record<string, string> = {
  assigned: "Waiting",
  in_progress: "At the table",
  done: "Scored",
  team_absent: "Team absent",
};

/** One spot's team, its judges, and every mark it has received. */
function SpotDialog({
  number,
  spot,
  now,
  round,
  onClose,
}: {
  number: number | null;
  spot: Spot | undefined;
  now: number;
  round: number | null;
  onClose: () => void;
}) {
  const open = number !== null;
  const teamId = spot?.team?.id;
  const resultsQ = api.judging.admin.getTeamResults.useQuery(undefined, {
    enabled: open && !!teamId,
    refetchInterval: 3000,
  });
  const result = resultsQ.data?.find((r) => r.team.id === teamId);
  const kind = styleOf(kindOf(spot, round), round);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            Table {number} · {spot?.team?.name ?? "No team"}
          </DialogTitle>
          <DialogDescription>
            {kind.label}
            {spot?.zone ? ` · ${spot.zone}` : ""}
          </DialogDescription>
        </DialogHeader>

        {!spot?.team ? (
          <p className={`m-0 text-sm ${MUTED}`}>No team is seated here.</p>
        ) : (
          <div className="flex flex-col gap-5 text-sm">
            {(result?.team.github ?? result?.team.devpost) && (
              <p className="m-0 flex flex-wrap gap-x-4 gap-y-1">
                {result.team.github && (
                  <a
                    href={result.team.github}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#5b3fa0] underline"
                  >
                    GitHub
                  </a>
                )}
                {result.team.devpost && (
                  <a
                    href={result.team.devpost}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-[#5b3fa0] underline"
                  >
                    Devpost
                  </a>
                )}
              </p>
            )}

            <section aria-label="Judges at this table">
              <h3 className="m-0 mb-1.5 text-base font-bold">Judges</h3>
              {spot.judges.length === 0 ? (
                <p className={`m-0 ${MUTED}`}>No judges assigned yet.</p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-1 p-0">
                  {spot.judges.map((j) => (
                    <li
                      key={j.assignmentId}
                      className="flex items-baseline justify-between gap-3"
                    >
                      <span className="font-semibold">{j.name}</span>
                      <span className={`tabular-nums ${MUTED}`}>
                        {JUDGE_STATUS[j.status] ?? j.status}
                        {j.status === "in_progress" && j.startedAt
                          ? ` · ${formatHold(now - new Date(j.startedAt).getTime())}`
                          : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section aria-label="Round history">
              <h3 className="m-0 mb-1.5 text-base font-bold">Round history</h3>
              {resultsQ.isLoading ? (
                <p className={`m-0 ${MUTED}`}>Loading…</p>
              ) : !result || result.regular.marks.length === 0 ? (
                <p className={`m-0 ${MUTED}`}>No scores yet.</p>
              ) : (
                <ol className="m-0 flex list-none flex-col gap-3 p-0">
                  {result.regular.marks.map((m, i) => (
                    <li
                      key={m.judgeId}
                      className="rounded-xl border border-[#e3e7ef] p-3"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <span className="font-semibold">
                          Round {i + 1} · {m.judgeName}
                        </span>
                        <span className="text-lg font-bold tabular-nums text-[#5b3fa0]">
                          {m.score.toFixed(1)}
                        </span>
                      </div>
                      {DEFAULT_RUBRIC.criteria.some(
                        (c) => m.ratings[c.id] !== undefined,
                      ) && (
                        <p className={`m-0 mt-1 text-xs tabular-nums ${MUTED}`}>
                          {DEFAULT_RUBRIC.criteria
                            .filter((c) => m.ratings[c.id] !== undefined)
                            .map(
                              (c) => `${c.name} ${m.ratings[c.id]!.toFixed(1)}`,
                            )
                            .join(" · ")}
                        </p>
                      )}
                      {m.notes && (
                        <p className="m-0 mt-1.5 whitespace-pre-wrap">
                          {m.notes}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {result && result.regular.average !== null && (
                <p className={`m-0 mt-2 ${MUTED}`}>
                  Average {result.regular.average.toFixed(1)} across{" "}
                  {result.regular.count} judge
                  {result.regular.count === 1 ? "" : "s"}.
                </p>
              )}
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pick any two tables and trade what is at them. A seated team swaps with the
 * team at the other table, or just moves if the other table is empty.
 */
function SwapDialog({
  open,
  tables,
  onClose,
  onSwapped,
}: {
  open: boolean;
  tables: Spot[];
  onClose: () => void;
  onSwapped: () => void;
}) {
  const [a, setA] = useState("");
  const [b, setB] = useState("");
  const [error, setError] = useState<string | null>(null);
  const swap = api.judging.admin.swapTeams.useMutation();
  const move = api.judging.admin.moveTeam.useMutation();
  const pending = swap.isPending || move.isPending;

  const close = () => {
    setA("");
    setB("");
    setError(null);
    onClose();
  };
  const find = (n: string) => tables.find((t) => String(t.number) === n);
  const options = (skip: string) =>
    tables
      .filter((t) => t.isActive && String(t.number) !== skip)
      .map((t) => (
        <option key={t.id} value={t.number}>
          Table {t.number} · {t.team?.name ?? "empty"}
        </option>
      ));
  const sa = find(a);
  const sb = find(b);
  const bothEmpty = !!sa && !!sb && !sa.team && !sb.team;

  const submit = async () => {
    if (!sa || !sb) return;
    setError(null);
    try {
      if (sa.team && sb.team)
        await swap.mutateAsync({ teamAId: sa.team.id, teamBId: sb.team.id });
      else if (sa.team)
        await move.mutateAsync({ teamId: sa.team.id, tableId: sb.id });
      else if (sb.team)
        await move.mutateAsync({ teamId: sb.team.id, tableId: sa.id });
      onSwapped();
      close();
    } catch (e) {
      setError(errorText(e as { message: string }));
    }
  };

  const line = (from: Spot, to: Spot) =>
    from.team ? (
      <>
        {from.team.name}: table {from.number} → {to.number}
        <br />
      </>
    ) : null;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Swap tables</DialogTitle>
          <DialogDescription>
            Pick any two tables and whatever is at them trades places. Judges
            stay with their table numbers, so each judge will see the other
            team.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 text-sm">
          <label className={`flex flex-col gap-1 ${MUTED}`}>
            First table
            <select
              className={FIELD}
              value={a}
              onChange={(e) => setA(e.target.value)}
            >
              <option value="">Choose a table…</option>
              {options(b)}
            </select>
          </label>
          <label className={`flex flex-col gap-1 ${MUTED}`}>
            Second table
            <select
              className={FIELD}
              value={b}
              onChange={(e) => setB(e.target.value)}
            >
              <option value="">Choose a table…</option>
              {options(a)}
            </select>
          </label>
          {sa && sb && (
            <p className="m-0 rounded-lg bg-[#f3f5f9] p-3 font-medium text-[#0b2238]">
              {bothEmpty ? (
                "Both tables are empty, so there is nothing to swap."
              ) : (
                <>
                  {line(sa, sb)}
                  {line(sb, sa)}
                </>
              )}
            </p>
          )}
          <StatusLine status={error ? { tone: "error", text: error } : null} />
        </div>
        <DialogFooter>
          <button type="button" className={BTN_OUTLINE} onClick={close}>
            Cancel
          </button>
          <button
            type="button"
            className={BTN_DARK}
            disabled={!sa || !sb || bothEmpty || pending}
            onClick={() => void submit()}
          >
            {pending ? "Swapping…" : "Swap tables"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Live room map. Each box is a physical table holding two spots, numbered
 * sequentially (1, 2 | 3, 4 | ...; flipped on right-to-left rows), and fills with its team and judging
 * progress. Tables run in a snake like the judges' map: row one left to
 * right, row two right to left.
 */
export function ControlTablesStatus({
  progress,
  queue,
  now,
  timed,
}: {
  progress: Progress | undefined;
  queue: QueueState | undefined;
  now: number;
  /** The timed rounds: tables are coloured for the current round. */
  timed: RoundOverview | undefined;
}) {
  const round = timed?.enabled && timed.round > 0 ? timed.round : null;
  const utils = api.useUtils();
  const [status, setStatus] = useState<Status>(null);
  const [openSpot, setOpenSpot] = useState<number | null>(null);
  const [swapOpen, setSwapOpen] = useState(false);
  const setup = api.judging.admin.setupTables.useMutation();
  const seat = api.judging.admin.seatTeams.useMutation();
  const assign = api.judging.admin.autoAssign.useMutation();
  const busy = setup.isPending || seat.isPending || assign.isPending;
  const locked = progress?.started === true;

  // Set up the room and reseat teams if any are missing a spot.
  const run = async () => {
    if (!progress) return;
    setStatus(null);
    try {
      const { settings } = progress;
      const needsSetup = settings.tableCount !== SPOT_COUNT;
      if (needsSetup)
        await setup.mutateAsync({
          tableCount: SPOT_COUNT,
          rows: settings.rows,
          judgesPerTable: settings.judgesPerTable,
        });
      const unseated =
        needsSetup || progress.teams.seated < progress.teams.submitted;
      if (unseated) await seat.mutateAsync({ random: true });
      await assign.mutateAsync();
      setStatus({ tone: "ok", text: "Judges assigned to tables." });
    } catch (e) {
      setStatus({
        tone: "error",
        text: `Couldn't assign judges. ${errorText(e as { message: string })}`,
      });
    }
    void utils.judging.admin.invalidate();
  };

  const reseat = async () => {
    if (!progress) return;
    if (
      progress.teams.seated > 0 &&
      !window.confirm("Move every team to a new random table?")
    )
      return;
    setStatus(null);
    try {
      const { planCleared } = await seat.mutateAsync({ random: true });
      if (planCleared) {
        try {
          await assign.mutateAsync();
        } catch (e) {
          setStatus({
            tone: "error",
            text: `Teams moved, but judge routes couldn't be rebuilt. ${errorText(e as { message: string })}`,
          });
          return;
        }
      }
      setStatus({
        tone: "ok",
        text: planCleared
          ? "Teams moved and judge routes rebuilt."
          : "Teams moved to new tables.",
      });
    } catch (e) {
      setStatus({
        tone: "error",
        text: `Couldn't reassign teams. ${errorText(e as { message: string })}`,
      });
    } finally {
      void utils.judging.admin.invalidate();
    }
  };

  const pill = !progress
    ? "Loading…"
    : locked
      ? "Judging has started"
      : `${queue?.teams.length ?? 0} team${queue?.teams.length === 1 ? "" : "s"} to judge`;

  const byNumber = new Map((progress?.tables ?? []).map((t) => [t.number, t]));
  const highest = Math.max(0, ...byNumber.keys());
  const physical = Math.max(
    MIN_PHYSICAL_TABLES,
    Math.ceil(highest / SPOTS_PER_TABLE),
  );

  // Snake order: every other row runs right to left.
  const order: number[] = [];
  for (let start = 0; start < physical; start += COLS) {
    const row = Array.from(
      { length: Math.min(COLS, physical - start) },
      (_, i) => start + i + 1,
    );
    order.push(...(Math.floor(start / COLS) % 2 === 0 ? row : row.reverse()));
  }

  const counts: Record<Kind, number> = {
    judging: 0,
    waiting: 0,
    finished: 0,
    free: 0,
    empty: 0,
    off: 0,
  };
  for (let n = 1; n <= physical * SPOTS_PER_TABLE; n++)
    counts[kindOf(byNumber.get(n), round)]++;

  return (
    <section className={CARD} aria-labelledby="tables-status-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="tables-status-title" className={CARD_TITLE}>
          Tables &amp; assignment
        </h2>
        <div className="flex flex-wrap items-center gap-3">
          <span className={`text-sm font-semibold ${MUTED}`}>{pill}</span>
          <button
            type="button"
            className={BTN_OUTLINE}
            disabled={busy || !progress}
            onClick={() => setSwapOpen(true)}
          >
            Swap tables
          </button>
          <button
            type="button"
            className={BTN_OUTLINE}
            disabled={busy || locked || !progress}
            onClick={() => void reseat()}
          >
            {seat.isPending && !assign.isPending ? "Moving…" : "Reassign teams"}
          </button>
          <button
            type="button"
            className={BTN_DARK}
            disabled={busy || locked || !progress}
            onClick={() => void run()}
          >
            {busy ? "Assigning…" : "Auto-assign judges"}
          </button>
        </div>
      </div>
      <StatusLine status={status} />
      {!progress ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading the tables…</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${KINDS[k].dot}`} />
                {styleOf(k, round).label}
                <span className={`tabular-nums ${MUTED}`}>{counts[k]}</span>
              </li>
            ))}
          </ul>
          <div
            className="grid gap-1.5"
            style={{ gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))` }}
          >
            {order.map((p) => {
              const first = (p - 1) * SPOTS_PER_TABLE + 1;
              // On right-to-left rows the lower spot goes on the right, so
              // the numbers keep running along the snake (20, then 21 | 22
              // read right to left).
              const reversed = Math.floor((p - 1) / COLS) % 2 === 1;
              return (
                <div key={p} className="flex">
                  {Array.from({ length: SPOTS_PER_TABLE }, (_, k) => {
                    const n = first + (reversed ? SPOTS_PER_TABLE - 1 - k : k);
                    return (
                      <SpotBox
                        key={n}
                        number={n}
                        spot={byNumber.get(n)}
                        now={now}
                        round={round}
                        onOpen={() => setOpenSpot(n)}
                      />
                    );
                  })}
                </div>
              );
            })}
          </div>
        </>
      )}
      <SwapDialog
        open={swapOpen}
        tables={progress?.tables ?? []}
        onClose={() => setSwapOpen(false)}
        onSwapped={() => {
          setStatus({ tone: "ok", text: "Teams swapped." });
          void utils.judging.admin.invalidate();
        }}
      />
      <SpotDialog
        number={openSpot}
        spot={openSpot === null ? undefined : byNumber.get(openSpot)}
        now={now}
        round={round}
        onClose={() => setOpenSpot(null)}
      />
    </section>
  );
}
