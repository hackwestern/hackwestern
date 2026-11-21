import { RoundBoard } from "~/components/judging/board/round-board";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";
import SEO from "~/components/seo";
import { liveServerSideProps } from "~/lib/live-page";

// Which judge sees which team in which round, for hackers. Judges are numbers
// and there are no scores. Organizers run the rounds at /internal/judging and
// switch this on for hackers with the eye button in the menu.
export default function RoundsPage({ isOrganizer }: { isOrganizer: boolean }) {
  return (
    <>
      <SEO title="Judging Rounds" noindex />
      <div className="flex h-screen w-screen flex-col bg-dashboard-bg-page font-figtree md:flex-row">
        <Topbar title="Judging Rounds" isOrganizer={isOrganizer} />
        <Sidebar isOrganizer={isOrganizer} />
        <main className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto p-5 md:gap-10 md:p-12">
          <div className="hidden items-start justify-between gap-4 md:flex">
            <h1 className="dashboard-h1">Judging Rounds</h1>
          </div>
          <RoundBoard isOrganizer={isOrganizer} />
        </main>
      </div>
    </>
  );
}

export const getServerSideProps = liveServerSideProps;
