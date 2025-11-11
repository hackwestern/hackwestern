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
import FAQ from "~/components/live/faq";
import Sidebar from "~/components/live/sidebar";
import Topbar from "~/components/live/topbar";
import { type GetServerSidePropsContext } from "next";
import { notVerifiedRedirectDashboard } from "~/utils/redirect";

const Live = () => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "home";

  const title = formatTitle(tab);

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
        <div className="flex max-h-screen min-h-screen w-screen flex-col bg-white p-5 sm:p-10 gap-8 sm:gap-12">
          <div className="text-xl xl:text-2xl 2xl:text-3xl text-heavy font-dico">{title}</div>
          <div className="flex-1 overflow-hidden">
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
    case "food-menu":
      return <FoodMenu />;
    case "mentors":
      return <Mentors />;
    case "sponsors":
      return <Sponsors />;
    case "event-logistics":
      return <EventLogistics />;
    case "contact-us":
      return <ContactUs />
    case "faq":
      return <FAQ />;
    default:
      return <Home />;
  }
};

function formatTitle( tab: string ): string {
  const multipleWords = tab.includes("-");

  if (multipleWords) {
    const splitWords = tab.split("-");
    return splitWords.map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(" ")
  }
  if (tab === "faq") {
    return tab.toUpperCase();
  }
  else {
    return tab.charAt(0).toUpperCase() + tab.slice(1);
  }
}

export default Live;

export const getServerSideProps = async (
  context: GetServerSidePropsContext,
) => {
  const verification = await notVerifiedRedirectDashboard(context);
  return verification;
};
