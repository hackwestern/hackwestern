import { disabledRedirect } from "~/utils/redirect";
import { api } from "~/utils/api";
import CheatTable from "~/components/internals/Table/cheatTable";
import { Button } from "~/components/ui/button";
import Link from "next/link";

const CheatCheck = () => {
  const { data: teams, error } = api.cheatCheck.getDisplayTeams.useQuery();

  return (
    <div className="bg-hw-linear-gradient-day flex min-h-screen flex-col items-center bg-primary-100 py-4">
      <div className="z-10 mb-4 flex w-full max-w-6xl items-center justify-between px-4">
        <h1 className="text-3xl">Cheat Checks</h1>
        <Button asChild variant="primary">
          <Link href="/internal/dashboard">Back to Dashboard</Link>
        </Button>
      </div>
      <div className="z-10 w-full max-w-6xl px-4 font-secondary text-medium">
        {error ? (
          <h2>Failed to load checks: {error.message}</h2>
        ) : teams ? (
          <CheatTable final_data={teams} />
        ) : (
          <h2>Loading...</h2>
        )}
      </div>
    </div>
  );
};

export default CheatCheck;

export const getServerSideProps = disabledRedirect;
