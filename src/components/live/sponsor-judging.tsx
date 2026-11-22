import { Clock, MapPin } from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import {
  isPCBWay,
  pcbWayAfterScheduledJudging,
  pcbWayJudgingCopy,
  sponsorSlotInstructions,
} from "~/content/sponsor-presentations";
import { QNX_JUDGING_ROOM } from "~/lib/sponsor-prize-tracks";
import { formatPresentationRange } from "~/lib/sponsor-presentations";
import { api } from "~/utils/api";

const instructions =
  "m-0 list-disc space-y-1.5 pl-5 text-sm leading-relaxed text-dashboard-text-medium";

function QnxTrack() {
  return (
    <DashboardPanel className="gap-4 p-5">
      <div>
        <h2 className="m-0 text-lg font-semibold text-dashboard-text-heavy">
          QNX Track
        </h2>
        <p className="mb-0 mt-1 text-sm text-dashboard-text-medium">
          Open to eligible projects, with no shortlist.
        </p>
      </div>
      <dl className="m-0 grid grid-cols-2 gap-3 rounded-dashboard-md bg-dashboard-bg-page p-3">
        <div>
          <dt className="text-xs font-medium text-dashboard-text-medium">
            Room
          </dt>
          <dd className="m-0 mt-0.5 font-semibold text-dashboard-text-heavy">
            {QNX_JUDGING_ROOM}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-dashboard-text-medium">
            Sunday
          </dt>
          <dd className="m-0 mt-0.5 font-semibold tabular-nums text-dashboard-text-heavy">
            9:45–11:00 a.m.
          </dd>
        </div>
      </dl>
      <p className="m-0 rounded-dashboard-md bg-dashboard-bg-highlight p-3 text-sm leading-relaxed text-dashboard-text-heavy">
        <strong>QNX hardware required.</strong> An organizer will check your
        hardware at the door.
      </p>
      <ul className={instructions}>
        <li>Have your hardware set up, powered on, and ready to demo.</li>
        <li>
          Judges will come to your station. Stay there for the full judging
          window. There are no individual time slots.
        </li>
      </ul>
    </DashboardPanel>
  );
}

export default function SponsorJudging() {
  const { data: session } = useSession();
  const presentations = api.sponsorPresentations.mySchedule.useQuery(
    undefined,
    {
      enabled: Boolean(session?.user.id),
      refetchInterval: 30_000,
    },
  );
  const slots = presentations.data?.slots ?? [];
  const scheduled = slots.filter((slot) => !isPCBWay(slot.sponsorName));
  const pcbWay = slots.find((slot) => isPCBWay(slot.sponsorName));
  const pcbWayAfterSlots = pcbWayAfterScheduledJudging(slots);
  const showPcbWayOrder =
    pcbWayAfterSlots && presentations.data?.hasQnxTrack === false;

  return (
    <div className="grid w-full max-w-6xl items-start gap-6 font-figtree xl:grid-cols-[minmax(0,1fr)_minmax(19rem,0.55fr)]">
      <section
        aria-labelledby="hacker-judging-schedule"
        className="flex min-w-0 flex-col gap-4"
      >
        <h2
          id="hacker-judging-schedule"
          className="m-0 text-xl font-semibold text-dashboard-text-heavy"
        >
          Your judging schedule
        </h2>
        {presentations.isError && !presentations.data ? (
          <DashboardPanel className="items-start p-5">
            <p role="alert" className="m-0 text-dashboard-text-warning">
              Couldn’t load your team’s sponsor judging schedule.
            </p>
            <DashboardButton
              variant="outline"
              onClick={() => void presentations.refetch()}
            >
              Try again
            </DashboardButton>
          </DashboardPanel>
        ) : !presentations.data ? (
          <p role="status" className="m-0 text-dashboard-text-medium">
            Loading your team’s schedule…
          </p>
        ) : slots.length === 0 ? (
          <DashboardPanel className="p-5">
            <p
              role="status"
              className="m-0 text-sm leading-relaxed text-dashboard-text-medium"
            >
              No sponsor presentations are listed for your team yet. Confirmed
              times and rooms appear here when organizers open Round 2.
            </p>
          </DashboardPanel>
        ) : (
          <>
            {showPcbWayOrder && (
              <div className="rounded-dashboard-lg border-l-4 border-dashboard-action-primary bg-dashboard-bg-highlight p-4">
                <h3 className="m-0 text-sm font-semibold text-dashboard-text-heavy">
                  Scheduled presentations first, PCBWay after
                </h3>
                <p className="mb-0 mt-1 text-sm leading-relaxed text-dashboard-text-medium">
                  {pcbWayJudgingCopy.afterScheduledJudging}
                </p>
              </div>
            )}
            {scheduled.length > 0 && (
              <DashboardPanel className="gap-4 p-5 sm:p-6">
                <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">
                  Sunday appointments
                </h3>
                <ol className="m-0 list-none divide-y divide-dashboard-border-subtle overflow-hidden rounded-dashboard-md border border-dashboard-border-subtle p-0">
                  {scheduled.map(({ sponsorName, room, start }) => (
                    <li
                      key={`${sponsorName}-${start}`}
                      className="grid gap-2 p-3 sm:grid-cols-[max-content_minmax(0,1fr)_max-content] sm:items-center sm:gap-4"
                    >
                      <div className="flex items-center gap-2 whitespace-nowrap text-sm font-semibold tabular-nums text-dashboard-text-active">
                        <Clock aria-hidden className="size-4 shrink-0" />
                        {formatPresentationRange(start)}
                      </div>
                      <span className="break-words font-semibold text-dashboard-text-heavy">
                        {sponsorName}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm font-medium text-dashboard-text-medium">
                        <MapPin aria-hidden className="size-4 shrink-0" />
                        {room}
                      </span>
                    </li>
                  ))}
                </ol>
                <div>
                  <h4 className="mb-2 mt-0 text-sm font-semibold text-dashboard-text-heavy">
                    Before your appointments
                  </h4>
                  <ul className={instructions}>
                    {sponsorSlotInstructions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </DashboardPanel>
            )}
            {pcbWay && (
              <DashboardPanel className="gap-4 p-5 sm:p-6">
                <div>
                  <h3 className="m-0 text-base font-semibold text-dashboard-text-heavy">
                    {pcbWayJudgingCopy.heading}
                  </h3>
                  <p className="mb-0 mt-1 text-sm text-dashboard-text-medium">
                    Station judging
                  </p>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 rounded-dashboard-md bg-dashboard-bg-page p-3 text-sm font-semibold text-dashboard-text-heavy">
                  <span className="inline-flex items-center gap-2">
                    <Clock aria-hidden className="size-4 shrink-0" />
                    Sunday, {pcbWayJudgingCopy.window}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <MapPin aria-hidden className="size-4 shrink-0" />
                    {pcbWay.room}
                  </span>
                </div>
                <ul className={instructions}>
                  <li>{pcbWayJudgingCopy.setup(pcbWay.room)}</li>
                  {!pcbWayAfterSlots && <li>{pcbWayJudgingCopy.stay}</li>}
                </ul>
              </DashboardPanel>
            )}
          </>
        )}
      </section>
      <QnxTrack />
    </div>
  );
}
