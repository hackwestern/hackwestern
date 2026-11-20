import { useRef, useState } from "react";
import {
  Card,
  CardHead,
  clockOf,
  focusRing,
} from "~/components/sponsors/organizer/coffee-sessions/parts";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { sponsorJudgingBoardCopy } from "~/content/sponsor-judging-board";
import { sponsorCountByTeam } from "~/lib/judging-board";
import {
  PRESENTATION_SLOT_MINUTES,
  PRESENTATION_WINDOW_START,
} from "~/lib/sponsor-presentations";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/utils/api";
import { roomOptions, type RoomHolder } from "./room-select";
import { SponsorsTag, STATUS_CELL, STATUS_ICON, StatusPill } from "./status";

const copy = sponsorJudgingBoardCopy.rooms;
const roomCopy = sponsorJudgingBoardCopy.room;
type Board = RouterOutputs["sponsorPresentations"]["board"];
type Slot = Board["slots"][number];
const VIEWS = ["calendar", "schedule"] as const;
type View = (typeof VIEWS)[number];

/** A room column: the room and the sponsor in it (if any). */
type Column = { room: string; sponsor: Board["sponsors"][number] | null };

/**
 * The calendar's columns: times run down the side and rooms across, so
 * team names have room (mock v2). The three standard rooms always show, then
 * any typed room in use. Remote sponsors have no column: their teams don't
 * present (Jazz, 2026-11-19).
 */
function columnsOf(board: Board): Column[] {
  const inRooms = board.sponsors.filter((s) => s.mode === "room");
  return roomOptions(inRooms).map((room) => ({
    room,
    sponsor:
      inRooms.find((s) => s.room?.toLowerCase() === room.toLowerCase()) ??
      null,
  }));
}

export function RoomsCard({
  board,
  colors,
  onOpenTeam,
  onMove,
  movePending,
}: {
  board: Board;
  colors: ReadonlyMap<string, number>;
  onOpenTeam: (teamId: string) => void;
  onMove: (sponsorId: string, room: string) => void;
  movePending: boolean;
}) {
  const [view, setView] = useState<View>("calendar");
  const refs = useRef(new Map<View, HTMLButtonElement>());
  const columns = columnsOf(board);
  const counts = sponsorCountByTeam(board.slots);
  const holders: RoomHolder[] = board.sponsors
    .filter((s) => s.mode === "room")
    .map((s) => ({ sponsorId: s.sponsorId, name: s.name, room: s.room }));
  const noRoom = board.waiting.filter((w) => w.reason === "no-room");
  const full = board.waiting.filter((w) => w.reason === "full");
  const sponsorName = new Map(board.sponsors.map((s) => [s.sponsorId, s.name]));

  return (
    <Card labelledBy="judging-rooms-heading" className="min-w-0">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <CardHead id="judging-rooms-heading" title={copy.heading} />
        <div
          role="tablist"
          aria-label={copy.viewsLabel}
          className="grid grid-cols-2 gap-1 rounded-dashboard-lg bg-dashboard-bg-nav p-1"
          onKeyDown={(e) => {
            if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
            e.preventDefault();
            const next = view === "calendar" ? "schedule" : "calendar";
            setView(next);
            refs.current.get(next)?.focus();
          }}
        >
          {VIEWS.map((v) => (
            <button
              key={v}
              ref={(el) => {
                if (el) refs.current.set(v, el);
                else refs.current.delete(v);
              }}
              type="button"
              role="tab"
              id={`judging-rooms-${v}`}
              aria-selected={view === v}
              aria-controls="judging-rooms-panel"
              tabIndex={view === v ? 0 : -1}
              onClick={() => setView(v)}
              className={cn(
                "inline-flex min-h-11 items-center justify-center rounded-dashboard-md px-3 text-sm font-semibold md:min-h-9",
                focusRing,
                view === v
                  ? "bg-dashboard-bg-surface text-dashboard-text-heavy shadow-dashboard-card"
                  : "text-dashboard-text-medium [@media(hover:hover)]:hover:text-dashboard-text-heavy",
                pressable,
              )}
            >
              {copy.views[v]}
            </button>
          ))}
        </div>
      </div>

      <Legend />

      <div
        role="tabpanel"
        id="judging-rooms-panel"
        aria-labelledby={`judging-rooms-${view}`}
        className="min-w-0"
      >
        {board.slots.length === 0 ? (
          <p className="m-0 rounded-dashboard-md bg-dashboard-bg-inset p-5 text-center text-sm font-medium text-dashboard-text-medium">
            {copy.empty}
          </p>
        ) : view === "calendar" ? (
          <Calendar
            columns={columns}
            slots={board.slots}
            counts={counts}
            colors={colors}
            holders={holders}
            onOpenTeam={onOpenTeam}
            onMove={onMove}
            movePending={movePending}
          />
        ) : (
          <Schedule
            columns={columns}
            slots={board.slots}
            counts={counts}
            colors={colors}
            onOpenTeam={onOpenTeam}
          />
        )}
      </div>

      {noRoom.length > 0 && (
        <section
          aria-labelledby="judging-no-room"
          className="flex flex-col gap-2 rounded-dashboard-md border border-dashed border-dashboard-border-task p-3"
        >
          <h3
            id="judging-no-room"
            className="m-0 text-sm font-bold text-dashboard-text-warning"
          >
            {copy.noRoomColumn}
          </h3>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {noRoom.map((w) => (
              <li key={`${w.sponsorId}:${w.teamId}`}>
                <TeamButton
                  teamId={w.teamId}
                  name={w.teamName}
                  detail={sponsorName.get(w.sponsorId) ?? ""}
                  onOpen={onOpenTeam}
                  className="border border-dashed border-dashboard-border-medium"
                />
              </li>
            ))}
          </ul>
        </section>
      )}
      {full.length > 0 && (
        <p
          role="status"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {copy.unplaced(full.length)}
        </p>
      )}
    </Card>
  );
}

function Legend() {
  const swatch = "inline-block h-4 w-6 shrink-0 rounded-dashboard-xs";
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-sm text-dashboard-text-medium">
      {(["not-sent", "waiting", "accepted"] as const).map((s) => {
        const Icon = STATUS_ICON[s];
        return (
          <li key={s} className="inline-flex items-center gap-1.5">
            <span aria-hidden className={cn(swatch, STATUS_CELL[s])} />
            <Icon aria-hidden className="size-3.5 text-dashboard-text-light" />
            {sponsorJudgingBoardCopy.status[s]}
          </li>
        );
      })}
      <li className="inline-flex items-center gap-1.5">
        <SponsorsTag count={2} />
        {copy.legend.twoSponsors}
      </li>
    </ul>
  );
}

/** A team: project name (full name on hover), ID small underneath. */
function TeamButton({
  teamId,
  name,
  detail,
  onOpen,
  className,
  children,
}: {
  teamId: string;
  name: string;
  detail?: string;
  onOpen: (teamId: string) => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={name}
      onClick={() => onOpen(teamId)}
      className={cn(
        "flex w-full min-w-0 flex-col items-start gap-0.5 rounded-dashboard-md px-2.5 py-2 text-left",
        "[@media(hover:hover)]:hover:ring-2 [@media(hover:hover)]:hover:ring-dashboard-border-outline",
        focusRing,
        pressable,
        className,
      )}
    >
      <span className="line-clamp-2 break-words text-sm font-semibold leading-tight text-dashboard-text-heavy">
        {name}
      </span>
      <span className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-dashboard-text-light">
        {teamId}
        {detail && <span>· {detail}</span>}
        {children}
      </span>
    </button>
  );
}

function SlotCell({
  slot,
  count,
  onOpen,
}: {
  slot: Slot;
  count: number;
  onOpen: (teamId: string) => void;
}) {
  const Icon = STATUS_ICON[slot.status];
  return (
    <TeamButton
      teamId={slot.teamId}
      name={slot.teamName}
      onOpen={onOpen}
      className={cn("h-full", STATUS_CELL[slot.status])}
    >
      <SponsorsTag count={count} />
      <Icon
        aria-hidden
        className={cn(
          "size-3.5",
          slot.status === "accepted"
            ? "text-dashboard-status-live"
            : "text-dashboard-text-light",
        )}
      />
      <span className="sr-only">
        {sponsorJudgingBoardCopy.status[slot.status]}
      </span>
    </TeamButton>
  );
}

function Calendar({
  columns,
  slots,
  counts,
  colors,
  holders,
  onOpenTeam,
  onMove,
  movePending,
}: {
  columns: Column[];
  slots: Slot[];
  counts: ReadonlyMap<string, number>;
  colors: ReadonlyMap<string, number>;
  holders: RoomHolder[];
  onOpenTeam: (teamId: string) => void;
  onMove: (sponsorId: string, room: string) => void;
  movePending: boolean;
}) {
  // Stops at the last used slot.
  const last = Math.max(...slots.map((s) => s.start));
  const times: number[] = [];
  for (let t = PRESENTATION_WINDOW_START; t <= last; t += PRESENTATION_SLOT_MINUTES) {
    times.push(t);
  }
  const at = (room: string, start: number) =>
    slots.find(
      (s) => s.start === start && s.room.toLowerCase() === room.toLowerCase(),
    );

  return (
    // Scrolls sideways inside the card on phones; the page never does.
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-1.5">
        <caption className="sr-only">{copy.tableLabel}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-14">
              <span className="sr-only">{copy.time}</span>
            </th>
            {columns.map((c) => (
              <th
                key={c.room}
                scope="col"
                className="rounded-dashboard-md bg-dashboard-bg-highlight px-2.5 py-2 text-left align-top font-normal"
              >
                <span className="block text-sm font-bold text-dashboard-text-heavy">
                  {c.room}
                </span>
                {c.sponsor && (
                  <>
                    <span className="mt-0.5 flex min-w-0 items-center gap-1.5 text-sm text-dashboard-text-medium">
                      <SponsorBadge name={c.sponsor.name} colors={colors} />
                      <span className="truncate">{c.sponsor.name}</span>
                    </span>
                    <MoveTo
                      sponsor={c.sponsor}
                      holders={holders}
                      disabled={movePending}
                      onMove={onMove}
                    />
                  </>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {times.map((t) => (
            <tr key={t}>
              <th
                scope="row"
                className="pr-1 text-right align-middle text-sm font-medium tabular-nums text-dashboard-text-medium"
              >
                {clockOf(t)}
              </th>
              {columns.map((c) => {
                const slot = at(c.room, t);
                return (
                  <td key={c.room} className="h-px p-0 align-top">
                    {slot && (
                      <SlotCell
                        slot={slot}
                        count={counts.get(slot.teamId) ?? 1}
                        onOpen={onOpenTeam}
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Move a sponsor to another room: only the other rooms, and a room another
 * sponsor has swaps the two.
 */
function MoveTo({
  sponsor,
  holders,
  disabled,
  onMove,
}: {
  sponsor: Board["sponsors"][number];
  holders: RoomHolder[];
  disabled: boolean;
  onMove: (sponsorId: string, room: string) => void;
}) {
  const others = roomOptions(holders).filter(
    (r) => r.toLowerCase() !== sponsor.room?.toLowerCase(),
  );
  return (
    <select
      aria-label={roomCopy.moveLabel(sponsor.name)}
      value=""
      disabled={disabled}
      onChange={(e) => {
        if (e.target.value) onMove(sponsor.sponsorId, e.target.value);
      }}
      className={cn(
        "mt-1 min-h-9 w-full cursor-pixel-hover rounded-dashboard-sm border border-dashboard-border-control bg-dashboard-bg-surface px-1.5 text-xs font-semibold text-dashboard-text-link disabled:opacity-dashboard-disabled",
        focusRing,
      )}
    >
      <option value="" disabled>
        {roomCopy.moveTo}
      </option>
      {others.map((room) => {
        const holder = holders.find(
          (h) =>
            h.sponsorId !== sponsor.sponsorId &&
            h.room?.toLowerCase() === room.toLowerCase(),
        );
        return (
          <option key={room} value={room}>
            {holder ? roomCopy.swapWith(room, holder.name) : room}
          </option>
        );
      })}
    </select>
  );
}

function Schedule({
  columns,
  slots,
  counts,
  colors,
  onOpenTeam,
}: {
  columns: Column[];
  slots: Slot[];
  counts: ReadonlyMap<string, number>;
  colors: ReadonlyMap<string, number>;
  onOpenTeam: (teamId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {columns.map((c) => {
        const mine = slots.filter(
          (s) => s.room.toLowerCase() === c.room.toLowerCase(),
        );
        if (mine.length === 0) return null;
        const first = mine[0]!.start;
        const end = mine[mine.length - 1]!.start + PRESENTATION_SLOT_MINUTES;
        return (
          <section
            key={c.room}
            aria-label={c.room}
            className="overflow-hidden rounded-dashboard-md border border-dashboard-border-subtle"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 bg-dashboard-bg-highlight px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-base">
                <b className="font-bold">{c.room}</b>
                {c.sponsor && (
                  <>
                    <SponsorBadge name={c.sponsor.name} colors={colors} />
                    <span className="truncate">{c.sponsor.name}</span>
                  </>
                )}
              </span>
              <span className="text-sm tabular-nums text-dashboard-text-light">
                {copy.roomTeams(mine.length)} · {clockOf(first)}–{clockOf(end)}
              </span>
            </div>
            <ol className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle p-0">
              {mine.map((s) => (
                <li
                  key={s.teamId}
                  className="flex items-center gap-3 px-4 py-2"
                >
                  <span className="w-12 shrink-0 text-base font-bold tabular-nums">
                    {clockOf(s.start)}
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenTeam(s.teamId)}
                    className={cn(
                      "flex min-w-0 flex-1 flex-col items-start rounded-dashboard-sm text-left",
                      focusRing,
                    )}
                  >
                    <span className="break-words text-base font-semibold text-dashboard-text-link [@media(hover:hover)]:hover:underline">
                      {s.teamName}
                    </span>
                    <span className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums text-dashboard-text-light">
                      {s.teamId}
                      <SponsorsTag count={counts.get(s.teamId) ?? 1} />
                    </span>
                  </button>
                  <StatusPill status={s.status} />
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </div>
  );
}
