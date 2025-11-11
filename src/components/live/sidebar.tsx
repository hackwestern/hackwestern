import Link from "next/link";
import { Horsey, SidebarIcon } from "./icons";
import { useSearchParams } from "next/navigation";
import { Button } from "../ui/button";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";

const Sidebar = () => {
  const router = useRouter();

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

  return (
    <div className="hidden h-screen w-1/4 flex-col justify-between bg-highlight px-4 py-8 md:flex lg:px-6 2xl:w-1/5 2xl:px-8 3xl:w-1/6 3xl:px-12">
      <div>
        <Link
          className="py-auto font-figtree font-bold text-heavy flex gap-4 text-center text-lg lg:text-xl"
          href="/"
        >
          <Horsey />
          <div className="flex flex-col justify-center">Hack Western 12</div>
        </Link>
        <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2 pt-8">
          <SectionLink tab="home" name="Home" />
          <SectionLink tab="schedule" name="Schedule" />
          <SectionLink tab="map" name="Map" />
          <SectionLink tab="food-menu" name="Food Menu" />
          <SectionLink tab="mentors" name="Mentors" />
          <SectionLink tab="sponsors" name="Sponsors" />
        </div>
        <hr className="border-[#ebdff7]"/>
        <div className="flex flex-col gap-2">
          <IconlessLink tab="event-logistics" name="Event Logistics" />
          <IconlessLink tab="contact-us" name="Contact Us" />
          <IconlessLink tab="faq" name="FAQ" />
        </div>
        </div>
      </div>
      <Button
        onClick={logout}
        variant="ghost"
        className="w-fit border border-light text-base text-medium"
      >
        Logout
      </Button>
    </div>
  );
};

const SectionLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const isActive = searchParams.get("tab") === tab;

  return (
    <Link
      href={`live/?tab=${tab}`}
      className={`flex gap-3 px-4 py-1.5 font-figtree ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
    >
      <div className="py-2">
        <SidebarIcon icon={tab} selected={isActive} />
      </div>
      <div className="flex flex-col justify-center font-medium">{name}</div>
    </Link>
  );
};

const IconlessLink = ({ tab, name }: {tab: string; name: string}) => {
  const searchParams = useSearchParams();
  const isActive = searchParams.get("tab") === tab;

  return (
    <Link
      href={`live/?tab=${tab}`}
      className={`flex gap-3 px-4 py-3 font-figtree ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
    >
      <div className="flex flex-col justify-center font-medium">{name}</div>
    </Link>
  )
}

export default Sidebar;
