import { useEffect, useRef, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Check, Pencil, Plus, X } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  cellAt,
  chatsInCell,
  keyOf,
  litCells,
  splitKey,
} from "~/lib/coffee-chat-board-view";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  buildingOf,
  minutesOfClock,
} from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import { api, type RouterOutputs } from "~/utils/api";
import { timeOf } from "./board-summary";
import { clockOf, focusRing, Logo, sessionLabel, type SessionBoardData } from "./parts";
import { partialTimeOf, type ChatCell } from "./rooms-grid";

const copy = coffeeSessionsCopy;
const rc = copy.rooms;
const dc = copy.detail;
const hc = copy.hackers;

export type InviteChat = RouterOutputs["coffeeChatInvites"]["status"]["sponsors"][number]["chats"][number];

/** Every grid cell key, rooms in order then sessions. */
export const ALL_KEYS = COFFEE_ROOMS.flatMap((r) => COFFEE_SESSIONS.map((s) => keyOf(r.id, s.id)));

const roomLabel = (room: string) => (buildingOf(room) === "ivey" ? rc.iveyRm(room) : rc.rm(room));

/** What the modal shows: a cell's detail, or the booking form. */
export type ModalView =
  | { kind: "cell"; key: string }
  | { kind: "book"; room: string; session: string }
  | null;

/**
 * The chat or booking detail in a modal over the board (mock v10): a bottom
 * sheet under 640px, a centred dialog from 640px. Focus goes to × on open
 * and stays inside; Esc, × and the backdrop close it.
 */
export function ChatModal({
  board,
  view,
  chats,
  busy,
  locked,
  onClose,
  onMoveTo,
  onRemove,
  onBook,
  onRemoveHacker,
  onFront,
  onCloseFocus,
}: {
  board: SessionBoardData;
  view: ModalView;
  /** Sent chats' invites for the open cell's sponsor (coffeeChatInvites.status). */
  chats: InviteChat[] | null;
  busy: boolean;
  locked: boolean;
  onClose: () => void;
  onMoveTo: (src: string, target: string) => void;
  onRemove: (src: string) => void;
  onBook: (v: { room: string; session: string; label: string; note: string; forSponsorId: string | null }) => void;
  onRemoveHacker: (t: { sponsorId: string; chatId: string; name: string }) => void;
  onFront: (sponsorId: string) => void;
  /** Where focus goes when the modal closes (the card, or Book a room). */
  onCloseFocus: () => void;
}) {
  const c = view?.kind === "cell" ? cellAt(board, view.key) : null;
  const open = view?.kind === "book" || !!c;
  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[57] bg-dashboard-text-heavy/30" />
        <Dialog.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            // The booking form starts in "Who it's for"; a detail on ×.
            if (view?.kind !== "book") return;
            e.preventDefault();
            document.getElementById("bk-who")?.focus();
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            onCloseFocus();
          }}
          className={cn(
            "fixed z-[58] overflow-y-auto overscroll-contain bg-dashboard-bg-surface pb-[env(safe-area-inset-bottom)] font-figtree text-dashboard-text-heavy focus:outline-none",
            "inset-x-0 bottom-0 max-h-[calc(100dvh-24px)] rounded-t-dashboard-lg shadow-[0_-4px_24px_rgba(11,43,74,.18)]",
            "sm:inset-x-auto sm:bottom-auto sm:left-1/2 sm:top-1/2 sm:max-h-[calc(100dvh-64px)] sm:w-[min(520px,calc(100%-32px))] sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-dashboard-lg sm:shadow-[0_10px_40px_rgba(11,43,74,.25)]",
          )}
        >
          <div aria-hidden className="mx-auto mt-2 h-1 w-9 rounded-sm bg-dashboard-border-default sm:hidden" />
          {view?.kind === "book" ? (
            <BookingForm board={board} initial={view} busy={busy || locked} onBook={onBook} />
          ) : c && view?.kind === "cell" ? (
            <CellDetail
              key={view.key}
              board={board}
              k={view.key}
              chats={chats}
              busy={busy}
              locked={locked}
              onMoveTo={(t) => onMoveTo(view.key, t)}
              onRemove={() => onRemove(view.key)}
              onRemoveHacker={onRemoveHacker}
              onFront={onFront}
            />
          ) : null}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

const pad = "flex flex-col gap-2.5 p-5 sm:p-6";
const pill = "inline-flex min-h-7 items-center gap-1 rounded-dashboard-lg px-2.5 text-sm";

function Head({ children, sub }: { children: React.ReactNode; sub: string }) {
  return (
    <div className="flex items-start justify-between gap-2">
      <div className="min-w-0">
        <Dialog.Title className="m-0 flex flex-wrap items-center gap-2 text-xl font-bold leading-snug [overflow-wrap:anywhere]">
          {children}
        </Dialog.Title>
        <span className="block text-sm text-dashboard-text-medium [overflow-wrap:anywhere]">{sub}</span>
      </div>
      <Dialog.Close
        aria-label={dc.close}
        className={cn(
          "-mr-2.5 -mt-2.5 inline-flex size-11 shrink-0 cursor-pixel-hover items-center justify-center rounded-dashboard-lg text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
          focusRing,
        )}
      >
        <X aria-hidden className="size-[18px]" />
      </Dialog.Close>
    </div>
  );
}

function CellDetail({
  board,
  k,
  chats,
  busy,
  locked,
  onMoveTo,
  onRemove,
  onRemoveHacker,
  onFront,
}: {
  board: SessionBoardData;
  k: string;
  chats: InviteChat[] | null;
  busy: boolean;
  locked: boolean;
  onMoveTo: (target: string) => void;
  onRemove: () => void;
  onRemoveHacker: (t: { sponsorId: string; chatId: string; name: string }) => void;
  onFront: (sponsorId: string) => void;
}) {
  const c = cellAt(board, k);
  const [moveOpen, setMoveOpen] = useState(false);
  if (!c) return null;
  const { room, session } = splitKey(k);
  const where = `${roomLabel(room)} · ${sessionLabel(session)}`;
  const who = c.kind === "chat" ? c.rep.name : c.booking.label;
  const actions = (
    <>
      <div className="flex flex-wrap gap-2">
        <DashboardButton
          variant="small"
          disabled={busy || locked}
          aria-expanded={moveOpen}
          aria-controls="coffee-move-list"
          onClick={() => setMoveOpen((o) => !o)}
        >
          {dc.moveTo}
        </DashboardButton>
        <DashboardButton variant="small" disabled={busy} onClick={onRemove}>
          {dc.remove}
        </DashboardButton>
      </div>
      {moveOpen && <MoveList board={board} k={k} who={who} onPick={onMoveTo} />}
    </>
  );
  if (c.kind === "booking") {
    return (
      <div className={pad}>
        <Head sub={`${where} · ${rc.adhoc}`}>{c.booking.label}</Head>
        {c.booking.note && <p className="m-0 text-[15px]">{c.booking.note}</p>}
        {actions}
      </div>
    );
  }
  const sent = c.placement.status === "sent";
  const forced = c.placement.forced;
  const part = partialTimeOf(c);
  const n = chatsInCell(board, c.placement);
  return (
    <div className={pad}>
      <Head sub={dc.sub(c.sponsor.name, `${roomLabel(room)} · ${part ?? sessionLabel(session)}`)}>
        <span className="rounded-dashboard-sm bg-dashboard-bg-inset px-1.5 py-0.5"><Logo name={c.sponsor.name} /></span>
        <span>{c.rep.name}</span>
      </Head>
      <div className="flex flex-wrap items-center gap-2">
        <span className={cn(pill, "bg-dashboard-bg-nav font-medium")}>{dc.format(c.sponsor)}</span>
        {sent ? (
          <span className={cn(pill, "bg-dashboard-schedule-green font-semibold text-dashboard-status-live")}>
            <Check aria-hidden className="size-3.5" strokeWidth={2.4} />
            {dc.sent}
          </span>
        ) : (
          <span className={cn(pill, "border border-dashboard-border-subtle bg-dashboard-bg-surface font-semibold text-dashboard-text-light")}>{dc.draft}</span>
        )}
        {forced && <span className={cn(pill, "bg-dashboard-bg-task font-semibold text-dashboard-text-warning")}>{rc.tagForced}</span>}
      </div>
      {forced && <p className="m-0 text-sm font-medium text-dashboard-text-warning">{dc.forcedNote(c.rep.name)}</p>}
      {sent ? (
        <HackerList cell={c} chats={chats} onRemoveHacker={onRemoveHacker} onFront={onFront} />
      ) : (
        <>
          <p className="m-0 text-[15px] font-bold tabular-nums">{dc.draftSum(n * c.sponsor.hackersPerChat, n)}</p>
          <p className="m-0 text-[15px] font-semibold">{dc.notSentYet}</p>
        </>
      )}
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
      {c.placement.pinned && !sent && !forced && <p className="m-0 text-sm text-dashboard-text-medium">{dc.pinned}</p>}
      {actions}
    </div>
  );
}

/**
 * Move to… (the keyboard way to move): only the cells the rep can take with
 * no question, by session. Picking one goes through the same warnings as a
 * drop.
 */
function MoveList({ board, k, who, onPick }: { board: SessionBoardData; k: string; who: string; onPick: (target: string) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const cells = [...litCells(board, k, ALL_KEYS)];
  useEffect(() => {
    ref.current?.querySelector<HTMLButtonElement>("button")?.focus();
  }, []);
  const box = "flex flex-col gap-2 rounded-dashboard-md bg-dashboard-bg-inset p-3";
  if (!cells.length) {
    return (
      <div id="coffee-move-list" ref={ref} className={box}>
        <p className="m-0 text-sm text-dashboard-text-medium">{dc.moveNone(who)}</p>
      </div>
    );
  }
  return (
    <div id="coffee-move-list" ref={ref} className={box}>
      <p className="m-0 text-sm font-semibold">{dc.moveListTitle(who)}</p>
      {COFFEE_SESSIONS.map((s) => {
        const ks = cells.filter((x) => splitKey(x).session === s.id);
        if (!ks.length) return null;
        return (
          <div key={s.id} className="grid grid-cols-[48px_minmax(0,1fr)] items-start gap-2">
            <span className="pt-2 text-sm font-semibold tabular-nums text-dashboard-text-medium">{sessionLabel(s.id)}</span>
            <div className="flex flex-wrap gap-1.5">
              {ks.map((x) => {
                const r = splitKey(x).room;
                return (
                  <DashboardButton key={x} variant="small" aria-label={dc.moveToLabel(r, sessionLabel(s.id))} onClick={() => onPick(x)}>
                    {r}
                  </DashboardButton>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** "10:00–10:15" from "10:00" and 15 minutes. */
function slotRange(slotTime: string, minutes: number): string {
  const a = minutesOfClock(slotTime) ?? 0;
  return `${clockOf(a)}–${clockOf(a + minutes)}`;
}

/**
 * A sent chat's hackers, one block per chat (mock v11), with the hour's
 * summary, the Edit hackers toggle (a red Remove on each row), and who's
 * next in line for this sponsor.
 */
function HackerList({
  cell,
  chats,
  onRemoveHacker,
  onFront,
}: {
  cell: ChatCell;
  chats: InviteChat[] | null;
  onRemoveHacker: (t: { sponsorId: string; chatId: string; name: string }) => void;
  onFront: (sponsorId: string) => void;
}) {
  const [edit, setEdit] = useState(false);
  const sponsorId = cell.sponsor.id;
  const line = api.coffeeChatInvites.line.useQuery({ sponsorId });
  if (!chats) return <p className="m-0 text-sm text-dashboard-text-medium">{hc.loading}</p>;
  const mine = chats
    .filter((x) => x.placementId === cell.placement.id)
    .sort((a, b) => (minutesOfClock(a.slotTime) ?? 0) - (minutesOfClock(b.slotTime) ?? 0));
  const sum = (f: (x: InviteChat) => number) => mine.reduce((n, x) => n + f(x), 0);
  const accepted = sum((x) => x.accepted);
  const waiting = sum((x) => x.filled) - accepted;
  const hpc = cell.sponsor.hackersPerChat;
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="m-0 text-[15px] font-bold tabular-nums">{dc.sum(sum((x) => x.seats), mine.length, accepted, waiting)}</p>
        {edit ? (
          <DashboardButton variant="small" aria-pressed="true" className="min-h-11 px-3.5 md:min-h-11" onClick={() => setEdit(false)}>
            {hc.done}
          </DashboardButton>
        ) : (
          <button
            type="button"
            aria-pressed="false"
            aria-label={hc.edit}
            data-tip={hc.edit}
            onClick={() => setEdit(true)}
            className={cn(
              "inline-flex size-11 flex-none cursor-pixel-hover items-center justify-center rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface text-dashboard-text-medium [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
              focusRing,
            )}
          >
            <Pencil aria-hidden className="size-4" />
          </button>
        )}
      </div>
      <div aria-label={hc.label} role="group" className="flex flex-col gap-2">
        {mine.map((x) => {
          const time = slotRange(x.slotTime, x.minutes);
          const acc = x.accepted;
          const wait = x.filled - x.accepted;
          return (
            <section key={x.slotTime} aria-label={hc.chatLabel(time)} className="overflow-hidden rounded-dashboard-md border border-dashboard-border-subtle bg-dashboard-bg-surface">
              <h3 className="m-0 bg-dashboard-bg-inset px-3 py-1.5 text-[13px] font-semibold leading-snug tabular-nums text-dashboard-text-medium">
                {hc.chatHead(time, hpc, acc, wait)}
              </h3>
              <ul className="m-0 list-none px-3 py-0">
                {x.invites.map((h) => (
                  <li
                    key={h.chatId}
                    className={cn(
                      "grid items-center gap-2.5 border-t border-dashboard-border-subtle py-2 first:border-t-0",
                      edit ? "grid-cols-[minmax(0,1fr)_auto_auto] gap-2" : "grid-cols-[minmax(0,1fr)_auto]",
                    )}
                  >
                    <div className="min-w-0">
                      <b className="block text-[15px] font-semibold [overflow-wrap:anywhere]">{h.name}</b>
                      <span className="block text-[13px] text-dashboard-text-light">{h.source ? (hc.why[h.source] ?? h.source) : ""}</span>
                    </div>
                    {h.status === "accepted" ? (
                      <span className="inline-flex flex-col items-end rounded-dashboard-md bg-dashboard-schedule-green px-2 py-[3px] text-right text-[13px] font-semibold leading-tight text-dashboard-status-live">
                        {hc.accepted}
                      </span>
                    ) : (
                      <span className="inline-flex flex-col items-end rounded-dashboard-md bg-dashboard-bg-task px-2 py-[3px] text-right text-[13px] font-semibold leading-tight text-dashboard-text-task">
                        {hc.waiting}
                        {h.expiresAt && <small className="text-xs font-medium">{hc.answerBy(timeOf(h.expiresAt))}</small>}
                      </span>
                    )}
                    {edit && (
                      <button
                        type="button"
                        aria-label={hc.removeLabel(h.name)}
                        onClick={() => onRemoveHacker({ sponsorId, chatId: h.chatId, name: h.name })}
                        className={cn(
                          "min-h-11 cursor-pixel-hover rounded-dashboard-md border border-destructive-dark bg-dashboard-bg-surface px-3 text-sm font-semibold text-destructive-dark [@media(hover:hover)]:hover:bg-destructive/10",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive-dark focus-visible:ring-offset-1",
                        )}
                      >
                        {hc.remove}
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
      <div className="flex flex-col gap-2 border-t border-dashboard-border-subtle pt-3">
        <h3 className="m-0 text-[15px] font-bold">{hc.queueTitle}</h3>
        {line.data?.queue.length ? (
          <ol aria-label={hc.queueTitle} className="m-0 flex list-none flex-col gap-1.5 p-0">
            {line.data.queue.map((q, i) => (
              <li key={q.userId} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
                <span aria-hidden className="inline-flex size-5 items-center justify-center rounded-full bg-dashboard-bg-inset text-xs font-semibold text-dashboard-text-light">
                  {i + 1}
                </span>
                <b className="font-semibold">{q.name}</b>
                <span
                  className={cn(
                    "inline-flex min-h-[22px] items-center whitespace-nowrap rounded-full px-2 text-xs font-semibold",
                    q.source === "organizer" ? "bg-dashboard-bg-nav text-dashboard-text-active" : "bg-dashboard-bg-inset text-dashboard-text-medium",
                  )}
                >
                  {hc.why[q.source] ?? q.source}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="m-0 text-[15px] text-dashboard-text-medium">{line.isLoading ? hc.loading : hc.queueNone}</p>
        )}
        <DashboardButton variant="small" className="self-start min-h-11 md:min-h-11" onClick={() => onFront(sponsorId)}>
          <Plus aria-hidden />
          {hc.addButton}
        </DashboardButton>
      </div>
    </>
  );
}

/** Ad hoc booking on an empty cell (or from "Book a room"); focus starts in "Who it's for". */
function BookingForm({
  board,
  initial,
  busy,
  onBook,
}: {
  board: SessionBoardData;
  initial: { room: string; session: string };
  busy: boolean;
  onBook: (v: { room: string; session: string; label: string; note: string; forSponsorId: string | null }) => void;
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
      className={pad}
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
        <Dialog.Title className="m-0 text-xl font-bold leading-snug">{bc.title}</Dialog.Title>
        <Dialog.Close
          aria-label={dc.close}
          className={cn("-mr-2.5 -mt-2.5 inline-flex size-11 cursor-pixel-hover items-center justify-center rounded-dashboard-lg text-dashboard-text-light [@media(hover:hover)]:hover:bg-dashboard-bg-highlight", focusRing)}
        >
          <X aria-hidden className="size-[18px]" />
        </Dialog.Close>
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
        <Dialog.Close asChild>
          <DashboardButton type="button" variant="small">{bc.cancel}</DashboardButton>
        </Dialog.Close>
      </div>
    </form>
  );
}
