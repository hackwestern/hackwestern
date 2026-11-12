import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu } from "lucide-react";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "../ui/sheet";
import { LogoutButton, SidebarNav } from "./sidebar";

const Topbar = ({
  title = "",
  isOrganizer = false,
}: {
  title?: string;
  isOrganizer?: boolean;
}) => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-dashboard-border-default bg-dashboard-bg-nav px-6 py-2 md:hidden">
      <Link href="/" aria-label="Hack Western home" className="px-2">
        <Image src="/shared/horse.svg" alt="" width={26} height={38} />
      </Link>
      <span className="font-figtree text-base font-semibold leading-default text-dashboard-text-heavy">
        {title}
      </span>
      <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
        <SheetTrigger
          aria-label="Open menu"
          className="flex h-10 w-10 cursor-pixel-hover items-center justify-end text-dashboard-text-heavy focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary"
        >
          <Menu className="size-6" />
        </SheetTrigger>
        <SheetContent
          side="right"
          className="flex w-full flex-col justify-between gap-6 overflow-y-auto border-0 bg-dashboard-bg-surface px-6 pb-6 pt-16 font-figtree sm:max-w-none"
          closeClassName="right-6 top-5 opacity-100 text-dashboard-text-heavy data-[state=open]:bg-transparent focus:ring-dashboard-action-primary"
          closeIconClassName="size-6"
          // Otherwise the search box gets focus and opens its empty results dropdown
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <SheetTitle className="sr-only">Menu</SheetTitle>
          {/* Close the menu when any link inside it is followed */}
          <div
            onClick={(event) => {
              if ((event.target as HTMLElement).closest("a")) {
                setMenuOpen(false);
              }
            }}
          >
            <SidebarNav isOrganizer={isOrganizer} />
          </div>
          <LogoutButton />
        </SheetContent>
      </Sheet>
    </header>
  );
};

export default Topbar;
