import Link from "next/link";
import { Horsey, SidebarIcon } from "./icons";
import { useSearchParams } from "next/navigation";
import { Button } from "../ui/button";
import { signOut } from "next-auth/react";
import { useRouter } from "next/router";

const Sidebar = () => {
  const router = useRouter();

  const logout = () => {
    signOut()
      .then(() => {
        void router.push("/");
      })
      .catch((e) => console.log("error logging out:", e));
  };

  return (
    <div className="flex h-screen w-1/3 flex-col justify-between bg-violet-100 px-16 py-8 2xl:w-1/4 3xl:w-1/5">
      <div>
        <Link
          className="py-auto flex gap-4 text-center font-MagicRetro text-xl lg:text-2xl 2xl:text-3xl"
          href="/"
        >
          <Horsey />

          <div className="flex flex-col justify-center">hack western 11</div>
        </Link>
        <div className="flex flex-col gap-2 pt-8">
          <SectionLink tab="home" name="Home" />
          <SectionLink tab="schedule" name="Schedule" />
          <SectionLink tab="map" name="Map" />
          <SectionLink tab="mentors" name="Mentors" />
          <SectionLink tab="sponsors" name="Sponsors" />
          <SectionLink tab="faq" name="FAQ" />
        </div>
      </div>
      <Button
        onClick={logout}
        variant="ghost"
        className="w-fit border border-primary-400 text-base text-violet-600"
      >
        Logout
      </Button>
    </div>
  );
};

const SectionLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const isActive = searchParams.get("tab") === tab;

  return (
    <Link
      href={`live/?tab=${tab}`}
      className={`flex gap-3 px-4 py-2.5 ${isActive && "bg-primary-300 text-primary-600"} rounded-xl transition-all hover:bg-primary-300`}
    >
      <div className="py-2">
        <SidebarIcon icon={tab} selected={isActive} />
      </div>
      <div className="flex flex-col justify-center font-medium">{name}</div>
    </Link>
  );
};

export default Sidebar;
