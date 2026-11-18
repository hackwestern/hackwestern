import { useMemo, useState } from "react";
import { DashboardChip } from "~/components/internals/dashboard-chip";
import { DashboardTag } from "~/components/internals/dashboard-tag";
import { HackerAvatar } from "~/components/sponsors/hacker-avatar";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { formatSubmittedTime } from "~/lib/sponsor-scoring";
import { cn } from "~/lib/utils";
import { type RouterOutputs } from "~/utils/api";

const copy = sponsorPresentationsCopy.organizer;
const hcopy = copy.hackers;
type Overview = RouterOutputs["sponsorPresentations"]["overview"];
type Hacker = Overview["notices"]["hackers"][number];
type Status = Hacker["status"];

const CARD =
  "flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-4 shadow-dashboard-card";

/** Pill colours, as on the coffee chat bookings board. */
const PILL: Record<Status, string> = {
  sent: "bg-dashboard-bg-highlight text-dashboard-text-active",
  emailed: "bg-dashboard-bg-highlight text-dashboard-text-active",
  "not-on-slack": "bg-dashboard-status-iconBadge text-dashboard-text-warning",
  failed: "bg-dashboard-status-iconBadge text-dashboard-text-warning",
  "not-sent": "bg-dashboard-bg-inset",
};

const reached = (h: Hacker) => h.status === "sent" || h.status === "emailed";

/**
 * Every scheduled hacker, grouped by team: the team's presentation slots
 * (time, sponsor, room) and each member's avatar, name and how they heard
 * (Slack sent / emailed, with the time, or why not). Filter by room, or
 * to "Not reached" for retries.
 */
export function PresentationHackers({ data }: { data: Overview }) {
  const [onlyNotReached, setOnlyNotReached] = useState(false);
  const [sponsor, setSponsor] = useState("all");
  const { hackers } = data.notices;

  const rooms = useMemo(() => {
    const by = new Map<string, string>();
    for (const s of data.slots) {
      by.set(s.sponsorId, copy.roomOf(s.sponsorName, s.room));
    }
    return [...by].sort((a, b) => a[1].localeCompare(b[1]));
  }, [data.slots]);

  const teams = useMemo(() => {
    const slotsOf = new Map<string, Overview["slots"]>();
    for (const s of data.slots) {
      const list = slotsOf.get(s.teamId) ?? [];
      list.push(s);
      slotsOf.set(s.teamId, list);
    }
    const membersOf = new Map<string, Hacker[]>();
    for (const h of hackers) {
      const list = membersOf.get(h.teamId) ?? [];
      list.push(h);
      membersOf.set(h.teamId, list);
    }
    return [...slotsOf]
      .filter(
        ([, slots]) =>
          sponsor === "all" || slots.some((s) => s.sponsorId === sponsor),
      )
      .map(([teamId, slots]) => ({
        teamId,
        teamName: slots[0]!.teamName,
        slots: [...slots].sort((a, b) => a.start - b.start),
        members: (membersOf.get(teamId) ?? []).filter(
          (h) => !onlyNotReached || !reached(h),
        ),
      }))
      .filter((t) => !onlyNotReached || t.members.length > 0)
      .sort((a, b) => a.teamName.localeCompare(b.teamName));
  }, [data.slots, hackers, sponsor, onlyNotReached]);

  const notReachedCount = hackers.filter((h) => !reached(h)).length;
  const shown = teams.reduce((n, t) => n + t.members.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div
          role="group"
          aria-label={hcopy.filterLabel}
          className="flex flex-wrap gap-1.5"
        >
          <DashboardChip
            selected={!onlyNotReached}
            onClick={() => setOnlyNotReached(false)}
            className="min-h-11 md:min-h-9"
          >
            {hcopy.all}
          </DashboardChip>
          <DashboardChip
            selected={onlyNotReached}
            onClick={() => setOnlyNotReached(true)}
            className="min-h-11 md:min-h-9"
          >
            {hcopy.notReached(notReachedCount)}
          </DashboardChip>
        </div>
        <label className="inline-flex items-center gap-2 text-sm font-semibold text-dashboard-text-medium">
          {hcopy.sponsorLabel}
          <select
            value={sponsor}
            onChange={(e) => setSponsor(e.target.value)}
            className="min-h-11 max-w-[16rem] rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-2 text-base font-semibold text-dashboard-text-heavy focus:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary md:min-h-9 md:text-sm"
          >
            <option value="all">{hcopy.allSponsors}</option>
            {rooms.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p
        className="m-0 text-sm font-medium text-dashboard-text-light"
        aria-live="polite"
      >
        {hcopy.count(shown, hackers.length)}
      </p>

      {teams.length === 0 ? (
        <p className="m-0 rounded-dashboard-lg bg-dashboard-bg-inset p-5 text-center text-sm font-medium text-dashboard-text-medium">
          {hcopy.none}
        </p>
      ) : (
        <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((t) => (
            <li key={t.teamId} className={CARD}>
              <h3 className="m-0 break-words text-sm font-semibold text-dashboard-text-heavy">
                {t.teamName}
              </h3>
              <ol className="m-0 flex list-none flex-col gap-0.5 p-0">
                {t.slots.map((s) => (
                  <li
                    key={s.sponsorId}
                    className={cn(
                      "flex items-baseline gap-3 text-sm",
                      sponsor !== "all" &&
                        s.sponsorId !== sponsor &&
                        "text-dashboard-text-light",
                    )}
                  >
                    <span className="w-16 shrink-0 font-semibold tabular-nums text-dashboard-text-medium">
                      {formatPresentationTime(s.start)}
                    </span>
                    <span className="min-w-0 break-words font-medium">
                      {copy.roomOf(s.sponsorName, s.room)}
                    </span>
                  </li>
                ))}
              </ol>
              {t.members.length === 0 ? (
                <p className="m-0 text-sm font-medium text-dashboard-text-light">
                  {hcopy.noMembers}
                </p>
              ) : (
                <ul className="m-0 flex list-none flex-col divide-y divide-dashboard-border-subtle border-t border-dashboard-border-subtle p-0">
                  {t.members.map((h) => (
                    <li
                      key={h.userId}
                      className="flex items-center gap-2.5 py-2"
                    >
                      <HackerAvatar name={h.name} github={h.github} size="sm" />
                      <span className="min-w-0 flex-1 break-words text-sm font-semibold text-dashboard-text-heavy">
                        {h.name}
                      </span>
                      <DashboardTag className={cn("shrink-0", PILL[h.status])}>
                        {h.sentAt
                          ? hcopy.statusAt(
                              hcopy.status[h.status],
                              formatSubmittedTime(h.sentAt),
                            )
                          : hcopy.status[h.status]}
                      </DashboardTag>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
