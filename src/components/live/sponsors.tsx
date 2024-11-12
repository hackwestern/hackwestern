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
        width={0}
        height={0}
        className="h-auto w-full"
      />
    </a>
  );
};

const Sponsors = () => {
  return (
    <div className="p-12">
      <h1 className="py-4 font-DM_Sans text-3xl font-bold ">Title Sponsor</h1>
      <div>
        <SponsorCard
          name="Scotiabank"
          logo="/sponsors/Scotiabank.svg"
          link="https://www.scotiabank.com/"
        />
      </div>
      {/* Diamond Sponsors */}
      <h1 className="py-4 font-DM_Sans text-3xl font-bold">Diamond Sponsors</h1>
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
      <h1 className="py-4 font-DM_Sans text-3xl font-bold">Gold Sponsors</h1>
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
      <h1 className="py-4 font-DM_Sans text-3xl font-bold">Bronze Sponsors</h1>
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
      </div>
      {/* In-kind Sponsors */}
      <h1 className="py-4 font-DM_Sans text-3xl font-bold">In-kind Sponsors</h1>
      <div className="grid grid-cols-4 gap-2 lg:gap-8">
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
      </div>
    </div>
  );
};

export default Sponsors;
