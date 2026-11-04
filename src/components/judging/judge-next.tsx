import {
  card,
  primaryButton,
  secondaryButton,
} from "~/components/judging/judge-ui";

// Placeholder floor map: a grid of tables with one highlighted.
// Replace with the real map once table positions exist.
const MAP_ROWS = 5;
const MAP_COLS = 13;
const HIGHLIGHT = { row: 1, col: 5 };

function MapPlaceholder() {
  return (
    <div
      role="img"
      aria-label="Floor map placeholder. Your next table is highlighted."
      className="grid gap-[5px]"
      style={{ gridTemplateColumns: `repeat(${MAP_COLS}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: MAP_ROWS * MAP_COLS }, (_, i) => {
        const row = Math.floor(i / MAP_COLS);
        const col = i % MAP_COLS;
        const here = row === HIGHLIGHT.row && col === HIGHLIGHT.col;
        return (
          <span
            key={i}
            className={`aspect-[3/2] rounded-[3px] border ${
              here
                ? "border-[#0b2238] bg-[#0b2238] ring-2 ring-[#5b3fa0] ring-offset-1"
                : "border-[#c3cad8] bg-white"
            }`}
          />
        );
      })}
    </div>
  );
}

interface PublicJudgeNextProps {
  started: boolean;
  onStart: () => void;
  /** Table numbers this judge covers, in order. */
  tables: number[];
  /** Index into `tables` of the table to visit next. */
  currentIndex: number;
  /** Set when the judge said they are at a different table than expected. */
  override: number | null;
  onWrongTable: () => void;
  onScan: () => void;
}

/** The "Next" tab: a welcome first, then the next table once judging starts. */
export function PublicJudgeNext({
  started,
  onStart,
  tables,
  currentIndex,
  override,
  onWrongTable,
  onScan,
}: PublicJudgeNextProps) {
  if (!started) {
    const first = tables[0];
    const last = tables[tables.length - 1];
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-[22px] font-bold">Welcome, judge</h1>
          <p className="text-[17px] text-[#4a5d73]">No account needed</p>
        </section>
        <section
          className={`${card} flex items-baseline justify-between gap-3 px-4 py-3.5`}
        >
          <span className="text-[17px]">Your tables</span>
          <span className="text-[20px] font-bold tabular-nums">
            {first === undefined
              ? "None yet"
              : first === last
                ? first
                : `${first}–${last}`}
          </span>
        </section>
        <button type="button" onClick={onStart} className={primaryButton}>
          Start judging
        </button>
      </>
    );
  }

  const expected = tables[currentIndex];
  const table = override ?? expected;

  // Every assigned table is done. Scanning is still open for ad hoc teams.
  if (table === undefined) {
    return (
      <>
        <section className={`${card} flex flex-col gap-1.5 p-4`}>
          <h1 className="text-[22px] font-bold">All done</h1>
          <p className="text-[17px] text-[#4a5d73]">
            You&apos;ve judged all your tables. Thank you!
          </p>
        </section>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onScan}
            className={`${secondaryButton} px-4`}
          >
            Scan team QR
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <section
        aria-labelledby="next-table-label"
        className={`${card} flex flex-col gap-2 p-4`}
      >
        <span id="next-table-label" className="text-[17px] text-[#4a5d73]">
          Next table
        </span>
        <span className="text-[64px] font-bold leading-none tabular-nums">
          {table ?? "–"}
        </span>
        {/* Placeholder directions. */}
        <span className="mt-2 text-[17px]">
          {override !== null && override !== expected
            ? `Changed from ${expected ?? "–"}`
            : "Row 2 · walk right"}
        </span>
      </section>

      <section aria-label="Floor map" className={`${card} p-3.5`}>
        <MapPlaceholder />
      </section>

      {/* Placeholder clock: static until the pitch timer is wired up. */}
      <section
        aria-label="Presentation time"
        className={`${card} flex items-center justify-between gap-3 px-4 py-3`}
      >
        <span className="text-[17px]">Presentation</span>
        <span className="font-mono text-[32px] font-bold tabular-nums">
          02:41
        </span>
      </section>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onWrongTable}
          className={`${secondaryButton} px-4`}
        >
          Wrong table?
        </button>
        <button
          type="button"
          onClick={onScan}
          className={`${secondaryButton} px-4`}
        >
          Scan team QR
        </button>
      </div>
    </>
  );
}