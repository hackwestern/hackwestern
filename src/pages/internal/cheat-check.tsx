import { disabledRedirect } from "~/utils/redirect";
import { api } from "~/utils/api";
import CheatTable from "~/components/internals/Table/cheatTable";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/router";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";

const filterCopy = sponsorPresentationsCopy.cheatCheckFilter;

const CheatCheck = () => {
  const { data: teams, error } = api.cheatCheck.getDisplayTeams.useQuery();
  // ?teams=a,b,c: only those teams (the sponsor top teams, linked from the
  // organizer Sponsor judging tab).
  const router = useRouter();
  const param =
    typeof router.query.teams === "string" ? router.query.teams : "";
  const only = param ? new Set(param.split(",").filter(Boolean)) : null;
  const shown = teams && only ? teams.filter((t) => only.has(t.teamId)) : teams;

  return (
    <div className="bg-hw-linear-gradient-day flex min-h-screen flex-col items-center bg-primary-100 py-4">
      <div className="z-10 mb-4 flex w-full max-w-6xl items-center justify-between px-4">
        <h1 className="text-3xl">Cheat Checks</h1>
        <Button asChild variant="primary">
          <Link href="/internal/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
      {only && shown && (
        <p className="z-10 m-0 mb-2 w-full max-w-6xl px-4 font-secondary text-sm">
          {filterCopy.showing(shown.length)}{" "}
          {shown.length < only.size &&
            filterCopy.missing(only.size - shown.length)}{" "}
          <Link href="/internal/cheat-check" className="underline">
            {filterCopy.showAll}
          </Link>
        </p>
      )}
      <div className="z-10 w-full max-w-6xl px-4 font-secondary text-medium">
        {error ? (
          <h2>Failed to load checks: {error.message}</h2>
        ) : shown ? (
          <CheatTable final_data={shown} />
        ) : (
          <h2>Loading...</h2>
        )}
      </div>
    </div>
  );
};

export default CheatCheck;

export const getServerSideProps = disabledRedirect;
