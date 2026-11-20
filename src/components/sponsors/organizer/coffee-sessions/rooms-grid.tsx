import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import {
  cellAt,
  chatsInCell,
  clockRange,
  keyOf,
  splitKey,
  type CellOf,
} from "~/lib/coffee-chat-board-view";
import {
  COFFEE_ROOMS,
  COFFEE_SESSIONS,
  minutesOfClock,
} from "~/lib/coffee-chat-sessions";
import { cn } from "~/lib/utils";
import {
  Card,
  CardHead,
  clockOf,
  focusRing,
  hatch,
  Logo,
  sessionLabel,
  StatusDot,
  type SessionBoardData,
} from "./parts";
import { type BoardDrag } from "./use-board-drag";

const copy = coffeeSessionsCopy;
const rc = copy.rooms;

export type CellContent = CellOf<SessionBoardData>;
export type ChatCell = Extract<CellContent, { kind: "chat" }>;

/** "1:00–1:30" when a chat uses only part of its session, else null. */
export function partialTimeOf(c: CellContent): string | null {
  if (c?.kind !== "chat") return null;
  const part = c.sponsor.partial[c.placement.sessionId];
  return part ? rc.partialTime(clockOf(part.start), clockOf(part.end)) : null;
}

/** A chat cell's third line: "2 chats · 3 each" (a partial session leads with its time). */
export function formatOf(board: SessionBoardData, c: ChatCell): string {
  return rc.cellFormat(
    chatsInCell(board, c.placement),
    c.sponsor.hackersPerChat,
    partialTimeOf(c),
  );
}

/** "Sun Life workshop · 2:30–3:30 PM · Rm 2230" pieces: the room without the sheet's capacity. */
function workshopRoom(location: string | null | undefined): string | null {
  // The sheet writes "Rm 2230 (50)" or "2230 (50)": drop the capacity.
  const bare = location?.replace(/\s*\([^)]*\)\s*$/, "").trim() ?? null;
  if (!bare) return null;
  return /^\d/.test(bare) ? rc.rm(bare) : bare;
}

/** True on a touch-first screen (the hint says "Press and hold"). */
function useCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const on = () => setCoarse(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return coarse;
}

/**
 * The Rooms grid (mock organizer-coffee-v12): 8 rooms x 6 sessions and the
 * Workshops row. Every cell is one fixed size (66px); lines are cut with
 * "…" and the whole text is in the title, the aria-label and the modal.
 * Chats and bookings are dragged (use-board-drag.ts); clicking any cell
 * opens the modal. While a drag runs, the cells the dragged one can drop on
 * with no question read "Drop here".
 */
export function RoomsGrid({
  board,
  selected,
  drag,
  lit,
  onCell,
  scrollRef,
}: {
  board: SessionBoardData;
  /** The cell the modal is open on. */
  selected: string | null;
  drag: BoardDrag | null;
  /** Cells the dragged one can drop on with no question. */
  lit: ReadonlySet<string>;
  onCell: (key: string) => void;
  scrollRef: React.RefObject<HTMLDivElement | null>;
}) {
  const coarse = useCoarsePointer();
  const group = (b: "near" | "ivey", label: string) => (
    <>
      <tr>
        <th
          colSpan={7}
          scope="colgroup"
          className="pb-0 pt-3 text-left text-[13px] font-semibold text-dashboard-text-medium first:pt-1"
        >
          <span className="sticky left-0">{label}</span>
        </th>
      </tr>
      {COFFEE_ROOMS.filter((r) => r.building === b).map((r) => (
        <tr key={r.id}>
          <th
            scope="row"
            className="sticky left-0 z-[2] w-[78px] whitespace-nowrap bg-dashboard-bg-surface pr-1 text-left text-sm font-semibold"
          >
            {r.id}
          </th>
          {COFFEE_SESSIONS.map((s) => (
            <td key={s.id} className="h-[66px] p-0">
              <Cell
                board={board}
                k={keyOf(r.id, s.id)}
                selected={selected}
                drag={drag}
                lit={lit}
                onCell={onCell}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
  return (
    <Card labelledBy="coffee-rooms" tour="coffee-table">
      <CardHead id="coffee-rooms" title={rc.heading} />
      <div className="-mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <p className="m-0 text-[13px] text-dashboard-text-light">
          {coarse ? rc.hintTouch : rc.hintMouse}
        </p>
        <p className="m-0 flex gap-3 text-[13px] text-dashboard-text-light">
          <span className="inline-flex items-center gap-[5px]">
            <LegendDot sent />
            {rc.tagSent}
          </span>
          <span className="inline-flex items-center gap-[5px]">
            <LegendDot sent={false} />
            {rc.tagDraft}
          </span>
        </p>
      </div>
      {/* The grid scrolls inside its card on phones; the page never does. */}
      <div
        ref={scrollRef}
        className="-mx-5 overflow-x-auto px-5 md:-mx-6 md:px-6"
      >
        <table className="w-full min-w-[860px] table-fixed border-separate border-spacing-1">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-[3] w-[78px] bg-dashboard-bg-surface"
              >
                <span className="sr-only">{rc.room}</span>
              </th>
              {COFFEE_SESSIONS.map((s) => (
                <th
                  key={s.id}
                  scope="col"
                  className="px-2 pb-0.5 text-left text-[13px] font-semibold text-dashboard-text-light"
                >
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
    </Card>
  );
}

function LegendDot({ sent }: { sent: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "inline-flex size-3.5 items-center justify-center",
        sent ? "text-dashboard-status-live" : "text-dashboard-text-light",
      )}
    >
      <span
        className={cn(
          "size-2 rounded-full",
          sent ? "bg-current" : "shadow-[inset_0_0_0_1.5px_currentColor]",
        )}
      />
    </span>
  );
}

const cellBase = cn(
  "relative flex h-[66px] w-full min-w-0 flex-col items-stretch justify-center gap-0.5 overflow-hidden rounded-dashboard-md py-1.5 pl-[9px] pr-1.5 text-left text-xs leading-tight [&>*]:min-w-0",
  focusRing,
);
/** Chats and bookings: grab cursor, no text selection or long-press menu (a press starts a drag). */
const draggable =
  "cursor-grab touch-manipulation select-none [-webkit-touch-callout:none] [&_img]:pointer-events-none";
const line = "block truncate";

function Cell({
  board,
  k,
  selected,
  drag,
  lit,
  onCell,
}: {
  board: SessionBoardData;
  k: string;
  selected: string | null;
  drag: BoardDrag | null;
  lit: ReadonlySet<string>;
  onCell: (key: string) => void;
}) {
  const c = cellAt(board, k);
  const { room, session } = splitKey(k);
  const where = rc.where(room, sessionLabel(session));
  const sel =
    selected === k &&
    !drag &&
    "outline outline-2 outline-offset-1 outline-dashboard-action-primary";
  const over = drag?.over === k;
  // A hovered cell the drag can't drop on with no question.
  const nohit =
    over &&
    !lit.has(k) &&
    drag?.src !== k &&
    "outline outline-2 outline-offset-1 outline-dashboard-text-warning";
  if (!c) {
    // One element for an empty cell, lit or not: a touch drag's events stop if
    // their target leaves the DOM, and the hovered cell changes during it.
    const target = lit.has(k);
    return (
      <button
        type="button"
        data-cell={k}
        onClick={() => onCell(k)}
        aria-label={target ? rc.cellMoveHere(where) : rc.cellBook(where)}
        className={cn(
          cellBase,
          "cursor-pixel-hover items-center",
          target
            ? cn(
                "whitespace-nowrap border-[1.5px] border-dashed border-dashboard-action-primary text-[13px] font-semibold text-dashboard-text-active",
                over
                  ? "border-solid bg-dashboard-bg-navSelected"
                  : "bg-dashboard-bg-highlight",
              )
            : "border border-dashed border-dashboard-border-default text-dashboard-border-control [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
          sel,
          nohit,
        )}
      >
        {target ? rc.dropHere : <Plus aria-hidden className="size-4" />}
      </button>
    );
  }
  const dragged = drag?.src === k && "opacity-40";
  if (c.kind === "booking") {
    const b = c.booking;
    const title = rc.cellTitle([b.label, rc.adhoc]);
    return (
      <button
        type="button"
        data-cell={k}
        data-drag=""
        onClick={() => onCell(k)}
        title={title}
        aria-label={`${title}, ${where}`}
        className={cn(
          cellBase,
          draggable,
          "border border-dashboard-border-default bg-dashboard-bg-inset text-dashboard-text-medium",
          sel,
          nohit,
          dragged,
        )}
      >
        <span
          className={cn(line, "text-sm font-bold text-dashboard-text-heavy")}
        >
          {b.label}
        </span>
        <span className={cn(line, "font-semibold text-dashboard-text-medium")}>
          {rc.adhoc}
        </span>
      </button>
    );
  }
  const sent = c.placement.status === "sent";
  const forced = c.placement.forced;
  const tag = sent ? rc.tagSent : rc.tagDraft;
  const fmt = formatOf(board, c);
  return (
    <button
      type="button"
      data-cell={k}
      // Sent chats are locked: hackers were notified, so they can't be dragged.
      data-drag={sent ? undefined : ""}
      onClick={() => onCell(k)}
      title={rc.cellTitle([
        c.rep.name,
        c.sponsor.name,
        fmt,
        tag,
        forced && rc.tagForced,
      ])}
      aria-label={rc.chatLabel(
        c.sponsor.name,
        c.rep.name,
        where,
        fmt,
        tag,
        forced,
      )}
      className={cn(
        cellBase,
        !sent && draggable,
        "border border-dashboard-border-outline bg-dashboard-bg-surface text-dashboard-text-active shadow-[inset_3px_0_0_theme(colors.dashboard.action.primary)] [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
        sel,
        nohit,
        dragged,
      )}
    >
      <span className="flex min-w-0 items-center gap-1.5">
        <span
          className={cn(
            line,
            "flex-auto text-sm font-bold text-dashboard-text-heavy",
          )}
        >
          {c.rep.name}
        </span>
        <StatusDot sent={sent} />
      </span>
      <span className={cn(line, "font-semibold text-dashboard-text-medium")}>
        {c.sponsor.name}
      </span>
      <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-dashboard-text-light">
        <span className={cn(line, "flex-auto tabular-nums")}>{fmt}</span>
        {forced && <NotFreeTag />}
      </span>
    </button>
  );
}

/** The small amber "Not free" pill on a forced chat's format line. */
export function NotFreeTag() {
  return (
    <span className="inline-flex h-[18px] flex-none items-center whitespace-nowrap rounded-full bg-dashboard-bg-task px-1.5 text-[11px] font-semibold leading-none text-dashboard-text-warning">
      {rc.tagForced}
    </span>
  );
}

/** Bottom row: each sponsor's own workshop in that session (hatched), start and end time. */
function WorkshopRow({ board }: { board: SessionBoardData }) {
  const hits = board.sponsors.flatMap((sp) =>
    sp.workshops.map((w) => ({ sp, w })),
  );
  return (
    <tr>
      <th
        scope="row"
        className="sticky left-0 z-[2] bg-dashboard-bg-surface pr-1 pt-2 text-left text-sm font-semibold text-dashboard-text-medium"
      >
        {rc.workshops}
      </th>
      {COFFEE_SESSIONS.map((s) => {
        const hit = hits.find(({ w }) => {
          const a = minutesOfClock(w.start) ?? 0;
          const b = minutesOfClock(w.end) ?? 0;
          return a < s.end && s.start < b;
        });
        if (!hit) return <td key={s.id} className="pt-2" aria-hidden />;
        const when = clockRange(hit.w.start, hit.w.end);
        const room = workshopRoom(hit.w.location);
        const label = rc.workshopLabel(hit.sp.name, room, when);
        return (
          <td key={s.id} className="p-0 pt-2">
            <div
              role="img"
              aria-label={label}
              title={label}
              className={cn(
                cellBase,
                hatch,
                "items-start border border-dashboard-border-default text-[11.5px] text-dashboard-text-medium",
              )}
            >
              <span className="max-w-full overflow-hidden rounded-dashboard-sm bg-dashboard-bg-surface px-1 py-0.5">
                <Logo name={hit.sp.name} size="sm" />
              </span>
              <span className={cn(line, "max-w-full")}>
                {rc.workshopCell(room)}
              </span>
              <span className={cn(line, "max-w-full tabular-nums")}>
                {when}
              </span>
            </div>
          </td>
        );
      })}
    </tr>
  );
}
