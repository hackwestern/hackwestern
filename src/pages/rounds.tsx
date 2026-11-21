import { RoundBoard } from "~/components/judging/board/round-board";
import SEO from "~/components/seo";

// Public for hackers: which judge sees which team in which round. Judges are
// numbers, and there are no scores. Organizers run the rounds at
// /internal/judging.
export default function RoundsPage() {
  return (
    <>
      <SEO title="Judging rounds" noindex />
      <main className="min-h-dvh bg-dashboard-bg-page px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <RoundBoard />
        </div>
      </main>
    </>
  );
}
