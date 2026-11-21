import Link from "next/link";
import { useMemo } from "react";
import SEO from "~/components/seo";
import { InternalPage } from "~/components/internals/page-shell";
import { ControlProgress } from "~/components/judging/control/control-progress";
import { ControlRounds } from "~/components/judging/control/control-rounds";
import { ControlQueue } from "~/components/judging/control/control-queue";
import { ControlTablesStatus } from "~/components/judging/control/control-tables-status";
import { ControlQueueTable } from "~/components/judging/control/control-queue-table";
import {
  errorText,
  queueFromProgress,
  useNow,
} from "~/components/judging/control/control-shared";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const POLL_MS = 5000;

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
              href="/internal/roster"
              className="inline-flex min-h-11 items-center rounded-[10px] border border-[#5b3fa0] px-4 text-[15px] font-bold text-[#5b3fa0] no-underline hover:bg-white"
            >
              Judges &amp; teams
            </Link>
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

        <ControlQueue queue={queue} />
        <ControlProgress queue={queue} judges={judgesQ.data} now={now} />

        <ControlTablesStatus progress={progressQ.data} now={now} />
        <ControlQueueTable queue={queue} now={now} />
        <ControlRounds queue={queue} />
      </InternalPage>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
