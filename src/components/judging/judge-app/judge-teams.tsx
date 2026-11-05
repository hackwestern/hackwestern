import { card, focusRing, primaryButton } from "~/components/judging/shared/judge-ui";
import { type Ratings } from "~/components/judging/shared/rubric-scorer";

/** One team this judge has scored or marked absent. */
export interface JudgedTeam {
  table: number;
  teamName: string;
  absent: boolean;
  /** Slider values by criterion id. Empty when absent. */
  ratings: Ratings;
  /** 0–100, the weighted average of the ratings. null when absent. */
  score: number | null;
  notes: string;
}

/**
 * Where the final submit stands. Once it leaves "open", scores are locked.
 * - sending: saved on the device, being sent now
 * - waiting: saved on the device, waiting for a connection
 * - sent: the server has them
 */
export type SubmitStatus = "open" | "sending" | "waiting" | "sent";

const SUBMIT_LABEL: Record<SubmitStatus, string> = {
  open: "Submit scores",
  sending: "Sending…",
  waiting: "Waiting for connection",
  sent: "Submitted",
};

interface PublicJudgeTeamsProps {
  results: JudgedTeam[];
  status: SubmitStatus;
  onEdit: (table: number) => void;
  onSubmit: () => void;
}

/** The "My teams" tab: review every score, change any of them, then submit. */
export function PublicJudgeTeams({
  results,
  status,
  onEdit,
  onSubmit,
}: PublicJudgeTeamsProps) {
  if (results.length === 0) {
    return (
      <p className="px-1 text-[15px] text-[#4a5d73]">
        No teams yet. They show up here as you score them.
      </p>
    );
  }

  const locked = status !== "open";

  return (
    <>
      {status === "sent" ? (
        <p
          role="status"
          className="m-0 rounded-xl bg-[#e4effd] px-3.5 py-2.5 text-sm font-semibold text-[#123d75]"
        >
          Scores submitted. Thank you!
        </p>
      ) : status === "sending" ? (
        <p
          role="status"
          className="m-0 rounded-xl bg-[#e4effd] px-3.5 py-2.5 text-sm font-semibold text-[#123d75]"
        >
          Sending your scores…
        </p>
      ) : status === "waiting" ? (
        <p
          role="status"
          className="m-0 rounded-xl bg-[#fff3d6] px-3.5 py-2.5 text-sm font-semibold text-[#6b4700]"
        >
          Saved on this phone. Your scores send when you&apos;re back online.
        </p>
      ) : (
        <p className="m-0 px-1 text-[13px] text-[#4a5d73]">
          Tap a team to change its score.
        </p>
      )}

      <section aria-label="Teams you've judged" className={`${card} overflow-hidden`}>
        <ul className="m-0 list-none p-0">
          {results.map((r, i) => (
            <li key={r.table} className={i > 0 ? "border-t border-[#e3e7ef]" : ""}>
              <button
                type="button"
                disabled={locked}
                onClick={() => onEdit(r.table)}
                aria-label={`${r.table} ${r.teamName}, ${
                  r.absent ? "absent" : `score ${r.score}`
                }. Edit.`}
                className={`flex min-h-[56px] w-full items-center justify-between gap-3 px-4 text-left text-[17px] enabled:hover:bg-[#f6f7fa] ${focusRing}`}
              >
                <span className="min-w-0 truncate">
                  {r.table} · {r.teamName}
                </span>
                <span className="shrink-0 font-bold tabular-nums">
                  {r.absent ? "absent" : r.score}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <button
        type="button"
        disabled={locked}
        onClick={onSubmit}
        className={primaryButton}
      >
        {SUBMIT_LABEL[status]}
      </button>
    </>
  );
}