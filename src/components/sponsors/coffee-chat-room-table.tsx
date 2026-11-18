import { useEffect, useMemo, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Lock, Plus, TriangleAlert, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { hover, press } from "~/components/internals/interaction";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { AddChatHere } from "~/components/sponsors/coffee-chat-board";
import { dashboardFieldClass } from "~/components/sponsors/coffee-chat-fields";
import {
  HoldRoomForm,
  HoldsHere,
  NeedsHackerBadge,
} from "~/components/sponsors/room-holds";
import { LoadError } from "~/components/sponsors/schedule-states";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import type { SponsorSelection } from "~/components/sponsors/sponsor-filter";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { buildRoomTable, type RoomCell } from "~/lib/coffee-chat-room-table";
import { holdCovers } from "~/lib/coffee-chat-holds";
import { coffeeChatRoomOf } from "~/lib/coffee-chat-requests";
import { formatClock } from "~/lib/run-of-show";
import { sponsorColor, sponsorColorIndexes } from "~/lib/sponsor-colors";
import { cn } from "~/lib/utils";
import type {
  BoardSponsor,
  ChatBoard,
} from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.roomTable;
const dialogCopy = copy.dialog;

/** How often the room table refetches bookings. */
export const ROOM_TABLE_REFRESH_MS = 15_000;

/** The organizer chat board, live (shared by the table and the map). */
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

// Coffee chats as a room booking table: one column per room, a row per
// 15-minute slot. Available cells are neutral grey; taken cells carry the
// sponsor's colour with who has the room and how full it is (hackers plus
// reps out of the room's capacity). Picking a cell opens booking for that
// room and time. `highlight` (a sponsor name) rings that sponsor's cells,
// dims everyone else's and scrolls to their first one; Escape clears it.
export function CoffeeChatRoomTable({
  selection,
  colors,
  highlight = null,
  onClearHighlight,
}: {
  selection: SponsorSelection;
  colors?: ReadonlyMap<string, number>;
  highlight?: string | null;
  onClearHighlight?: () => void;
}) {
  const q = useLiveChatBoard();
  const now = useNow(30_000);
  const [picked, setPicked] = useState<Picked | null>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const region = useRef<HTMLDivElement>(null);
  const ownColors = useSponsorColors(q.data?.colorNames ?? NO_NAMES);
  const palette = colors ?? ownColors;
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

  // Bring the highlighted sponsor's first booking into view.
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
  const table = buildRoomTable(board, { selected: selection.selected });
  const pickedCell = picked
    ? table.rows[table.slots.indexOf(picked.slotTime)]?.[
        table.rooms.indexOf(picked.room)
      ]
    : undefined;

  return (
    <div className="flex min-w-0 flex-col gap-3">
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
                {table.rows[i]!.map((cell) => (
                  <td
                    key={cell.room}
                    className="border-b border-r border-dashboard-border-subtle p-1 align-top"
                  >
                    <CellButton
                      cell={cell}
                      colors={palette}
                      highlight={highlight}
                      onOpen={(button) => {
                        opener.current = button;
                        setPicked({ room: cell.room, slotTime: cell.slotTime });
                      }}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RoomSlotDialog
        cell={pickedCell}
        board={board}
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
// fill (sponsor cells are tinted with a solid strong left edge).
const FREE_CELL =
  "border-dashed border-dashboard-border-default bg-dashboard-bg-surface";
// Over capacity: solid warning edge on white with an icon and "Over";
// no sponsor colour uses the warning orange.
const OVER_CELL =
  "border-2 border-dashboard-status-warning bg-dashboard-bg-surface text-dashboard-text-warning";
const HELD_EDGE = "border-2 border-dashed border-dashboard-status-warning";

function CellButton({
  cell,
  colors,
  highlight,
  onOpen,
}: {
  cell: RoomCell;
  colors: ReadonlyMap<string, number>;
  highlight: string | null;
  onOpen: (button: HTMLButtonElement) => void;
}) {
  const time = formatClock(cell.slotTime);
  const who = cell.occupants.map((o) => o.sponsor).join(", ") || null;
  const occupied = cell.occupants.length > 0;
  const highlighted =
    highlight !== null && cell.occupants.some((o) => o.sponsor === highlight);
  // Dim only other sponsors' bookings: free cells never dim.
  const dimmed =
    occupied &&
    (cell.occupants.every((o) => !o.selected) ||
      (highlight !== null && !highlighted));
  // The sponsor the cell is about: the highlighted one, else the first
  // shown, else the first.
  const lead =
    cell.occupants.find((o) => o.sponsor === highlight) ??
    cell.occupants.find((o) => o.selected) ??
    cell.occupants[0];
  const color = lead ? sponsorColor(colors, lead.sponsor) : null;
  const hackers = cell.occupants.reduce((n, o) => n + o.hackers, 0);
  const fill = Math.min(1, cell.used / cell.capacity);
  const over = cell.state === "over";
  const warning = over
    ? copy.overWarning
    : cell.clash
      ? copy.clash
      : cell.needsHacker
        ? copy.needsHacker
        : null;
  return (
    <button
      type="button"
      aria-haspopup="dialog"
      aria-label={copy.cellLabel(
        cell.room,
        time,
        cell.state === "free"
          ? null
          : warning
            ? `${who ?? ""}, ${warning}`
            : cell.state === "full"
              ? `${who ?? ""}, ${copy.full}`
              : (who ?? copy.overWarning),
        cell.used,
        cell.capacity,
      )}
      onClick={(e) => onOpen(e.currentTarget)}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn(
        "flex min-h-14 w-full flex-col items-stretch gap-1 rounded-dashboard-sm border px-2 py-1.5 text-left text-xs leading-4",
        "transition-opacity duration-150 ease-out motion-reduce:transition-none",
        press,
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1",
        cell.state === "free" &&
          cn(
            FREE_CELL,
            "font-semibold text-dashboard-text-light",
            hover.highlight,
          ),
        // Booked and full: the sponsor's tint with a strong left edge.
        (cell.state === "booked" || cell.state === "full") &&
          cn(
            "border-l-4 border-dashboard-border-subtle text-dashboard-text-heavy",
            color?.fill,
            color?.edge,
          ),
        cell.state === "full" &&
          "ring-1 ring-inset ring-dashboard-border-strong",
        over && OVER_CELL,
        // A hold with no hacker yet: dashed warning edge, apart from over.
        cell.needsHacker && !over && HELD_EDGE,
        highlighted &&
          "ring-2 ring-dashboard-text-heavy ring-offset-1 ring-offset-dashboard-bg-surface",
        dimmed && DIMMED,
      )}
    >
      {cell.state === "free" ? (
        <span className="flex items-center gap-1">
          <Plus aria-hidden className="size-3.5 shrink-0" />
          {copy.free}
        </span>
      ) : (
        <>
          <span className="flex items-center justify-between gap-2">
            <span className="flex min-w-0 items-center gap-1.5">
              {lead && (
                <SponsorBadge
                  name={lead.sponsor}
                  color={color ?? undefined}
                  className="size-5"
                />
              )}
              <span className="min-w-0 truncate font-semibold">
                {who ?? copy.overWarning}
              </span>
            </span>
            <span className="flex shrink-0 items-center gap-1 font-semibold tabular-nums">
              {cell.state === "full" && (
                <>
                  <Lock aria-hidden className="size-3" />
                  <span>{copy.full}</span>
                </>
              )}
              {copy.used(cell.used, cell.capacity)}
            </span>
          </span>
          <span className="truncate text-dashboard-text-medium">
            {over || cell.clash ? (
              <span className="inline-flex items-center gap-1 font-semibold text-dashboard-text-warning">
                <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
                {over ? copy.over : copy.clash}
              </span>
            ) : cell.needsHacker ? (
              <NeedsHackerBadge />
            ) : (
              copy.hackers(hackers)
            )}
          </span>
          <span
            aria-hidden
            className="h-1 w-full overflow-hidden rounded-full bg-dashboard-bg-surface"
          >
            <span
              className={cn(
                "block h-full rounded-full",
                over
                  ? "bg-dashboard-status-warning"
                  : "bg-dashboard-action-primary",
              )}
              style={{ width: `${fill * 100}%` }}
            />
          </span>
        </>
      )}
    </button>
  );
}

const NO_NAMES: string[] = [];

// Who has the room at this time, and booking: pick a sponsor with an open
// start here; when their chats are in another room, move them here first
// (same rules as the room picker), then add the chat with the usual flow.
function RoomSlotDialog({
  cell,
  board,
  now,
  onClose,
  onCloseFocus,
}: {
  cell: RoomCell | undefined;
  board: ChatBoard;
  now: Date;
  onClose: () => void;
  onCloseFocus: () => void;
}) {
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
          {cell && <DialogBody cell={cell} board={board} now={now} />}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function sameRoom(a: string | null, b: string): boolean {
  return (
    Boolean(a) && (coffeeChatRoomOf(a) ?? a) === (coffeeChatRoomOf(b) ?? b)
  );
}

function DialogBody({
  cell,
  board,
  now,
}: {
  cell: RoomCell;
  board: ChatBoard;
  now: Date;
}) {
  const time = formatClock(cell.slotTime);
  // A sponsor is in this room when it's theirs or they hold it now.
  const inRoom = (s: BoardSponsor) =>
    sameRoom(s.room, cell.room) ||
    board.holds.some(
      (h) =>
        h.sponsorId === s.sponsorId &&
        sameRoom(h.room, cell.room) &&
        holdCovers(h, { slotTime: cell.slotTime }),
    );
  // Sponsors who can take a chat starting now-ish here: an offerable start
  // at this slot. People already in the room (or holding it) come first.
  const bookable = board.sponsors
    .filter((s) =>
      s.cells.some((c) => c.slotTime === cell.slotTime && c.offerable),
    )
    .sort(
      (a, b) =>
        Number(inRoom(b)) - Number(inRoom(a)) ||
        a.sponsor.localeCompare(b.sponsor),
    );
  const [sponsorName, setSponsorName] = useState(
    cell.occupants.find((o) => bookable.some((s) => s.sponsor === o.sponsor))
      ?.sponsor ??
      bookable[0]?.sponsor ??
      "",
  );
  const sponsor = bookable.find((s) => s.sponsor === sponsorName);
  // Holds in this room covering this slot.
  const holdsHere = board.holds.filter(
    (h) =>
      sameRoom(h.room, cell.room) && holdCovers(h, { slotTime: cell.slotTime }),
  );
  const sponsorCell = sponsor?.cells.find((c) => c.slotTime === cell.slotTime);
  const selectId = `room-book-${cell.room}-${cell.slotTime}`;

  return (
    <>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1">
          <Dialog.Title className="m-0 break-words text-xl font-semibold">
            {dialogCopy.title(cell.room, time)}
          </Dialog.Title>
          <Dialog.Description className="m-0 text-sm text-dashboard-text-medium">
            {dialogCopy.description(cell.used, cell.capacity)}
            {cell.state === "over" && ` ${copy.overWarning}.`}
          </Dialog.Description>
        </div>
        <Dialog.Close
          aria-label={dialogCopy.close}
          className={cn(
            "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
            hover.highlight,
          )}
        >
          <X aria-hidden className="size-5" />
        </Dialog.Close>
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="m-0 text-base font-semibold">{dialogCopy.inRoom}</h3>
        {cell.occupants.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-medium">
            {dialogCopy.nobody}
          </p>
        ) : (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {cell.occupants.map((o) => (
              <li
                key={o.sponsor}
                className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm"
              >
                <span className="font-semibold">{o.sponsor}</span>
                <span className="text-dashboard-text-medium">
                  {copy.hackers(o.hackers)} · {copy.reps(o.reps)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-4">
        {bookable.length === 0 ? (
          <p className="m-0 text-sm text-dashboard-text-medium">
            {dialogCopy.noSponsors}
          </p>
        ) : (
          <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
            <span className="text-dashboard-text-light">
              {dialogCopy.sponsor}
            </span>
            <select
              id={selectId}
              value={sponsorName}
              onChange={(e) => setSponsorName(e.target.value)}
              className={dashboardFieldClass}
            >
              {bookable.map((s) => (
                <option key={s.sponsor} value={s.sponsor}>
                  {s.room ? `${s.sponsor} (${s.room})` : s.sponsor}
                </option>
              ))}
            </select>
          </label>
        )}
        {sponsor && sponsorCell && (
          <>
            {inRoom(sponsor) ? (
              <AddChatHere sponsor={sponsor} cell={sponsorCell} now={now} />
            ) : (
              <MoveHere sponsor={sponsor} room={cell.room} />
            )}
          </>
        )}
      </section>

      <HoldsHere holds={holdsHere} slots={board.slots} />
      <HoldRoomForm board={board} room={cell.room} slotTime={cell.slotTime} />
    </>
  );
}

// The sponsor's chats are in another room (or none yet): give them this
// room, with the same clash rules as the room picker on the board.
function MoveHere({ sponsor, room }: { sponsor: BoardSponsor; room: string }) {
  const utils = api.useUtils();
  const assign = api.coffeeChatRequests.assignCoffeeChatRoom.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.coffeeChatRequests.invalidate(),
        utils.sponsorSchedule.invalidate(),
      ]);
    },
  });
  if (!sponsor.sponsorId) return null;
  return (
    <div className="flex flex-col gap-2">
      <p className="m-0 text-sm text-dashboard-text-medium">
        {dialogCopy.otherRoom(sponsor.sponsor, sponsor.room)}
      </p>
      <DashboardButton
        variant="outline"
        disabled={assign.isPending}
        onClick={() => assign.mutate({ sponsorId: sponsor.sponsorId!, room })}
        className="h-11 w-fit"
      >
        {dialogCopy.assign(room)}
      </DashboardButton>
      {assign.error && (
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {assign.error.message || dialogCopy.assignError}
        </p>
      )}
    </div>
  );
}
