import { useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  cellAt,
  dropCheck,
  keyOf,
  litCells,
  splitKey,
} from "~/lib/coffee-chat-board-view";
import {
  chatsInWindow,
  type CoffeeRoomId,
  type CoffeeSessionId,
} from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { api } from "~/utils/api";
import { BoardSummary, timeOf } from "./board-summary";
import {
  ConfirmDialog,
  FrontDialog,
  MoveCheckDialog,
  RemoveHackerDialog,
} from "./board-dialogs";
import {
  ALL_KEYS,
  ChatModal,
  type InviteChat,
  type ModalView,
} from "./chat-modal";
import { FixesBand } from "./fixes-band";
import { HelpSheet } from "./help-sheet";
import { BoardTips, sessionLabel, type SessionBoardData } from "./parts";
import { RoomsGrid } from "./rooms-grid";
import { SponsorsBand, sponsorRowId } from "./sponsors-band";
import { useBoardDrag } from "./use-board-drag";

const copy = coffeeSessionsCopy;
const rc = copy.rooms;

/** A question before a move goes through: the rep didn't tick that session. */
type Ask = { kind: "notFree"; src: string; target: string };

const BAR = "[data-coffee-bar]";
/** The Undo toast stays a little longer than the others (mock: 5 s). */
const UNDO_MS = 5_000;

/**
 * Organizer coffee chat board (session model), built from mocks
 * organizer-coffee-v8 to v12: Sponsors and Suggested fixes on the left, the
 * Rooms grid (8 rooms x 6 sessions, plus each sponsor's workshop) on the
 * right, and a sticky bar: Auto-schedule -> Re-run -> Notify hackers. Draft chats and
 * bookings are dragged to move (or onto the Remove zone); sent chats are
 * locked. A click opens the chat's modal. Everything is saved on the server (coffeeChatSessions and
 * coffeeChatInvites routers); the page only holds what's open.
 */
export function CoffeeSessionsTab({ sponsor }: { sponsor: string | null }) {
  const utils = api.useUtils();
  const [dragging, setDragging] = useState(false);
  const board = api.coffeeChatSessions.getBoard.useQuery(undefined, {
    // Never mid-drag: a refetch would re-render the cells under the finger.
    refetchInterval: dragging ? false : 15_000,
    refetchOnWindowFocus: !dragging,
  });
  const hasSent = !!board.data?.placements.some((p) => p.status === "sent");
  const invites = api.coffeeChatInvites.status.useQuery(undefined, {
    enabled: hasSent,
    refetchInterval: dragging ? false : 15_000,
  });
  const [open, setOpen] = useState<string | null>(null);
  const [view, setView] = useState<ModalView>(null);
  const [ask, setAsk] = useState<Ask | null>(null);
  const [hackerRm, setHackerRm] = useState<{
    sponsorId: string;
    chatId: string;
    name: string;
  } | null>(null);
  const [front, setFront] = useState<string | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);
  // Where focus goes when the modal closes: that cell (after a move, its new
  // place; after a remove or a booking, that cell).
  const focusBack = useRef<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // While a drag runs, the board shown is the one it started on.
  const frozen = useRef<SessionBoardData | undefined>(undefined);
  if (!dragging) frozen.current = board.data;
  const data = frozen.current;

  // ?sponsor= (an id or name) opens that sponsor's row once, scrolls it into
  // view and moves focus there ("Open coffee chats" from Needs attention or
  // My sponsors). Once per link: the 15 s refetch doesn't re-open it.
  const jumpedTo = useRef<string | null>(null);
  useEffect(() => {
    if (!sponsor || !board.data || jumpedTo.current === sponsor) return;
    const s = board.data.sponsors.find(
      (x) =>
        x.id === sponsor.toLowerCase() ||
        x.name.toLowerCase() === sponsor.toLowerCase(),
    );
    if (!s) return;
    jumpedTo.current = sponsor;
    setOpen(s.id);
    requestAnimationFrame(() => {
      const row = document.getElementById(sponsorRowId(s.id));
      row?.scrollIntoView({ block: "start", behavior: "smooth" });
      row?.focus({ preventScroll: true });
    });
  }, [sponsor, board.data]);

  const refresh = () => utils.coffeeChatSessions.getBoard.invalidate();
  const refreshAll = () =>
    Promise.all([refresh(), utils.coffeeChatInvites.invalidate()]);
  const onError = (e: { message: string }) => toast.error(e.message);
  const auto = api.coffeeChatSessions.autoSchedule.useMutation({
    onSuccess: (r) => toast.success(copy.toast.scheduled(r.chats, r.fixed)),
    onError,
    onSettled: refresh,
  });
  const applyFix = api.coffeeChatSessions.applyFix.useMutation({
    onSuccess: () => toast.success(copy.toast.fixApplied),
    onError,
    onSettled: () => {
      setApplying(null);
      return refreshAll();
    },
  });
  const movePlacement = api.coffeeChatSessions.movePlacement.useMutation({
    onSuccess: () => toast.success(copy.toast.moved),
    onError,
    onSettled: refreshAll,
  });
  const moveBooking = api.coffeeChatSessions.moveBooking.useMutation({
    onSuccess: () => toast.success(copy.toast.moved),
    onError,
    onSettled: refresh,
  });
  const placeChat = api.coffeeChatSessions.placeChat.useMutation({
    onSuccess: () => toast.success(copy.toast.restored),
    onError,
    onSettled: refresh,
  });
  // A draft chat or a booking can be put back from the toast. (A sent chat
  // is locked: it can't be removed.)
  const removePlacement = api.coffeeChatSessions.removePlacement.useMutation({
    onSuccess: (_r, input) => {
      const p = board.data?.placements.find((x) => x.id === input.placementId);
      toast.success(
        copy.toast.removed,
        p && p.status === "draft"
          ? {
              duration: UNDO_MS,
              action: {
                label: copy.toast.undo,
                onClick: () =>
                  placeChat.mutate({
                    repId: p.repId,
                    room: p.room as CoffeeRoomId,
                    sessionId: p.sessionId as CoffeeSessionId,
                    force: p.forced,
                  }),
              },
            }
          : undefined,
      );
    },
    onError,
    onSettled: refreshAll,
  });
  const bookRoom = api.coffeeChatSessions.bookRoom.useMutation({
    onSuccess: () => toast.success(copy.toast.booked),
    onError,
    onSettled: refresh,
  });
  const removeBooking = api.coffeeChatSessions.removeBooking.useMutation({
    onSuccess: (_r, input) => {
      const b = board.data?.bookings.find((x) => x.id === input.bookingId);
      toast.success(
        copy.toast.removed,
        b
          ? {
              duration: UNDO_MS,
              action: {
                label: copy.toast.undo,
                onClick: () =>
                  bookRoom.mutate({
                    room: b.room as CoffeeRoomId,
                    sessionId: b.sessionId as CoffeeSessionId,
                    label: b.label,
                    forSponsorId: b.forSponsorId,
                    bookedBy: b.bookedBy,
                  }),
              },
            }
          : undefined,
      );
    },
    onError,
    onSettled: refresh,
  });
  // Book an event: a room booking; each hacker picked gets an invite.
  const bookEvent = api.coffeeChatSessions.bookEvent.useMutation({
    onSuccess: (r) =>
      toast.success(
        copy.toast.eventBooked(
          r.chatIds.length,
          r.skipped.map((x) => x.reason),
        ),
      ),
    onError,
    onSettled: refreshAll,
  });
  const send = api.coffeeChatSessions.send.useMutation({
    onSuccess: (r) => {
      const dry =
        r.invites.dryRun && r.invites.created > 0 ? copy.toast.dryRun : "";
      toast.success(
        r.sent || r.invites.created
          ? copy.toast.sent(r.chats, r.invites.created) +
              dry +
              (r.reconfirmed ? ` ${copy.toast.reconfirmed(r.reconfirmed)}` : "")
          : r.reconfirmed
            ? copy.toast.reconfirmed(r.reconfirmed)
            : copy.bar.nothingToSend,
      );
      if (r.invites.status === "disabled") toast.message(copy.toast.invitesOff);
      if (r.sheet === "disabled") toast.info(copy.toast.sheetOff);
      if (r.sheet === "failed") toast.error(copy.toast.sheetFailed);
    },
    onError,
    onSettled: refreshAll,
  });
  const busy =
    auto.isPending ||
    applyFix.isPending ||
    movePlacement.isPending ||
    moveBooking.isPending ||
    removePlacement.isPending ||
    removeBooking.isPending ||
    bookRoom.isPending ||
    bookEvent.isPending ||
    send.isPending ||
    placeChat.isPending;
  // No run of show = no workshop windows: the server refuses every write
  // that places or moves something, so those buttons are off too.
  const locked = !!data && !data.workshopsAvailable;

  /** A sponsor's sent chats with their invites, or null before they load. */
  const chatsOf = (sponsorId: string): InviteChat[] | null =>
    invites.data
      ? (invites.data.sponsors.find((s) => s.sponsorId === sponsorId)?.chats ??
        [])
      : null;
  /** After a move, the modal (and focus) follow the cell to its new place, once the board has it. */
  const followTo = (src: string, target: string) =>
    void refresh().then(() => {
      if (focusBack.current === src) focusBack.current = target;
      setView((v) =>
        v?.kind === "cell" && v.key === src ? { kind: "cell", key: target } : v,
      );
    });

  const doMove = (src: string, target: string, force: boolean) => {
    const c = data ? cellAt(data, src) : null;
    if (c?.kind !== "chat") return;
    const { room, session } = splitKey(target);
    movePlacement.mutate(
      {
        placementId: c.placement.id,
        room: room as CoffeeRoomId,
        sessionId: session as CoffeeSessionId,
        force,
      },
      {
        onSuccess: () => followTo(src, target),
      },
    );
  };

  /** Drop or Move to…: refuse, ask, or move. A sent chat is locked (the server refuses too). */
  const requestMove = (src: string, target: string) => {
    if (!data) return;
    const from = cellAt(data, src);
    const { room, session } = splitKey(target);
    const s = sessionLabel(session);
    const check = dropCheck(data, src, target);
    if (check === "same" || check === "gone" || !from) return;
    if (from.kind === "chat" && from.placement.status === "sent")
      return void toast.error(copy.errors.sentLocked);
    if (check === "taken")
      return void toast.error(copy.errors.roomTaken(rc.rm(room), s));
    if (from.kind === "booking") {
      return moveBooking.mutate(
        {
          bookingId: from.booking.id,
          room: room as CoffeeRoomId,
          sessionId: session as CoffeeSessionId,
        },
        {
          onSuccess: () => followTo(src, target),
        },
      );
    }
    if (check === "workshop")
      return void toast.error(copy.errors.duringWorkshop(from.sponsor.name));
    if (check === "busy")
      return void toast.error(copy.errors.repBusy(from.rep.name, s));
    if (check === "notFree") return setAsk({ kind: "notFree", src, target });
    doMove(src, target, false);
  };

  const doRemove = (src: string) => {
    const c = data ? cellAt(data, src) : null;
    if (!c) return;
    // Removing from the modal closes it and puts focus on the now-empty cell.
    setView((v) => (v?.kind === "cell" && v.key === src ? null : v));
    if (c.kind === "chat")
      removePlacement.mutate({ placementId: c.placement.id });
    else removeBooking.mutate({ bookingId: c.booking.id });
  };
  const requestRemove = (src: string) => {
    const c = data ? cellAt(data, src) : null;
    if (c?.kind === "chat" && c.placement.status === "sent")
      return void toast.error(copy.errors.sentLocked);
    doRemove(src);
  };

  const drag = useBoardDrag({
    scrollRef,
    barSelector: BAR,
    enabled: !!data && !locked && !busy && !view && !ask,
    onDrop: (src, target) =>
      target === "remove" ? requestRemove(src) : requestMove(src, target),
  });
  useEffect(() => setDragging(!!drag), [drag]);
  const lit = useMemo(
    () =>
      drag && data ? litCells(data, drag.src, ALL_KEYS) : new Set<string>(),
    [drag, data],
  );

  if (board.isLoading) {
    return <p className="m-0 text-dashboard-text-medium">{copy.loading}</p>;
  }
  if (!data) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card">
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">
          {copy.loadError}
        </p>
        <DashboardButton variant="small" onClick={() => void board.refetch()}>
          {copy.retry}
        </DashboardButton>
      </div>
    );
  }

  const onCell = (k: string) => {
    focusBack.current = k;
    const { room, session } = splitKey(k);
    setView(
      cellAt(data, k)
        ? { kind: "cell", key: k }
        : { kind: "book", room, session },
    );
  };

  // The open question's pieces.
  const askCell = ask ? cellAt(data, ask.src) : null;
  const askChat = askCell?.kind === "chat" ? askCell : null;
  const modalCell = view?.kind === "cell" ? cellAt(data, view.key) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div>
          <h2 className="m-0 text-[28px] font-bold leading-tight lg:text-[32px]">
            {copy.title}
          </h2>
          <p className="m-0 text-sm text-dashboard-text-light">{copy.day}</p>
        </div>
        {/* Events are booked from an empty cell (it gives the room and session). */}
        <HelpSheet />
      </header>

      <BoardSummary
        board={data}
        action={
          // The line says "Run Auto-schedule": the button sits right beside it.
          !data.scheduled && data.sponsors.some((sp) => sp.submitted) ? (
            <DashboardButton
              variant="primary"
              disabled={busy || locked}
              onClick={() => auto.mutate()}
              className="shrink-0 sm:w-auto"
            >
              {busy ? copy.bar.working : copy.bar.autoSchedule}
            </DashboardButton>
          ) : undefined
        }
      />

      {!data.workshopsAvailable && (
        <p
          role="alert"
          className="m-0 rounded-dashboard-lg bg-dashboard-bg-task/40 px-4 py-3 text-sm text-dashboard-text-task"
        >
          {copy.workshopsUnavailable}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <SponsorsBand
            board={data}
            open={open}
            onOpen={(id) => setOpen((o) => (o === id ? null : id))}
          />
          <FixesBand
            board={data}
            applying={applying}
            locked={locked}
            onApply={(fixId) => {
              setApplying(fixId);
              applyFix.mutate({ fixId });
            }}
          />
        </div>
        <RoomsGrid
          board={data}
          selected={view?.kind === "cell" ? view.key : null}
          drag={drag}
          lit={lit}
          onCell={onCell}
          scrollRef={scrollRef}
        />
      </div>

      {/* Room for the sticky bar. */}
      <div aria-hidden className="h-28 sm:h-16" />
      <ActionBar
        board={data}
        busy={busy}
        locked={locked}
        onAuto={() => auto.mutate()}
        onSend={() => setConfirmSend(true)}
      />
      {drag && (
        // Covers the whole bottom bar while dragging.
        <div
          data-remove-zone=""
          style={{ minHeight: drag.zoneHeight }}
          className={cn(
            "fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-2 border-t-2 px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 text-base font-semibold",
            drag.over === "remove"
              ? "border-solid border-dashboard-notice-danger bg-dashboard-notice-danger text-dashboard-text-inverse"
              : "border-dashed border-dashboard-notice-danger bg-destructive/10 text-dashboard-notice-danger",
          )}
        >
          <Trash2 aria-hidden className="size-[22px]" />
          {rc.dropRemove}
        </div>
      )}
      <BoardTips off={!!drag} />

      <ChatModal
        board={data}
        view={view}
        chats={
          modalCell?.kind === "chat" ? chatsOf(modalCell.sponsor.id) : null
        }
        busy={busy}
        locked={locked}
        onClose={() => setView(null)}
        onMoveTo={requestMove}
        onRemove={requestRemove}
        onBook={(v) => {
          bookEvent.mutate(
            {
              room: v.room as CoffeeRoomId,
              sessionId: v.session as CoffeeSessionId,
              description: v.description,
              bookedBy: v.bookedBy,
              sponsorId: v.sponsorId,
              repIds: v.repIds,
              userIds: v.userIds,
            },
            {
              // The modal shows the new booking.
              onSuccess: () =>
                void refresh().then(() => {
                  const k = keyOf(v.room, v.session);
                  focusBack.current = k;
                  setView({ kind: "cell", key: k });
                }),
            },
          );
        }}
        onRemoveHacker={setHackerRm}
        onFront={setFront}
        onCloseFocus={() =>
          requestAnimationFrame(() => {
            const k = focusBack.current;
            if (k)
              document
                .querySelector<HTMLElement>(`[data-cell="${k}"]`)
                ?.focus({ preventScroll: true });
          })
        }
      />

      <MoveCheckDialog
        open={!!ask && !!askChat}
        rep={{ name: askChat?.rep.name ?? "", phone: askChat?.rep.phone ?? "" }}
        session={ask ? sessionLabel(splitKey(ask.target).session) : ""}
        onYes={() => {
          if (ask) doMove(ask.src, ask.target, true);
          setAsk(null);
        }}
        onClose={() => setAsk(null)}
      />
      <RemoveHackerDialog target={hackerRm} onClose={() => setHackerRm(null)} />
      <FrontDialog sponsorId={front} onClose={() => setFront(null)} />

      <SendConfirm
        board={data}
        open={confirmSend}
        onClose={() => setConfirmSend(false)}
        onSend={() => {
          setConfirmSend(false);
          send.mutate();
        }}
      />
    </div>
  );
}

/**
 * Notify hackers messages hackers and locks their chats, and can't be
 * undone, so it asks once (the board's red ConfirmDialog, Cancel focused):
 * how many sponsors' rooms are confirmed and up to how many hackers get
 * invited (every seat in the draft chats).
 */
function SendConfirm({
  board,
  open,
  onClose,
  onSend,
}: {
  board: SessionBoardData;
  open: boolean;
  onClose: () => void;
  onSend: () => void;
}) {
  const c = copy.sendConfirm;
  const drafts = board.placements.filter((p) => p.status === "draft");
  const sponsorOf = new Map(board.sponsors.map((sp) => [sp.id, sp]));
  const sponsors = new Set([
    ...drafts.map((p) => p.sponsorId),
    ...board.sponsors.filter((sp) => sp.changedAfterSend).map((sp) => sp.id),
  ]).size;
  const hackers = drafts.reduce((n, p) => {
    const sp = sponsorOf.get(p.sponsorId);
    return sp
      ? n + chatsInWindow(p.window, sp.chatMinutes) * sp.hackersPerChat
      : n;
  }, 0);
  return (
    <ConfirmDialog
      open={open}
      heading={c.title}
      paras={[c.body(sponsors, hackers), c.undoable]}
      ok={c.send}
      onOk={onSend}
      onClose={onClose}
    />
  );
}

function ActionBar({
  board,
  busy,
  locked,
  onAuto,
  onSend,
}: {
  board: SessionBoardData;
  busy: boolean;
  /** The run of show can't be read: nothing can be scheduled or sent. */
  locked: boolean;
  onAuto: () => void;
  onSend: () => void;
}) {
  const b = copy.bar;
  const nFix = board.fixes.length;
  // A sponsor who changed after invites still needs its schedule re-confirmed.
  const changed = board.sponsors.some((sp) => sp.changedAfterSend);
  const allSent =
    board.scheduled && board.draftCount === 0 && board.sentAt && !changed;
  const sentTime = board.sentAt ? timeOf(board.sentAt) : "";
  return (
    <div
      data-tour="coffee-send"
      data-coffee-bar=""
      className="fixed inset-x-0 bottom-0 z-20 border-t border-dashboard-border-default bg-dashboard-bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-dashboard-card lg:px-12"
    >
      <div className="mx-auto flex max-w-[1440px] flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        {allSent ? (
          <span className="inline-flex items-center justify-center gap-1.5 text-[17px] font-bold text-dashboard-status-live">
            <CircleCheck aria-hidden className="size-5" />
            {b.sentAt(sentTime)}
          </span>
        ) : !board.scheduled ? (
          <>
            <span className="text-center text-[15px] text-dashboard-text-medium sm:text-left">
              {b.start}
            </span>
            <DashboardButton
              variant="primary"
              disabled={busy || locked}
              onClick={onAuto}
              className="sm:w-auto"
            >
              {busy ? b.working : b.autoSchedule}
            </DashboardButton>
          </>
        ) : (
          <>
            <span className="flex flex-wrap items-center justify-center gap-1 text-[15px] text-dashboard-text-medium sm:justify-start">
              {nFix ? (
                <span className="font-medium text-dashboard-text-warning">
                  {b.fixesOpen(nFix)}
                </span>
              ) : board.sentAt && board.draftCount > 0 ? (
                b.newSince(board.draftCount)
              ) : (
                b.review
              )}
              <DashboardButton
                variant="link"
                disabled={busy || locked}
                onClick={onAuto}
              >
                {b.rerun}
              </DashboardButton>
            </span>
            <DashboardButton
              variant="primary"
              disabled={busy || locked}
              onClick={onSend}
              className="sm:w-auto"
            >
              {busy ? b.working : b.send}
            </DashboardButton>
          </>
        )}
      </div>
    </div>
  );
}
