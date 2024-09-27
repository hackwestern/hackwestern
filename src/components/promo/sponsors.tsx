import { useRouter } from "next/router";
import { Button } from "../ui/button";

interface Sponsor {
  name: string;
  logo: string;
}

const SponsorCard = ({ name, logo }: Sponsor) => {
  return (
    <div className="h-36 w-full cursor-pointer rounded-xl bg-white transition-all hover:scale-[1.01] hover:shadow-2xl xl:h-40 2xl:h-48">
      {name + logo}
    </div>
  );
};

const Sponsors = () => {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-[#713eba] py-28 text-center">
      <h1 className="font-MagicRetro text-5xl text-primary-100">
        thank you to our sponsors
      </h1>
      <div className="font-dmsans py-12 text-xl text-primary-100">
        We&apos;d like to extend our appreciation to all of our sponsors that
        help make Hack Western a reality.
      </div>
      <div className="3xl:w-1/3 mx-auto flex w-5/6 flex-col gap-8 py-12 lg:w-3/5 2xl:w-3/5">
        {/* Large Sponsors */}
        <div className="flex columns-1 flex-col">
          <SponsorCard name="" logo="" />
        </div>
        {/* Medium Sponsors */}
        <div className="flex columns-2 flex-col gap-8 lg:flex-row">
          <SponsorCard name="" logo="" />
          <SponsorCard name="" logo="" />
        </div>
        {/* Small Sponsors */}
        <div className="flex columns-3 flex-col gap-8 lg:flex-row">
          <SponsorCard name="" logo="" />
          <SponsorCard name="" logo="" />
          <SponsorCard name="" logo="" />
        </div>
        <div className="mt-20 flex h-64 flex-col justify-around rounded-xl border border-2 border-[#B07ACA] bg-gradient-to-tr from-[#7B3FDF] via-[#DE81A8] to-[#FFBD80] py-2.5">
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
    </div>
  );
};

export default Sponsors;
