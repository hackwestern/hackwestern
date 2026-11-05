import { InternalNavbar } from "~/components/internals/navbar";
import { RubricBuilder } from "~/components/judging/control/control-judge-rubric";
import SEO from "~/components/seo";
import { authRedirectOrganizer } from "~/utils/redirect";

export default function RubricBuilderPage() {
  return (
    <>
      <SEO title="Rubric builder" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-offwhite px-4 pb-12 pt-8 sm:px-5">
        <div className="mx-auto max-w-[1280px]">
          {/* UI only for now: swap console.log for a tRPC mutation later. */}
          <RubricBuilder onSave={(rubric) => console.log("rubric", rubric)} />
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;