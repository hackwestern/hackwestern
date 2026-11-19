import { keepNamesTogether } from "~/lib/keep-names-together";
import { CalendarClock, Clock, MapPin, TriangleAlert } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { HoldActions } from "~/components/sponsors/sponsor-holds";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { scheduleCopy } from "~/content/sponsor-schedule";
import { formatClock } from "~/lib/run-of-show";
import type { NextEvent } from "~/lib/sponsor-next-event";

const copy = scheduleCopy.nextEvent;

function titleOf(event: NextEvent): string {
  if (event.kind === "ceremony" && event.ceremony) {
    return copy.ceremonyTitle(event.ceremony);
  }
  if (event.kind === "coffee") return copy.coffeeTitle;
  if (event.kind === "hold") return copy.holdTitle;
  return keepNamesTogether(event.title);
}

// "Your next event": the sponsor's next own item from now, with a countdown.
// The countdown ticks with useNow (once a minute), so it isn't aria-live.
// A held room with no hacker yet says so, with ways to find one (needs the
// sponsor's UUID for the links).
export function NextEventCard({
  event,
  sponsor,
}: {
  event: NextEvent | null;
  sponsor?: string;
}) {
  return (
    <DashboardPanel className="border-l-4 border-dashboard-action-primary">
      <h2 className="m-0 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
        <CalendarClock aria-hidden className="size-4" strokeWidth={1.67} />
        {copy.heading}
      </h2>
      {!event ? (
        <div className="flex flex-col gap-1">
          <p className="m-0 text-xl font-semibold text-dashboard-text-heavy">
            {copy.none}
          </p>
          <p className="m-0 text-base text-dashboard-text-medium">
            {copy.noneBody}
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <p className="m-0 min-w-0 break-words text-xl font-semibold text-dashboard-text-heavy">
              {titleOf(event)}
            </p>
            <DashboardTag
              className={
                event.now
                  ? "bg-dashboard-action-primary text-sm font-semibold text-dashboard-text-inverse"
                  : "bg-dashboard-bg-highlight text-sm font-semibold text-dashboard-text-heavy"
              }
            >
              {event.now ? copy.now : copy.countdown(event.minutesUntil)}
            </DashboardTag>
          </div>
          <dl className="m-0 grid grid-cols-1 gap-2 sm:grid-cols-2">
            <div className="flex items-center gap-2 text-base text-dashboard-text-heavy">
              <dt className="flex shrink-0 text-dashboard-text-light">
                <Clock aria-hidden className="size-4" />
                <span className="sr-only">{copy.labels.when}</span>
              </dt>
              <dd className="m-0">
                {copy.when(event.day, formatClock(event.start))}
              </dd>
            </div>
            <div className="flex items-center gap-2 text-base text-dashboard-text-heavy">
              <dt className="flex shrink-0 text-dashboard-text-light">
                <MapPin aria-hidden className="size-4" />
                <span className="sr-only">{copy.labels.room}</span>
              </dt>
              <dd className="m-0 break-words">
                {event.location ?? scheduleCopy.noLocation}
              </dd>
            </div>
          </dl>
          {event.kind === "hold" && event.needsHacker && (
            <div className="flex flex-col gap-3">
              <p className="m-0 flex items-center gap-1.5 text-base font-semibold text-dashboard-text-warning">
                <TriangleAlert aria-hidden className="size-4 shrink-0" />
                {coffeeChatCopy.sponsorHolds.needsHacker}
              </p>
              {sponsor && event.location && (
                <HoldActions
                  sponsor={sponsor}
                  hold={{ room: event.location, startTime: event.start }}
                />
              )}
            </div>
          )}
        </>
      )}
    </DashboardPanel>
  );
}
