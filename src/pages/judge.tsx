// pages/judge/index.tsx (or wherever the judge page lives)
import { type GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";

import { JudgeApp } from "~/components/judging/judge-app/judge-app";
import SEO from "~/components/seo";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import {
  type JudgeInitialData,
  loadJudgeData,
} from "~/server/api/utils/judge-data";

export default function JudgePage({
  judgeId,
  initial,
}: {
  judgeId: string | null;
  initial: JudgeInitialData | null;
}) {
  if (!judgeId || !initial) {
    return (
      <>
        <SEO title="Judging" noindex />
        <main className="flex min-h-dvh items-center justify-center bg-dashboard-bg-page px-5 font-figtree text-dashboard-text-heavy">
          <section className="flex w-full max-w-md flex-col gap-2 rounded-dashboard-lg border border-dashboard-border-default bg-dashboard-bg-surface p-5">
            <h1 className="m-0 text-2xl font-bold">
              You&apos;re not set up as a judge yet.
            </h1>
            <p className="m-0 text-base font-medium text-dashboard-text-light">
              Ask an organizer.
            </p>
          </section>
        </main>
      </>
    );
  }

  return (
    <>
      <SEO title="Judging" noindex />
      {/* judgeId keeps saved progress separate per judge on a shared phone. */}
      <JudgeApp judgeKey={judgeId} initial={initial} />
    </>
  );
}

/**
 * Signed out: sent to /login and back here afterwards. Signed in: the page gets
 * `judgeId` (the user's id, if they have a row in the `judge` table) or null,
 * so it can show "You're not set up as a judge yet". users.type isn't the
 * check, since organizers and sponsors can judge too. The judging procedures
 * still do the real check on the server.
 */
export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const session = await getServerSession(context.req, context.res, authOptions);

  if (!session) {
    return {
      redirect: {
        destination: `/login?callbackUrl=${encodeURIComponent(context.resolvedUrl)}`,
        permanent: false,
      },
    };
  }

  const judge = await db.query.judges.findFirst({
    where: (judges, { eq }) => eq(judges.id, session.user.id),
    columns: { id: true },
  });

  if (!judge) return { props: { judgeId: null, initial: null } };

  return {
    props: { judgeId: judge.id, initial: await loadJudgeData(judge.id) },
  };
};
