import { Clock, MapPin } from "lucide-react";
import { useSession } from "next-auth/react";
import { DashboardButton } from "~/components/internals/dashboard-button";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import {
  isPCBWay,
  pcbWayJudgingCopy,
  sponsorSlotInstructions,
} from "~/content/sponsor-presentations";
import { QNX_JUDGING_ROOM } from "~/lib/sponsor-prize-tracks";
import { formatPresentationRange } from "~/lib/sponsor-presentations";
import { api } from "~/utils/api";

export default function SponsorJudging() {
  const { data: session } = useSession();
  const signedIn = Boolean(session?.user.id);
  const presentations = api.sponsorPresentations.mine.useQuery(undefined, {
    enabled: signedIn,
    refetchInterval: 30_000,
  });

  return (
    <section
      aria-label="Sponsor Judging"
      className="flex max-w-2xl flex-col gap-4 font-figtree"
    >
      <DashboardPanel className="items-start gap-3">
        <h2 className="m-0 text-lg font-semibold text-dashboard-text-heavy">
          QNX Track
        </h2>
        <dl className="m-0 flex flex-wrap gap-x-5 gap-y-2 text-sm text-dashboard-text-medium">
          <div className="flex gap-1.5">
            <dt className="font-semibold">Location</dt>
            <dd className="m-0">{QNX_JUDGING_ROOM}</dd>
          </div>
          <div className="flex gap-1.5">
            <dt className="font-semibold">Judging</dt>
            <dd className="m-0">Sunday, 9:45–11:00 a.m.</dd>
          </div>
        </dl>
        <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-dashboard-text-medium">
          <li>
            Only projects that use QNX hardware are eligible. An organizer will
            check your hardware at the door.
          </li>
          <li>
            If your project uses QNX hardware, you’re welcome to join. There’s
            no shortlist.
          </li>
          <li>
            Have your hardware set up, powered on, and ready to demo in{" "}
            {QNX_JUDGING_ROOM}.
          </li>
          <li>
            There are no individual time slots. Judges will come to you, so stay
            at your station for the full judging window.
          </li>
        </ul>
      </DashboardPanel>
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
                    <h2 className="m-0 text-lg font-semibold text-dashboard-text-heavy">
                      {pcbWay ? pcbWayJudgingCopy.heading : sponsorName}
                    </h2>
                    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-dashboard-text-medium">
                      <span className="inline-flex items-center gap-2">
                        <Clock aria-hidden className="size-4" />
                        Sunday,{" "}
                        {pcbWay
                          ? pcbWayJudgingCopy.window
                          : formatPresentationRange(start)}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <MapPin aria-hidden className="size-4" />
                        {room}
                      </span>
                    </div>
                    <ul className="m-0 list-disc space-y-1 pl-5 text-sm text-dashboard-text-medium">
                      {(pcbWay
                        ? [
                            pcbWayJudgingCopy.setup(room),
                            pcbWayJudgingCopy.stay,
                          ]
                        : sponsorSlotInstructions
                      ).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
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
