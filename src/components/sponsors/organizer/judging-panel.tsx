import { CircleCheck, Gavel, TriangleAlert } from "lucide-react";
import { useMemo } from "react";
import Link from "next/link";
import { SponsorBadge } from "~/components/sponsors/sponsor-badge";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { formatClock } from "~/lib/run-of-show";
import { sponsorColorIndexes } from "~/lib/sponsor-colors";
import {
  MAX_SPONSOR_PICKS,
  MIN_SPONSOR_PICKS,
  type JudgingBoard,
  type JudgingRow,
  type JudgingStatus,
} from "~/lib/sponsor-judging-rooms";
import { cn } from "~/lib/utils";

const copy = sponsorOrganizerCopy.judging;

/** Problems a sponsor (or the team) has to fix before judging. */
const WARN: ReadonlySet<JudgingStatus> = new Set([
  "missing-room",
  "too-few-picks",
]);

const NOTICE =
  "m-0 rounded-dashboard-md bg-dashboard-bg-inset px-3 py-2 text-sm text-dashboard-text-medium";

// Sunday sponsor track judging under the organizer run of show (like the
// ceremony running order): the sheet's time window, then each sponsor's
// room, picks and status. Read-only: rooms are filled in the sheets by the
// team (docs/decisions.md, 2026-11-18), so the only action is the sheet.
export function JudgingPanel({
  board,
  failed,
}: {
  board: JudgingBoard | null | undefined;
  /** The summary query failed (no board to show). */
  failed: boolean;
}) {
  // Colours over registered sponsors only, the set the other tabs use.
  const colors = useMemo(
    () =>
      sponsorColorIndexes(
        (board?.rows ?? []).filter((r) => r.registered).map((r) => r.name),
      ),
    [board],
  );

  return (
    <section
      aria-labelledby="judging-heading"
      className="flex flex-col gap-4 rounded-dashboard-lg bg-dashboard-bg-surface p-4 font-figtree shadow-dashboard-card sm:p-6"
    >
      <div className="flex flex-col gap-1">
        <h2
          id="judging-heading"
          className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy"
        >
          <Gavel aria-hidden className="size-4 text-dashboard-text-light" />
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">
          {board?.slot
            ? copy.when(
                board.slot.title,
                formatClock(board.slot.start),
                formatClock(board.slot.end),
              )
            : board?.runOfShowRead
              ? copy.noSlot
              : null}
        </p>
        {board && board.counts.sponsors > 0 && (
          <p className="m-0 text-sm font-semibold tabular-nums text-dashboard-text-heavy">
            {copy.summary(
              board.counts.withRoom,
              board.counts.sponsors,
              board.counts.enoughPicks,
            )}
          </p>
        )}
      </div>

      {!board && failed && (
        <p role="status" className={NOTICE}>
          {copy.loadFailed}
        </p>
      )}
      {board && !board.runOfShowRead && (
        <p role="status" className={NOTICE}>
          {copy.runOfShowUnread}
        </p>
      )}
      {board && !board.sheetRead && (
        <p role="status" className={NOTICE}>
          {copy.sheetUnread}
        </p>
      )}

      {board && board.rows.length === 0 && (
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.empty}</p>
      )}

      {board && board.rows.length > 0 && (
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <table className="w-full min-w-[560px] border-separate border-spacing-0 text-left text-sm">
            <caption className="sr-only">{copy.tableLabel}</caption>
            <thead>
              <tr className="text-xs font-semibold text-dashboard-text-light">
                {[
                  copy.columns.sponsor,
                  copy.columns.room,
                  copy.columns.picks,
                  copy.columns.status,
                ].map((h) => (
                  <th
                    key={h}
                    scope="col"
                    className="border-b border-dashboard-border-subtle px-3 py-2 font-semibold"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((row) => (
                <JudgingTableRow
                  key={row.sponsorId ?? `x-${row.name}`}
                  row={row}
                  colors={colors}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Rooms are typed on the Judging board now, not in the sheet. */}
      <Link
        href="/internal/sponsors?tab=judging"
        className="self-start text-sm font-medium text-dashboard-action-primary underline-offset-2 hover:underline"
      >
        {copy.setRooms}
      </Link>
    </section>
  );
}

function JudgingTableRow({
  row,
  colors,
}: {
  row: JudgingRow;
  colors: ReadonlyMap<string, number>;
}) {
  const cell = "border-b border-dashboard-border-subtle px-3 py-2.5 align-top";
  return (
    <tr>
      {/* Pinned, like the Sponsors table, so the name stays on phones. */}
      <th
        scope="row"
        className={cn(
          cell,
          "sticky left-0 z-10 bg-dashboard-bg-surface font-semibold",
        )}
      >
        <span className="flex min-w-0 items-center gap-2">
          <SponsorBadge name={row.name} colors={colors} />
          <span className="break-words">{row.name}</span>
        </span>
      </th>
      <td className={cell}>
        {row.room ? (
          <span className="flex flex-col">
            <span className="font-semibold">{row.room}</span>
            {row.source && (
              <span className="text-xs text-dashboard-text-light">
                {copy.source[row.source]}
              </span>
            )}
            {row.otherRoom && (
              <span className="text-xs text-dashboard-text-warning">
                {copy.otherRoom(row.otherRoom)}
              </span>
            )}
          </span>
        ) : row.missingRoom ? (
          <span className="font-semibold text-dashboard-text-warning">
            {copy.missing}
          </span>
        ) : (
          <span className="text-dashboard-text-light">{copy.roomUnknown}</span>
        )}
      </td>
      <td
        className={cn(
          cell,
          "whitespace-nowrap tabular-nums",
          row.tooFewPicks && "font-semibold text-dashboard-text-warning",
        )}
      >
        {row.picks === null
          ? copy.picksUnknown
          : copy.picks(row.picks, MIN_SPONSOR_PICKS, MAX_SPONSOR_PICKS)}
      </td>
      <td className={cell}>
        <JudgingStatusPill status={row.status} />
      </td>
    </tr>
  );
}

/** Status as icon + text, never colour alone. */
export function JudgingStatusPill({ status }: { status: JudgingStatus }) {
  const warn = WARN.has(status);
  const ready = status === "ready";
  const Icon = ready ? CircleCheck : warn ? TriangleAlert : null;
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 whitespace-nowrap rounded-dashboard-sm px-2 py-0.5 text-xs font-semibold leading-5",
        warn
          ? "bg-dashboard-status-iconBadge text-dashboard-text-warning"
          : ready
            ? "bg-dashboard-bg-highlight text-dashboard-text-active"
            : "bg-dashboard-bg-nav text-dashboard-text-medium",
      )}
    >
      {Icon && <Icon aria-hidden className="size-3.5" />}
      {copy.status[status]}
    </span>
  );
}
