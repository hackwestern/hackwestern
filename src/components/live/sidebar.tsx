import Link from "next/link";
import { Horsey } from "./icons";
import { Button } from "../ui/button";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { SectionLink, IconlessLink } from "./navlinks";

const Sidebar = () => {
  const router = useRouter();
  const { data: session } = useSession();

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
          className="py-auto flex gap-4 text-center font-figtree text-lg font-bold text-heavy lg:text-xl"
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
            <SectionLink tab="menu" name="Menu" />
            <SectionLink tab="mentors" name="Mentors" />
            <SectionLink tab="sponsors" name="Sponsors" />
          </div>
          <hr className="border-[#ebdff7]" />
          <div className="flex flex-col gap-2">
            <IconlessLink tab="event-logistics" name="Event Logistics" />
            <IconlessLink tab="contact-us" name="Contact Us" />
            <IconlessLink tab="faq" name="FAQ" />
          </div>
        </div>
      </div>
      {session && (
        <Button
          onClick={logout}
          variant="ghost"
          className="w-fit border border-light text-base text-medium"
        >
          Logout
        </Button>
      )}
    </div>
  );
};

export default Sidebar;
