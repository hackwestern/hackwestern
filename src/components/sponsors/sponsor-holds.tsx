import Link from "next/link";
import { DoorOpen, ScanLine, Users } from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { coffeeChatCopy } from "~/content/coffee-chat";
import type { BlockFormat, SponsorHoldView } from "~/lib/coffee-chat-holds";
import { formatClock } from "~/lib/run-of-show";
import { cn } from "~/lib/utils";

const copy = coffeeChatCopy.sponsorHolds;

/** Full-width compact outline buttons (DashboardButton "small"). */
const actionClass = "w-full";

/** The scan page, opened on this block's first open slot. */
export function scanHrefForHold(sponsor: string, startTime: string): string {
  return `/sponsors/${sponsor}/scan?time=${encodeURIComponent(startTime)}`;
}

// "Pick from candidates" and "Scan a badge" for a block's open slots (Scan
// opens on the first one). Candidates is a button when the caller can
// switch tabs in place, else a link.
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
        <DashboardButton
          variant="small"
          type="button"
          onClick={onPickCandidates}
          className={actionClass}
        >
          <Users aria-hidden />
          {copy.pick}
        </DashboardButton>
      ) : (
        <DashboardButton variant="small" asChild className={actionClass}>
          <Link href={`/sponsors/${sponsor}/coffee-chats#interested`}>
            <Users aria-hidden />
            {copy.pick}
          </Link>
        </DashboardButton>
      )}
      <DashboardButton variant="small" asChild className={actionClass}>
        <Link href={scanHrefForHold(sponsor, hold.startTime)}>
          <ScanLine aria-hidden />
          {copy.scan}
        </Link>
      </DashboardButton>
    </div>
  );
}

// The sponsor's own room blocks: "Rm 2243 · 9:00–10:00 · 1 of 4 chats
// filled" with their chat type, and ways to fill the open slots.
export function SponsorHolds({
  sponsor,
  holds,
  format,
  onPickCandidates,
}: {
  sponsor: string;
  holds: SponsorHoldView[];
  format: BlockFormat;
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
        <p className="m-0 text-sm text-dashboard-text-medium">
          {copy.intro} {copy.chatType(format.groupSize, format.reps)}
        </p>
      </div>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {holds.map((h) => (
          <li
            key={h.holdId}
            className={cn(
              "flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card",
              h.needsHacker && "border-l-4 border-dashboard-border-strong",
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
                  h.filled,
                  h.total,
                )}
              </p>
            </div>
            {h.needsHacker && h.firstOpen && (
              <HoldActions
                sponsor={sponsor}
                hold={{ room: h.room, startTime: h.firstOpen }}
                onPickCandidates={onPickCandidates}
              />
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
