import Link from "next/link";
import { useSession } from "next-auth/react";
import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { ControlAddJudge } from "~/components/judging/control-add-judge";
import { ControlJudges } from "~/components/judging/control-judges";
import { ControlProgress } from "~/components/judging/control-progress";
import { ControlQueue } from "~/components/judging/control-queue";
import { ControlQueueTable } from "~/components/judging/control-queue-table";
import { ControlRanking } from "~/components/judging/control-ranking";
import { MUTED, errorText, useNow } from "~/components/judging/control-shared";
import { ControlSponsorTracks } from "~/components/judging/control-sponsor-tracks";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const POLL_MS = 5000;

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

export default function JudgingControlRoom() {
  const now = useNow();
  const { data: session } = useSession();
  const poll = { refetchInterval: POLL_MS };
  const queueQ = api.judging.admin.getQueue.useQuery(undefined, poll);
  const judgesQ = api.judging.admin.getAllJudges.useQuery(undefined, poll);
  const rankingQ = api.judging.admin.getLatestRanking.useQuery(undefined, poll);

  const queries = [queueQ, judgesQ, rankingQ];
  // The oldest of the three, so the label never claims fresher data than shown.
  const updatedAt = queries.every((q) => q.dataUpdatedAt > 0)
    ? Math.min(...queries.map((q) => q.dataUpdatedAt))
    : 0;
  const failed = queries.find((q) => q.error)?.error;

  return (
    <>
      <SEO title="Judging control room" noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-[#eef1f6] px-4 pb-12 pt-8 font-figtree text-[#0b2238] sm:px-5">
        <div className="mx-auto flex max-w-[1280px] flex-col gap-5">
          <header className="flex flex-wrap items-end justify-between gap-4">
            <div className="flex flex-col gap-1">
              <span className={`text-sm ${MUTED}`}>
                Hack Western 13 · Organizers
              </span>
              <h1 className="m-0 text-[28px] font-bold leading-tight lg:text-[34px]">
                Judging control room
              </h1>
              <span className={`text-[13px] tabular-nums ${MUTED}`}>
                {updatedAt ? `Updated ${ago(now - updatedAt)} ago` : "Loading…"}
              </span>
            </div>
            <Link
              href="/judge"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-[#5b3fa0] px-4 text-[15px] font-bold text-white no-underline hover:bg-[#3f2a75]"
            >
              My judging (phone view)
            </Link>
          </header>

          {failed && (
            <p
              aria-live="polite"
              className="m-0 rounded-xl bg-[#fdecea] px-4 py-3 text-[15px] font-medium text-[#7a1a0f]"
            >
              Couldn&apos;t refresh ({errorText(failed)}). Trying again every
              5 seconds.
            </p>
          )}

          <ControlQueue queue={queueQ.data} />
          <ControlProgress queue={queueQ.data} judges={judgesQ.data} now={now} />

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <ControlJudges
              judges={judgesQ.data}
              queue={queueQ.data}
              now={now}
              myId={session?.user.id}
            />
            <ControlRanking ranking={rankingQ.data} queue={queueQ.data} />
          </div>

          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 lg:items-start">
            <ControlQueueTable queue={queueQ.data} now={now} />
            <div className="flex min-w-0 flex-col gap-5">
              <ControlSponsorTracks />
              <ControlAddJudge />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
