import { Button } from "../ui/button";
import Image from "next/image";

interface Sponsor {
  name: string;
  logo: string;
  link: string;
}

const SponsorCard = ({ name, logo, link }: Sponsor) => {
  return (
    <a
      className="mx-auto flex h-36 w-full cursor-pointer select-none justify-center rounded-xl bg-primary-700 p-4 align-middle transition-all hover:scale-[1.0075] hover:shadow-2xl xl:h-40 2xl:h-48"
      href={link}
      target="_blank"
      rel="noreferrer noopener"
    >
      <Image
        src={logo}
        alt={name}
        width={150}
        height={150}
        className="h-auto w-auto"
      />
    </a>
  );
};

export { SponsorCard };

const Sponsors = () => {
  return (
    <div className="min-h-screen bg-[#713eba] pt-28 text-center">
      <h1 className="font-MagicRetro text-5xl text-primary-100" id="sponsors">
        thank you to our sponsors
      </h1>
      <div className="font-dmsans p-5 py-12 text-xl text-primary-100">
        We&apos;d like to extend our appreciation to all of our sponsors that
        help make Hack Western a reality.
      </div>
      <div className="mx-auto flex w-11/12 flex-col gap-8 py-12 md:w-5/6 lg:w-4/5 2xl:w-3/5 3xl:w-2/5">
        {/* Title Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Title Sponsor
        </h1>
        <div>
          <SponsorCard
            name="Scotiabank"
            logo="/sponsors/Scotiabank.svg"
            link="https://www.scotiabank.com/"
          />
        </div>
        {/* Diamond Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Diamond Sponsors
        </h1>
        <div className="flex flex-col gap-2 lg:gap-8">
          <div className="grid grid-cols-2 gap-2 lg:gap-8">
            <SponsorCard
              name="Canada Life"
              logo="/sponsors/CanadaLife.svg"
              link="https://www.canadalife.com/"
            />
            <SponsorCard
              name="Sun Life"
              logo="/sponsors/Sun Life.svg"
              link="https://www.sunlife.ca/"
            />
          </div>
          <SponsorCard
            name="Starknet"
            logo="/sponsors/Starknet.svg"
            link="https://www.starknet.io/"
          />
        </div>
        {/* Gold Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Gold Sponsors
        </h1>
        <div className="grid grid-cols-3 gap-2 lg:gap-8">
          <SponsorCard
            name="TD invent"
            logo="/sponsors/TD Invent.svg"
            link="https://tdinvent.td.com/"
          />
          <SponsorCard
            name="DoraHacks"
            logo="/sponsors/DoraHacks.svg"
            link="https://dorahacks.io/"
          />
          <SponsorCard
            name="Big Blue Bubble"
            logo="/sponsors/Big Blue Bubble.svg"
            link="https://www.bigbluebubble.com/"
          />
        </div>
        {/* Bronze Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Bronze Sponsors
        </h1>
        <div className="grid grid-cols-3 flex-col gap-2 lg:gap-8">
          <SponsorCard
            name="P&G"
            logo="/sponsors/P&G.svg"
            link="https://www.pg.ca/"
          />
          <SponsorCard
            name="Accenture"
            logo="/sponsors/Accenture.svg"
            link="https://www.accenture.com/"
          />
          <SponsorCard
            name="Morrissette"
            logo="/sponsors/Morrissette.svg"
            link="https://entrepreneurship.uwo.ca/"
          />
          <SponsorCard
            name="Digital Extreme"
            logo="/sponsors/digitalextreme.svg"
            link="https://www.digitalextremes.com/"
          />
          <SponsorCard
            name="GEOTAB"
            logo="/sponsors/geotab.svg"
            link="https://www.geotab.com/"
          />
          <SponsorCard
            name="Notion"
            logo="/sponsors/notion.png"
            link="https://notion.com"
          />
          <SponsorCard
            name="Tempo Labs"
            logo="/sponsors/tempo-logo-white.svg"
            link="https://www.tempolabs.ai/"
          />
        </div>
        {/* In-kind Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          In-kind Sponsors
        </h1>
        <div className="grid grid-cols-3 gap-2 lg:gap-8">
          <SponsorCard
            name="Canada Learning Code"
            logo="/sponsors/Canada Learning Code.svg"
            link="https://www.canadalearningcode.ca/"
          />
          <SponsorCard
            name="Warp"
            logo="/sponsors/Warp.svg"
            link="https://www.warp.dev/"
          />
          <SponsorCard
            name="Voiceflow"
            logo="/sponsors/Voiceflow.svg"
            link="https://www.voiceflow.com/"
          />
          <SponsorCard
            name="StandOut Stickers"
            logo="/sponsors/StandOut.svg"
            link="http://hackp.ac/mlh-StandOutStickers-hackathons"
          />
          <SponsorCard
            name="Western Engineering"
            logo="/sponsors/WesternEngineering.svg"
            link="https://www.eng.uwo.ca/outreach/index.html"
          />
          <SponsorCard
            name="Awake Caffeinated Chocolate"
            logo="/sponsors/Awake Chocolate.svg"
            link="https://awakechocolate.com/"
          />
          <SponsorCard
            name="Hack the North"
            logo="/sponsors/HacktheNorthLogo_White.svg"
            link="https://hackthenorth.com/"
          />
        </div>
        <div className="mt-8 flex h-64 flex-col justify-around rounded-xl border-2 border-[#B07ACA] bg-gradient-to-tr from-[#7B3FDF] via-[#DE81A8] to-[#FFBD80] p-5 py-2.5 md:mt-20">
          <div className="text-3xl font-bold text-white">
            Help us set some ideas ablaze.
          </div>
          <div className="text-xl text-white">
            For our sponsorship package and other inquiries:
          </div>
          <Button variant="primary" className="mx-auto w-max text-xl" asChild>
            <a href="https://drive.google.com/file/d/1a8Pf5XKAr-FPT-8RyWyycuj_YI9PNk4X/view?usp=sharing">
              Become a Sponsor
            </a>
          </Button>
        </div>
      </div>
      <div className="-mt-12 h-48 bg-gradient-to-b from-[#713EBA] via-[#582B95] to-[#320862] lg:-mt-8 lg:h-64 2xl:h-80" />
    </div>
  );
};

export default Sponsors;
