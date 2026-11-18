import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Plus, TriangleAlert, X } from "lucide-react";
import { requestSummary } from "~/components/sponsors/chat-request-form";
import { hover, press } from "~/components/internals/interaction";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import {
  BlockDetails,
  GiveRoom,
  SlotFill,
  SponsorStrip,
} from "~/components/sponsors/room-blocks";
import { LoadError } from "~/components/sponsors/schedule-states";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  buildRoomTable,
  roomCellSpans,
  sponsorStrip,
  type RoomCell,
} from "~/lib/coffee-chat-room-table";
import { formatClock } from "~/lib/run-of-show";
import { sponsorColor, sponsorColorIndexes } from "~/lib/sponsor-colors";
import { cn } from "~/lib/utils";
import type {
  BoardHold,
  ChatBoard,
} from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.roomTable;

/** How often the room table refetches bookings. */
export const ROOM_TABLE_REFRESH_MS = 15_000;

/** The organizer chat board, live (shared by the table and the board). */
export function useLiveChatBoard() {
  return api.coffeeChatRequests.organizerChatBoard.useQuery(undefined, {
    refetchInterval: ROOM_TABLE_REFRESH_MS,
    refetchOnWindowFocus: true,
    retry: 1,
  });
}

/** Stable palette indexes for these sponsor names (sponsor-colors). */
export function useSponsorColors(
  names: readonly string[],
): ReadonlyMap<string, number> {
  const key = names.join("\u0000");
  // Keyed by content so a refetch with the same names keeps the map.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => sponsorColorIndexes(names), [key]);
}

type Picked = { room: string; slotTime: string };

// Coffee chats as one room booking view: one column per room, a row per
// 15-minute slot, with the sponsor strip above. A free cell gives the
// room to a sponsor for a length; a room block is one tall cell in the
// sponsor's colour with their logo, request and each slot's hackers
// booked / asked for, and opens the block. `highlight` (a sponsor name)
// rings that sponsor's blocks, dims everyone else's and scrolls to their
// first one; Escape clears it. No legend.
export function CoffeeChatRoomTable({
  highlight = null,
  onHighlight,
  onClearHighlight,
}: {
  highlight?: string | null;
  onHighlight?: (name: string) => void;
  onClearHighlight?: () => void;
}) {
  const q = useLiveChatBoard();
  const now = useNow(30_000);
  const [picked, setPicked] = useState<Picked | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const palette = useSponsorColors(q.data?.colorNames ?? NO_NAMES);
  const ready = Boolean(q.data);

  // Escape clears the highlight (unless a dialog is open; it closes first).
  useEffect(() => {
    if (!highlight || !onClearHighlight) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !picked) onClearHighlight();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [highlight, onClearHighlight, picked]);

  // Bring the highlighted sponsor's first block into view.
  useEffect(() => {
    if (!highlight || !ready) return;
    const first = region.current?.querySelector<HTMLElement>(
      '[data-highlighted="true"]',
    );
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)");
    first?.scrollIntoView({
      behavior: reduce.matches ? "auto" : "smooth",
      block: "nearest",
      inline: "nearest",
    });
  }, [highlight, ready]);

  if (q.isLoading) {
    return (
      <div
        aria-busy="true"
        className="h-72 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-safe:animate-pulse"
      />
    );
  }
  if (!q.data) return <LoadError onRetry={() => void q.refetch()} />;
  const board = q.data;
  if (board.slots.length === 0) {
    return (
      <DashboardPanel>
        <p className="m-0 text-dashboard-text-medium">{copy.empty}</p>
      </DashboardPanel>
    );
  }
  const table = buildRoomTable(board);
  const spans = roomCellSpans(table);
  const pickedCell = picked
    ? table.rows[table.slots.indexOf(picked.slotTime)]?.[
        table.rooms.indexOf(picked.room)
      ]
    : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <SponsorStrip
        items={sponsorStrip(board)}
        colors={palette}
        highlight={highlight}
        onHighlight={onHighlight}
      />
      <div
        role="region"
        aria-label={copy.tableLabel}
        tabIndex={0}
        ref={region}
        className="max-h-[70vh] min-w-0 overflow-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
      >
        <table className="w-full min-w-[480px] border-separate border-spacing-0 text-sm">
          <caption className="sr-only">{copy.tableLabel}</caption>
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 top-0 z-30 w-20 min-w-20 border-b border-r border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-3 text-left text-xs font-semibold text-dashboard-text-light"
              >
                {copy.time}
              </th>
              {table.rooms.map((room) => (
                <th
                  key={room}
                  scope="col"
                  className="sticky top-0 z-20 min-w-36 border-b border-r border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-3 text-left text-sm font-semibold text-dashboard-text-heavy"
                >
                  {room}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.slots.map((slot, i) => (
              <tr key={slot}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-2 text-left align-top text-xs font-semibold text-dashboard-text-medium"
                >
                  {formatClock(slot)}
                </th>
                {table.rows[i]!.map((cell, j) =>
                  spans[i]![j] === 0 ? null : (
                    <td
                      key={cell.room}
                      rowSpan={spans[i]![j]}
                      className="h-px border-b border-r border-dashboard-border-subtle p-1 align-top"
                    >
                      <CellButton
                        cell={cell}
                        hold={board.holds.find(
                          (h) => h.holdId === cell.holdId,
                        )}
                        board={board}
                        colors={palette}
                        highlight={highlight}
                        onOpen={(button) => {
                          opener.current = button;
                          setPicked({
                            room: cell.room,
                            slotTime: cell.slotTime,
                          });
                        }}
                      />
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RoomSlotDialog
        cell={pickedCell}
        board={board}
        colors={palette}
        now={now}
        onClose={() => setPicked(null)}
        onCloseFocus={() => opener.current?.focus()}
      />
    </div>
  );
}

/** One opacity for everything dimmed. */
const DIMMED = "opacity-40";

// Free: white with a dashed neutral edge and "+ Free", unlike any sponsor
// fill (blocks are tinted with a solid strong left edge).
const FREE_CELL =
  "border-dashed border-dashboard-border-default bg-dashboard-bg-surface";

function CellButton({
  cell,
  hold,
  board,
  colors,
  highlight,
  onOpen,
}: {
  cell: RoomCell;
  hold: BoardHold | undefined;
  board: ChatBoard;
  colors: ReadonlyMap<string, number>;
  highlight: string | null;
  onOpen: (button: HTMLButtonElement) => void;
}) {
  const who = cell.occupants.map((o) => o.sponsor).join(", ") || null;
  const free = cell.occupants.length === 0;
  const highlighted =
    highlight !== null && cell.occupants.some((o) => o.sponsor === highlight);
  // Dim only other sponsors' blocks: free cells never dim.
  const dimmed = !free && highlight !== null && !highlighted;
  const lead =
    cell.occupants.find((o) => o.sponsor === highlight) ?? cell.occupants[0];
  const color = lead ? sponsorColor(colors, lead.sponsor) : null;
  const sponsor = board.sponsors.find((s) => s.sponsorId === lead?.sponsorId);
  const when = hold
    ? `${formatClock(hold.startTime)}–${formatClock(hold.endTime)}`
    : formatClock(cell.slotTime);
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={copy.cellLabel(cell.room, when, who)}
      onClick={(e) => onOpen(e.currentTarget)}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "flex h-full min-h-14 w-full flex-col items-stretch gap-1 rounded-dashboard-sm border px-2 py-1.5 text-left text-xs leading-4",
        "transition-opacity duration-150 ease-out motion-reduce:transition-none",
        press,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1",
        free
          ? cn(
              FREE_CELL,
              "font-semibold text-dashboard-text-light",
              hover.highlight,
            )
          : cn(
              "border-l-4 border-dashboard-border-subtle text-dashboard-text-heavy",
              color?.fill,
              color?.edge,
            ),
        highlighted &&
          "ring-2 ring-dashboard-text-heavy ring-offset-1 ring-offset-dashboard-bg-surface",
        dimmed && DIMMED,
      )}
    >
      {free ? (
        <span className="flex items-center gap-1">
          <Plus aria-hidden className="size-3.5 shrink-0" />
          {copy.free}
        </span>
      ) : (
        <>
          {/* Logo only; the button's aria-label names the sponsor. */}
          <span aria-hidden className="flex min-w-0 items-center gap-1">
            {cell.occupants.map((o) => (
              <SponsorBadge
                key={o.sponsor}
                name={o.sponsor}
                color={sponsorColor(colors, o.sponsor) ?? undefined}
                className="size-6"
              />
            ))}
          </span>
          {cell.clash ? (
            <span className="inline-flex items-center gap-1 font-semibold text-dashboard-text-warning">
              <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
              {copy.clash}
            </span>
          ) : (
            sponsor &&
            hold && (
              <span className="truncate text-dashboard-text-medium">
                {copy.blockSummary(
                  requestSummary(sponsor.request),
                  hold.booked,
                  hold.needed,
                )}
              </span>
            )
          )}
          {hold && (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {hold.slots.map((slot) => (
                <li
                  key={slot.slotTime}
                  className="flex flex-wrap items-baseline justify-between gap-x-2 tabular-nums"
                >
                  <span className="text-dashboard-text-medium">
                    {formatClock(slot.slotTime)}
                  </span>
                  <SlotFill slot={slot} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </button>
  );
}

const NO_NAMES: string[] = [];

// A free cell gives the room; a block cell opens the block. A cell with
// only a chat booked before blocks also gives the room (a block for that
// sponsor there takes the chat in).
function RoomSlotDialog({
  cell,
  board,
  colors,
  now,
  onClose,
  onCloseFocus,
}: {
  cell: RoomCell | undefined;
  board: ChatBoard & { rooms: string[] };
  colors: ReadonlyMap<string, number>;
  now: Date;
  onClose: () => void;
  onCloseFocus: () => void;
}) {
  const hold = board.holds.find((h) => h.holdId === cell?.holdId);
  const sponsor = board.sponsors.find((s) => s.sponsorId === hold?.sponsorId);
  return (
    <Dialog.Root open={Boolean(cell)} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=open]:fade-in-0" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onCloseFocus();
          }}
          className={cn(
            "fixed z-50 flex w-full flex-col gap-5 overflow-y-auto bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-[440px] sm:rounded-none sm:rounded-l-dashboard-2xl",
          )}
        >
          {cell && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Dialog.Title className="m-0 break-words text-xl font-semibold">
                    {hold
                      ? copy.block.title(
                          hold.room,
                          formatClock(hold.startTime),
                          formatClock(hold.endTime),
                        )
                      : copy.give.title(cell.room, formatClock(cell.slotTime))}
                  </Dialog.Title>
                  {hold ? (
                    <Dialog.Description className="m-0 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-dashboard-text-medium">
                      <SponsorBadge name={hold.sponsor} colors={colors} />
                      <span className="font-semibold text-dashboard-text-heavy">
                        {hold.sponsor}
                      </span>
                      {sponsor && (
                        <span>
                          {copy.block.request(
                            requestSummary(sponsor.request),
                            sponsor.request.durationMinutes,
                          )}
                        </span>
                      )}
                    </Dialog.Description>
                  ) : (
                    <Dialog.Description className="sr-only">
                      {copy.give.submit}
                    </Dialog.Description>
                  )}
                </div>
                <Dialog.Close
                  aria-label={copy.close}
                  className={cn(
                    "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    hover.highlight,
                  )}
                >
                  <X aria-hidden className="size-5" />
                </Dialog.Close>
              </div>
              {hold ? (
                <BlockDetails
                  key={hold.holdId}
                  board={board}
                  hold={hold}
                  now={now}
                  onReleased={onClose}
                />
              ) : (
                <GiveRoom
                  key={`${cell.room}-${cell.slotTime}`}
                  board={board}
                  room={cell.room}
                  slotTime={cell.slotTime}
                  colors={colors}
                  onGiven={onClose}
                />
              )}
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
