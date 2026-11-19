import { useEffect, useRef, useState } from "react";
import * as AlertDialog from "@radix-ui/react-alert-dialog";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  chatsInWindow,
  type CoffeeRoomId,
  type CoffeeSessionId,
} from "~/lib/coffee-chat-sessions";
import { api } from "~/utils/api";
import { BoardSummary, timeOf } from "./board-summary";
import { FixesBand } from "./fixes-band";
import { HelpSheet } from "./help-sheet";
import { type SessionBoardData } from "./parts";
import { BookingForm, CellDetail, RoomsGrid, cellAt, keyOf, moveCheck, splitKey } from "./rooms-grid";
import { SponsorsBand, sponsorRowId } from "./sponsors-band";

const copy = coffeeSessionsCopy;

/**
 * Organizer coffee chat board (session model), built from
 * mocks/organizer-coffee-v8: Sponsors and Suggested fixes on the left, the
 * Rooms grid (8 rooms x 6 sessions, plus each sponsor's workshop) on the
 * right, and a sticky bar: Auto-schedule -> Re-run -> Send. Everything is
 * saved on the server (coffeeChatSessions router); the page only holds
 * what's open and selected.
 */
export function CoffeeSessionsTab({ sponsor }: { sponsor: string | null }) {
  const utils = api.useUtils();
  const board = api.coffeeChatSessions.getBoard.useQuery(undefined, {
    refetchInterval: 15_000,
    refetchOnWindowFocus: true,
  });
  const [open, setOpen] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ room: string; session: string } | null>(null);
  const [applying, setApplying] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState(false);

  // ?sponsor= (an id or name) opens that sponsor's row once, scrolls it into
  // view and moves focus there ("Open coffee chats" from Needs attention or
  // My sponsors). Once per link: the 15 s refetch doesn't re-open it.
  const jumpedTo = useRef<string | null>(null);
  useEffect(() => {
    if (!sponsor || !board.data || jumpedTo.current === sponsor) return;
    const s = board.data.sponsors.find(
      (x) => x.id === sponsor.toLowerCase() || x.name.toLowerCase() === sponsor.toLowerCase(),
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

  // Esc leaves move mode or closes the detail.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      setMoving(null);
      setSelected(null);
      setBooking(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const refresh = () => utils.coffeeChatSessions.getBoard.invalidate();
  const onError = (e: { message: string }) => toast.error(e.message);
  const auto = api.coffeeChatSessions.autoSchedule.useMutation({
    onSuccess: (r) => toast.success(copy.toast.scheduled(r.placed)),
    onError,
    onSettled: refresh,
  });
  const applyFix = api.coffeeChatSessions.applyFix.useMutation({
    onSuccess: () => toast.success(copy.toast.fixApplied),
    onError,
    onSettled: () => {
      setApplying(null);
      return refresh();
    },
  });
  const movePlacement = api.coffeeChatSessions.movePlacement.useMutation({
    onSuccess: (r) => toast.success(r.sent ? copy.toast.movedSent : copy.toast.moved),
    onError,
    onSettled: refresh,
  });
  const moveBooking = api.coffeeChatSessions.moveBooking.useMutation({ onError, onSettled: refresh });
  const placeChat = api.coffeeChatSessions.placeChat.useMutation({
    onSuccess: () => toast.success(copy.toast.restored),
    onError,
    onSettled: refresh,
  });
  // A draft chat or a booking can be put back from the toast. A sent chat
  // can't: its hackers were already told.
  const removePlacement = api.coffeeChatSessions.removePlacement.useMutation({
    onSuccess: (_r, input) => {
      const p = board.data?.placements.find((x) => x.id === input.placementId);
      toast.success(
        copy.toast.removed,
        p && p.status === "draft"
          ? {
              action: {
                label: copy.toast.undo,
                onClick: () =>
                  placeChat.mutate({
                    repId: p.repId,
                    room: p.room as CoffeeRoomId,
                    sessionId: p.sessionId as CoffeeSessionId,
                  }),
              },
            }
          : undefined,
      );
    },
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
              action: {
                label: copy.toast.undo,
                onClick: () =>
                  bookRoom.mutate({
                    room: b.room as CoffeeRoomId,
                    sessionId: b.sessionId as CoffeeSessionId,
                    label: b.label,
                    note: b.note ?? "",
                    forSponsorId: b.forSponsorId,
                  }),
              },
            }
          : undefined,
      );
    },
    onError,
    onSettled: refresh,
  });
  const bookRoom = api.coffeeChatSessions.bookRoom.useMutation({
    onSuccess: () => toast.success(copy.toast.booked),
    onError,
    onSettled: refresh,
  });
  const send = api.coffeeChatSessions.send.useMutation({
    onSuccess: (r) => {
      const dry = r.invites.dryRun && r.invites.created > 0 ? copy.toast.dryRun : "";
      toast.success(
        r.sent || r.invites.created
          ? copy.toast.sent(r.sent, r.invites.created, r.invites.openSeats) +
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
    onSettled: refresh,
  });
  const busy =
    auto.isPending || applyFix.isPending || movePlacement.isPending || moveBooking.isPending ||
    removePlacement.isPending || removeBooking.isPending || bookRoom.isPending || send.isPending;

  if (board.isLoading) {
    return <p className="m-0 text-dashboard-text-medium">{copy.loading}</p>;
  }
  if (!board.data) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card">
        <p role="alert" className="m-0 text-sm text-dashboard-text-warning">{copy.loadError}</p>
        <DashboardButton variant="small" onClick={() => void board.refetch()}>{copy.retry}</DashboardButton>
      </div>
    );
  }
  const data = board.data;
  // No run of show = no workshop windows: the server refuses every write
  // that places or moves something, so those buttons are off too.
  const locked = !data.workshopsAvailable;

  const onCell = (k: string) => {
    if (moving) {
      const check = moveCheck(data, moving, k);
      if (typeof check === "object") return void toast.error(copy.errors.duringWorkshop(check.workshop));
      if (check === "ok") {
        const from = cellAt(data, moving);
        const { room, session } = splitKey(k);
        const input = { room: room as CoffeeRoomId, sessionId: session as CoffeeSessionId };
        if (from?.kind === "chat") movePlacement.mutate({ placementId: from.placement.id, ...input });
        if (from?.kind === "booking") moveBooking.mutate({ bookingId: from.booking.id, ...input });
        setSelected(k);
      }
      setMoving(null);
      return;
    }
    if (!cellAt(data, k)) {
      setBooking(splitKey(k));
      setSelected(k);
      return;
    }
    setBooking(null);
    setSelected((s) => (s === k ? null : k));
  };

  const detailKey = moving ?? selected;
  const detail = booking ? (
    <BookingForm
      board={data}
      initial={booking}
      busy={bookRoom.isPending || locked}
      onClose={() => {
        setBooking(null);
        setSelected(null);
      }}
      onBook={(v) => {
        bookRoom.mutate(
          { room: v.room as CoffeeRoomId, sessionId: v.session as CoffeeSessionId, label: v.label, note: v.note || null, forSponsorId: v.forSponsorId },
          {
            onSuccess: () => {
              setBooking(null);
              setSelected(keyOf(v.room, v.session));
            },
          },
        );
      }}
    />
  ) : detailKey && cellAt(data, detailKey) ? (
    <CellDetail
      board={data}
      k={detailKey}
      moving={!!moving}
      busy={busy}
      locked={locked}
      onClose={() => setSelected(null)}
      onCancelMove={() => setMoving(null)}
      onMove={() => setMoving(detailKey)}
      onRemove={() => {
        const c = cellAt(data, detailKey);
        if (c?.kind === "chat") removePlacement.mutate({ placementId: c.placement.id });
        if (c?.kind === "booking") removeBooking.mutate({ bookingId: c.booking.id });
        setSelected(null);
      }}
    />
  ) : null;

  return (
    <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
      <header className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
        <div>
          <h2 className="m-0 text-[28px] font-bold leading-tight lg:text-[32px]">{copy.title}</h2>
          <p className="m-0 text-sm text-dashboard-text-light">{copy.day}</p>
        </div>
        <div className="contents sm:flex sm:items-center sm:gap-2">
          <DashboardButton
            variant="small"
            className="col-span-2 row-start-2 min-h-11 px-4 text-base sm:col-auto sm:row-auto md:min-h-11"
            disabled={locked}
            onClick={() => {
              const free = COFFEE_ROOMS.flatMap((r) => COFFEE_SESSIONS.map((s) => keyOf(r.id, s.id))).find((k) => !cellAt(data, k));
              if (!free) return;
              setMoving(null);
              setSelected(null);
              setBooking(splitKey(free));
            }}
          >
            {copy.bookRoom}
          </DashboardButton>
          <div className="col-start-2 row-start-1 sm:col-auto sm:row-auto">
            <HelpSheet />
          </div>
        </div>
      </header>

      <BoardSummary
        board={data}
        action={
          // The line says "Run Auto-schedule": the button sits right beside it.
          !data.scheduled && data.sponsors.some((sp) => sp.submitted) ? (
            <DashboardButton
              variant="primary"
              disabled={busy || locked}
              onClick={() => {
                setSelected(null);
                auto.mutate();
              }}
              className="shrink-0 sm:w-auto"
            >
              {busy ? copy.bar.working : copy.bar.autoSchedule}
            </DashboardButton>
          ) : undefined
        }
      />

      {!data.workshopsAvailable && (
        <p role="alert" className="m-0 rounded-dashboard-lg bg-dashboard-bg-task/40 px-4 py-3 text-sm text-dashboard-text-task">
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
        <RoomsGrid board={data} selected={selected} moving={moving} onCell={onCell} detail={detail} />
      </div>

      {/* Room for the sticky bar. */}
      <div aria-hidden className="h-28 sm:h-16" />
      <ActionBar
        board={data}
        busy={busy}
        locked={locked}
        onAuto={() => {
          setSelected(null);
          auto.mutate();
        }}
        onSend={() => setConfirmSend(true)}
      />
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
 * Send messages hackers and can't be undone, so it asks once: how many
 * sponsors' schedules go out and up to how many hackers get invited (every
 * seat in the draft chats).
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
    return sp ? n + chatsInWindow(p.window, sp.chatMinutes) * sp.hackersPerChat : n;
  }, 0);
  return (
    <AlertDialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="fixed inset-0 z-50 bg-dashboard-text-heavy/30" />
        <AlertDialog.Content className="fixed left-1/2 top-1/2 z-50 flex w-[calc(100%-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 flex-col gap-4 rounded-dashboard-lg bg-dashboard-bg-surface p-6 font-figtree text-dashboard-text-heavy shadow-dashboard-card">
          <AlertDialog.Title className="m-0 text-xl font-bold">{c.title}</AlertDialog.Title>
          <AlertDialog.Description className="m-0 text-base text-dashboard-text-medium">
            {c.body(sponsors, hackers)}
          </AlertDialog.Description>
          <div className="flex flex-col gap-2 sm:flex-row-reverse">
            <AlertDialog.Action asChild>
              <DashboardButton variant="primary" className="min-h-11 sm:w-auto sm:px-5" onClick={onSend}>
                {c.send}
              </DashboardButton>
            </AlertDialog.Action>
            <AlertDialog.Cancel asChild>
              <DashboardButton variant="outline" className="h-11 sm:w-auto sm:px-5">
                {c.cancel}
              </DashboardButton>
            </AlertDialog.Cancel>
          </div>
        </AlertDialog.Content>
      </AlertDialog.Portal>
    </AlertDialog.Root>
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
  // A sponsor who changed after invites still needs Noah's Send to re-confirm.
  const changed = board.sponsors.some((sp) => sp.changedAfterSend);
  const allSent = board.scheduled && board.draftCount === 0 && board.sentAt && !changed;
  const sentTime = board.sentAt ? timeOf(board.sentAt) : "";
  // Only Noah sends (checked again on the server). If HW Contacts can't be
  // read, nobody can: say why instead of "Only Noah sends".
  const sender = board.sender;
  const whyNot = sender.canSend
    ? null
    : sender.reason === "notSender"
      ? b.onlyNoah
      : copy.errors.sender[sender.reason];
  return (
    <div data-tour="coffee-send" className="fixed inset-x-0 bottom-0 z-20 border-t border-dashboard-border-default bg-dashboard-bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-dashboard-card lg:px-12">
      <div className="mx-auto flex max-w-[1440px] flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        {allSent ? (
          <span className="inline-flex items-center justify-center gap-1.5 text-[17px] font-bold text-dashboard-status-live">
            <CircleCheck aria-hidden className="size-5" />
            {b.sentAt(sentTime)}
          </span>
        ) : !board.scheduled ? (
          <>
            <span className="text-center text-[15px] text-dashboard-text-medium sm:text-left">{b.start}</span>
            <DashboardButton variant="primary" disabled={busy || locked} onClick={onAuto} className="sm:w-auto">
              {busy ? b.working : b.autoSchedule}
            </DashboardButton>
          </>
        ) : (
          <>
            <span className="flex flex-wrap items-center justify-center gap-1 text-[15px] text-dashboard-text-medium sm:justify-start">
              {nFix ? <span className="font-medium text-dashboard-text-warning">{b.fixesOpen(nFix)}</span> : b.review}
              <DashboardButton variant="link" disabled={busy || locked} onClick={onAuto}>{b.rerun}</DashboardButton>
            </span>
            <span className="flex flex-col items-stretch gap-1 sm:flex-row sm:items-center sm:gap-2">
              {whyNot && (
                <span id="coffee-send-why" className="text-center text-sm font-medium text-dashboard-text-medium sm:text-right">
                  {whyNot}
                </span>
              )}
              <DashboardButton
                variant="primary"
                disabled={busy || locked || !sender.canSend}
                aria-describedby={whyNot ? "coffee-send-why" : undefined}
                onClick={onSend}
                className="sm:w-auto"
              >
                {busy ? b.working : b.send}
              </DashboardButton>
            </span>
          </>
        )}
      </div>
    </div>
  );
}
