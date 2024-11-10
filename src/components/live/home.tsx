import { api } from "~/utils/api";
import { Button } from "../ui/button";
import { ArrowUpRight, LucideIcon } from "lucide-react";
import Image from "next/image";
const Home = () => {
  const { data: application } = api.application.get.useQuery();

  return (
    <div className="flex w-full flex-row justify-start p-10 ">
      <div className="flex w-2/3 flex-col ">
        <h2 className="font-MagicRetro text-5xl">
          Hi {application?.firstName ? `${application.firstName}` : "Hacker"},
        </h2>
        <p className="pt-5 text-lg text-slate-600">
          Welcome to Hack Western 11, where ideas take flight!
        </p>
        <p className="text-md pt-5  text-slate-600">
          We are thrilled to have you at Hack Western 11! We hope you build a
          cool project and kindle some fun memories this weekend 💜
        </p>
        <div className="md:hidden">
          <QuickLinks />
        </div>
        <div className="pt-5">
          <h3 className="text-md font-bold text-slate-700">GETTING STARTED</h3>
          <div className="w-full border-t-2 border-primary-300" />
          <p className="text-md pt-5 font-medium text-slate-600">
            Resources to help kickstart your hackathon project and learn various
            skills in design, development, and more.
          </p>
          <Button variant="primary" className="mt-5 p-6">
            Access Starter Pack <ArrowUpRight size={20} />
          </Button>
        </div>
        <div className="pt-5">
          <h3 className="text-md font-bold text-slate-700">NEED HELP?</h3>
          <div className="w-full border-t-2 border-primary-300" />
          <p className="text-md pt-5 font-medium text-slate-600">
            For urgent matters, send a message in the{" "}
            <span className="font-bold text-primary-600">#questions</span>{" "}
            channel on Slack! You can also identify Hack Western organizers and
            volunteers by their name tags - feel free to ask us for help.
            Otherwise, feel free to send an email to{" "}
            <span className="font-bold text-primary-600 underline">
              <a href="mailto:hello@hackwestern.com">hello@hackwestern.com</a>
            </span>
            .
          </p>
        </div>
        <div className="pt-5">
          <h3 className="text-md font-bold text-slate-700">FOR EMERGENCIES</h3>
          <div className="w-full border-t-2 border-primary-300" />
          <p className="text-md pt-5 font-medium text-slate-600">
            To contact campus police, dial{" "}
            <span className="font-bold text-primary-600 underline">
              <a href="tel:519-661-3300">519-661-3300</a>
            </span>
            . To request a safe walk outside at night, dial Western Foot Patrol
            at{" "}
            <span className="font-bold text-primary-600 underline">
              <a href="tel:519-661-3650">519-661-3650</a>
            </span>
            .
          </p>
        </div>
      </div>
      <div className="mx-auto hidden px-5 md:block">
        <QuickLinks />
      </div>
    </div>
  );
};

const QuickLinks = () => {
  return (
    <div className="flex flex-col rounded-xl bg-primary-200 p-5 pr-16">
      <div className="text-2xl font-bold">Quick Links</div>
      <div className="text-lg font-medium ">
        <div className="mt-5 w-[120%] border-t-2 border-primary-400" />
        <QLink
          text="Event Guide"
          link="#"
          image="/images/icons/arrowupright.svg"
        />
        <div className="w-[120%] border-t-2 border-primary-400" />
        <QLink text="Join our Slack" link="#" image="/images/icons/slack.svg" />
        <div className="w-[120%] border-t-2 border-primary-400" />
        <QLink
          text="Add Schedule to GCal"
          link="#"
          image="/images/icons/gcal.svg"
        />
        <div className="w-[120%] border-t-2 border-primary-400" />
        <QLink
          text="Submit your project"
          link="#"
          image="/images/icons/dorahacks.png"
        />
      </div>
    </div>
  );
};

const QLink = ({
  text,
  link,
  image,
}: {
  text: string;
  link: string;
  image: string;
}) => {
  return (
    <a href="https://slack.com/" className="flex items-center space-x-3 py-3">
      <Image src={image} alt="Link Icon" width={20} height={20} />
      <span className="transition-all duration-200 ease-in-out hover:text-primary-600">
        {text}
      </span>
    </a>
  );
};
export default Home;
