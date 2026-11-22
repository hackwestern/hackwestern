import { Eye, EyeOff } from "lucide-react";
import { SectionLink } from "./navlinks";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

/**
 * The Judging Rounds menu item. Hackers see it only while an organizer has
 * the rounds switched on; organizers always see it, with an eye button to
 * show or hide it for hackers.
 */
export const RoundsNavItem = ({ isOrganizer }: { isOrganizer: boolean }) => {
  const utils = api.useUtils();
  const { data: access } = api.judging.board.getAccess.useQuery(undefined, {
    retry: false,
    staleTime: 15_000,
  });
  const toggle = api.judging.admin.setBoardVisible.useMutation({
    onSuccess: () => void utils.judging.board.getAccess.invalidate(),
  });

  if (!isOrganizer) {
    return access?.visible ? (
      <SectionLink tab="rounds" name="Judging Rounds" href="/rounds" />
    ) : null;
  }

  const shown = access?.shownToHackers === true;
  const next = !shown;
  return (
    <div className="flex items-center gap-1">
      <div className="min-w-0 flex-1">
        <SectionLink tab="rounds" name="Judging Rounds" href="/rounds" />
      </div>
      <button
        type="button"
        aria-pressed={shown}
        aria-label={
          shown
            ? "Hackers can see Judging Rounds. Hide it from them"
            : "Judging Rounds is hidden from hackers. Show it to them"
        }
        title={shown ? "Visible to hackers" : "Hidden from hackers"}
        disabled={!access || toggle.isPending}
        onClick={() => toggle.mutate({ shownToHackers: next })}
        className={cn(
          "flex size-10 shrink-0 cursor-pixel-hover items-center justify-center rounded-dashboard-sm border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary disabled:opacity-dashboard-disabled",
          shown
            ? "border-dashboard-action-primary bg-dashboard-bg-navSelected text-dashboard-text-active"
            : "border-dashboard-border-default text-dashboard-text-medium hover:bg-dashboard-bg-surface",
        )}
      >
        {shown ? (
          <Eye aria-hidden="true" className="size-5" />
        ) : (
          <EyeOff aria-hidden="true" className="size-5" />
        )}
      </button>
    </div>
  );
};
