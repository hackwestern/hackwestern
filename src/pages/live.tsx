import { type GetServerSidePropsContext } from "next";
import { getServerSession } from "next-auth";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import SEO from "~/components/seo";
import Home from "~/components/live/home";
import Schedule from "~/components/live/schedule";
import MapTab from "~/components/live/map";
import FoodMenu from "~/components/live/food-menu";
import Mentors from "~/components/live/mentors";
import Sponsors from "~/components/live/sponsors";
import EventLogistics from "~/components/live/event-logistics";
import ContactUs from "~/components/live/contact-us";
import Activities from "~/components/live/activities";
import Rewards from "~/components/live/rewards";
import CoffeeChats from "~/components/live/coffee-chats";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { formatTitle } from "~/utils/format";
import { SCHEDULE_ENABLED } from "~/constants/live";
import { liveAccessRedirect } from "~/lib/live-access";

const Live = ({ isOrganizer }: { isOrganizer: boolean }) => {
  const searchParams = useSearchParams();
  const requestedTab = searchParams.get("tab") ?? "home";
  // Direct links to a disabled tab, or to an organizer-only tab, land on Home
  const tab =
    (requestedTab === "schedule" && !SCHEDULE_ENABLED) ||
    ((requestedTab === "activities" || requestedTab === "rewards") &&
      !isOrganizer)
      ? "home"
      : requestedTab;
  const { data: session } = useSession();

  const firstName = session?.user?.name?.split(" ")[0];
  const isGreeting = tab === "home" && !isOrganizer && firstName !== undefined;
  const pageTitle =
    tab === "home" && isOrganizer ? "All Scans" : formatTitle(tab);

  return (
    <>
      <SEO
        title="Live Portal"
        description="Live dashboard for Hack Western participants. Access schedules, maps, mentors, and more during Canada's largest student-run hackathon."
        noindex
      />
      <div className="flex h-screen w-screen flex-col bg-dashboard-bg-page md:flex-row">
        <Topbar
          title={pageTitle}
          isOrganizer={isOrganizer}
        />
        <Sidebar isOrganizer={isOrganizer} />
        <main className="flex min-w-0 flex-1 flex-col gap-8 overflow-y-auto p-5 md:gap-10 md:p-12">
          <div className="hidden items-start justify-between gap-4 md:flex">
            <h1 className={isGreeting ? "dashboard-display" : "dashboard-h1"}>
              {isGreeting ? `Hi, ${firstName}!` : pageTitle}
            </h1>
          </div>
          <TabComponent tab={tab} isOrganizer={isOrganizer} />
        </main>
      </div>
    </>
  );
};

const TabComponent = ({
  tab,
  isOrganizer,
}: {
  tab: string;
  isOrganizer: boolean;
}) => {
  switch (tab) {
    case "home":
      return <Home isOrganizer={isOrganizer} />;
    case "schedule":
      return <Schedule />;
    case "map":
      return <MapTab />;
    case "menu":
      return <FoodMenu />;
    case "mentors":
      return <Mentors />;
    case "sponsors":
      return <Sponsors />;
    case "event-logistics":
      return <EventLogistics />;
    case "contact-us":
      return <ContactUs />;
    case "activities":
      return <Activities />;
    case "rewards":
      return <Rewards />;
    // Not in the nav (Slack only, Jazz 2026-11-20): reachable only from the
    // coffee chat email, so hackers Slack can't find can still answer.
    case "coffee-chats":
      return isOrganizer ? <Home isOrganizer /> : <CoffeeChats />;
    default:
      return <Home isOrganizer={isOrganizer} />;
  }
};

export default Live;

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  // Organizers and admitted hackers only. Navigation between tabs is shallow,
  // so this only runs on a full page load.
  const session = await getServerSession(context.req, context.res, authOptions);
  const user = session
    ? await db.query.users.findFirst({
        where: (users, { eq }) => eq(users.id, session.user.id),
        columns: { type: true },
      })
    : undefined;
  const application =
    session && user?.type === "hacker"
      ? await db.query.applications.findFirst({
          where: (applications, { eq }) =>
            eq(applications.userId, session.user.id),
          columns: { status: true },
        })
      : undefined;

  const destination = liveAccessRedirect(
    session ? { type: user?.type ?? null, status: application?.status } : null,
  );
  if (destination) return { redirect: { destination, permanent: false } };

  return { props: { isOrganizer: user?.type === "organizer" } };
};
