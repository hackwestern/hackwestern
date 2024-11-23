import Head from "next/head";
import { useSearchParams } from "next/navigation";
import Home from "~/components/live/home";
import Schedule from "~/components/live/schedule";
import Map from "~/components/live/map";
import Mentors from "~/components/live/mentors";
import Sponsors from "~/components/live/sponsors";
import FAQ from "~/components/live/faq";
import Sidebar from "~/components/live/sidebar";
import { authRedirectHacker } from "~/utils/redirect";
import Topbar from "~/components/live/topbar";

const Live = () => {
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "home";

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
        <div className="flex max-h-screen min-h-screen w-screen flex-col bg-primary-100">
          <h1 className="w-fill hidden border-b p-10 pt-12 text-xl font-bold md:block xl:text-2xl 2xl:text-3xl">
            {tab != "faq"
              ? tab.charAt(0).toUpperCase() + tab.slice(1)
              : tab.toUpperCase()}
          </h1>
          <div className="flex-1 overflow-auto">
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
    case "mentors":
      return <Mentors />;
    case "sponsors":
      return <Sponsors />;
    case "faq":
      return <FAQ />;
    default:
      return <Home />;
  }
};

export default Live;
export const getServerSideProps = authRedirectHacker;
