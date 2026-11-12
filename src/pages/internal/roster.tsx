import { InternalNavbar } from "~/components/internals/navbar";
import { JudgeRoster } from "~/components/judging/control/control-judge-roster";
import SEO from "~/components/seo";
import { authRedirectOrganizer } from "~/utils/redirect";

export default function JudgesPage() {
  return (
    <>
      <SEO title="Judges" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-offwhite px-4 pb-12 pt-8 font-figtree sm:px-5">
        <div className="mx-auto max-w-[1100px]">
          <JudgeRoster />
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
