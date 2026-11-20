import { useId, useState } from "react";
import { focusRing } from "~/components/sponsors/organizer/coffee-sessions/parts";
import {
  JUDGING_ROOMS,
  sponsorJudgingBoardCopy,
} from "~/content/sponsor-judging-board";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingBoardCopy.room;

/**
 * A sponsor's judging room typed in its calendar column ("Rm ____"),
 * with the three standard rooms as suggestions. Saves on Enter or when
 * focus leaves, through setRoom (which rebuilds the schedule). A room
 * another sponsor has is refused there and the error shows under the box.
 * Key it by the saved room so it resets when that changes. Used in the
 * calendar columns, the Sponsors list and the "needs a room" to-do.
 */
export function RoomInput({
  sponsor,
  pending,
  error,
  onSet,
}: {
  sponsor: { sponsorId: string; name: string; room: string | null };
  pending: boolean;
  error: string | null;
  onSet: (room: string) => void;
}) {
  const id = useId();
  const [typed, setTyped] = useState(sponsor.room ?? "");
  const save = () => {
    const room = typed.trim();
    if (room && room.toLowerCase() !== sponsor.room?.toLowerCase()) {
      onSet(room);
    }
  };
  const unset = !sponsor.room;
  return (
    <form
      className="mt-1 flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor={id} className="sr-only">
        {copy.label(sponsor.name)}
      </label>
      <input
        id={id}
        list={`${id}-rooms`}
        value={typed}
        onChange={(e) => setTyped(e.target.value)}
        onBlur={save}
        placeholder={sponsorJudgingBoardCopy.rooms.roomPlaceholder}
        maxLength={64}
        disabled={pending}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={cn(
          "min-h-9 w-full rounded-dashboard-sm border px-2 text-sm font-semibold placeholder:font-normal placeholder:text-dashboard-text-placeholder disabled:opacity-dashboard-disabled",
          unset
            ? "border-dashboard-border-task bg-dashboard-bg-task text-dashboard-text-task"
            : "border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-heavy",
          focusRing,
        )}
      />
      <datalist id={`${id}-rooms`}>
        {JUDGING_ROOMS.map((room) => (
          <option key={room} value={room} />
        ))}
      </datalist>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="m-0 text-xs font-semibold text-dashboard-text-warning"
        >
          {error}
        </p>
      )}
    </form>
  );
}
