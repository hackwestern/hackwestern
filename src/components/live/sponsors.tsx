import { SponsorCard } from "../promo/sponsors";

const Sponsors = () => {
  return (
    <div className="p-12">
      <h1 className="py-4 font-DM_Sans text-2xl font-medium text-slate-600">
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
      <h1 className="py-4 font-DM_Sans text-2xl font-medium text-slate-600">
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
      <h1 className="py-4 font-DM_Sans text-2xl font-medium text-slate-600">
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
      <h1 className="py-4 font-DM_Sans text-2xl font-medium text-slate-600">
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
      <h1 className="py-4 font-DM_Sans text-2xl font-medium text-slate-600">
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
    </div>
  );
};

export default Sponsors;
