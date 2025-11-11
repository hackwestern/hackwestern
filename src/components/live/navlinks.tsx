import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SidebarIcon, LogisticsIcon } from "./icons";

export const SectionLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const isActive = searchParams.get("tab") === tab;

  return (
    <Link
      href={`live/?tab=${tab}`}
      className={`flex items-center gap-3 px-4 py-1.5 py-3 font-figtree ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
    >
      <SidebarIcon icon={tab} selected={isActive} />
      <div className="flex flex-col justify-center font-medium">{name}</div>
    </Link>
  );
};

export const IconlessLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const eventLogisticsTab = tab === "event-logistics";
  const miscLogisticsTab = tab === "contact-us" || tab === "faq";
  const step = tab === "contact-us" ? "5" : tab === "faq" ? "6" : "1";

  const isActive = eventLogisticsTab
    ? ["1", "2", "3", "4"].includes(searchParams.get("step") ?? "")
    : miscLogisticsTab
      ? searchParams.get("step") === step
      : searchParams.get("tab") === tab;

  return (
    <>
      {eventLogisticsTab || miscLogisticsTab ? (
        <Link
          href={`live/?tab=event-logistics&step=${step}`}
          className={`flex gap-3 px-4 py-3 font-figtree ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
        >
          <div className="flex flex-col justify-center font-medium">{name}</div>
        </Link>
      ) : (
        <Link
          href={`live/?tab=${tab}`}
          className={`flex gap-3 px-4 py-3 font-figtree ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
        >
          <div className="flex flex-col justify-center font-medium">{name}</div>
        </Link>
      )}
    </>
  );
};

export const LogisticsLink = ({
  step,
  name,
}: {
  step: string;
  name: string;
}) => {
  const searchParams = useSearchParams();
  const isActive = searchParams.get("step") === step;

  return (
    <Link
      href={`live/?tab=event-logistics&step=${step}`}
      className={`flex w-full items-center gap-3 px-4 py-2.5 font-figtree ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
    >
      <LogisticsIcon icon={step} selected={isActive} />
      <div className="font-medium">{name}</div>
    </Link>
  );
};
