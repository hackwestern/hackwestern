import Head from "next/head";
import { useSearchParams } from "next/navigation";
import Home from "~/components/live/home";
import Schedule from "~/components/live/schedule";
import Map from "~/components/live/map";
import FoodMenu from "~/components/live/food-menu";
import Mentors from "~/components/live/mentors";
import Sponsors from "~/components/live/sponsors";
import EventLogistics from "~/components/live/event-logistics";
import ContactUs from "~/components/live/contact-us";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";
import { type GetServerSidePropsContext } from "next";
import { notVerifiedRedirectDashboard } from "~/utils/redirect";
import { getServerSession } from "next-auth";
import { authOptions } from "~/server/auth";
import { db } from "~/server/db";
import { formatTitle } from "~/utils/format";
import { useSession } from "next-auth/react";

const Live = () => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "event-logistics";
  const { data: session } = useSession();

  const getTitle = () => {
    if (tab === "home" && session?.user?.name) {
      const firstName = session.user.name.split(" ")[0];
      return `Hi ${firstName}!`;
    }
    return formatTitle(tab);
  };

  return (
    <>
      <Head>
        <title>Live Portal</title>
        <meta
          name="description"
          content="Hack Western: One of Canada's largest annual student-run hackathons based out of Western University in London, Ontario."
        />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="flex h-screen w-screen flex-col md:flex-row">
        <Topbar />
        <Sidebar />
        <div className="flex w-screen flex-col gap-4 bg-[#fbfbfb] p-5 sm:gap-8 sm:p-10">
          <div className="hidden font-dico text-xl text-heavy md:flex xl:text-2xl 2xl:text-3xl">
            {getTitle()}
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden">
            <TabComponent tab={tab} />
          </div>
        </div>
      </div>
    </>
  );
};

const TabComponent = ({ tab }: { tab: string }) => {
  switch (tab) {
    case "home":
      return <Home />;
    case "schedule":
      return <Schedule />;
    case "map":
      return <Map />;
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
    default:
      return <Home />;
  }
};

export default Live;
