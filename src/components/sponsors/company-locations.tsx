import { Building2, Coffee, MapPin } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { scheduleCopy } from "~/content/sponsor-schedule";
import {
  compareRunOfShow,
  formatClock,
  type CompanyLocation,
  type CompanyLocations,
  type RunOfShowDay,
  type RunOfShowItem,
} from "~/lib/run-of-show";
import { isHappeningNow, runOfShowInstant } from "~/lib/run-of-show-time";

const copy = scheduleCopy.where;

function timeRange(item: Pick<RunOfShowItem, "start" | "end">) {
  const end = item.end === "24:00" ? "00:00" : item.end;
  return `${formatClock(item.start)} – ${formatClock(end)}`;
}

/** Coffee chats as a schedule-like block, when the sponsor is set up. */
function coffeeChatBlock(company: CompanyLocation) {
  const cc = company.coffeeChat;
  if (!cc?.windowStart || !cc.windowEnd) return null;
  return {
    day: "Saturday" as const,
    start: cc.windowStart,
    end: cc.windowEnd,
    title: copy.coffeeChats,
    location: cc.room ?? scheduleCopy.coffeeChat.roomTbd,
  };
}

/** Where a company is at `now`: a live item, coffee chats, or the Sponsor Bay. */
export function whereNow(
  company: CompanyLocation,
  sponsorBay: readonly RunOfShowItem[],
  now: Date,
): string | null {
  const live = company.items.find((i) => isHappeningNow(i, now));
  if (live) return `${live.title}${live.location ? `, ${live.location}` : ""}`;
  const cc = coffeeChatBlock(company);
  if (cc && isHappeningNow(cc, now)) return `${cc.title}, ${cc.location}`;
  const bay = sponsorBay.find((i) => isHappeningNow(i, now));
  if (bay) return `${copy.sponsorBay}${bay.location ? `, ${bay.location}` : ""}`;
  return null;
}

export function CompanyLocationsView({
  data,
  day,
  now,
}: {
  data: CompanyLocations;
  day: RunOfShowDay;
  now: Date;
}) {
  const eventStarted = now >= runOfShowInstant("Friday", "16:00");
  const nowRows = eventStarted
    ? data.companies
        .map((c) => ({ name: c.name, place: whereNow(c, data.sponsorBay, now) }))
        .filter((r): r is { name: string; place: string } => r.place !== null)
    : [];
  const bayToday = data.sponsorBay.filter((i) => i.day === day);

  return (
    <div className="flex flex-col gap-4">
      {nowRows.length > 0 && (
        <DashboardPanel title={copy.rightNow}>
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {nowRows.map((r) => (
              <li
                key={r.name}
                className="flex flex-col gap-0.5 border-b border-dashboard-bg-nav pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-baseline sm:justify-between sm:gap-3"
              >
                <span className="font-semibold">{r.name}</span>
                <span className="text-sm text-dashboard-text-medium">
                  {r.place}
                </span>
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )}

      {bayToday.length > 0 && (
        <DashboardPanel>
          <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-dashboard-text-light">
            <Building2 aria-hidden className="size-4" strokeWidth={1.67} />
            {copy.sponsorBay}
          </span>
          <p className="m-0 text-sm text-dashboard-text-medium">
            {copy.sponsorBayHours}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {bayToday.sort(compareRunOfShow).map((i) => (
              <li key={i.id} className="flex flex-wrap gap-x-2 text-base">
                <span className="font-semibold">{timeRange(i)}</span>
                {i.location && (
                  <span className="text-dashboard-text-medium">{i.location}</span>
                )}
              </li>
            ))}
          </ul>
        </DashboardPanel>
      )}

      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 sm:grid-cols-2">
        {data.companies.map((company) => {
          const items = company.items
            .filter((i) => i.day === day)
            .sort(compareRunOfShow);
          const cc = day === "Saturday" ? coffeeChatBlock(company) : null;
          return (
            <li
              key={company.name}
              className="flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card"
            >
              <div className="flex items-center justify-between gap-2">
                <h2 className="m-0 text-lg font-semibold">{company.name}</h2>
              </div>
              {items.length === 0 && !cc ? (
                <p className="m-0 text-sm text-dashboard-text-light">
                  {copy.nothingListed}
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
                  {cc && (
                    <Stop
                      icon={<Coffee aria-hidden className="size-4" />}
                      when={timeRange(cc)}
                      title={cc.title}
                      where={cc.location}
                      live={isHappeningNow(cc, now)}
                    />
                  )}
                  {items.map((i) => (
                    <Stop
                      key={i.id}
                      icon={<MapPin aria-hidden className="size-4" />}
                      when={timeRange(i)}
                      title={i.title}
                      where={i.location ?? scheduleCopy.noLocation}
                      live={isHappeningNow(i, now)}
                    />
                  ))}
                </ul>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Stop({
  icon,
  when,
  title,
  where,
  live,
}: {
  icon: React.ReactNode;
  when: string;
  title: string;
  where: string;
  live: boolean;
}) {
  return (
    <li className="flex gap-2.5" aria-current={live ? "time" : undefined}>
      <span className="mt-0.5 flex shrink-0 text-dashboard-text-light">{icon}</span>
      <div className="flex min-w-0 flex-col">
        <span className="flex flex-wrap items-center gap-1.5 text-sm text-dashboard-text-medium">
          {when}
          {live && (
            <DashboardTag className="bg-dashboard-action-primary text-dashboard-text-inverse">
              {scheduleCopy.now}
            </DashboardTag>
          )}
        </span>
        <span className="break-words font-semibold">{title}</span>
        <span className="break-words text-sm text-dashboard-text-medium">{where}</span>
      </div>
    </li>
  );
}
