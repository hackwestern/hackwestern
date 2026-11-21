import {
  CARD,
  CARD_TITLE,
  MUTED,
  type Progress,
  formatHold,
} from "./control-shared";

type Spot = Progress["tables"][number];
type Kind = "judging" | "waiting" | "finished" | "empty" | "off";

/** Physical tables drawn, even before the DB has rows for all of them. */
const MIN_PHYSICAL_TABLES = 70;
/** In the DB a "table" is one team's spot; a physical table holds two. */
const SPOTS_PER_TABLE = 2;
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

function kindOf(s: Spot | undefined): Kind {
  if (!s?.isActive) return "off";
  if (!s.team) return "empty";
  if (s.judges.some((j) => j.status === "in_progress")) return "judging";
  const open = s.judges.some((j) => j.status === "assigned");
  if (s.judges.length > 0 && !open) return "finished";
  return "waiting";
}

function SpotBox({
  number,
  spot,
  now,
}: {
  number: number;
  spot: Spot | undefined;
  now: number;
}) {
  const kind = kindOf(spot);
  const style = KINDS[kind];
  const current = spot?.judges.find((j) => j.status === "in_progress");
  const held = current?.startedAt
    ? formatHold(now - new Date(current.startedAt).getTime())
    : null;
  return (
    <div
      className={`flex min-h-[72px] min-w-0 flex-1 flex-col gap-0.5 border-[1.5px] p-1 first:rounded-l-lg last:rounded-r-lg ${style.box}`}
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
    </div>
  );
}

/**
 * Live room map. Each box is a physical table holding two spots, numbered
 * sequentially (1, 2 | 3, 4 | ...), and fills with its team and judging
 * progress. Tables run in a snake like the judges' map: row one left to
 * right, row two right to left.
 */
export function ControlTablesStatus({
  progress,
  now,
}: {
  progress: Progress | undefined;
  now: number;
}) {
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
    empty: 0,
    off: 0,
  };
  for (let n = 1; n <= physical * SPOTS_PER_TABLE; n++)
    counts[kindOf(byNumber.get(n))]++;

  return (
    <section className={CARD} aria-labelledby="tables-status-title">
      <h2 id="tables-status-title" className={CARD_TITLE}>
        Tables and assignments{progress ? ` · ${physical} tables` : ""}
      </h2>
      {!progress ? (
        <p className={`m-0 text-sm ${MUTED}`}>Loading the tables…</p>
      ) : (
        <>
          <ul className="m-0 flex list-none flex-wrap gap-x-4 gap-y-1 p-0 text-sm">
            {(Object.keys(KINDS) as Kind[]).map((k) => (
              <li key={k} className="flex items-center gap-1.5">
                <span className={`size-2.5 rounded-full ${KINDS[k].dot}`} />
                {KINDS[k].label}
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
              return (
                <div key={p} className="flex">
                  {Array.from({ length: SPOTS_PER_TABLE }, (_, k) => (
                    <SpotBox
                      key={k}
                      number={first + k}
                      spot={byNumber.get(first + k)}
                      now={now}
                    />
                  ))}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
