import { CheckCircle2, Clock, Send } from "lucide-react";
import { sponsorJudgingBoardCopy } from "~/content/sponsor-judging-board";
import type { TeamStatus } from "~/lib/judging-board";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingBoardCopy;

/**
 * The three team states (Jazz, 2026-11-19), as cell styles: Invite not
 * sent is dashed, Waiting is solid, Accepted is green with a check. Each
 * also has an icon and text, never colour alone.
 */
export const STATUS_CELL: Record<TeamStatus, string> = {
  "not-sent":
    "border border-dashed border-dashboard-border-medium bg-dashboard-bg-surface",
  waiting: "border border-solid border-dashboard-border-control bg-dashboard-bg-surface",
  accepted:
    "border border-solid border-dashboard-status-live bg-dashboard-schedule-green",
};

export const STATUS_ICON = {
  "not-sent": Send,
  waiting: Clock,
  accepted: CheckCircle2,
} as const;

const PILL: Record<TeamStatus, string> = {
  "not-sent":
    "border border-dashed border-dashboard-border-medium text-dashboard-text-medium",
  waiting: "bg-dashboard-bg-nav text-dashboard-text-active",
  accepted: "bg-dashboard-schedule-green text-dashboard-status-live",
};

export function StatusPill({
  status,
  className,
}: {
  status: TeamStatus;
  className?: string;
}) {
  const Icon = STATUS_ICON[status];
  return (
    <span
      className={cn(
        "inline-flex w-fit shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold leading-5",
        PILL[status],
        className,
      )}
    >
      <Icon aria-hidden className="size-3.5" />
      {copy.status[status]}
    </span>
  );
}

/** A small "2 sponsors" tag for a team on several shortlists. */
export function SponsorsTag({ count }: { count: number }) {
  if (count < 2) return null;
  return (
    <span className="inline-flex w-fit items-center whitespace-nowrap rounded-full bg-dashboard-bg-navSelected px-1.5 text-[11px] font-bold leading-[18px] text-dashboard-text-active">
      {copy.rooms.twoSponsors(count)}
    </span>
  );
}
