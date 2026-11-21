import { authRedirectOrganizer } from "~/utils/redirect";
import { api } from "~/utils/api";
import CheatTable from "~/components/internals/Table/cheatTable";
import { Button } from "~/components/ui/button";
import Link from "next/link";
import { useRouter } from "next/router";
import { sponsorPresentationsCopy } from "~/content/sponsor-presentations";

const filterCopy = sponsorPresentationsCopy.cheatCheckFilter;

const formatTime = (date: Date) =>
  date.toLocaleString("en-CA", { dateStyle: "medium", timeStyle: "short" });

/**
 * Sweep progress and a manual start. The automatic sweep only starts once
 * every judging stop is done, team_absent or cancelled, so one missed stop
 * nobody scores keeps it from firing; "Run sweep" covers that.
 */
const SweepStatus = () => {
  const utils = api.useUtils();
  const status = api.cheatCheck.getSweepStatus.useQuery(undefined, {
    refetchInterval: (query) =>
      query.state.data?.sweep.status === "running" ? 10_000 : false,
  });
  const refresh = () => void utils.cheatCheck.getSweepStatus.invalidate();
  const start = api.cheatCheck.startSweep.useMutation({ onSettled: refresh });
  const resume = api.cheatCheck.resumeSweep.useMutation({
    onSettled: refresh,
  });

  const data = status.data;
  const sweep = data?.sweep;
  const running = sweep?.status === "running";
  const pausedUntil =
    sweep?.rateLimitedUntil && sweep.rateLimitedUntil > new Date()
      ? sweep.rateLimitedUntil
      : null;

  let line: string;
  if (status.error) {
    line = `Failed to load sweep status: ${status.error.message}`;
  } else if (data === undefined) {
    line = "Loading sweep status...";
  } else if (!sweep) {
    line = "No sweep has run yet.";
  } else {
    const failed = data.items.failed > 0 ? `, ${data.items.failed} failed` : "";
    const progress = `${data.items.done}/${sweep.totalTeams} teams done${failed}`;
    if (running) {
      line = `Sweep running since ${formatTime(sweep.startedAt)}: ${progress}.`;
      if (pausedUntil)
        line += ` Paused for the GitHub rate limit until ${formatTime(pausedUntil)}.`;
      if (data.stalled) line += " Stalled: no progress for a few minutes.";
    } else if (sweep.status === "failed") {
      line = `Last sweep failed${sweep.finishedAt ? ` ${formatTime(sweep.finishedAt)}` : ""}: ${sweep.error ?? "unknown error"}`;
    } else {
      line = `Last sweep finished${sweep.finishedAt ? ` ${formatTime(sweep.finishedAt)}` : ""}: ${progress}.`;
    }
  }

  const note =
    start.error?.message ??
    resume.error?.message ??
    (resume.data && !resume.data.resumed ? resume.data.reason : undefined);

  return (
    <div className="z-10 mb-4 flex w-full max-w-6xl flex-col gap-2 px-4 font-secondary text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="m-0">{line}</p>
        {note && <p className="m-0">{note}</p>}
      </div>
      <div className="flex shrink-0 gap-2">
        {data?.stalled && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => resume.mutate()}
            disabled={resume.isPending}
          >
            {resume.isPending ? "Resuming..." : "Resume sweep"}
          </Button>
        )}
        <Button
          variant="primary"
          size="sm"
          onClick={() => start.mutate()}
          disabled={running || start.isPending}
        >
          {start.isPending ? "Starting..." : "Run sweep"}
        </Button>
      </div>
    </div>
  );
};

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
      <SweepStatus />
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

export const getServerSideProps = authRedirectOrganizer;
