import Image from "next/image";
import Link from "next/link";
import { signOut, useSession } from "next-auth/react";
import { useRouter } from "next/router";
import { SearchAutocomplete } from "../internals/search-autocomplete";
import { Button } from "../ui/button";
import { SectionLink, IconlessLink } from "./navlinks";
import { useNow } from "~/components/sponsors/use-now";
import { coffeeChatCopy } from "~/content/coffee-chat";
import { pendingCount, showCoffeeChatsTab } from "~/lib/coffee-chat-view";
import * as tokens from "~/lib/tokens";
import { api } from "~/utils/api";

// Hackers' Coffee chats link, badged with requests waiting for an answer.
// Hidden until a sponsor offers the hacker a chat; the 30 s refetch (shared
// with the toast) makes it appear when a new offer arrives.
const CoffeeChatsLink = () => {
  const { data: session } = useSession();
  const { data } = api.coffeeChatRequests.mine.useQuery(undefined, {
    enabled: !!session?.user?.id,
    refetchInterval: 30_000,
  });
  const now = useNow(30_000);
  const count = pendingCount(data ?? [], now);
  if (!showCoffeeChatsTab(data)) return null;
  return (
    <SectionLink
      tab="coffee-chats"
      name={coffeeChatCopy.page.navName}
      badge={count}
      badgeLabel={coffeeChatCopy.page.navBadge(count)}
    />
  );
};

export const SidebarNav = ({
  isOrganizer = false,
}: {
  isOrganizer?: boolean;
}) => (
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
        {!isOrganizer && <CoffeeChatsLink />}
        {isOrganizer && (
          // Mobile-only scan page
          <div className="md:hidden">
            <SectionLink tab="scan" name="Scan" href="/scavenger" />
          </div>
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
