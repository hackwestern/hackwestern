import { useRouter, useSearchParams } from "next/navigation";
import { Horsey } from "./icons";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { SectionLink, IconlessLink } from "./navlinks";
import { signOut } from "next-auth/react";
import { formatTitle } from "~/utils/format";

const Topbar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "home";
  const title = formatTitle(tab);

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

  const sectionLinks: [string, string][] = [
    ["home", "Home"],
    ["schedule", "Schedule"],
    ["map", "Map"],
    ["food-menu", "Food Menu"],
    ["mentors", "Mentors"],
    ["sponsors", "Sponsors"],
  ];

  const logisticsLinks: [string, string][] = [
    ["event-logistics", "Event Logistics"],
    ["contact-us", "Contact Us"],
    ["faq", "FAQ"],
  ];

  return (
    <div className="flex justify-between border border-[#ebdff7] bg-highlight p-3 md:hidden">
      <Horsey />
      <div className="flex flex-col justify-center font-dico text-2xl text-heavy">
        {title}
      </div>
      <Drawer>
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
              <DrawerClose key={s[0]} asChild>
                <SectionLink tab={s[0]} name={s[1]} />
              </DrawerClose>
            ))}
            <hr className="border-[#ebdff7]" />
            {logisticsLinks.map((s) => (
              <DrawerClose key={s[0]} asChild>
                <IconlessLink tab={s[0]} name={s[1]} />
              </DrawerClose>
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
