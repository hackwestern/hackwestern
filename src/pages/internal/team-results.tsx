// Put this next to your judges page (same folder) so it lives with the other
// organizer pages; the URL follows the file name, e.g. pages/control/team-results.tsx.
import { type GetServerSidePropsContext } from "next";

import { InternalNavbar } from "~/components/internals/navbar";
import { TeamResultsView } from "~/components/judging/control/team-results-view";
import SEO from "~/components/seo";
import { type TeamResult } from "~/server/api/utils/team-results";
import { loadTeamResults } from "~/server/api/utils/team-results-data";
import { authRedirectOrganizer } from "~/utils/redirect";

export default function TeamResultsPage({
  results,
}: {
  results: TeamResult[];
}) {
  return (
    <>
      <SEO title="Team results" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-offwhite px-4 pb-12 pt-8 font-figtree sm:px-5">
        <div className="mx-auto max-w-[900px]">
          <TeamResultsView results={results} />
        </div>
      </main>
    </>
  );
}

/**
 * Organizers only: the same guard as the judges page runs first, then the
 * results load straight from the database.
 */
export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const guard = await authRedirectOrganizer(context);
  if ("redirect" in guard) return guard;
  return { props: { results: await loadTeamResults() } };
};
