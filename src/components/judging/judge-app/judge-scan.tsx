import { useEffect, useState } from "react";

import { QrCamera } from "~/components/judging/judge-app/judge-camera";
import { parseTableCode } from "~/components/judging/judge-app/judge-qr";
import {
  card,
  focusRing,
  primaryButton,
  secondaryButton,
} from "~/components/judging/shared/judge-ui";

interface PublicJudgeScanProps {
  /** Placeholder until the backend knows how many judges a team has had. */
  judgesSoFar: number;
  judgesNeeded: number;
  onScore: (table: number) => void;
}

/**
 * Body of the "Scan team QR" screen: a live camera that reads the team's QR
 * code, with a typed table number as the fallback.
 */
export function PublicJudgeScan({
  judgesSoFar,
  judgesNeeded,
  onScore,
}: PublicJudgeScanProps) {
  const [found, setFound] = useState<number | null>(null);
  const [problem, setProblem] = useState<string | null>(null);
  const [cameraOk, setCameraOk] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const accept = (text: string, source: "camera" | "typed") => {
    const table = parseTableCode(text);
    if (table === null) {
      setProblem(
        source === "camera"
          ? "That isn't a team QR code. Try another."
          : "Enter a table number, like 52.",
      );
      return;
    }
    setProblem(null);
    setFound(table);
    if (source === "camera" && "vibrate" in navigator) navigator.vibrate(60);
  };

  // A message about a bad code goes away by itself.
  useEffect(() => {
    if (!problem) return;
    const timer = window.setTimeout(() => setProblem(null), 3000);
    return () => window.clearTimeout(timer);
  }, [problem]);

  const scanAgain = () => {
    setFound(null);
    setProblem(null);
    setTyped("");
  };

  // With no working camera the typed entry is the only way, so show it.
  const showManual = manualOpen || !cameraOk;

  return (
    <>
      <QrCamera
        paused={found !== null}
        onDetect={(text) => accept(text, "camera")}
        onStatus={(s) => setCameraOk(s === "starting" || s === "scanning")}
      />

      {problem && (
        <p
          role="status"
          className="m-0 rounded-xl bg-[#fff3d6] px-3.5 py-2.5 text-sm font-semibold text-[#6b4700]"
        >
          {problem}
        </p>
      )}

      {found !== null ? (
        <>
          <section
            aria-label="Scan result"
            className={`${card} flex flex-col gap-2 px-4 py-3.5`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-[17px]">Found</span>
              <span className="text-[20px] font-bold tabular-nums">
                Table {found}
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
            onClick={() => onScore(found)}
            className={primaryButton}
          >
            Score this team
          </button>
          <button
            type="button"
            onClick={scanAgain}
            className={`${secondaryButton} px-4`}
          >
            Scan again
          </button>
        </>
      ) : (
        <>
          <p className="m-0 px-1 text-[15px] text-[#4a5d73]">
            Point the camera at the QR code on the team&apos;s table.
          </p>

          {cameraOk && !manualOpen && (
            <button
              type="button"
              onClick={() => setManualOpen(true)}
              className={`self-start text-sm font-bold text-[#5b3fa0] hover:text-[#3f2a75] ${focusRing} min-h-[44px]`}
            >
              Enter table number instead
            </button>
          )}

          {showManual && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                accept(typed, "typed");
              }}
              className="flex gap-2"
            >
              <label htmlFor="manual-table" className="sr-only">
                Table number
              </label>
              <input
                id="manual-table"
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="off"
                placeholder="Table number"
                value={typed}
                onChange={(e) => setTyped(e.target.value)}
                className={`min-h-[44px] min-w-0 flex-1 rounded-xl border-[1.5px] border-[#c3cad8] bg-white px-3 text-[17px] ${focusRing}`}
              />
              <button type="submit" className={`${secondaryButton} px-4`}>
                Use table
              </button>
            </form>
          )}
        </>
      )}
    </>
  );
}