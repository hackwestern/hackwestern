import { useEffect, useState } from "react";
import { CircleCheck } from "lucide-react";
import { toast } from "sonner";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  type CoffeeRoomId,
  type CoffeeSessionId,
} from "~/lib/coffee-chat-sessions";
import { api } from "~/utils/api";
import { FixesBand } from "./fixes-band";
import { HelpSheet } from "./help-sheet";
import { type SessionBoardData } from "./parts";
import { BookingForm, CellDetail, RoomsGrid, cellAt, keyOf, moveCheck, splitKey } from "./rooms-grid";
import { SponsorsBand } from "./sponsors-band";

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
  const [contact, setContact] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [moving, setMoving] = useState<string | null>(null);
  const [booking, setBooking] = useState<{ room: string; session: string } | null>(null);
  const [applying, setApplying] = useState<string | null>(null);

  // ?sponsor= (an id or name) opens that sponsor's row once.
  useEffect(() => {
    if (!sponsor || !board.data) return;
    const s = board.data.sponsors.find(
      (x) => x.id === sponsor.toLowerCase() || x.name.toLowerCase() === sponsor.toLowerCase(),
    );
    if (s) setOpen(s.id);
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
      setContact(null);
      return refresh();
    },
  });
  const movePlacement = api.coffeeChatSessions.movePlacement.useMutation({ onError, onSettled: refresh });
  const moveBooking = api.coffeeChatSessions.moveBooking.useMutation({ onError, onSettled: refresh });
  const removePlacement = api.coffeeChatSessions.removePlacement.useMutation({
    onSuccess: () => toast.success(copy.toast.removed),
    onError,
    onSettled: refresh,
  });
  const removeBooking = api.coffeeChatSessions.removeBooking.useMutation({
    onSuccess: () => toast.success(copy.toast.removed),
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
      toast.success(r.sent ? copy.toast.sent(r.sent) : copy.bar.nothingToSend);
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
      busy={bookRoom.isPending}
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

      {!data.workshopsAvailable && (
        <p role="status" className="m-0 rounded-dashboard-lg bg-dashboard-bg-task/40 px-4 py-3 text-sm text-dashboard-text-task">
          {copy.workshopsUnavailable}
        </p>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[400px_minmax(0,1fr)] lg:items-start lg:gap-6">
        <div className="flex min-w-0 flex-col gap-4 lg:gap-6">
          <SponsorsBand
            board={data}
            open={open}
            onOpen={(id) => {
              setOpen((o) => (o === id ? null : id));
              setContact(null);
            }}
            contact={contact}
            onContact={(key) => {
              setContact((c) => (c === key ? null : key));
              if (key.startsWith("sp:")) setOpen(null);
            }}
          />
          <FixesBand
            board={data}
            contact={contact}
            onContact={(key) => setContact((c) => (c === key ? null : key))}
            applying={applying}
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
        onAuto={() => {
          setSelected(null);
          auto.mutate();
        }}
        onSend={() => send.mutate()}
      />
    </div>
  );
}

function ActionBar({
  board,
  busy,
  onAuto,
  onSend,
}: {
  board: SessionBoardData;
  busy: boolean;
  onAuto: () => void;
  onSend: () => void;
}) {
  const b = copy.bar;
  const nFix = board.fixes.length;
  const allSent = board.scheduled && board.draftCount === 0 && board.sentAt;
  const sentTime = board.sentAt
    ? new Date(board.sentAt).toLocaleTimeString("en-US", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" })
    : "";
  return (
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-dashboard-border-default bg-dashboard-bg-surface px-4 pb-[calc(12px+env(safe-area-inset-bottom))] pt-3 shadow-dashboard-card lg:px-12">
      <div className="mx-auto flex max-w-[1440px] flex-col items-stretch gap-1.5 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between sm:gap-3">
        {allSent ? (
          <span className="inline-flex items-center justify-center gap-1.5 text-[17px] font-bold text-dashboard-status-live">
            <CircleCheck aria-hidden className="size-5" />
            {b.sentAt(sentTime)}
          </span>
        ) : !board.scheduled ? (
          <>
            <span className="text-center text-[15px] text-dashboard-text-medium sm:text-left">{b.start}</span>
            <DashboardButton variant="primary" disabled={busy} onClick={onAuto} className="sm:w-auto">
              {busy ? b.working : b.autoSchedule}
            </DashboardButton>
          </>
        ) : (
          <>
            <span className="flex flex-wrap items-center justify-center gap-1 text-[15px] text-dashboard-text-medium sm:justify-start">
              {nFix ? <span className="font-medium text-dashboard-text-warning">{b.fixesOpen(nFix)}</span> : b.review}
              <DashboardButton variant="link" disabled={busy} onClick={onAuto}>{b.rerun}</DashboardButton>
            </span>
            <DashboardButton variant="primary" disabled={busy} onClick={onSend} className="sm:w-auto">
              {busy ? b.working : b.send}
            </DashboardButton>
          </>
        )}
      </div>
    </div>
  );
}
