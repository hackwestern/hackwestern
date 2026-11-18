import { Check } from "lucide-react";
import { press } from "~/components/internals/interaction";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import { formatClock, type RunOfShowItem } from "~/lib/run-of-show";
import {
  round1State,
  round2State,
  slotFill,
  slotTone,
  slotsByRoom,
  sundayWhere,
  type SlotTone,
} from "~/lib/sponsor-day-board";
import type { SponsorSummary } from "~/lib/sponsor-organizer";
import { sponsorLogo } from "~/lib/sponsor-logos";
import { formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";

// The day-specific cells of the organizer Sponsors tab (Friday portal
// link, Saturday chat slots, Sunday rounds and where to be). Each reads
// the sponsor's summary row (sponsorOrganizer.summary).

const copy = sponsorOrganizerCopy.day;

const focusRing =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-1";

/** The real logo, or nothing: the name is always beside it. */
export function SponsorLogo({ name }: { name: string }) {
  const logo = sponsorLogo(name);
  if (!logo) return null;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={logo}
      alt=""
      aria-hidden
      width={64}
      height={20}
      loading="lazy"
      className="h-5 w-auto max-w-16 shrink-0 object-contain object-left"
    />
  );
}

/** Friday: a small pill that marks the portal link as handed over. */
export function LinkGivenToggle({
  name,
  given,
  pending,
  onToggle,
}: {
  name: string;
  given: boolean;
  pending: boolean;
  onToggle: (given: boolean) => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={given}
      aria-label={copy.linkGivenLabel(name, given)}
      disabled={pending}
      onClick={() => onToggle(!given)}
      className={cn(
        "inline-flex min-h-11 cursor-pixel-hover items-center gap-1 whitespace-nowrap rounded-full border px-2.5 text-xs font-semibold md:min-h-8",
        press,
        focusRing,
        pending && "opacity-dashboard-disabled",
        given
          ? "border-dashboard-status-live bg-dashboard-schedule-green text-dashboard-text-heavy"
          : "border-dashboard-border-default bg-dashboard-bg-surface text-dashboard-text-medium [@media(hover:hover)]:hover:bg-dashboard-bg-highlight",
      )}
    >
      {given && <Check aria-hidden className="size-3.5" />}
      {given ? copy.linkGiven : copy.markGiven}
    </button>
  );
}

const TONE: Record<SlotTone, string> = {
  full: "bg-dashboard-bg-highlight text-dashboard-text-active",
  open: "bg-dashboard-status-iconBadge text-dashboard-text-warning",
  off: "bg-dashboard-bg-nav text-dashboard-text-light",
};

/** Saturday: each slot of the sponsor's room blocks as "9:00 2/3". */
export function ChatSlotsCell({ summary }: { summary: SponsorSummary }) {
  if (summary.chatSlots.length === 0) {
    return <span className="text-dashboard-text-light">{copy.noSlots}</span>;
  }
  return (
    <span className="flex flex-col gap-1">
      {slotsByRoom(summary.chatSlots).map(({ room, slots }) => (
        <span key={room} className="flex flex-wrap items-center gap-1">
          <span className="mr-0.5 whitespace-nowrap text-xs font-semibold text-dashboard-text-medium">
            {room}
          </span>
          {slots.map((s) => {
            // Never "4/3": booked is capped at the ask, extras said apart.
            const { shown, over } = slotFill(s);
            return (
              <span
                key={s.slotTime}
                role="img"
                aria-label={copy.slotLabel(
                  room,
                  formatClock(s.slotTime),
                  shown,
                  s.needed,
                  over,
                )}
                className="inline-flex items-center gap-1 whitespace-nowrap"
              >
                <span
                  aria-hidden
                  className={cn(
                    "rounded-dashboard-sm px-1.5 py-0.5 text-xs font-semibold tabular-nums leading-5",
                    TONE[slotTone(s)],
                  )}
                >
                  {copy.slot(
                    formatClock(s.slotTime).replace(/ [AP]M$/, ""),
                    shown,
                    s.needed,
                  )}
                </span>
                {over > 0 && (
                  <span
                    aria-hidden
                    className="text-xs tabular-nums text-dashboard-text-light"
                  >
                    {copy.slotOver(over)}
                  </span>
                )}
              </span>
            );
          })}
        </span>
      ))}
    </span>
  );
}

function StatusText({
  tone,
  children,
}: {
  tone: "done" | "warn" | "quiet";
  children: React.ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex w-fit items-center gap-1 text-sm sm:whitespace-nowrap",
        tone === "done" && "font-semibold text-dashboard-status-live",
        tone === "warn" && "font-semibold text-dashboard-text-warning",
        tone === "quiet" && "text-dashboard-text-light",
      )}
    >
      {tone === "done" && <Check aria-hidden className="size-3.5" />}
      {children}
    </span>
  );
}

/** Sunday round 1: shortlist sent, in progress, or not started. */
export function Round1Cell({ summary }: { summary: SponsorSummary }) {
  const r = round1State(summary.sunday);
  if (r.kind === "sent") {
    return (
      <StatusText tone="done">
        {copy.round1.sent(r.teams, formatSubmittedTime(r.at))}
      </StatusText>
    );
  }
  if (r.kind === "working") {
    return (
      <StatusText tone="warn">
        {copy.round1.working(r.scored, r.shortlisted)}
      </StatusText>
    );
  }
  return <StatusText tone="quiet">{copy.round1.notStarted}</StatusText>;
}

/** Sunday round 2: top 5 sent, waiting on them, or not open yet. */
export function Round2Cell({
  summary,
  round2Open,
}: {
  summary: SponsorSummary;
  round2Open: boolean;
}) {
  const r = round2State(summary.sunday, round2Open);
  if (r.kind === "sent") {
    return (
      <StatusText tone="done">
        {copy.round2.sent(formatSubmittedTime(r.at))}
      </StatusText>
    );
  }
  if (r.kind === "ranking") {
    return <StatusText tone="warn">{copy.round2.ranking}</StatusText>;
  }
  return <StatusText tone="quiet">{copy.round2.notOpen}</StatusText>;
}

/** Sunday: where the sponsor should be now (or next), from real data only. */
export function WhereCell({
  summary,
  items,
  now,
}: {
  summary: SponsorSummary;
  /** Run-of-show blocks; null when the sheet didn't load. */
  items: readonly RunOfShowItem[] | null;
  now: Date;
}) {
  if (!items && summary.sunday.slots.length === 0) {
    return (
      <span className="text-dashboard-text-light">{copy.where.unread}</span>
    );
  }
  const w = sundayWhere({
    sponsorName: summary.name,
    items: items ?? [],
    slots: summary.sunday.slots,
    now,
  });
  const line = (main: string, sub: string | null, live = false) => (
    <span className="flex min-w-0 flex-col sm:whitespace-nowrap">
      <span className="flex items-center gap-1.5 font-semibold">
        {live && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-full bg-dashboard-status-live"
          />
        )}
        {main}
      </span>
      {sub && <span className="text-xs text-dashboard-text-light">{sub}</span>}
    </span>
  );
  switch (w.kind) {
    case "presenting":
      return line(
        copy.where.presenting(w.room),
        w.team
          ? copy.where.presentingTeam(w.team, formatClock(w.until))
          : copy.where.presentingUntil(formatClock(w.until)),
        true,
      );
    case "presenting-next":
      return line(
        copy.where.presentingNext(w.room),
        copy.where.at(formatClock(w.start)),
      );
    case "item":
      return line(
        w.location ?? copy.where.noLocation,
        `${w.now ? copy.where.now : copy.where.next(formatClock(w.start))} · ${w.title}`,
        w.now,
      );
    case "done":
      return (
        <span className="text-dashboard-text-light">{copy.where.done}</span>
      );
    case "none":
      return (
        <span className="text-dashboard-text-light">{copy.where.none}</span>
      );
  }
}
