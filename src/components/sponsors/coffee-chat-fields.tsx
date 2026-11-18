import { useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";

// A sponsor's coffee chat "Watched by" field and its Save flow
// (setCoffeeChatWatcher), plus the shared field style. Used by the Coffee
// chats board and the Sponsors tab's expanded rows. Organizers only. Rooms
// come from room blocks (room table), not a per-sponsor room.

/** Text field / select style shared by the organizer coffee chat forms. */
export const dashboardFieldClass =
  "h-11 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:h-10";

const copy = coffeeChatCopy.organizer.board;
const booked = coffeeChatCopy.organizer;

const smallField =
  "h-9 w-full rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-2 text-xs text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";

export function WatcherInput({
  sponsorId,
  watcher,
  idPrefix = "board-watcher",
}: {
  sponsorId: string;
  watcher: string | null;
  idPrefix?: string;
}) {
  const utils = api.useUtils();
  const [value, setValue] = useState(watcher ?? "");
  const [saved, setSaved] = useState(false);
  const save = api.coffeeChatRequests.setCoffeeChatWatcher.useMutation({
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        utils.coffeeChatRequests.invalidate(),
        utils.sponsorOrganizer.invalidate(),
      ]);
    },
  });
  const id = `${idPrefix}-${sponsorId}`;
  const dirty = value.trim() !== (watcher ?? "");
  return (
    <form
      className="flex flex-col gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        save.mutate({ sponsorId, watcher: value.trim() || null });
      }}
    >
      <label htmlFor={id} className="text-xs text-dashboard-text-light">
        {copy.watcher}
      </label>
      <div className="flex gap-1">
        <input
          id={id}
          list="board-watchers"
          value={value}
          maxLength={255}
          onChange={(e) => {
            setValue(e.target.value);
            setSaved(false);
          }}
          className={cn(smallField, "min-w-0 flex-1")}
        />
        <DashboardButton
          type="submit"
          variant="outline"
          disabled={!dirty || save.isPending}
          className="h-9 px-2.5 text-xs"
        >
          {copy.watcherSave}
        </DashboardButton>
      </div>
      <span aria-live="polite" className="text-xs empty:hidden">
        {save.error ? (
          <span className="text-dashboard-text-warning">
            {save.error.message || booked.rooms.watcherError}
          </span>
        ) : saved && !dirty ? (
          <span className="text-dashboard-text-light">{copy.watcherSaved}</span>
        ) : null}
      </span>
    </form>
  );
}
