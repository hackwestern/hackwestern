import Link from "next/link";
import { useMemo } from "react";
import SEO from "~/components/seo";
import { InternalPage } from "~/components/internals/page-shell";
import { ControlRoundGrid } from "~/components/judging/control/control-round-grid";
import { ControlRoundsBar } from "~/components/judging/control/control-rounds-bar";
import { ControlProgress } from "~/components/judging/control/control-progress";
import { ControlRounds } from "~/components/judging/control/control-rounds";
import { ControlTablesStatus } from "~/components/judging/control/control-tables-status";
import {
  errorText,
  queueFromProgress,
  useNow,
} from "~/components/judging/control/control-shared";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const POLL_MS = 3000;

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m`;
}

export default function JudgingControlRoom() {
  const now = useNow();
  const poll = { refetchInterval: POLL_MS };
  const progressQ = api.judging.admin.getProgress.useQuery(undefined, poll);
  const queue = useMemo(
    () => (progressQ.data ? queueFromProgress(progressQ.data) : undefined),
    [progressQ.data],
  );
  const judgesQ = api.judging.admin.getAllJudges.useQuery(undefined, poll);
  const roundQ = api.judging.admin.getRound.useQuery(undefined, {
    refetchInterval: 3000,
  });

  const queries = [progressQ, judgesQ];
  // The oldest of the two, so the label never claims fresher data than shown.
  const updatedAt = queries.every((q) => q.dataUpdatedAt > 0)
    ? Math.min(...queries.map((q) => q.dataUpdatedAt))
    : 0;
  const failed = queries.find((q) => q.error)?.error;

  return (
    <>
      <SEO title="Judging control room" noindex />
      <InternalPage
        title="Judging control room"
        subtitle={
          updatedAt ? `Updated ${ago(now - updatedAt)} ago` : "Loading…"
        }
        actions={
          <>
            <Link
              href="/judge"
              className="inline-flex min-h-11 items-center rounded-[10px] bg-[#5b3fa0] px-4 text-[15px] font-bold text-white no-underline hover:bg-[#3f2a75]"
            >
              My judging (phone view)
            </Link>
          </>
        }
      >
        {failed && (
          <p
            aria-live="polite"
            className="m-0 rounded-xl bg-[#fdecea] px-4 py-3 text-[15px] font-medium text-[#7a1a0f]"
          >
            Couldn&apos;t refresh ({errorText(failed)}). Trying again every 5
            seconds.
          </p>
        )}

        <ControlProgress
          queue={queue}
          judges={judgesQ.data}
          round={roundQ.data}
          now={now}
        />

        <ControlRoundsBar now={now} />
        <ControlTablesStatus
          progress={progressQ.data}
          queue={queue}
          now={now}
        />
        <ControlRoundGrid progress={progressQ.data} round={roundQ.data} />
        <ControlRounds
          queue={queue}
          progress={progressQ.data}
          timed={roundQ.data}
        />
      </InternalPage>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
