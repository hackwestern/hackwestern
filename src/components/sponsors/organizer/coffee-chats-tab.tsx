import { useState } from "react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { AddCoffeeChat } from "~/components/sponsors/add-coffee-chat";
import { CoffeeChatBoard } from "~/components/sponsors/coffee-chat-board";
import { LoadError } from "~/components/sponsors/schedule-states";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { formatClock } from "~/lib/run-of-show";
import type { OrganizerCoffeeChat } from "~/server/api/routers/coffee-chat-requests";
import { api } from "~/utils/api";

// Organizer Coffee chats tab: the colour-coded rooms table and "By sponsor"
// board, with the list (add a chat, booked chats) one toggle away. Each
// sponsor's room, watcher and totals live on the Sponsors tab's table.
// `sponsor` (an id or name, from ?sponsor=) highlights that sponsor.
export function CoffeeChatsTab({ sponsor }: { sponsor: string | null }) {
  return (
    <CoffeeChatBoard
      sponsor={sponsor}
      list={
        <>
          <AddCoffeeChat />
          <BookedChats />
        </>
      }
    />
  );
}

const booked = coffeeChatCopy.organizer;

// Every booked coffee chat with Cancel and Move room. Organizers change
// bookings here, not in the sheet (no two-way sync, docs/decisions.md).
function BookedChats() {
  const q = api.coffeeChatRequests.organizerChats.useQuery(undefined, {
    refetchInterval: 30_000,
  });
  return (
    <section aria-labelledby="booked-chats" className="flex flex-col gap-3">
      <h2 id="booked-chats" className="m-0 text-lg font-semibold">
        {booked.heading}
      </h2>
      {q.isLoading ? (
        <div className="h-24 w-full animate-pulse rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card" />
      ) : !q.data ? (
        <LoadError onRetry={() => void q.refetch()} />
      ) : q.data.chats.length === 0 ? (
        <DashboardPanel>
          <p className="m-0 text-dashboard-text-medium">{booked.empty}</p>
        </DashboardPanel>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-2 p-0">
          {q.data.chats.map((chat) => (
            <BookedChat key={chat.chatId} chat={chat} rooms={q.data.rooms} />
          ))}
        </ul>
      )}
    </section>
  );
}

function BookedChat({
  chat,
  rooms,
}: {
  chat: OrganizerCoffeeChat;
  rooms: string[];
}) {
  const utils = api.useUtils();
  const [mode, setMode] = useState<"idle" | "cancel" | "move">("idle");
  const otherRooms = rooms.filter((room) => room !== chat.room);
  const [room, setRoom] = useState(otherRooms[0] ?? "");
  const done = {
    onSuccess: async () => {
      setMode("idle");
      await Promise.all([
        utils.coffeeChatRequests.organizerChats.invalidate(),
        utils.sponsorOrganizer.summary.invalidate(),
      ]);
    },
  };
  const cancel = api.coffeeChatRequests.cancel.useMutation(done);
  const move = api.coffeeChatRequests.moveRoom.useMutation(done);
  const error = cancel.error ?? move.error;
  const active = chat.status === "pending" || chat.status === "accepted";
  const hacker = booked.hacker(chat.firstName, chat.lastName);
  const time = formatClock(chat.slotTime);
  const selectId = `move-${chat.chatId}`;

  return (
    <li className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-1">
          <span className="text-sm font-semibold text-dashboard-text-light">
            {booked.when(time, chat.durationMinutes)}
          </span>
          <span className="break-words font-semibold">{chat.sponsorName}</span>
          <span className="break-words text-sm text-dashboard-text-medium">
            {hacker} · {chat.room ?? booked.roomTbd}
          </span>
        </div>
        <DashboardTag
          className={
            active
              ? "bg-dashboard-bg-highlight text-dashboard-text-active"
              : "bg-dashboard-bg-inset"
          }
        >
          {booked.status[chat.status]}
        </DashboardTag>
      </div>

      {active && mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <DashboardButton variant="outline" onClick={() => setMode("move")}>
            {booked.moveRoom}
          </DashboardButton>
          <DashboardButton variant="outline" onClick={() => setMode("cancel")}>
            {booked.cancel}
          </DashboardButton>
        </div>
      )}

      {active && mode === "cancel" && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm">
            {booked.cancelConfirm(hacker, chat.sponsorName, time)}
          </p>
          <div className="flex flex-wrap gap-2">
            <DashboardButton
              variant="outline"
              disabled={cancel.isPending}
              onClick={() => cancel.mutate({ chatId: chat.chatId })}
            >
              {booked.confirmCancel}
            </DashboardButton>
            <DashboardButton variant="tertiary" onClick={() => setMode("idle")}>
              {booked.close}
            </DashboardButton>
          </div>
        </div>
      )}

      {active && mode === "move" && (
        <div className="flex flex-col gap-2">
          <p className="m-0 text-sm">
            {booked.moveHint(chat.sponsorName, time)}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
              <span className="text-dashboard-text-light">{booked.moveTo}</span>
              <select
                id={selectId}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className="h-10 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
              >
                {otherRooms.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <DashboardButton
              variant="outline"
              disabled={!room || move.isPending}
              onClick={() => move.mutate({ chatId: chat.chatId, room })}
            >
              {booked.move}
            </DashboardButton>
            <DashboardButton
              variant="tertiary"
              className="h-10"
              onClick={() => setMode("idle")}
            >
              {booked.close}
            </DashboardButton>
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {error.message || booked.actionError}
        </p>
      )}
    </li>
  );
}
