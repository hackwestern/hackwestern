import { DashboardButton } from "~/components/internals/dashboard-button";
import {
  card,
  focusRing,
  fullWidth,
  infoBanner,
  warningBanner,
} from "../shared/judge-ui";
import { type Ratings } from "../shared/rubric-scorer";

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

interface JudgeTeamsProps {
  results: JudgedTeam[];
  status: SubmitStatus;
  onEdit: (table: number) => void;
  onSubmit: () => void;
}

/** The "My teams" tab: review every score, change any of them, then submit. */
export function JudgeTeams({
  results,
  status,
  onEdit,
  onSubmit,
}: JudgeTeamsProps) {
  if (results.length === 0) {
    return (
      <p className="px-1 text-base font-medium text-dashboard-text-light">
        No teams yet. They show up here as you score them.
      </p>
    );
  }

  const locked = status !== "open";

  return (
    <>
      {status === "sent" ? (
        <p role="status" className={infoBanner}>
          Scores submitted. Thank you!
        </p>
      ) : status === "sending" ? (
        <p role="status" className={infoBanner}>
          Sending your scores…
        </p>
      ) : status === "waiting" ? (
        <p role="status" className={warningBanner}>
          Saved on this phone. Your scores send when you&apos;re back online.
        </p>
      ) : (
        <p className="m-0 px-1 text-sm text-dashboard-text-light">
          Tap a team to change its score.
        </p>
      )}

      <section
        aria-label="Teams you've judged"
        className={`${card} overflow-hidden`}
      >
        <ul className="m-0 list-none p-0">
          {results.map((r, i) => (
            <li
              key={r.table}
              className={i > 0 ? "border-t border-dashboard-border-subtle" : ""}
            >
              <button
                type="button"
                disabled={locked}
                onClick={() => onEdit(r.table)}
                aria-label={`${r.table} ${r.teamName}, ${
                  r.absent ? "absent" : `score ${r.score}`
                }. Edit.`}
                className={`flex min-h-14 w-full cursor-pixel-hover items-center justify-between gap-3 px-4 text-left text-base font-medium text-dashboard-text-heavy enabled:hover:bg-dashboard-bg-highlight ${focusRing}`}
              >
                <span className="min-w-0 truncate">
                  {r.table} · {r.teamName}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {r.absent ? "absent" : r.score}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      <DashboardButton
        type="button"
        disabled={locked}
        onClick={onSubmit}
        className={`${fullWidth} disabled:opacity-dashboard-disabled`}
      >
        {SUBMIT_LABEL[status]}
      </DashboardButton>
    </>
  );
}
