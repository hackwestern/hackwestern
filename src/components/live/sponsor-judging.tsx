import { Clock, MapPin } from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { isPCBWay, pcbWayJudgingCopy } from "~/content/sponsor-presentations";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { api } from "~/utils/api";

export default function SponsorJudging() {
  const { data: session } = useSession();
  const presentations = api.sponsorPresentations.mine.useQuery(undefined, {
    enabled: Boolean(session?.user.id),
    refetchInterval: 30_000,
  });

  return (
    <section
      aria-labelledby="sponsor-judging-heading"
      className="flex max-w-2xl flex-col gap-4 font-figtree"
    >
      <h2
        id="sponsor-judging-heading"
        className="m-0 text-xl font-semibold text-dashboard-text-heavy"
      >
        Sponsor judging
      </h2>
      {presentations.isError ? (
        <DashboardPanel className="items-start">
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
      ) : presentations.data.length === 0 ? (
        <DashboardPanel className="items-start">
          <p role="status" className="m-0 text-dashboard-text-medium">
            Your team has no scheduled sponsor presentations to show yet.
            Presentations with a time and room appear when organizers open Round
            2.
          </p>
        </DashboardPanel>
      ) : (
        <>
          <p className="m-0 text-dashboard-text-medium">
            Your team was selected to present to these sponsors.
          </p>
          <ul className="m-0 flex list-none flex-col gap-3 p-0">
            {presentations.data.map(({ sponsorName, room, start }) => {
              const pcbWay = isPCBWay(sponsorName);
              return (
                <li key={`${sponsorName}-${start}`}>
                  <DashboardPanel className="items-start gap-3">
                    <h3 className="m-0 text-lg font-semibold text-dashboard-text-heavy">
                      {pcbWay ? pcbWayJudgingCopy.heading : sponsorName}
                    </h3>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-dashboard-text-medium">
                      <span className="inline-flex items-center gap-2">
                        <Clock aria-hidden className="size-4" />
                        Sunday,{" "}
                        {pcbWay
                          ? pcbWayJudgingCopy.window
                          : formatPresentationTime(start)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapPin aria-hidden className="size-4" />
                        {room}
                      </span>
                    </div>
                    {pcbWay && (
                      <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-dashboard-text-medium">
                        <li>{pcbWayJudgingCopy.setup(room)}</li>
                        <li>{pcbWayJudgingCopy.stay}</li>
                      </ul>
                    )}
                  </DashboardPanel>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </section>
  );
}
