import { useState } from "react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { LoadError } from "~/components/sponsors/schedule-states";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { formatClock } from "~/lib/run-of-show";
import type { OrganizerCoffeeChatRoom } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.rooms;

export const dashboardFieldClass =
  "h-10 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary";

// Organizers give each sponsor a Saturday coffee chat room (2241-2243).
// The server refuses overlapping windows in one room and moves the
// sponsor's booked chats along (docs/decisions.md).
export function CoffeeChatRooms() {
  const q = api.coffeeChatRequests.organizerRooms.useQuery(undefined, {
    refetchInterval: 60_000,
    retry: 1,
  });
  return (
    <section aria-labelledby="chat-rooms" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 id="chat-rooms" className="m-0 text-lg font-semibold">
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      </div>
      {q.isLoading ? (
        <div className="h-24 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card" />
      ) : !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.data.sponsors.length === 0 ? (
        <DashboardPanel>
          <p className="m-0 text-dashboard-text-medium">{copy.empty}</p>
        </DashboardPanel>
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
          {q.data.sponsors.map((s) => (
            <SponsorRoom
              key={s.sponsorId ?? s.sponsor}
              sponsor={s}
              rooms={q.data.rooms}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

function SponsorRoom({
  sponsor: s,
  rooms,
}: {
  sponsor: OrganizerCoffeeChatRoom;
  rooms: string[];
}) {
  const utils = api.useUtils();
  const [saved, setSaved] = useState(false);
  const assign = api.coffeeChatRequests.assignCoffeeChatRoom.useMutation({
    onSuccess: async () => {
      setSaved(true);
      await Promise.all([
        utils.coffeeChatRequests.organizerRooms.invalidate(),
        utils.coffeeChatRequests.organizerChats.invalidate(),
        utils.sponsorSchedule.invalidate(),
      ]);
    },
  });
  const selectId = `room-${s.sponsorId ?? s.sponsor}`;
  const errorId = `${selectId}-error`;
  const hasWindow = Boolean(s.windowStart && s.windowEnd);

  return (
    <li className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card">
      <h3 className="m-0 break-words text-base font-semibold">{s.sponsor}</h3>
      {hasWindow ? (
        <dl className="m-0 grid grid-cols-[5.5rem_1fr] gap-x-3 gap-y-1 text-sm">
          <dt className="text-dashboard-text-light">{copy.window}</dt>
          <dd className="m-0">
            {formatClock(s.windowStart!)} – {formatClock(s.windowEnd!)}
          </dd>
          <dt className="text-dashboard-text-light">{copy.format}</dt>
          <dd className="m-0">
            {scheduleCopy.coffeeChat.format(s.durationMinutes, s.groupSize)}
          </dd>
          <dt className="text-dashboard-text-light">{copy.hackers}</dt>
          <dd className="m-0">{s.hackers ?? "–"}</dd>
        </dl>
      ) : (
        <p className="m-0 text-sm text-dashboard-text-light">{copy.notSetUp}</p>
      )}

      {s.sponsorId ? (
        <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
          <span className="text-dashboard-text-light">{copy.room}</span>
          <select
            id={selectId}
            value={s.assignedRoom ?? ""}
            disabled={assign.isPending}
            aria-describedby={assign.error ? errorId : undefined}
            onChange={(e) => {
              setSaved(false);
              assign.mutate({
                sponsorId: s.sponsorId!,
                room: e.target.value || null,
              });
            }}
            className={dashboardFieldClass}
          >
            <option value="">{copy.unassigned}</option>
            {rooms.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          {!s.assignedRoom && s.sheetRoom && (
            <span className="text-dashboard-text-light">
              {copy.sheetRoom(s.sheetRoom)}
            </span>
          )}
        </label>
      ) : (
        <p className="m-0 text-sm text-dashboard-text-light">
          {copy.notRegistered}
        </p>
      )}

      <p aria-live="polite" className="m-0 text-sm empty:hidden">
        {assign.error ? (
          <span id={errorId} className="text-dashboard-text-warning">
            {assign.error.message || copy.saveError}
          </span>
        ) : saved && !assign.isPending ? (
          <span className="text-dashboard-text-light">{copy.saved}</span>
        ) : null}
      </p>
    </li>
  );
}
