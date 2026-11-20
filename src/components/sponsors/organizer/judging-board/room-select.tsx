import { useId, useState } from "react";
import { ChevronDown } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { focusRing } from "~/components/sponsors/organizer/coffee-sessions/parts";
import {
  JUDGING_ROOMS,
  sponsorJudgingBoardCopy,
} from "~/content/sponsor-judging-board";
import { cn } from "~/lib/utils";

const copy = sponsorJudgingBoardCopy.room;
const OTHER = "__other";
const UNSET = "";

export type RoomHolder = { sponsorId: string; name: string; room: string | null };

/** Every room to offer: the three standard ones, then rooms typed in. */
export function roomOptions(holders: readonly RoomHolder[]) {
  const typed = holders
    .map((h) => h.room)
    .filter(
      (r): r is string =>
        r !== null &&
        !JUDGING_ROOMS.some((s) => s.toLowerCase() === r.toLowerCase()),
    );
  return [...JUDGING_ROOMS, ...new Set(typed)];
}

/**
 * A sponsor's judging room: Rm 2230, Rm 2235, Rm 2110 or Other… (a text
 * box right there). A room another sponsor has reads "Rm 2230 · Canada
 * Life" and can't be picked; unset reads "Set a room" in amber.
 */
export function RoomSelect({
  sponsor,
  holders,
  pending,
  error,
  onSet,
}: {
  sponsor: { sponsorId: string; name: string; room: string | null };
  /** Every in-room sponsor and its room (taken rooms are disabled). */
  holders: readonly RoomHolder[];
  pending: boolean;
  error: string | null;
  onSet: (room: string) => void;
}) {
  const id = useId();
  const [other, setOther] = useState(false);
  const [typed, setTyped] = useState("");
  const holderOf = (room: string) =>
    holders.find(
      (h) =>
        h.sponsorId !== sponsor.sponsorId &&
        h.room?.toLowerCase() === room.toLowerCase(),
    );
  const unset = !sponsor.room;

  if (other) {
    return (
      <form
        className="flex w-full flex-col gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (typed.trim()) onSet(typed.trim());
        }}
      >
        <label htmlFor={`${id}-other`} className="sr-only">
          {copy.otherLabel(sponsor.name)}
        </label>
        <input
          id={`${id}-other`}
          // eslint-disable-next-line jsx-a11y/no-autofocus -- opened by the user's own pick
          autoFocus
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={copy.otherPlaceholder}
          maxLength={64}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "min-h-11 w-full rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder",
            focusRing,
          )}
        />
        <div className="flex gap-2">
          <DashboardButton
            type="submit"
            variant="small"
            disabled={pending || !typed.trim()}
          >
            {pending ? copy.saving : copy.save}
          </DashboardButton>
          <DashboardButton
            type="button"
            variant="link"
            onClick={() => {
              setOther(false);
              setTyped("");
            }}
          >
            {copy.cancel}
          </DashboardButton>
        </div>
        {error && (
          <p
            id={`${id}-error`}
            role="alert"
            className="m-0 text-sm font-semibold text-dashboard-text-warning"
          >
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="relative">
        <select
          aria-label={copy.label(sponsor.name)}
          value={sponsor.room ?? UNSET}
          disabled={pending}
          aria-describedby={error ? `${id}-error` : undefined}
          onChange={(e) => {
            const v = e.target.value;
            if (v === OTHER) setOther(true);
            else if (v !== UNSET) onSet(v);
          }}
          className={cn(
            "min-h-11 w-full cursor-pixel-hover appearance-none rounded-dashboard-md border bg-dashboard-bg-surface py-2 pl-3 pr-9 text-base font-medium",
            unset
              ? "border-dashboard-border-task bg-dashboard-bg-task text-dashboard-text-task"
              : "border-dashboard-border-control text-dashboard-text-heavy",
            "disabled:opacity-dashboard-disabled",
            focusRing,
          )}
        >
          {unset && (
            <option value={UNSET} disabled>
              {copy.unset}
            </option>
          )}
          {roomOptions(holders).map((room) => {
            const holder = holderOf(room);
            return (
              <option key={room} value={room} disabled={holder !== undefined}>
                {holder ? copy.taken(room, holder.name) : room}
              </option>
            );
          })}
          <option value={OTHER}>{copy.other}</option>
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-dashboard-text-light"
        />
      </div>
      {error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {error}
        </p>
      )}
    </div>
  );
}
