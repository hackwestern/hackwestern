import { useRouter, useSearchParams } from "next/navigation";
import { Horsey } from "./icons";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { SectionLink, IconlessLink } from "./navlinks";
import { signOut } from "next-auth/react";
import { formatTitle } from "~/utils/format";
import { useState } from "react";

const Topbar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "home";
  const title = formatTitle(tab);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sectionLinks: [string, string][] = [
    ["home", "Home"],
    ["schedule", "Schedule"],
    ["map", "Map"],
    ["menu", "Menu"],
    ["mentors", "Mentors"],
    ["sponsors", "Sponsors"],
  ];

  const logisticsLinks: [string, string][] = [
    ["event-logistics", "Event Logistics"],
    ["contact-us", "Contact Us"],
    ["faq", "FAQ"],
  ];

  const handleLinkClick = (href: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      void router.push(href);
    });
  };

  const getLogisticsHref = (tab: string): string => {
    if (tab === "contact-us" || tab === "faq") {
      const step = tab === "contact-us" ? "6" : "7";
      return `live/?tab=event-logistics&step=${step}`;
    }
    if (tab === "event-logistics") {
      return `live/?tab=event-logistics&step=1`;
    }
    return `live/?tab=${tab}`;
  };

  return (
    <div className="flex justify-between border border-[#ebdff7] bg-highlight p-3 md:hidden">
      <Horsey />
      <div className="flex flex-col justify-center font-dico text-2xl text-heavy">
        {title}
      </div>
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <div className="flex items-center gap-2">
          <DrawerTrigger asChild>
            <Button className="rounded-2xl p-2.5">
              <Menu strokeWidth={2.5} className="size-6 text-slate-800" />
            </Button>
          </DrawerTrigger>
        </div>
        <DrawerContent>
          <DrawerHeader>
            {sectionLinks.map((s) => (
              <div
                key={s[0]}
                onClick={(e) => handleLinkClick(`live/?tab=${s[0]}`, e)}
              >
                <SectionLink tab={s[0]} name={s[1]} />
              </div>
            ))}
            <hr className="border-[#ebdff7]" />
            {logisticsLinks.map((s) => (
              <div
                key={s[0]}
                onClick={(e) => handleLinkClick(getLogisticsHref(s[0]), e)}
              >
                <IconlessLink tab={s[0]} name={s[1]} />
              </div>
            ))}
            {/*<Button
              onClick={logout}
              variant="ghost"
              className="mt-4 w-full border border-light text-base text-medium"
            >
              Logout
            </Button>*/}
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Topbar;
