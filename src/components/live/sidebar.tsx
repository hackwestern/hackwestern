import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { Button } from "../ui/button";
import { SectionLink, SectionGroup, IconlessLink } from "./navlinks";
import * as tokens from "~/lib/tokens";
import { SCHEDULE_ENABLED } from "~/constants/live";

export const SidebarNav = ({
  isOrganizer = false,
}: {
  isOrganizer?: boolean;
}) => (
  <div className="flex flex-col gap-9">
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <SectionLink tab="home" name="Home" />
        <SectionLink
          tab="schedule"
          name="Schedule"
          locked={!SCHEDULE_ENABLED}
        />
        <SectionLink tab="map" name="Map" />
        <SectionLink tab="menu" name="Food Menu" />
        <SectionLink tab="mentors" name="Mentors" />
        <SectionLink tab="sponsors" name="Sponsors" />
        {!isOrganizer && <SectionLink tab="coffee-chats" name="Coffee Chats" />}
        {!isOrganizer && (
          <SectionLink tab="scavenger-hunt" name="Scavenger Hunt" />
        )}
        {isOrganizer && (
          <SectionGroup
            icon="scavenger"
            name="Scavenger Hunt"
            tabs={["activities", "rewards"]}
            hrefs={["/scavenger"]}
          >
            <SectionLink tab="scan" name="Scan" href="/scavenger" />
            <SectionLink tab="activities" name="Activities" />
            <SectionLink tab="rewards" name="Rewards" />
          </SectionGroup>
        )}
        {isOrganizer && (
          <SectionLink tab="judge" name="Judging" href="/judge" />
        )}
      </div>
      <hr className="border-dashboard-border-subtle" />
      <div className="flex flex-col gap-1.5">
        <IconlessLink tab="event-logistics" name="Event Logistics" />
        <IconlessLink tab="contact-us" name="Contact Us" />
        <IconlessLink tab="faq" name="FAQ" />
      </div>
    </div>
  </div>
);

export const LogoutButton = () => {
  const router = useRouter();
  const { data: session } = useSession();

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

  if (!session) return null;

  return (
    <Button
      onClick={logout}
      variant="ghost"
      size="sm"
      className="mt-12 w-fit rounded-dashboard-lg border border-dashboard-border-medium px-[11px] py-[7px] leading-default text-dashboard-text-medium hover:bg-dashboard-bg-surface hover:text-dashboard-text-heavy"
      style={tokens.dashboardTypography.body}
    >
      Logout
    </Button>
  );
};

const Sidebar = ({ isOrganizer = false }: { isOrganizer?: boolean }) => {
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
        <SidebarNav isOrganizer={isOrganizer} />
      </div>
      <LogoutButton />
    </nav>
  );
};

export default Sidebar;
