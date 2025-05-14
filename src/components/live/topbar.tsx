import { useRouter, useSearchParams } from "next/navigation";
import { Horsey, SidebarIcon } from "./icons";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTrigger,
} from "../ui/drawer";
import { Button } from "../ui/button";
import { Menu } from "lucide-react";
import Link from "next/link";
import { signOut } from "next-auth/react";

const tabName = (tab: string) =>
  tab != "faq" ? tab.charAt(0).toUpperCase() + tab.slice(1) : tab.toUpperCase();

const Topbar = () => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") ?? "home";

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

  return (
    <div className="flex justify-between border border-primary-300 bg-primary-100 p-3 md:hidden">
      <Horsey />
      <div className="flex flex-col justify-center text-2xl font-semibold">
        {tabName(tab)}
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
            {["home", "schedule", "map", "mentors", "sponsors", "faq"].map(
              (s) => (
                <DrawerClose key={s} asChild>
                  <Link
                    href={{ pathname: "/live", query: { tab: s } }}
                    className={`flex gap-3 px-4 py-2.5 ${tab === s && "bg-primary-300 text-primary-600"} rounded-xl transition-all hover:bg-primary-300`}
                  >
                    <div className="py-2">
                      <SidebarIcon icon={s} selected={tab === s} />
                    </div>
                    <div className="flex flex-col justify-center font-medium">
                      {tabName(s)}
                    </div>
                  </Link>
                </DrawerClose>
              ),
            )}
            <Button
              onClick={logout}
              variant="ghost"
              className="mt-4 w-full border border-primary-400 text-base text-violet-600"
            >
              Logout
            </Button>
          </DrawerHeader>
        </DrawerContent>
      </Drawer>
    </div>
  );
};

export default Topbar;
