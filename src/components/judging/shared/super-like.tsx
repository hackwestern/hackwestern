import { Heart } from "lucide-react";

import { focusRing } from "~/components/judging/shared/judge-ui";

/**
 * A judge's "super like": a heart they can put on a team they loved. It is
 * saved on the mark (team_mark.super_like), so it shows again while
 * re-scoring, on the final review and in the results.
 */
export function SuperLikeToggle({
  on,
  onChange,
  teamName,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  teamName: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      aria-label={`Super like ${teamName}`}
      onClick={() => onChange(!on)}
      className={`inline-flex min-h-11 shrink-0 cursor-pixel-hover items-center gap-1.5 rounded-full border px-3 text-sm font-semibold transition-colors ${
        on
          ? "border-dashboard-status-iconBadgeIcon bg-dashboard-status-iconBadge text-dashboard-text-warning"
          : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-light"
      } ${focusRing}`}
    >
      <Heart
        aria-hidden="true"
        className={`size-4 ${
          on
            ? "fill-dashboard-status-iconBadgeIcon text-dashboard-status-iconBadgeIcon"
            : ""
        }`}
      />
      {on ? "Super liked" : "Super like"}
    </button>
  );
}

/** The small filled heart shown beside a super-liked team in lists. */
export function SuperLikeMark({ on }: { on: boolean }) {
  if (!on) return null;
  return (
    <>
      <Heart
        aria-hidden="true"
        className="inline size-4 shrink-0 fill-dashboard-status-iconBadgeIcon align-[-2px] text-dashboard-status-iconBadgeIcon"
      />
      <span className="sr-only">Super liked. </span>
    </>
  );
}
