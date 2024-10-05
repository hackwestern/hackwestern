import { useRouter } from "next/router";
import { Button } from "../ui/button";
import Image from "next/image";

interface Sponsor {
  name: string;
  logo: string;
}

const SponsorCard = ({ name, logo }: Sponsor) => {
  return (
    <div className="mx-auto flex h-36 w-full cursor-pointer justify-center rounded-xl bg-primary-700 p-4 align-middle transition-all hover:scale-[1.0075] xl:h-40 2xl:h-48">
      <Image
        src={logo}
        alt={name}
        width={0}
        height={0}
        className="h-auto w-full"
      ></Image>
    </div>
  );
};

const Sponsors = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#713eba] pt-28 text-center">
      <h1 className="font-MagicRetro text-5xl text-primary-100">
        thank you to our sponsors
      </h1>
      <div className="font-dmsans p-5 py-12 text-xl text-primary-100">
        We&apos;d like to extend our appreciation to all of our sponsors that
        help make Hack Western a reality.
      </div>
      <div className="mx-auto flex w-5/6 flex-col gap-8 py-12 lg:w-3/5 2xl:w-3/5 3xl:w-1/3">
        {/* Title Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Title Sponsor
        </h1>
        <div className="flex columns-1 flex-col">
          <SponsorCard name="Scotiabank" logo="/sponsors/Scotiabank.svg" />
        </div>
        {/* Diamond Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Diamond Sponsors
        </h1>
        <div className="columns-1 gap-8 lg:columns-2">
          <SponsorCard name="Canada Life" logo="/sponsors/CanadaLife.svg" />
          <div className="h-8 lg:hidden" />
          <SponsorCard name="Sun Life" logo="/sponsors/Sun Life.svg" />
        </div>
        <SponsorCard name="Starknet" logo="/sponsors/Starknet.svg" />
        {/* Gold Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Gold Sponsors
        </h1>
        <div className="columns-3 flex-col gap-2 lg:flex-row lg:gap-8">
          <SponsorCard name="TD invent" logo="/sponsors/TD Invent.svg" />
          <SponsorCard name="DoraHacks" logo="/sponsors/DoraHacks.svg" />
          <SponsorCard
            name="Big Blue Bubble"
            logo="/sponsors/Big Blue Bubble.svg"
          />
        </div>
        {/* Bronze Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          Bronze Sponsors
        </h1>
        <div className="columns-3 flex-col gap-2 lg:flex-row lg:gap-8">
          <SponsorCard name="P&G" logo="/sponsors/P&G.svg" />
          <SponsorCard name="Accenture" logo="/sponsors/Accenture.svg" />
          <SponsorCard name="Morrissette" logo="/sponsors/Morrissette.svg" />
        </div>
        {/* In-kind Sponsors */}
        <h1 className="font-DM_Sans text-3xl font-bold text-primary-100">
          In-kind Sponsors
        </h1>
        <div className="columns-2 flex-col gap-2 lg:flex-row lg:gap-8">
          <SponsorCard
            name="Canada Learning Code"
            logo="/sponsors/Canada Learning Code.svg"
          />
          <SponsorCard name="Warp" logo="/sponsors/Warp.svg" />
        </div>
        <div className="mt-20 flex h-64 flex-col justify-around rounded-xl border border-2 border-[#B07ACA] bg-gradient-to-tr from-[#7B3FDF] via-[#DE81A8] to-[#FFBD80] p-5 py-2.5">
          <div className="text-3xl font-bold text-white">
            Help us set some ideas ablaze.
          </div>
          <div className="text-xl text-white">
            For our sponsorship package and other inquiries:
          </div>
          <Button
            variant="primary"
            className="mx-auto w-max text-xl"
            onClick={() => router.push("/sponsors")}
          >
            Become a Sponsor
          </Button>
        </div>
      </div>
      <div className="mt-12 h-48 bg-gradient-to-b from-[#713EBA] via-[#582B95] to-[#320862] lg:h-64 2xl:h-80" />
    </div>
  );
};

export default Sponsors;
