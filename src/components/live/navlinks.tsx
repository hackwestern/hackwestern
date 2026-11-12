import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SidebarIcon, LogisticsIcon } from "./icons";
import { cn } from "~/lib/utils";
import * as tokens from "~/lib/tokens";

const navLinkClass = (isActive: boolean) =>
  cn(
    "group flex cursor-pixel-hover items-center gap-2.5 rounded-dashboard-sm px-4 py-3 leading-default transition-colors hover:bg-dashboard-bg-surface hover:text-dashboard-text-heavy",
    isActive
      ? "bg-dashboard-bg-navSelected text-dashboard-text-active"
      : "text-dashboard-text-medium",
  );

export const SectionLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const isActive = (searchParams.get("tab") ?? "home") === tab;

  return (
    <Link
      href={`/live?tab=${tab}`}
      aria-current={isActive ? "page" : undefined}
      className={navLinkClass(isActive)}
      style={tokens.dashboardTypography.body}
    >
      <SidebarIcon
        icon={tab}
        className={cn(
          "size-5 shrink-0 transition-colors group-hover:text-dashboard-text-heavy",
          isActive ? "text-dashboard-text-active" : "text-dashboard-text-light",
        )}
      />
      {name}
    </Link>
  );
};

export const IconlessLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const activeStep = searchParams.get("step");
  const step = tab === "contact-us" ? "6" : tab === "faq" ? "7" : "1";

  const isActive =
    searchParams.get("tab") === "event-logistics" &&
    (tab === "event-logistics"
      ? activeStep !== "6" && activeStep !== "7"
      : activeStep === step);

  return (
    <Link
      href={`/live?tab=event-logistics&step=${step}`}
      aria-current={isActive ? "page" : undefined}
      className={navLinkClass(isActive)}
      style={tokens.dashboardTypography.body}
    >
      {name}
    </Link>
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
      className={`flex w-full items-center gap-3 px-4 py-2.5 font-secondary ${isActive ? "bg-primary-300 text-heavy" : "text-medium"} rounded-md transition-all hover:bg-primary-300`}
    >
      <LogisticsIcon icon={step} selected={isActive} />
      <div className="font-medium">{name}</div>
    </Link>
  );
};
