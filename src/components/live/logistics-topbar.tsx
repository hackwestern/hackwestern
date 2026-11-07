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
import { useRouter } from "next/router";
import { logisticsHref, logisticsSteps } from "~/constants/event-logistics";

const LogisticsTopbar = () => {
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const handleLinkClick = (step: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDrawerOpen(false);
    requestAnimationFrame(() => {
      void router.push(logisticsHref(step), undefined, { shallow: true });
    });
  };

  return (
    <div className="md:hidden">
      <Drawer open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DrawerTrigger asChild>
          <Button className="w-fit rounded-2xl p-0">
            <Menu
              strokeWidth={2.5}
              className="size-6 text-dashboard-text-heavy"
            />
          </Button>
        </DrawerTrigger>
        <DrawerContent>
          <DrawerHeader>
            <div className="flex flex-col gap-3 font-figtree">
              <h2 className="text-base font-semibold uppercase leading-default tracking-[-0.02em] text-dashboard-text-heavy">
                Overview
              </h2>
              <div className="flex flex-col">
                {logisticsSteps.map((s, i) => (
                  <div key={s.slug} onClick={(e) => handleLinkClick(i + 1, e)}>
                    <LogisticsLink step={i + 1} />
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
