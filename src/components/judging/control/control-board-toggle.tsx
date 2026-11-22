import { Eye, EyeOff } from "lucide-react";
import { api } from "~/utils/api";

/**
 * Shows or hides the hackers' Judging Rounds tab (/rounds), the same switch as
 * the eye button next to it in the live site menu.
 */
export function ControlBoardToggle() {
  const utils = api.useUtils();
  const { data: access } = api.judging.board.getAccess.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const toggle = api.judging.admin.setBoardVisible.useMutation({
    onSuccess: () => void utils.judging.board.getAccess.invalidate(),
  });
  const shown = access?.shownToHackers === true;

  return (
    <button
      type="button"
      aria-pressed={shown}
      disabled={!access || toggle.isPending}
      onClick={() => toggle.mutate({ shownToHackers: !shown })}
      title={
        shown
          ? "Hackers see the Judging Rounds tab. Click to hide it."
          : "Hackers don't see the Judging Rounds tab. Click to show it."
      }
      className={`inline-flex min-h-11 items-center gap-2 rounded-[10px] border px-4 text-[15px] font-bold disabled:opacity-50 ${
        shown
          ? "border-[#1f8a3a] bg-[#e3f4e6] text-[#14532d]"
          : "border-[#c3cad8] bg-white text-[#4a5d73]"
      }`}
    >
      {shown ? (
        <Eye aria-hidden="true" className="size-5" />
      ) : (
        <EyeOff aria-hidden="true" className="size-5" />
      )}
      {shown
        ? "Judging tab: shown to hackers"
        : "Judging tab: hidden from hackers"}
    </button>
  );
}
