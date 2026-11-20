import { Fragment, useRef, useState } from "react";
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
  PRESENTATION_WINDOW_END,
  PRESENTATION_WINDOW_START,
  formatPresentationTime,
  runsPastEnd,
} from "~/lib/sponsor-presentations";
import { cn } from "~/lib/utils";
import type { RouterOutputs } from "~/utils/api";
import { RoomInput } from "./room-select";
import {
  SHOWN_STATUSES,
  SponsorsTag,
  STATUS_CELL,
  STATUS_ICON,
  StatusPill,
} from "./status";

const copy = sponsorJudgingBoardCopy.rooms;
type Board = RouterOutputs["sponsorPresentations"]["board"];
type Slot = Board["slots"][number];
const VIEWS = ["calendar", "schedule"] as const;
type View = (typeof VIEWS)[number];

type Sponsor = Board["sponsors"][number];

/**
 * The calendar's columns: one per sponsor that presents in a room, there
 * from the start, each with its room typed in the header (Jazz,
 * 2026-11-20: "columns and rooms are created already for each sponsor").
 * Times run down the side. Remote sponsors have no column: their teams
 * don't present (Jazz, 2026-11-19).
 */
function columnsOf(board: Board): Sponsor[] {
  return board.sponsors.filter((s) => s.mode === "room");
}

/** The room-change state the header inputs share. */
export type RoomEdit = {
  pendingFor: string | null;
  error: { sponsorId: string; message: string } | null;
  onSet: (sponsorId: string, room: string) => void;
};

export function RoomsCard({
  board,
  colors,
  onOpenTeam,
  roomEdit,
}: {
  board: Board;
  colors: ReadonlyMap<string, number>;
  onOpenTeam: (teamId: string) => void;
  roomEdit: RoomEdit;
}) {
  const [view, setView] = useState<View>("calendar");
  const refs = useRef(new Map<View, HTMLButtonElement>());
  const columns = columnsOf(board);
  const counts = sponsorCountByTeam(board.slots);
  // Never hidden: slots after the window show, marked (Jazz, 2026-11-20).
  const pastEnd = board.slots.filter((s) => runsPastEnd(s.start));
  const lastEnd =
    pastEnd.length > 0
      ? Math.max(...pastEnd.map((s) => s.start)) + PRESENTATION_SLOT_MINUTES
      : null;

  return (
    <Card
      labelledBy="judging-rooms-heading"
      className="min-w-0"
      tour="judging-rooms"
    >
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
        {view === "calendar" && columns.length > 0 ? (
          <Calendar
            columns={columns}
            slots={board.slots}
            counts={counts}
            colors={colors}
            onOpenTeam={onOpenTeam}
            roomEdit={roomEdit}
          />
        ) : board.slots.length === 0 ? null : (
          <Schedule
            columns={columns}
            slots={board.slots}
            counts={counts}
            colors={colors}
            onOpenTeam={onOpenTeam}
          />
        )}
        {board.slots.length === 0 && (
          <p className="m-0 rounded-dashboard-md bg-dashboard-bg-inset p-5 text-center text-sm font-medium text-dashboard-text-medium">
            {copy.empty}
          </p>
        )}
      </div>

      {lastEnd !== null && (
        <p
          role="status"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {copy.overBy(
            pastEnd.length,
            formatPresentationTime(PRESENTATION_WINDOW_END),
            formatPresentationTime(lastEnd),
            lastEnd - PRESENTATION_WINDOW_END,
          )}
        </p>
      )}
      {board.waiting.length > 0 && (
        <p
          role="status"
          className="m-0 text-sm font-semibold text-dashboard-text-warning"
        >
          {copy.unplaced(board.waiting.map((w) => w.teamName))}
        </p>
      )}
    </Card>
  );
}

function Legend() {
  const swatch = "inline-block h-4 w-6 shrink-0 rounded-dashboard-xs";
  return (
    <ul className="m-0 flex list-none flex-wrap items-center gap-x-4 gap-y-1.5 p-0 text-sm text-dashboard-text-medium">
      {SHOWN_STATUSES.map((s) => {
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
  const Icon = slot.status === "not-sent" ? null : STATUS_ICON[slot.status];
  return (
    <TeamButton
      teamId={slot.teamId}
      name={slot.teamName}
      onOpen={onOpen}
      className={cn("h-full", STATUS_CELL[slot.status])}
    >
      <SponsorsTag count={count} />
      {Icon && (
        <>
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
        </>
      )}
    </TeamButton>
  );
}

function Calendar({
  columns,
  slots,
  counts,
  colors,
  onOpenTeam,
  roomEdit,
}: {
  columns: Sponsor[];
  slots: Slot[];
  counts: ReadonlyMap<string, number>;
  colors: ReadonlyMap<string, number>;
  onOpenTeam: (teamId: string) => void;
  roomEdit: RoomEdit;
}) {
  // Stops at the last used slot (no rows before any slot exists).
  const last =
    slots.length > 0
      ? Math.max(...slots.map((s) => s.start))
      : PRESENTATION_WINDOW_START - 1;
  const times: number[] = [];
  for (
    let t = PRESENTATION_WINDOW_START;
    t <= last;
    t += PRESENTATION_SLOT_MINUTES
  ) {
    times.push(t);
  }
  const at = (sponsorId: string, start: number) =>
    slots.find((s) => s.start === start && s.sponsorId === sponsorId);

  return (
    // Scrolls sideways inside the card on phones; the page never does.
    // `relative` keeps the cells' sr-only labels (absolutely placed)
    // inside the scroll box, so they can't widen the page.
    <div className="relative -mx-1 overflow-x-auto px-1 pb-1">
      <table className="w-full min-w-[34rem] table-fixed border-separate border-spacing-1.5">
        <caption className="sr-only">{copy.tableLabel}</caption>
        <thead>
          <tr>
            <th scope="col" className="w-14">
              <span className="sr-only">{copy.time}</span>
            </th>
            {columns.map((c) => {
              return (
                <th
                  key={c.sponsorId}
                  scope="col"
                  className="rounded-dashboard-md bg-dashboard-bg-highlight px-2.5 py-2 text-left align-top font-normal"
                >
                  <span className="flex min-w-0 items-center gap-1.5 text-sm font-bold text-dashboard-text-heavy">
                    <SponsorBadge name={c.name} colors={colors} />
                    <span className="truncate">{c.name}</span>
                  </span>
                  {/* Keyed by the saved room, so a save elsewhere resets it. */}
                  <RoomInput
                    key={c.room ?? ""}
                    sponsor={c}
                    pending={roomEdit.pendingFor === c.sponsorId}
                    error={
                      roomEdit.error?.sponsorId === c.sponsorId
                        ? roomEdit.error.message
                        : null
                    }
                    onSet={(room) => roomEdit.onSet(c.sponsorId, room)}
                  />
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {times.map((t, i) => (
            <Fragment key={t}>
              {/* One marker row where the window ends. */}
              {runsPastEnd(t) && (i === 0 || !runsPastEnd(times[i - 1]!)) && (
                <tr>
                  <td
                    colSpan={columns.length + 1}
                    className="border-t-2 border-dashed border-dashboard-border-task pt-1 text-xs font-bold uppercase tracking-wider text-dashboard-text-task"
                  >
                    {copy.pastEnd(
                      formatPresentationTime(PRESENTATION_WINDOW_END),
                    )}
                  </td>
                </tr>
              )}
              <tr>
                <th
                  scope="row"
                  className="pr-1 text-right align-middle text-sm font-medium tabular-nums text-dashboard-text-medium"
                >
                  {clockOf(t)}
                </th>
                {columns.map((c) => {
                  const slot = at(c.sponsorId, t);
                  return (
                    <td key={c.sponsorId} className="h-px p-0 align-top">
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
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Schedule({
  columns,
  slots,
  counts,
  colors,
  onOpenTeam,
}: {
  columns: Sponsor[];
  slots: Slot[];
  counts: ReadonlyMap<string, number>;
  colors: ReadonlyMap<string, number>;
  onOpenTeam: (teamId: string) => void;
}) {
  return (
    <div className="flex flex-col gap-3">
      {columns.map((c) => {
        const mine = slots.filter((s) => s.sponsorId === c.sponsorId);
        if (mine.length === 0) return null;
        const first = mine[0]!.start;
        const end = mine[mine.length - 1]!.start + PRESENTATION_SLOT_MINUTES;
        return (
          <section
            key={c.sponsorId}
            aria-label={c.room ?? c.name}
            className="overflow-hidden rounded-dashboard-md border border-dashboard-border-subtle"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 bg-dashboard-bg-highlight px-4 py-2.5">
              <span className="flex min-w-0 items-center gap-2 text-base">
                <b className="font-bold">{c.room}</b>
                <SponsorBadge name={c.name} colors={colors} />
                <span className="truncate">{c.name}</span>
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
                  {runsPastEnd(s.start) && (
                    <span className="shrink-0 text-xs font-semibold text-dashboard-text-task">
                      {copy.pastEnd(
                        formatPresentationTime(PRESENTATION_WINDOW_END),
                      )}
                    </span>
                  )}
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
