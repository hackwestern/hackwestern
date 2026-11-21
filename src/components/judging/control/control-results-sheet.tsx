import { useState } from "react";
import { api } from "~/utils/api";
import {
  BTN_DARK,
  CARD,
  CARD_TITLE,
  MUTED,
  type Status,
  StatusLine,
  errorText,
} from "./control-shared";

/**
 * Writes the final results to the Google Sheet in one go, once judging is
 * over. Safe to press again: the sheet is rebuilt from the latest marks and
 * completeness scores already typed are kept.
 */
export function ControlResultsSheet() {
  const [status, setStatus] = useState<Status>(null);
  const [url, setUrl] = useState<string | null>(null);

  const write = api.judging.admin.finalizeResultsSheet.useMutation({
    onSuccess: (r) => {
      setUrl(r.url);
      setStatus({
        tone: "ok",
        text: `Wrote ${r.teams} of ${r.totalTeams} teams (the top 20 overall on Results, the top 20 by adventure on Results Adventure) and their ${r.marks} marks.${r.scoresKept > 0 ? ` Kept ${r.scoresKept} completeness score${r.scoresKept === 1 ? "" : "s"}.` : ""}`,
      });
    },
    onError: (e) =>
      setStatus({
        tone: "error",
        text: `Couldn't write the sheet. ${errorText(e)}`,
      }),
  });

  return (
    <section className={CARD} aria-labelledby="results-sheet-title">
      <h2 id="results-sheet-title" className={CARD_TITLE}>
        Results spreadsheet
      </h2>
      <p className={`m-0 text-sm ${MUTED}`}>
        When judging is over, write the top 20 teams overall and the top 20 by
        adventure, with their marks, to the Google Sheet. Then type completeness
        scores in the Results tab. Press it again to refresh; completeness
        scores already typed are kept.
      </p>
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          className={BTN_DARK}
          disabled={write.isPending}
          onClick={() => {
            setStatus(null);
            write.mutate();
          }}
        >
          {write.isPending ? "Writing…" : "Write results to sheet"}
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-[15px] font-semibold text-[#5b3fa0]"
          >
            Open sheet
          </a>
        )}
      </div>
      <StatusLine status={status} />
    </section>
  );
}
