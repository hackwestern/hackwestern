import { card, primaryButton } from "~/components/judging/judge-ui";

interface PublicJudgeScanProps {
  /** The table the scanned QR belongs to. */
  table: number;
  judgesSoFar: number;
  judgesNeeded: number;
  onScore: (table: number) => void;
}

/**
 * Body of the "Scan team QR" screen. The camera is a placeholder and the
 * scan result is mock data: it always "finds" the table passed in.
 */
export function PublicJudgeScan({
  table,
  judgesSoFar,
  judgesNeeded,
  onScore,
}: PublicJudgeScanProps) {
  return (
    <>
      <div
        role="img"
        aria-label="Camera placeholder"
        className="flex aspect-square w-full items-center justify-center rounded-2xl border-[1.5px] border-[#0b2238] bg-[#d6dbe5] text-[17px] text-[#4a5d73]"
      >
        camera
      </div>

      <section
        aria-label="Scan result"
        className={`${card} flex flex-col gap-2 px-4 py-3.5`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px]">Found</span>
          <span className="text-[20px] font-bold tabular-nums">
            Table {table}
          </span>
        </div>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[17px]">Judges so far</span>
          <span className="text-[20px] font-bold tabular-nums">
            {judgesSoFar} of {judgesNeeded}
          </span>
        </div>
      </section>

      <button
        type="button"
        onClick={() => onScore(table)}
        className={primaryButton}
      >
        Score this team
      </button>
    </>
  );
}