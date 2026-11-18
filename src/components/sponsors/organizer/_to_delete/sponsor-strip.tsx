import Link from "next/link";
import {
  CalendarDays,
  Coffee,
  DoorOpen,
  LifeBuoy,
  TriangleAlert,
} from "lucide-react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { sponsorOrganizerCopy } from "~/content/sponsor-organizer";
import {
  organizerHomeHref,
  type OrganizerTab,
  type SponsorSummary,
} from "~/lib/sponsor-organizer";
import { cn } from "~/lib/utils";

const copy = sponsorOrganizerCopy.strip;

const pill =
  "inline-flex items-center gap-1 whitespace-nowrap rounded-dashboard-sm px-2 py-0.5 text-xs font-semibold leading-5";

// 44px tall on touch screens, 36px on desktop; hover only where a pointer
// hovers; a small scale-down on press.
// DashboardButton "link" at the strip's smaller text size; an open help
// request gets the warning outline so it stands out.
const action = "border border-transparent text-xs";

/**
 * One sponsor at a glance on the Sponsors tab: coffee chat room, chats
 * accepted and pending, the live help request (highlighted while nobody has
 * claimed it), and links into the other tabs focused on this sponsor.
 * Nothing for unregistered sponsors (no id, so no chats or help yet).
 */
export function SponsorStrip({
  sponsorId,
  name,
  summary,
  loading,
  now,
  className,
}: {
  sponsorId: string | null;
  name: string;
  summary: SponsorSummary | undefined;
  loading: boolean;
  now: Date;
  className?: string;
}) {
  if (!sponsorId) return null;
  if (loading) {
    return (
      <div
        aria-busy="true"
        aria-label={copy.loading}
        className={cn(
          "h-7 w-full max-w-md rounded-dashboard-sm bg-dashboard-bg-inset motion-safe:animate-pulse",
          className,
        )}
      />
    );
  }
  const help = summary?.help ?? null;
  const helpMinutes = help
    ? Math.max(
        0,
        Math.floor(
          (now.getTime() - new Date(help.createdAt).getTime()) / 60_000,
        ),
      )
    : 0;
  const link = (tab: OrganizerTab) =>
    organizerHomeHref({ tab, sponsor: sponsorId });

  return (
    <div
      role="group"
      aria-label={copy.label(name)}
      className={cn("flex flex-wrap items-center gap-x-3 gap-y-2", className)}
    >
      {summary && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              pill,
              summary.room
                ? "bg-dashboard-bg-nav text-dashboard-text-heavy"
                : "bg-dashboard-bg-inset text-dashboard-text-light",
            )}
          >
            <DoorOpen aria-hidden className="size-3.5" />
            {summary.room ? copy.room(summary.room) : copy.noRoom}
          </span>
          <span
            className={cn(
              pill,
              "bg-dashboard-bg-nav tabular-nums text-dashboard-text-heavy",
            )}
          >
            <Coffee aria-hidden className="size-3.5" />
            {copy.chats(summary.accepted, summary.pending)}
          </span>
          {summary.needsHacker > 0 && (
            <span
              className={cn(
                pill,
                "bg-dashboard-status-iconBadge tabular-nums text-dashboard-text-warning",
              )}
            >
              <TriangleAlert aria-hidden className="size-3.5" />
              {copy.needsHacker(summary.needsHacker)}
            </span>
          )}
          {help ? (
            <span
              className={cn(
                pill,
                help.status === "open"
                  ? "bg-dashboard-status-iconBadge text-dashboard-text-warning"
                  : "bg-dashboard-bg-highlight text-dashboard-text-active",
              )}
            >
              <LifeBuoy aria-hidden className="size-3.5" />
              {help.status === "open"
                ? copy.helpOpen(helpMinutes)
                : copy.helpClaimed(help.claimedByName)}
            </span>
          ) : (
            <span
              className={cn(
                pill,
                "bg-dashboard-bg-inset font-medium text-dashboard-text-light",
              )}
            >
              {copy.noHelp}
            </span>
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        <DashboardButton variant="link" asChild className={action}>
          <Link href={link("schedule")} shallow scroll={false}>
            <CalendarDays aria-hidden />
            {copy.viewSchedule}
            <span className="sr-only"> {name}</span>
          </Link>
        </DashboardButton>
        <DashboardButton variant="link" asChild className={action}>
          <Link href={link("coffee")} shallow scroll={false}>
            <Coffee aria-hidden />
            {copy.coffeeChats}
            <span className="sr-only"> {name}</span>
          </Link>
        </DashboardButton>
        <DashboardButton
          variant="link"
          asChild
          className={cn(
            action,
            help?.status === "open" &&
              "border-dashboard-status-iconBadgeIcon text-dashboard-text-warning",
          )}
        >
          <Link
            href={organizerHomeHref({
              tab: "pings",
              sponsor: sponsorId,
              help: true,
            })}
            shallow
            scroll={false}
          >
            <LifeBuoy aria-hidden />
            {copy.help}
            <span className="sr-only"> {name}</span>
          </Link>
        </DashboardButton>
      </div>
    </div>
  );
}
