import { useEffect, useRef, useState } from "react";
import { Plus, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  buildingOf,
  chatsBySession,
  chatsInWindow,
  minutesOfClock,
} from "~/lib/coffee-chat-sessions";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";
import {
  Card,
  CardHead,
  clockOf,
  focusRing,
  hatch,
  Logo,
  sessionLabel,
  type BoardSponsor,
  type SessionBoardData,
} from "./parts";

const copy = coffeeSessionsCopy;
const rc = copy.rooms;
const dc = copy.detail;

export const keyOf = (room: string, session: string) => `${room}|${session}`;
export const splitKey = (key: string) => {
  const [room = "", session = ""] = key.split("|");
  return { room, session };
};

type Placement = SessionBoardData["placements"][number];
type Booking = SessionBoardData["bookings"][number];
export type CellContent =
  | { kind: "chat"; placement: Placement; sponsor: BoardSponsor; repName: string }
  | { kind: "booking"; booking: Booking }
  | null;

export function cellAt(board: SessionBoardData, key: string): CellContent {
  const { room, session } = splitKey(key);
  const p = board.placements.find((x) => x.room === room && x.sessionId === session);
  if (p) {
    const sponsor = board.sponsors.find((s) => s.id === p.sponsorId);
    const rep = sponsor?.reps.find((r) => r.id === p.repId);
    if (sponsor && rep) return { kind: "chat", placement: p, sponsor, repName: rep.name };
  }
  const b = board.bookings.find((x) => x.room === room && x.sessionId === session);
  return b ? { kind: "booking", booking: b } : null;
}

/**
 * Can the cell being moved go to `target`? "ok", a sponsor name when it's
 * during their workshop (the page says why), or "no".
 */
export function moveCheck(board: SessionBoardData, moving: string, target: string): "ok" | "no" | { workshop: string } {
  if (cellAt(board, target)) return "no";
  const from = cellAt(board, moving);
  if (!from) return "no";
  if (from.kind === "booking") return "ok";
  const { session } = splitKey(target);
  const { sponsor, placement } = from;
  if (sponsor.blocked.includes(session)) return { workshop: sponsor.name };
  const rep = sponsor.reps.find((r) => r.id === placement.repId);
  if (!rep?.free.includes(session)) return "no";
  const elsewhere = board.placements.find(
    (p) => p.repId === rep.id && p.sessionId === session && p.id !== placement.id,
  );
  return elsewhere ? "no" : "ok";
}

/** Chats a placement holds (a partial session fits fewer), times hackers per chat. */
function hackersAt(board: SessionBoardData, c: Extract<CellContent, { kind: "chat" }>): number {
  const rep = c.sponsor.reps.find((r) => r.id === c.placement.repId);
  if (!rep) return 0;
  const mine = board.placements.filter((p) => p.repId === rep.id);
  const fits = (id: string) =>
    chatsInWindow(mine.find((p) => p.sessionId === id)?.window ?? null, c.sponsor.chatMinutes);
  const chats = chatsBySession(mine.map((p) => p.sessionId), rep.chatsWanted, fits).get(c.placement.sessionId) ?? 0;
  return chats * c.sponsor.hackersPerChat;
}

/** "1:00–1:30" when a chat uses only part of its session, else null. */
export function partialTimeOf(c: CellContent): string | null {
  if (c?.kind !== "chat") return null;
  const part = c.sponsor.partial[c.placement.sessionId];
  return part ? rc.partialTime(clockOf(part.start), clockOf(part.end)) : null;
}

export function RoomsGrid({
  board,
  selected,
  moving,
  onCell,
  detail,
}: {
  board: SessionBoardData;
  selected: string | null;
  moving: string | null;
  onCell: (key: string) => void;
  detail: React.ReactNode;
}) {
  const group = (b: "near" | "ivey", label: string) => (
    <>
      <tr>
        <th colSpan={7} scope="colgroup" className="pb-0 pt-3 text-left text-[13px] font-semibold text-dashboard-text-medium first:pt-1">
          <span className="sticky left-0">{label}</span>
        </th>
      </tr>
      {COFFEE_ROOMS.filter((r) => r.building === b).map((r) => (
        <tr key={r.id}>
          <th scope="row" className="sticky left-0 z-[2] w-[78px] whitespace-nowrap bg-dashboard-bg-surface pr-1 text-left text-sm font-semibold">
            {r.id}
          </th>
          {COFFEE_SESSIONS.map((s) => (
            <td key={s.id} className="p-0">
              <Cell board={board} k={keyOf(r.id, s.id)} selected={selected} moving={moving} onCell={onCell} />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
  return (
    <Card labelledBy="coffee-rooms" tour="coffee-table">
      <CardHead id="coffee-rooms" title={rc.heading} />
      {/* The grid scrolls inside its card on phones; the page never does. */}
      <div className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6">
        <table className="w-full min-w-[780px] table-fixed border-separate border-spacing-1">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-[3] w-[78px] bg-dashboard-bg-surface">
                <span className="sr-only">{rc.room}</span>
              </th>
              {COFFEE_SESSIONS.map((s) => (
                <th key={s.id} scope="col" className="px-2 pb-0.5 text-left text-[13px] font-semibold text-dashboard-text-light">
                  {sessionLabel(s.id)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {group("near", rc.near)}
            {group("ivey", rc.ivey)}
            <WorkshopRow board={board} />
          </tbody>
        </table>
      </div>
      <div aria-live="polite">{detail}</div>
    </Card>
  );
}

const cellBase = cn(
  "flex h-full min-h-[52px] w-full flex-col items-start justify-center gap-[3px] rounded-dashboard-md px-2 py-1 text-left text-[13px] leading-tight [overflow-wrap:anywhere]",
  focusRing,
);

function Cell({
  board,
  k,
  selected,
  moving,
  onCell,
}: {
  board: SessionBoardData;
  k: string;
  selected: string | null;
  moving: string | null;
  onCell: (key: string) => void;
}) {
  const c = cellAt(board, k);
  const { room, session } = splitKey(k);
  const where = rc.where(room, sessionLabel(session));
  const sel = selected === k && "outline outline-2 outline-offset-1 outline-dashboard-action-primary";
  if (!c) {
    if (moving && moveCheck(board, moving, k) === "ok") {
      return (
        <button type="button" onClick={() => onCell(k)} aria-label={rc.cellMoveHere(where)}
          className={cn(cellBase, "cursor-pixel-hover border-[1.5px] border-dashed border-dashboard-action-primary bg-dashboard-bg-highlight font-semibold text-dashboard-text-active")}>
          {rc.moveHere}
        </button>
      );
    }
    return (
      <button type="button" onClick={() => onCell(k)} aria-label={rc.cellBook(where)}
        className={cn(cellBase, sel, "cursor-pixel-hover border border-dashed border-dashboard-border-default text-dashboard-border-control [@media(hover:hover)]:hover:bg-dashboard-bg-highlight")}>
        <Plus aria-hidden className="size-4" />
      </button>
    );
  }
  const drag = moving === k && "opacity-50";
  if (c.kind === "booking") {
    return (
      <button type="button" onClick={() => onCell(k)} aria-label={`${c.booking.label}, ${where}`}
        className={cn(cellBase, sel, drag, "cursor-pixel-hover border border-dashboard-border-default bg-dashboard-bg-inset text-dashboard-text-medium")}>
        <b className="font-semibold">{c.booking.label}</b>
      </button>
    );
  }
  const part = partialTimeOf(c);
  return (
    <button type="button" onClick={() => onCell(k)} aria-label={rc.chatLabel(c.sponsor.name, c.repName, part ? rc.where(room, part) : where)}
      className={cn(cellBase, sel, drag,
        "cursor-pixel-hover border border-dashboard-border-outline bg-dashboard-bg-surface text-dashboard-text-active shadow-[inset_3px_0_0_theme(colors.dashboard.action.primary)] [@media(hover:hover)]:hover:bg-dashboard-bg-highlight")}>
      <Logo name={c.sponsor.name} size="sm" />
      <span>{c.repName}</span>
      {part && <span className="text-xs font-semibold tabular-nums text-dashboard-text-warning">{part}</span>}
    </button>
  );
}

/** Bottom row: each sponsor's own workshop in that session (hatched). */
function WorkshopRow({ board }: { board: SessionBoardData }) {
  const hits = board.sponsors.flatMap((sp) => sp.workshops.map((w) => ({ sp, w })));
  return (
    <tr>
      <th scope="row" className="sticky left-0 z-[2] bg-dashboard-bg-surface pr-1 pt-2 text-left text-sm font-semibold text-dashboard-text-medium">
        {rc.workshops}
      </th>
      {COFFEE_SESSIONS.map((s) => {
        const hit = hits.find(({ w }) => {
          const a = minutesOfClock(w.start) ?? 0;
          const b = minutesOfClock(w.end) ?? 0;
          return a < s.end && s.start < b;
        });
        if (!hit) return <td key={s.id} className="pt-2" aria-hidden />;
        const when = formatClock(hit.w.start);
        // The sheet writes "Rm 2230 (50)" or "2230 (50)": drop the capacity.
        const bare = hit.w.location?.replace(/\s*\([^)]*\)\s*$/, "").trim() ?? null;
        const room = bare && /^\d/.test(bare) ? rc.rm(bare) : bare;
        return (
          <td key={s.id} className="p-0 pt-2">
            <div role="img" aria-label={rc.workshopLabel(hit.sp.name, room, when)}
              className={cn(cellBase, hatch, "border border-dashboard-border-default text-xs text-dashboard-text-medium")}>
              <span className="rounded-dashboard-sm bg-dashboard-bg-surface px-1 py-0.5">
                <Logo name={hit.sp.name} size="sm" />
              </span>
              <span>{rc.workshopCell(room)}</span>
              <span className="tabular-nums">{when}</span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}

/** Inline detail under the grid for the selected (or moving) cell. */
export function CellDetail({
  board,
  k,
  moving,
  busy,
  locked = false,
  onClose,
  onMove,
  onRemove,
  onCancelMove,
}: {
  board: SessionBoardData;
  k: string;
  moving: boolean;
  busy: boolean;
  /** The run of show can't be read: no moves (removing is still fine). */
  locked?: boolean;
  onClose: () => void;
  onMove: () => void;
  onRemove: () => void;
  onCancelMove: () => void;
}) {
  const c = cellAt(board, k);
  if (!c) return null;
  const { room, session } = splitKey(k);
  const part = partialTimeOf(c);
  const where = `${buildingOf(room) === "ivey" ? rc.iveyRm(room) : rc.rm(room)} · ${part ?? sessionLabel(session)}`;
  const title =
    c.kind === "chat" ? (
      <>
        <span className="rounded-dashboard-sm bg-dashboard-bg-surface px-1.5 py-0.5"><Logo name={c.sponsor.name} /></span>
        <span>{c.repName}</span>
      </>
    ) : (
      c.booking.label
    );
  const head = (extra?: string) => (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <b className="flex flex-wrap items-center gap-2 text-[17px] font-bold">{title}</b>
        <span className="text-sm text-dashboard-text-medium">{extra ? `${where} · ${extra}` : where}</span>
      </div>
      {!moving && (
        <button type="button" onClick={onClose} aria-label={dc.close}
          className={cn("-mr-2.5 -mt-2.5 inline-flex size-11 shrink-0 cursor-pixel-hover items-center justify-center rounded-dashboard-lg text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight", focusRing)}>
          <X aria-hidden className="size-[18px]" />
        </button>
      )}
    </div>
  );
  const box = "flex flex-col gap-2.5 rounded-dashboard-lg bg-dashboard-bg-checklistCurrent p-4";
  if (moving) {
    const who = c.kind === "chat" ? c.repName : c.booking.label;
    return (
      <div className={box}>
        {head()}
        <p className="m-0 text-[15px]">{dc.movePick(who)}</p>
        <div><DashboardButton variant="small" onClick={onCancelMove}>{dc.cancel}</DashboardButton></div>
      </div>
    );
  }
  const actions = (
    <div className="flex flex-wrap gap-2">
      <DashboardButton variant="small" disabled={busy || locked} onClick={onMove}>{dc.move}</DashboardButton>
      <DashboardButton variant="small" disabled={busy} onClick={onRemove}>{dc.remove}</DashboardButton>
    </div>
  );
  if (c.kind === "booking") {
    return (
      <div className={box}>
        {head(rc.adhoc)}
        {c.booking.note && <p className="m-0 text-[15px]">{c.booking.note}</p>}
        {actions}
      </div>
    );
  }
  const n = hackersAt(board, c);
  const sent = c.placement.status === "sent";
  return (
    <div className={box}>
      {head()}
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex min-h-7 items-center rounded-dashboard-lg bg-dashboard-bg-nav px-2.5 text-sm font-medium">{dc.format(c.sponsor)}</span>
        {sent && <span className="inline-flex min-h-7 items-center rounded-dashboard-lg bg-dashboard-schedule-green px-2.5 text-sm font-semibold text-dashboard-status-live">{dc.sent}</span>}
      </div>
      <p className="m-0 text-[15px] tabular-nums">{dc.toInvite(n)}</p>
      {part && <p className="m-0 text-sm text-dashboard-text-medium">{rc.partialNote}</p>}
      {board.walks
        .filter((w) => {
          // This chat is either end of the walk: the later chat or the one before it.
          const i = COFFEE_SESSIONS.findIndex((x) => x.id === w.sessionId);
          return w.repId === c.placement.repId && (w.sessionId === session || COFFEE_SESSIONS[i - 1]?.id === session);
        })
        .map((w) => (
          <p key={w.sessionId} className="m-0 text-sm font-medium text-dashboard-text-warning">
            {copy.sponsors.walk(w.toIvey, sessionLabel(w.sessionId))}
          </p>
        ))}
      {sent && <p className="m-0 text-sm font-medium text-dashboard-text-warning">{dc.afterSend}</p>}
      {c.placement.pinned && <p className="m-0 text-sm text-dashboard-text-medium">{dc.pinned}</p>}
      {actions}
    </div>
  );
}

/** Ad hoc booking on an empty cell (or from "Book a room"). */
export function BookingForm({
  board,
  initial,
  busy,
  onBook,
  onClose,
}: {
  board: SessionBoardData;
  initial: { room: string; session: string };
  busy: boolean;
  onBook: (v: { room: string; session: string; label: string; note: string; forSponsorId: string | null }) => void;
  onClose: () => void;
}) {
  const bc = copy.booking;
  const [room, setRoom] = useState(initial.room);
  const [session, setSession] = useState(initial.session);
  const [who, setWho] = useState("");
  const [note, setNote] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const whoRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    setRoom(initial.room);
    setSession(initial.session);
    whoRef.current?.focus();
  }, [initial.room, initial.session]);
  const field = "flex min-w-0 flex-[1_1_180px] flex-col gap-1.5";
  const input = cn(
    "min-h-11 w-full rounded-dashboard-md border border-dashboard-border-default bg-dashboard-bg-surface px-3 py-2.5 text-base text-dashboard-text-heavy placeholder:text-dashboard-text-placeholder",
    focusRing,
  );
  return (
    <form
      className="flex flex-col gap-2.5 rounded-dashboard-lg bg-dashboard-bg-checklistCurrent p-4"
      onSubmit={(e) => {
        e.preventDefault();
        const label = who.trim();
        if (!label) return setErr(bc.needWho);
        if (cellAt(board, keyOf(room, session))) {
          return setErr(copy.errors.roomTaken(rc.rm(room), sessionLabel(session)));
        }
        const sponsor = board.sponsors.find((s) => s.name.toLowerCase() === label.toLowerCase());
        setErr(null);
        onBook({ room, session, label, note: note.trim(), forSponsorId: sponsor?.id ?? null });
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <b className="text-[17px] font-bold">{bc.title}</b>
        <button type="button" onClick={onClose} aria-label={dc.close}
          className={cn("-mr-2.5 -mt-2.5 inline-flex size-11 cursor-pixel-hover items-center justify-center rounded-dashboard-lg text-dashboard-text-light", focusRing)}>
          <X aria-hidden className="size-[18px]" />
        </button>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <div className={field}>
          <label htmlFor="bk-room" className="text-sm font-semibold">{bc.room}</label>
          <select id="bk-room" className={input} value={room} onChange={(e) => setRoom(e.target.value)}>
            {COFFEE_ROOMS.map((r) => (
              <option key={r.id} value={r.id}>{bc.roomOption(r.id, r.building === "ivey")}</option>
            ))}
          </select>
        </div>
        <div className={field}>
          <label htmlFor="bk-session" className="text-sm font-semibold">{bc.session}</label>
          <select id="bk-session" className={input} value={session} onChange={(e) => setSession(e.target.value)}>
            {COFFEE_SESSIONS.map((s) => (
              <option key={s.id} value={s.id}>{sessionLabel(s.id)}</option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex flex-wrap gap-2.5">
        <div className={field}>
          <label htmlFor="bk-who" className="text-sm font-semibold">{bc.forWho}</label>
          <input id="bk-who" ref={whoRef} className={input} value={who} onChange={(e) => setWho(e.target.value)} placeholder={bc.forWhoPlaceholder} autoComplete="off" />
        </div>
        <div className={field}>
          <label htmlFor="bk-note" className="text-sm font-semibold">{bc.note}</label>
          <input id="bk-note" className={input} value={note} onChange={(e) => setNote(e.target.value)} placeholder={bc.notePlaceholder} autoComplete="off" />
        </div>
      </div>
      {err && <p role="alert" className="m-0 text-sm font-medium text-dashboard-text-warning">{err}</p>}
      <div className="flex flex-wrap gap-2">
        <DashboardButton type="submit" variant="primary" disabled={busy} className="h-auto min-h-11 w-auto px-4 py-0 text-sm md:min-h-9">{bc.book}</DashboardButton>
        <DashboardButton type="button" variant="small" onClick={onClose}>{bc.cancel}</DashboardButton>
      </div>
    </form>
  );
}
