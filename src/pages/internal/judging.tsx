import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { authRedirectOrganizer } from "~/utils/redirect";

// Placeholder: the old control room was removed with the judging queue
// (#1155). The new organizer judging UI will live here.
export default function Judging() {
  return (
    <>
      <SEO title="Judging" noindex />
      <InternalNavbar />
      <main className="min-h-screen bg-[#eef1f6] px-4 pb-12 pt-8 font-figtree text-[#0b2238]">
        <div className="mx-auto flex max-w-[800px] flex-col gap-2">
          <h1 className="m-0 text-[28px] font-bold">Judging</h1>
          <p className="m-0 text-slate-600">
            Organizer judging controls are coming soon.
          </p>
        </div>
      </main>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
