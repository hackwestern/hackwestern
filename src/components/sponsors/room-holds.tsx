import { useState } from "react";
import { TriangleAlert } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-fields";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  DEFAULT_HOLD_MINUTES,
  HOLD_LENGTHS,
  holdEndOf,
  holdMinutes,
} from "~/lib/coffee-chat-holds";
import { COFFEE_CHAT_ROOMS } from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import type {
  BoardHold,
  ChatBoard,
} from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.roomTable;

/** Refetch everything that shows rooms after a hold changes. */
function useHoldDone(onDone?: () => void) {
  const utils = api.useUtils();
  return async () => {
    onDone?.();
    await Promise.all([
      utils.coffeeChatRequests.invalidate(),
      utils.sponsorSchedule.invalidate(),
      utils.sponsorOrganizer.invalidate(),
    ]);
  };
}

/** "Needs a hacker" with a warning icon (never colour alone). */
export function NeedsHackerBadge() {
  return (
    <span className="inline-flex items-center gap-1 font-semibold text-dashboard-text-warning">
      <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
      {copy.needsHacker}
    </span>
  );
}

// The holds in a room cell: sponsor, time span, whether it still needs a
// hacker, and Move / Remove. Adding a chat into a hold uses the cell's
// existing "Add a chat here" form below.
export function HoldsHere({
  holds,
  slots,
}: {
  holds: BoardHold[];
  slots: string[];
}) {
  if (holds.length === 0) return null;
  return (
    <section className="flex flex-col gap-2">
      <h3 className="m-0 text-base font-semibold">{copy.holds.heading}</h3>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {holds.map((h) => (
          <HoldItem key={h.holdId} hold={h} slots={slots} />
        ))}
      </ul>
    </section>
  );
}

function HoldItem({ hold, slots }: { hold: BoardHold; slots: string[] }) {
  const [mode, setMode] = useState<"idle" | "move" | "remove">("idle");
  const [room, setRoom] = useState(hold.room);
  const [start, setStart] = useState(hold.startTime);
  const [length, setLength] = useState(holdMinutes(hold));
  const done = useHoldDone(() => setMode("idle"));
  const move = api.coffeeChatRequests.moveHold.useMutation({
    onSuccess: done,
  });
  const remove = api.coffeeChatRequests.deleteHold.useMutation({
    onSuccess: done,
  });
  const error = move.error ?? remove.error;
  const end = holdEndOf(start, length);
  const lengths = [...new Set([...HOLD_LENGTHS, holdMinutes(hold)])].sort(
    (a, b) => a - b,
  );
  const id = `hold-${hold.holdId}`;

  return (
    <li className="flex flex-col gap-2 rounded-dashboard-md border border-dashboard-border-subtle p-3 text-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <span className="min-w-0 break-words font-semibold">
          {copy.heldFor(hold.sponsor)}
        </span>
        <span className="tabular-nums text-dashboard-text-medium">
          {hold.room} ·{" "}
          {copy.holds.span(
            formatClock(hold.startTime),
            formatClock(hold.endTime),
          )}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {hold.needsHacker ? (
          <NeedsHackerBadge />
        ) : (
          <span className="text-dashboard-text-medium">
            {copy.holds.chats(hold.chats)}
          </span>
        )}
        {hold.note && (
          <span className="min-w-0 break-words text-dashboard-text-light">
            {hold.note}
          </span>
        )}
      </div>
      {hold.needsHacker && mode === "idle" && (
        <p className="m-0 text-dashboard-text-medium">{copy.holds.addHint}</p>
      )}

      {mode === "idle" && (
        <div className="flex flex-wrap gap-2">
          <DashboardButton variant="outline" onClick={() => setMode("move")}>
            {copy.holds.move}
          </DashboardButton>
          <DashboardButton variant="outline" onClick={() => setMode("remove")}>
            {copy.holds.remove}
          </DashboardButton>
        </div>
      )}

      {mode === "remove" && (
        <div className="flex flex-col gap-2">
          <p className="m-0">{copy.holds.removeConfirm(hold.sponsor)}</p>
          <div className="flex flex-wrap gap-2">
            <DashboardButton
              variant="outline"
              disabled={remove.isPending}
              onClick={() => remove.mutate({ holdId: hold.holdId })}
            >
              {copy.holds.confirmRemove}
            </DashboardButton>
            <DashboardButton variant="tertiary" onClick={() => setMode("idle")}>
              {copy.holds.cancel}
            </DashboardButton>
          </div>
        </div>
      )}

      {mode === "move" && (
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!end || move.isPending) return;
            move.mutate({
              holdId: hold.holdId,
              room,
              startTime: start,
              endTime: end,
            });
          }}
        >
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <label className="flex flex-col gap-1">
              <span className="text-dashboard-text-light">
                {copy.holds.room}
              </span>
              <select
                id={`${id}-room`}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className={dashboardFieldClass}
              >
                {COFFEE_CHAT_ROOMS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-dashboard-text-light">
                {copy.holds.start}
              </span>
              <select
                value={start}
                onChange={(e) => setStart(e.target.value)}
                className={dashboardFieldClass}
              >
                {[...new Set([...slots, hold.startTime])].sort().map((t) => (
                  <option key={t} value={t}>
                    {formatClock(t)}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-dashboard-text-light">
                {copy.holds.length}
              </span>
              <select
                value={length}
                onChange={(e) => setLength(Number(e.target.value))}
                className={dashboardFieldClass}
              >
                {lengths.map((m) => (
                  <option key={m} value={m}>
                    {copy.holdForm.minutes(m)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap gap-2">
            <DashboardButton
              type="submit"
              variant="outline"
              disabled={!end || move.isPending}
            >
              {copy.holds.save}
            </DashboardButton>
            <DashboardButton
              type="button"
              variant="tertiary"
              onClick={() => setMode("idle")}
            >
              {copy.holds.cancel}
            </DashboardButton>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="m-0 text-dashboard-text-warning">
          {error.message || copy.holds.error}
        </p>
      )}
    </li>
  );
}

// "Hold room for a sponsor": set this room aside from this time for a
// sponsor before any hacker is booked. The server refuses it when another
// sponsor has the room then.
export function HoldRoomForm({
  board,
  room,
  slotTime,
}: {
  board: ChatBoard;
  room: string;
  slotTime: string;
}) {
  const sponsors = board.sponsors.filter(
    (s): s is typeof s & { sponsorId: string } => s.sponsorId !== null,
  );
  const [sponsorId, setSponsorId] = useState("");
  const [length, setLength] = useState<number>(DEFAULT_HOLD_MINUTES);
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState<string | null>(null);
  const done = useHoldDone();
  const end = holdEndOf(slotTime, length);
  const hold = api.coffeeChatRequests.createHold.useMutation({
    onSuccess: async () => {
      const name = sponsors.find((s) => s.sponsorId === sponsorId)?.sponsor;
      setSaved(
        copy.holdForm.done(
          name ?? "",
          room,
          formatClock(slotTime),
          formatClock(end ?? slotTime),
        ),
      );
      setNote("");
      await done();
    },
  });
  const f = copy.holdForm;
  const base = `hold-form-${room}-${slotTime}`;

  return (
    <section
      aria-labelledby={`${base}-heading`}
      className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id={`${base}-heading`} className="m-0 text-base font-semibold">
          {f.heading}
        </h3>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {f.intro(room, formatClock(slotTime))}
        </p>
      </div>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!sponsorId || !end || hold.isPending) return;
          setSaved(null);
          hold.mutate({
            sponsorId,
            room,
            startTime: slotTime,
            endTime: end,
            note: note.trim() || undefined,
          });
        }}
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_auto]">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-dashboard-text-light">{f.sponsor}</span>
            <select
              value={sponsorId}
              onChange={(e) => setSponsorId(e.target.value)}
              className={dashboardFieldClass}
            >
              <option value="">{f.pickSponsor}</option>
              {sponsors.map((s) => (
                <option key={s.sponsorId} value={s.sponsorId}>
                  {s.sponsor}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-dashboard-text-light">{f.length}</span>
            <select
              value={length}
              onChange={(e) => setLength(Number(e.target.value))}
              className={dashboardFieldClass}
            >
              {HOLD_LENGTHS.map((m) => (
                <option key={m} value={m}>
                  {f.minutes(m)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-dashboard-text-light">{f.note}</span>
          <input
            value={note}
            maxLength={255}
            onChange={(e) => setNote(e.target.value)}
            className={dashboardFieldClass}
          />
        </label>
        <DashboardButton
          type="submit"
          variant="outline"
          disabled={!sponsorId || !end || hold.isPending}
          className="h-11 w-fit"
        >
          {hold.isPending ? f.saving : f.submit}
        </DashboardButton>
        {saved && (
          <p role="status" className="m-0 text-sm text-dashboard-text-medium">
            {saved}
          </p>
        )}
        {hold.error && (
          <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
            {hold.error.message || f.error}
          </p>
        )}
      </form>
    </section>
  );
}
