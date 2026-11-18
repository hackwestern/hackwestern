import Link from "next/link";
import { DoorOpen, ScanLine, TriangleAlert, Users } from "lucide-react";
import { pressable } from "~/components/sponsors/sponsor-shell";
import { coffeeChatCopy } from "~/content/coffee-chat";
import type { SponsorHoldView } from "~/lib/coffee-chat-holds";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";

const copy = coffeeChatCopy.sponsorHolds;

const actionClass =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-dashboard-lg border border-dashboard-border-control bg-dashboard-bg-surface px-3 text-sm font-semibold text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary [@media(hover:hover)]:hover:bg-dashboard-bg-highlight";

/** The scan page, opened on this hold's start time when it's still open. */
export function scanHrefForHold(sponsor: string, startTime: string): string {
  return `/sponsors/${sponsor}/scan?time=${encodeURIComponent(startTime)}`;
}

// "Pick from candidates" and "Scan a badge" for one hold. Candidates is a
// button when the caller can switch tabs in place, else a link.
export function HoldActions({
  sponsor,
  hold,
  onPickCandidates,
}: {
  sponsor: string;
  hold: Pick<SponsorHoldView, "room" | "startTime">;
  onPickCandidates?: () => void;
}) {
  return (
    <div
      role="group"
      aria-label={copy.actionsLabel(hold.room, formatClock(hold.startTime))}
      className="grid grid-cols-1 gap-2 min-[400px]:grid-cols-2"
    >
      {onPickCandidates ? (
        <button
          type="button"
          onClick={onPickCandidates}
          className={cn(actionClass, pressable)}
        >
          <Users aria-hidden className="size-4" />
          {copy.pick}
        </button>
      ) : (
        <Link
          href={`/sponsors/${sponsor}/coffee-chats#interested`}
          className={cn(actionClass, pressable)}
        >
          <Users aria-hidden className="size-4" />
          {copy.pick}
        </Link>
      )}
      <Link
        href={scanHrefForHold(sponsor, hold.startTime)}
        className={cn(actionClass, pressable)}
      >
        <ScanLine aria-hidden className="size-4" />
        {copy.scan}
      </Link>
    </div>
  );
}

// The sponsor's own room holds: room and time, and either "You still need
// a hacker" (with ways to find one) or how many hackers are booked.
export function SponsorHolds({
  sponsor,
  holds,
  onPickCandidates,
}: {
  sponsor: string;
  holds: SponsorHoldView[];
  onPickCandidates?: () => void;
}) {
  if (holds.length === 0) return null;
  return (
    <section aria-labelledby="held-rooms" className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2
          id="held-rooms"
          className="m-0 text-lg font-semibold text-dashboard-text-heavy"
        >
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {holds.map((h) => (
          <li
            key={h.holdId}
            className={cn(
              "flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
              h.needsHacker && "border-l-4 border-dashboard-status-warning",
            )}
          >
            <div className="flex flex-col gap-1">
              <p className="m-0 flex items-center gap-2 text-base font-semibold tabular-nums text-dashboard-text-heavy">
                <DoorOpen
                  aria-hidden
                  className="size-4 shrink-0 text-dashboard-text-light"
                />
                {copy.line(
                  h.room,
                  formatClock(h.startTime),
                  formatClock(h.endTime),
                )}
              </p>
              {h.needsHacker ? (
                <p className="m-0 flex items-center gap-1.5 text-sm font-semibold text-dashboard-text-warning">
                  <TriangleAlert aria-hidden className="size-4 shrink-0" />
                  {copy.needsHacker}
                </p>
              ) : (
                <p className="m-0 text-sm text-dashboard-text-medium">
                  {copy.booked(h.chats)}
                </p>
              )}
            </div>
            {h.needsHacker && (
              <HoldActions
                sponsor={sponsor}
                hold={h}
                onPickCandidates={onPickCandidates}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
