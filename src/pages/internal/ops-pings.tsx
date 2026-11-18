import SEO from "~/components/seo";
import { InternalNavbar } from "~/components/internals/navbar";
import { OpsPingsView } from "~/components/ops-pings/ops-pings-view";
import { PageIntro } from "~/components/sponsors/schedule-states";
import { opsPingsCopy } from "~/content/ops-pings";
import { authRedirectOrganizer } from "~/utils/redirect";

const copy = opsPingsCopy.page;

// Organizer-only: every task in the organizer run of show, its owners'
// Slack matches, and the start/end DMs (src/server/api/utils/ops-pings.ts).
export default function OpsPingsPage() {
  return (
    <>
      <SEO title={copy.title} noindex />
      <InternalNavbar />
      <div className="min-h-screen bg-dashboard-bg-page px-4 pb-12 pt-6 font-figtree font-medium leading-default text-dashboard-text-heavy sm:px-5">
        <div className="mx-auto flex w-full max-w-[1100px] flex-col gap-5">
          <PageIntro eyebrow={copy.eyebrow} title={copy.heading} intro={copy.intro} />
          <OpsPingsView />
        </div>
      </div>
    </>
  );
}

export const getServerSideProps = authRedirectOrganizer;
