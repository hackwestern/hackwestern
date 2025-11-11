import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import { LogisticsLink } from "./navlinks";

const LogisticsTopbar = () => {
  const logisticsData: [string, string][] = [
    ["1", "Packing List"],
    ["2", "Communications"],
    ["3", "Housekeeping"],
    ["4", "Project Rules"],
    ["5", "Contact Us"],
    ["6", "FAQ"],
  ];

  return (
    <div className="md:hidden">
      <Drawer>
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
                  <LogisticsLink key={s[0]} step={s[0]} name={s[1]} />
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
