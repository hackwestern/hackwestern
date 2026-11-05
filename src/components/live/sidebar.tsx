import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { SearchAutocomplete } from "../internals/search-autocomplete";
import { Button } from "../ui/button";
import { SectionLink, IconlessLink } from "./navlinks";
import * as tokens from "~/lib/tokens";

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
    <nav className="hidden h-screen w-[324px] shrink-0 flex-col justify-between overflow-y-auto rounded-dashboard-lg border-r border-dashboard-border-default bg-dashboard-bg-nav px-6 py-12 md:flex">
      <div className="flex flex-col gap-12">
        <Link
          href="/"
          className="flex cursor-pixel-hover items-center gap-3 leading-default text-dashboard-text-heavy"
          style={tokens.dashboardTypography.bodyLg}
        >
          <Image
            src="/shared/horse.svg"
            alt=""
            width={34}
            height={50}
            className="-my-[2.5px] mx-[7px] shrink-0"
          />
          Hack Western 13
        </Link>
        <div className="flex flex-col gap-9">
          <SearchAutocomplete options={[]} placeholder="Search" />
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1.5">
              <SectionLink tab="home" name="Home" />
              <SectionLink tab="schedule" name="Schedule" />
              <SectionLink tab="map" name="Map" />
              <SectionLink tab="menu" name="Food Menu" />
              <SectionLink tab="mentors" name="Mentors" />
              <SectionLink tab="sponsors" name="Sponsors" />
            </div>
            <hr className="border-dashboard-border-subtle" />
            <div className="flex flex-col gap-1.5">
              <IconlessLink tab="event-logistics" name="Event Logistics" />
              <IconlessLink tab="contact-us" name="Contact Us" />
              <IconlessLink tab="faq" name="FAQ" />
            </div>
          </div>
        </div>
      </div>
      {session && (
        <Button
          onClick={logout}
          variant="ghost"
          size="sm"
          className="mt-12 w-fit rounded-dashboard-lg border border-dashboard-border-medium px-[11px] py-[7px] leading-default text-dashboard-text-medium hover:bg-dashboard-bg-surface hover:text-dashboard-text-heavy"
          style={tokens.dashboardTypography.body}
        >
          Logout
        </Button>
      )}
    </nav>
  );
};

export default Sidebar;
