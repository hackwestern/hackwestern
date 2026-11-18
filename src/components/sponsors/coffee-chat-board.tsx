import { useEffect, useRef, useState, type ReactNode } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { hover } from "~/components/internals/interaction";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import {
  HackerMatches,
  useDebounced,
} from "~/components/sponsors/add-coffee-chat";
import {
  dashboardFieldClass,
  WatcherInput,
} from "~/components/sponsors/coffee-chat-fields";
import {
  CoffeeChatRoomTable,
  useLiveChatBoard,
  useSponsorColors,
} from "~/components/sponsors/coffee-chat-room-table";
import {
  SponsorFilter,
  useSponsorSelection,
} from "~/components/sponsors/sponsor-filter";
import { LoadError } from "~/components/sponsors/schedule-states";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import {
  COFFEE_CHAT_GRID_MINUTES,
  coffeeChatExpiresAt,
  coffeeChatStartsAt,
  type CoffeeChatStatus,
} from "~/lib/coffee-chat-requests";
import { holdCovers } from "~/lib/coffee-chat-holds";
import { formatClock } from "~/lib/run-of-show";
import { sponsorNameForParam } from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";
import type { OrganizerHackerMatch } from "~/server/api/routers/coffee-chat-requests";
import type {
  BoardCell,
  BoardChat,
  BoardSponsor,
} from "~/server/api/utils/coffee-chat-board";
import { api } from "~/utils/api";

const copy = coffeeChatCopy.organizer.board;
const booked = coffeeChatCopy.organizer;

type Selected = { sponsor: string; slotTime: string };

// Organizer Coffee chats tab: the sponsor filter, then the colour-coded
// rooms table (a room booking view) by default, with the sponsor x time
// table and the list (add a chat, booked chats) one toggle away. The
// filter applies to every view; per-sponsor totals live on the Sponsors
// tab. Picking a sponsor's name (or arriving with ?sponsor=, an id or name)
// highlights their cells and dims everyone else's; Escape clears it.
export function CoffeeChatBoard({
  list,
  sponsor = null,
}: {
  list: ReactNode;
  sponsor?: string | null;
}) {
  const [view, setView] = useState<"rooms" | "table" | "list">("rooms");
  const board = useLiveChatBoard();
  const names = board.data?.sponsors.map((s) => s.sponsor) ?? NO_NAMES;
  const selection = useSponsorSelection(names);
  const colors = useSponsorColors(board.data?.colorNames ?? NO_NAMES);
  const linked = sponsorNameForParam(
    sponsor,
    board.data?.sponsors ?? NO_SPONSORS,
  );
  const [highlight, setHighlight] = useState<string | null>(null);
  // ?sponsor= highlights that sponsor once the board knows them.
  useEffect(() => {
    if (linked) setHighlight(linked);
  }, [linked]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <section
        aria-labelledby="chat-board"
        className="flex min-w-0 flex-col gap-4"
      >
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <h2 id="chat-board" className="m-0 text-lg font-semibold">
              {copy.heading}
            </h2>
            <p className="m-0 text-sm text-dashboard-text-medium">
              {copy.intro}
            </p>
          </div>
          <div role="group" aria-label={copy.viewLabel} className="flex gap-2">
            {(["rooms", "table", "list"] as const).map((v) => (
              <DashboardChip
                key={v}
                selected={view === v}
                onClick={() => setView(v)}
                className="min-h-11"
              >
                {copy.views[v]}
              </DashboardChip>
            ))}
          </div>
        </div>
        {view !== "list" && board.data && (
          <>
            <SponsorFilter
              names={names}
              selection={selection}
              colors={colors}
              highlight={highlight}
              onHighlight={(name) =>
                setHighlight((h) => (h === name ? null : name))
              }
            />
          </>
        )}
        {view === "list" ? (
          list
        ) : view === "rooms" ? (
          <CoffeeChatRoomTable
            selection={selection}
            colors={colors}
            highlight={highlight}
            onHighlight={(name) =>
              setHighlight((h) => (h === name ? null : name))
            }
            onClearHighlight={() => setHighlight(null)}
          />
        ) : (
          <Board isShown={selection.isShown} />
        )}
      </section>
    </div>
  );
}

const NO_NAMES: string[] = [];
const NO_SPONSORS: BoardSponsor[] = [];

const STATUS_CHIP: Record<CoffeeChatStatus, string> = {
  accepted: "bg-dashboard-bg-highlight text-dashboard-text-active",
  pending: "bg-dashboard-bg-nav text-dashboard-text-heavy",
  declined: "bg-dashboard-bg-inset text-dashboard-text-light line-through",
  expired: "bg-dashboard-bg-inset text-dashboard-text-light line-through",
  cancelled: "bg-dashboard-bg-inset text-dashboard-text-light line-through",
};

function StatusChip({ status }: { status: CoffeeChatStatus }) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center rounded-dashboard-sm px-1.5 py-0.5 text-xs font-semibold leading-4",
        STATUS_CHIP[status],
      )}
    >
      {copy.status[status]}
    </span>
  );
}

/** True while `now` is inside the 15-minute row starting at `slotTime`. */
function isNowRow(slotTime: string, now: Date): boolean {
  const start = coffeeChatStartsAt(slotTime).getTime();
  const t = now.getTime();
  return t >= start && t < start + COFFEE_CHAT_GRID_MINUTES * 60_000;
}

function Board({ isShown }: { isShown: (sponsor: string) => boolean }) {
  const now = useNow(30_000);
  const q = useLiveChatBoard();
  const [selected, setSelected] = useState<Selected | null>(null);
  // The cell that opened the panel, focused again when it closes (no
  // Dialog.Trigger, so Radix can't). Found by key: refetches re-render cells.
  const opener = useRef<string | null>(null);
  const cellKey = (s: Selected) => `${s.sponsor}|${s.slotTime}`;

  if (q.isLoading) {
    return (
      <div
        aria-busy="true"
        className="h-72 w-full rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card motion-safe:animate-pulse"
      />
    );
  }
  if (!q.data) return <LoadError onRetry={() => void q.refetch()} />;
  const board = {
    ...q.data,
    sponsors: q.data.sponsors.filter((s) => isShown(s.sponsor)),
  };
  if (board.sponsors.length === 0 || board.slots.length === 0) {
    return (
      <DashboardPanel>
        <p className="m-0 text-dashboard-text-medium">{copy.empty}</p>
      </DashboardPanel>
    );
  }

  const chatsById = new Map(board.chats.map((c) => [c.chatId, c]));
  // Each sponsor's cells keyed by the row they start on.
  const cellAt = board.sponsors.map(
    (s) => new Map(s.cells.map((c) => [c.slotTime, c])),
  );
  const panelSponsor = selected
    ? board.sponsors.find((s) => s.sponsor === selected.sponsor)
    : undefined;
  const panelCell = panelSponsor?.cells.find(
    (c) => c.slotTime === selected?.slotTime,
  );

  return (
    <>
      <p className="m-0 text-xs text-dashboard-text-light md:hidden">
        {copy.scrollHint}
      </p>
      {/* Scrolls inside itself, never the page. */}
      <div className="min-w-0">
        <div
          role="region"
          aria-label={copy.tableLabel}
          tabIndex={0}
          className="relative max-h-[75vh] scroll-pl-20 overflow-auto rounded-dashboard-lg bg-dashboard-bg-surface shadow-dashboard-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          <table className="border-separate border-spacing-0 text-sm">
            <caption className="sr-only">{copy.tableLabel}</caption>
            <thead>
              <tr>
                <th
                  scope="col"
                  className="sticky left-0 top-0 z-30 w-20 min-w-20 border-b border-r border-dashboard-border-subtle bg-dashboard-bg-surface px-3 py-3 text-left align-bottom text-xs font-semibold text-dashboard-text-light"
                >
                  {copy.time}
                </th>
                {board.sponsors.map((s) => (
                  <SponsorHeader key={s.sponsor} sponsor={s} />
                ))}
              </tr>
            </thead>
            <tbody>
              {board.slots.map((slot) => {
                const nowRow = isNowRow(slot, now);
                return (
                  <tr key={slot}>
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 border-b border-r border-dashboard-border-subtle px-3 py-2 text-left align-top text-xs font-semibold",
                        nowRow
                          ? "bg-dashboard-bg-highlight text-dashboard-text-active"
                          : "bg-dashboard-bg-surface text-dashboard-text-medium",
                      )}
                    >
                      <span className="whitespace-nowrap">
                        {formatClock(slot)}
                      </span>
                      {nowRow && (
                        <span className="mt-1 block w-fit rounded-dashboard-sm bg-dashboard-action-primary px-1.5 py-0.5 text-xs text-dashboard-text-inverse">
                          {copy.now}
                        </span>
                      )}
                    </th>
                    {board.sponsors.map((s, i) => {
                      const cell = cellAt[i]!.get(slot);
                      if (!cell) return null; // covered by a 30-min cell
                      return (
                        <BoardCellView
                          key={s.sponsor}
                          sponsor={s}
                          cell={cell}
                          chats={cell.chatIds.flatMap((id) => {
                            const c = chatsById.get(id);
                            return c ? [c] : [];
                          })}
                          nowRow={nowRow}
                          cellId={cellKey({
                            sponsor: s.sponsor,
                            slotTime: cell.slotTime,
                          })}
                          onOpen={() => {
                            const next = {
                              sponsor: s.sponsor,
                              slotTime: cell.slotTime,
                            };
                            opener.current = cellKey(next);
                            setSelected(next);
                          }}
                        />
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <datalist id="board-watchers">
        {board.watchers.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      <CellPanel
        open={Boolean(panelSponsor && panelCell)}
        onClose={() => setSelected(null)}
        onCloseFocus={() => {
          const key = opener.current;
          if (!key) return;
          document
            .querySelector<HTMLElement>(`[data-cell="${CSS.escape(key)}"]`)
            ?.focus();
        }}
        sponsor={panelSponsor}
        cell={panelCell}
        chats={(panelCell?.chatIds ?? []).flatMap((id) => {
          const c = chatsById.get(id);
          return c ? [c] : [];
        })}
        rooms={board.rooms}
        room={
          panelSponsor && panelCell
            ? (board.holds.find(
                (h) =>
                  h.sponsorId === panelSponsor.sponsorId &&
                  holdCovers(h, panelCell),
              )?.room ?? null)
            : null
        }
        now={now}
      />
    </>
  );
}

// Totals for the sponsors in the filter (every sponsor by default).
function SponsorHeader({ sponsor: s }: { sponsor: BoardSponsor }) {
  return (
    <th
      scope="col"
      data-sponsor={s.sponsor}
      className={cn(
        "sticky top-0 z-20 w-56 min-w-56 border-b border-r border-dashboard-border-subtle px-3 py-3 text-left align-top font-medium",
        "bg-dashboard-bg-surface",
      )}
    >
      <div className="flex flex-col gap-1.5">
        <span className="break-words text-sm font-semibold text-dashboard-text-heavy">
          {s.sponsor}
        </span>
        {s.setUp ? (
          <span className="text-xs text-dashboard-text-medium">
            {copy.format(s.durationMinutes, s.groupSize)} · {copy.reps(s.reps)}
          </span>
        ) : (
          <span className="w-fit rounded-dashboard-sm bg-dashboard-bg-inset px-1.5 py-0.5 text-xs font-semibold text-dashboard-text-light">
            {copy.notSetUp}
          </span>
        )}
        {s.sponsorId ? (
          <WatcherInput sponsorId={s.sponsorId} watcher={s.watcher} />
        ) : (
          <span className="text-xs text-dashboard-text-light">
            {copy.notRegistered}
          </span>
        )}
        <span className="text-xs text-dashboard-text-medium">
          {copy.counts(s.counts.accepted, s.counts.pending, s.counts.total)}
        </span>
      </div>
    </th>
  );
}

// Hatched background for times outside a sponsor's window.
const hatched =
  "bg-dashboard-bg-inset bg-[repeating-linear-gradient(135deg,transparent_0_6px,rgba(81,100,118,0.08)_6px_8px)]";

function BoardCellView({
  sponsor: s,
  cell,
  chats,
  nowRow,
  cellId,
  onOpen,
}: {
  sponsor: BoardSponsor;
  cell: BoardCell;
  chats: BoardChat[];
  nowRow: boolean;
  cellId: string;
  onOpen: () => void;
}) {
  const open = cell.kind === "open";
  const time = formatClock(cell.slotTime);
  const base = cn(
    "border-b border-r border-dashboard-border-subtle p-0 align-top",
    nowRow && "border-t-2 border-t-dashboard-action-primary",
  );

  // Outside the window with nothing in it: muted, not a button.
  if (!open && chats.length === 0) {
    return (
      <td rowSpan={cell.rows} className={cn(base, hatched)}>
        <span className="sr-only">
          {copy.cellLabel(s.sponsor, time)}:{" "}
          {cell.kind === "gap" ? copy.noStart : copy.outside}
        </span>
      </td>
    );
  }

  return (
    <td rowSpan={cell.rows} className={cn(base, !open && hatched)}>
      <button
        type="button"
        onClick={onOpen}
        aria-haspopup="dialog"
        data-cell={cellId}
        className={cn(
          "flex h-full min-h-14 w-full flex-col items-stretch gap-1.5 px-2.5 py-2 text-left transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-dashboard-action-primary",
          hover.highlightSubtle,
        )}
      >
        <span className="sr-only">{copy.cellLabel(s.sponsor, time)}: </span>
        {chats.length > 0 && (
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {chats.map((c) => (
              <li
                key={c.chatId}
                className="flex items-center justify-between gap-1.5"
              >
                <span className="min-w-0 truncate text-xs font-semibold text-dashboard-text-heavy">
                  {copy.shortName(c.firstName, c.lastName)}
                </span>
                <StatusChip status={c.status} />
              </li>
            ))}
          </ul>
        )}
        <span
          className={cn(
            "text-xs",
            cell.offerable
              ? "text-dashboard-text-medium"
              : "text-dashboard-text-light",
          )}
        >
          {!open
            ? cell.kind === "gap"
              ? copy.noStart
              : copy.outside
            : cell.seatsLeft < 1
              ? copy.full
              : cell.offerable
                ? copy.seatsLeft(cell.seatsLeft)
                : copy.closed}
        </span>
      </button>
    </td>
  );
}

function CellPanel({
  open,
  onClose,
  onCloseFocus,
  sponsor,
  cell,
  chats,
  rooms,
  room,
  now,
}: {
  open: boolean;
  onClose: () => void;
  onCloseFocus: () => void;
  sponsor: BoardSponsor | undefined;
  cell: BoardCell | undefined;
  chats: BoardChat[];
  rooms: string[];
  /** The room of the sponsor's block here, if any. */
  room: string | null;
  now: Date;
}) {
  const time = cell ? formatClock(cell.slotTime) : "";
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/40 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:fade-out-0 motion-safe:data-[state=open]:fade-in-0" />
        <Dialog.Content
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onCloseFocus();
          }}
          className={cn(
            "fixed z-50 flex w-full flex-col gap-5 overflow-y-auto bg-dashboard-bg-surface p-6 font-figtree font-medium leading-default text-dashboard-text-heavy shadow-dashboard-card focus:outline-none",
            "inset-x-0 bottom-0 max-h-[90dvh] rounded-t-dashboard-2xl pb-[max(1.5rem,env(safe-area-inset-bottom))]",
            "sm:inset-y-0 sm:left-auto sm:right-0 sm:max-h-none sm:max-w-[440px] sm:rounded-none sm:rounded-l-dashboard-2xl",
            "motion-safe:data-[state=open]:duration-200 motion-safe:data-[state=open]:animate-in motion-safe:data-[state=closed]:animate-out motion-safe:data-[state=closed]:slide-out-to-bottom motion-safe:data-[state=open]:slide-in-from-bottom motion-safe:sm:data-[state=closed]:slide-out-to-right motion-safe:sm:data-[state=open]:slide-in-from-right",
          )}
        >
          {sponsor && cell && (
            <>
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 flex-col gap-1">
                  <Dialog.Title className="m-0 break-words text-xl font-semibold">
                    {copy.panel.title(sponsor.sponsor, time)}
                  </Dialog.Title>
                  <Dialog.Description className="m-0 text-sm text-dashboard-text-medium">
                    {copy.panel.description(
                      copy.format(sponsor.durationMinutes, sponsor.groupSize),
                      room,
                    )}
                    {cell.kind === "open" &&
                      ` · ${cell.seatsLeft > 0 ? copy.seatsLeft(cell.seatsLeft) : copy.full}`}
                  </Dialog.Description>
                </div>
                <Dialog.Close
                  aria-label={copy.panel.close}
                  className={cn(
                    "-mr-2 -mt-2 inline-flex size-11 shrink-0 items-center justify-center rounded-dashboard-lg text-dashboard-text-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary",
                    hover.highlight,
                  )}
                >
                  <X aria-hidden className="size-5" />
                </Dialog.Close>
              </div>

              <section
                aria-labelledby="panel-chats"
                className="flex flex-col gap-2"
              >
                <h3 id="panel-chats" className="m-0 text-base font-semibold">
                  {copy.panel.chats}
                </h3>
                {chats.length === 0 ? (
                  <p className="m-0 text-sm text-dashboard-text-medium">
                    {copy.panel.noChats}
                  </p>
                ) : (
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {chats.map((c) => (
                      <PanelChat
                        key={c.chatId}
                        chat={c}
                        sponsor={sponsor}
                        rooms={rooms}
                      />
                    ))}
                  </ul>
                )}
              </section>

              <AddChatHere sponsor={sponsor} cell={cell} now={now} />
            </>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

function PanelChat({
  chat,
  sponsor,
  rooms,
}: {
  chat: BoardChat;
  sponsor: BoardSponsor;
  rooms: string[];
}) {
  const utils = api.useUtils();
  const [mode, setMode] = useState<"idle" | "cancel" | "move">("idle");
  const otherRooms = rooms.filter((r) => r !== chat.room);
  const [room, setRoom] = useState(otherRooms[0] ?? "");
  const done = {
    onSuccess: async () => {
      setMode("idle");
      await utils.coffeeChatRequests.invalidate();
    },
  };
  const cancel = api.coffeeChatRequests.cancel.useMutation(done);
  const move = api.coffeeChatRequests.moveRoom.useMutation(done);
  const error = cancel.error ?? move.error;
  const active = chat.status === "pending" || chat.status === "accepted";
  const hacker = booked.hacker(chat.firstName, chat.lastName);
  const time = formatClock(chat.slotTime);
  const selectId = `panel-move-${chat.chatId}`;

  return (
    <li className="flex flex-col gap-2 rounded-dashboard-lg border border-dashboard-border-subtle p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 flex-col gap-0.5 text-sm">
          <span className="break-words font-semibold">{hacker}</span>
          <span className="break-all text-dashboard-text-light">
            {copy.panel.code(chat.hackerId)}
          </span>
          <span className="text-dashboard-text-medium">
            {copy.panel.rep(chat.repName)} · {chat.room ?? booked.roomTbd}
          </span>
        </div>
        <StatusChip status={chat.status} />
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
            {booked.cancelConfirm(hacker, sponsor.sponsor, time)}
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
            {booked.moveHint(sponsor.sponsor, time)}
          </p>
          <div className="flex flex-wrap items-end gap-2">
            <label htmlFor={selectId} className="flex flex-col gap-1 text-sm">
              <span className="text-dashboard-text-light">{booked.moveTo}</span>
              <select
                id={selectId}
                value={room}
                onChange={(e) => setRoom(e.target.value)}
                className={dashboardFieldClass}
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

const add = booked.add;

export function AddChatHere({
  sponsor,
  cell,
  now,
}: {
  sponsor: BoardSponsor;
  cell: BoardCell;
  now: Date;
}) {
  const utils = api.useUtils();
  const [query, setQuery] = useState("");
  const [hacker, setHacker] = useState<OrganizerHackerMatch | null>(null);
  const [repName, setRepName] = useState("");
  const [added, setAdded] = useState<string | null>(null);
  const search = useDebounced(query.trim(), 250);
  const matches = api.coffeeChatRequests.searchHackers.useQuery(
    { query: search },
    { enabled: !hacker && search.length >= 2, retry: false },
  );
  const time = formatClock(cell.slotTime);
  const offer = api.coffeeChatRequests.organizerOffer.useMutation({
    onSuccess: async (chat) => {
      setAdded(
        add.added(hacker?.name ?? chat.firstName, sponsor.sponsor, time),
      );
      setHacker(null);
      setQuery("");
      setRepName("");
      await utils.coffeeChatRequests.invalidate();
    },
  });

  const reason = !sponsor.sponsorId
    ? copy.panel.cantAdd.notRegistered
    : cell.kind !== "open"
      ? copy.panel.cantAdd.notOpen
      : now >= coffeeChatExpiresAt(cell.slotTime)
        ? copy.panel.cantAdd.tooLate
        : cell.seatsLeft < 1
          ? copy.panel.cantAdd.full
          : null;

  return (
    <section
      aria-labelledby="panel-add"
      className="flex flex-col gap-3 border-t border-dashboard-border-subtle pt-4"
    >
      <div className="flex flex-col gap-1">
        <h3 id="panel-add" className="m-0 text-base font-semibold">
          {copy.panel.addHeading}
        </h3>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {reason ?? copy.panel.addIntro(sponsor.sponsor, time)}
        </p>
      </div>
      {!reason && sponsor.sponsorId && (
        <form
          className="flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!hacker || offer.isPending) return;
            setAdded(null);
            offer.mutate({
              sponsorId: sponsor.sponsorId!,
              userId: hacker.userId,
              slotTime: cell.slotTime,
              repName: repName.trim() || undefined,
            });
          }}
        >
          <div className="flex flex-col gap-1 text-sm">
            {hacker ? (
              <>
                <span className="text-dashboard-text-light">{add.hacker}</span>
                <div className="flex min-h-10 items-center justify-between gap-2 rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2">
                  <span className="min-w-0 break-words">
                    <span className="font-semibold">{hacker.name}</span>
                    <span className="block break-all text-dashboard-text-light">
                      {add.code(hacker.hackerId)} · {hacker.email}
                    </span>
                  </span>
                  <DashboardButton
                    type="button"
                    variant="tertiary"
                    onClick={() => setHacker(null)}
                  >
                    {add.change}
                  </DashboardButton>
                </div>
              </>
            ) : (
              <>
                <label
                  htmlFor="panel-add-hacker"
                  className="text-dashboard-text-light"
                >
                  {add.hacker}
                </label>
                <input
                  id="panel-add-hacker"
                  type="search"
                  autoComplete="off"
                  value={query}
                  placeholder={add.hackerPlaceholder}
                  onChange={(e) => setQuery(e.target.value)}
                  aria-describedby="add-chat-hacker-status"
                  className={dashboardFieldClass}
                />
                <HackerMatches
                  query={query.trim()}
                  settled={search}
                  loading={matches.isFetching}
                  matches={matches.data}
                  onPick={setHacker}
                />
              </>
            )}
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-dashboard-text-light">{add.rep}</span>
            <input
              value={repName}
              maxLength={255}
              onChange={(e) => setRepName(e.target.value)}
              className={dashboardFieldClass}
            />
          </label>
          <DashboardButton
            type="submit"
            disabled={!hacker || offer.isPending}
            className="w-fit"
          >
            {add.submit}
          </DashboardButton>
        </form>
      )}
      <p aria-live="polite" className="m-0 text-sm empty:hidden">
        {offer.error ? (
          <span className="text-dashboard-text-warning">
            {offer.error.message || add.addError}
          </span>
        ) : added ? (
          <span className="text-dashboard-text-medium">{added}</span>
        ) : null}
      </p>
    </section>
  );
}
