import { coffeeSessionsCopy } from "~/content/coffee-chat-sessions";
import { type SessionBoardData } from "./parts";

const copy = coffeeSessionsCopy;

/** "9:58 PM", Toronto time. */
export const timeOf = (d: Date | string) =>
  new Date(d).toLocaleTimeString("en-US", { timeZone: "America/Toronto", hour: "numeric", minute: "2-digit" });

/**
 * One line for an organizer arriving cold: what needs doing now, then what
 * happens next. Pure, so it's easy to reason about.
 */
export function summaryLine(board: SessionBoardData): string {
  const s = copy.summary;
  const submitted = board.sponsors.filter((x) => x.submitted).length;
  const notSubmitted = board.sponsors.length - submitted;
  if (submitted === 0) return s.nothingYet;
  const tail = notSubmitted > 0 ? s.notSubmittedTail(notSubmitted) : "";
  const changed = board.sponsors.filter((x) => x.changedAfterSend).length;
  // Needs scheduling, or placed with a rep still missing.
  const need = board.sponsors.filter(
    (x) => "done" in x.status && (x.status.kind === "need" || x.status.done < x.status.total),
  ).length;
  let head: string;
  if (changed > 0) head = s.changedAfterSend(changed);
  else if (!board.scheduled) head = s.notScheduled(submitted);
  else if (need > 0) head = s.need(need);
  else if (board.fixes.length > 0) head = s.fixes(board.fixes.length);
  else if (board.draftCount === 0 && board.sentAt) head = s.sent(timeOf(board.sentAt));
  else head = s.ready;
  return head + tail;
}

/**
 * The summary line, then what sponsors changed since the board was last
 * scheduled or sent ("Sun Life edited reps or times after Send · 9:58 PM"),
 * newest first, with when the board was last scheduled and sent.
 */
export function BoardSummary({
  board,
  action,
}: {
  board: SessionBoardData;
  /** A button beside the line when it names the next step (Auto-schedule). */
  action?: React.ReactNode;
}) {
  const c = copy.changes;
  const changes = board.sponsors
    .flatMap((sp) => (sp.change ? [{ sp, change: sp.change }] : []))
    .sort((a, b) => new Date(b.change.at).getTime() - new Date(a.change.at).getTime());
  const stamps = [
    board.lastScheduledAt ? c.lastScheduled(timeOf(board.lastScheduledAt)) : null,
    board.sentAt ? c.lastSent(timeOf(board.sentAt)) : null,
  ].filter(Boolean);
  return (
    <section aria-label={c.heading} className="flex flex-col gap-2 rounded-dashboard-lg bg-dashboard-bg-surface px-4 py-3 shadow-dashboard-card md:px-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <p className="m-0 text-[17px] font-semibold text-dashboard-text-heavy">{summaryLine(board)}</p>
        {action}
      </div>
      {(changes.length > 0 || stamps.length > 0) && (
        <div className="flex flex-col gap-1 text-sm text-dashboard-text-medium">
          {changes.length > 0 && (
            <ul className="m-0 flex list-none flex-col gap-0.5 p-0">
              {changes.map(({ sp, change }) => (
                <li key={sp.id} className={change.kind === "editedAfterSend" ? "font-medium text-dashboard-text-warning" : undefined}>
                  {c[change.kind](sp.name, timeOf(change.at))}
                </li>
              ))}
            </ul>
          )}
          {stamps.length > 0 && <p className="m-0 text-[13px] text-dashboard-text-light">{stamps.join(" · ")}</p>}
        </div>
      )}
    </section>
  );
}
