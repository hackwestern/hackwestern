import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { LogisticsLink } from "./navlinks";
import { useState } from "react";
import { useRouter } from "next/navigation";

const LogisticsTopbar = () => {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const logisticsData: [string, string][] = [
    ["1", "Packing List"],
    ["2", "Communications"],
    ["3", "Housekeeping"],
    ["4", "Project Rules"],
    ["5", "Contact Us"],
    ["6", "FAQ"],
  ];

  const handleLinkClick = (step: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      void router.push(`live/?tab=event-logistics&step=${step}`);
    });
  };

  return (
    <div className="md:hidden">
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button className="w-fit rounded-2xl p-0">
            <Menu strokeWidth={2.5} className="size-6 text-slate-800" />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex flex-col gap-4">
              <h1 className="font-jetbrains-mono font-semibold text-heavy">
                EVENT LOGISTICS OVERVIEW
              </h1>
              <div className="flex flex-col gap-2">
                {logisticsData.map((s) => (
                  <div key={s[0]} onClick={(e) => handleLinkClick(s[0], e)}>
                    <LogisticsLink step={s[0]} name={s[1]} />
                  </div>
                ))}
              </div>
            </div>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default LogisticsTopbar;
