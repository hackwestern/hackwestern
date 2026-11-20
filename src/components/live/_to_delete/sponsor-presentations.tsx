import { useSession } from "next-auth/react";
import { Presentation } from "lucide-react";
import { DashboardPanel } from "~/components/internals/dashboard-panel";
import { ConfirmTimesButton } from "~/components/live/confirm-times-button";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";
import { formatPresentationTime } from "~/lib/sponsor-presentations";
import { api } from "~/utils/api";

const copy = sponsorPresentationsCopy.live;

// The hacker's Sunday sponsor presentations on the /live home tab: one line
// per room and time, the same as their Slack DM. Hidden until organizers
// notify the team (sponsorPresentations.mine).
export default function SponsorPresentations() {
  const { data: session } = useSession();
  const q = api.sponsorPresentations.mine.useQuery(undefined, {
    enabled: !!session?.user?.id,
    refetchInterval: 60_000,
  });
  const confirmation = api.sponsorPresentations.myConfirmation.useQuery(
    undefined,
    { enabled: !!session?.user?.id, refetchInterval: 60_000 },
  );
  if (!q.data || q.data.length === 0) return null;

  return (
    <DashboardPanel className="gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="m-0 flex items-center gap-2 text-base font-semibold text-dashboard-text-heavy">
          <Presentation
            aria-hidden
            className="size-5 text-dashboard-action-primary"
          />
          {copy.heading}
        </h2>
        <p className="m-0 text-sm text-dashboard-text-medium">{copy.intro}</p>
      </div>
      <ol className="m-0 flex list-none flex-col gap-1 p-0">
        {q.data.map((s) => (
          <li
            key={`${s.start}-${s.sponsorName}`}
            className="text-base font-medium tabular-nums text-dashboard-text-heavy"
          >
            {copy.slot(formatPresentationTime(s.start), s.sponsorName, s.room)}
          </li>
        ))}
      </ol>
      {confirmation.data && (
        <ConfirmTimesButton
          confirmed={confirmation.data.confirmedAt !== null}
        />
      )}
    </DashboardPanel>
  );
}
