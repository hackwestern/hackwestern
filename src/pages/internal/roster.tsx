import { type GetServerSidePropsContext } from "next";
import { useRouter } from "next/router";
import { useMemo } from "react";
import { useSession } from "next-auth/react";
import { InternalPage } from "~/components/internals/page-shell";
import { JudgeRoster } from "~/components/judging/control/control-judge-roster";
import {
  queueFromProgress,
  useNow,
} from "~/components/judging/control/control-shared";
import { TeamResultsView } from "~/components/judging/control/team-results-view";
import SEO from "~/components/seo";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "~/components/ui/tabs";
import { type TeamResult } from "~/server/api/utils/team-results";
import { loadTeamResults } from "~/server/api/utils/team-results-data";
import { api } from "~/utils/api";
import { authRedirectOrganizer } from "~/utils/redirect";

const TAB =
  "min-h-10 rounded-lg px-4 text-[15px] font-bold text-[#4a5d73] data-[state=active]:bg-[#5b3fa0] data-[state=active]:text-white";
const TABS = ["judges", "teams"] as const;
type Tab = (typeof TABS)[number];

/** Individual judges and teams: who they are, what they've scored, who goes where. */
export default function RosterPage({ results }: { results: TeamResult[] }) {
  const router = useRouter();
  const now = useNow();
  const { data: session } = useSession();
  const progressQ = api.judging.admin.getProgress.useQuery(undefined, {
    refetchInterval: 5000,
  });
  const queue = useMemo(
    () => (progressQ.data ? queueFromProgress(progressQ.data) : undefined),
    [progressQ.data],
  );

  const tab: Tab = TABS.find((t) => t === router.query.tab) ?? "judges";
  const setTab = (next: string) =>
    void router.replace({ query: { ...router.query, tab: next } }, undefined, {
      shallow: true,
    });

  return (
    <>
      <SEO title="Judges and Teams" noindex />
      <InternalPage
        title="Judges and Teams"
        subtitle="Individual judges and teams, and their scores. For the event as a whole, use Judging Controls."
      >
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex flex-col gap-4"
        >
          <TabsList className="h-auto gap-1 rounded-xl border-[#d6dbe5] bg-white p-1">
            <TabsTrigger value="judges" className={TAB}>
              Judges
            </TabsTrigger>
            <TabsTrigger value="teams" className={TAB}>
              Teams ({results.length})
            </TabsTrigger>
          </TabsList>
          <TabsContent value="judges" className="mt-0 flex flex-col gap-5">
            <JudgeRoster
              progress={progressQ.data}
              queue={queue}
              now={now}
              myId={session?.user.id}
            />
          </TabsContent>
          <TabsContent value="teams" className="mt-0">
            <TeamResultsView results={results} />
          </TabsContent>
        </Tabs>
      </InternalPage>
    </>
  );
}

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const guard = await authRedirectOrganizer(context);
  if ("redirect" in guard) return guard;
  return { props: { results: await loadTeamResults() } };
};
