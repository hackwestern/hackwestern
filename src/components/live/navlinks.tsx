import { usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Lock } from "lucide-react";
import { SidebarIcon, LogisticsIcon } from "./icons";
import { NotificationBadge } from "~/components/internals/notification-badge";
import { cn } from "~/lib/utils";
import * as tokens from "~/lib/tokens";

const navLinkClass = (isActive: boolean) =>
  cn(
    "group flex items-center gap-2.5 rounded-dashboard-sm px-4 py-3 leading-default transition-colors",
    isActive
      ? "cursor-pixel-default bg-dashboard-bg-navSelected text-dashboard-text-active"
      : "cursor-pixel-hover text-dashboard-text-medium hover:bg-dashboard-bg-surface hover:text-dashboard-text-heavy",
  );

export const SectionLink = ({
  tab,
  name,
  locked = false,
  badge,
  href,
}: {
  tab: string;
  name: string;
  locked?: boolean; // Locked pages (before RSVP) show a lock and can't be opened
  badge?: number;
  href?: string;
}) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isActive =
    href !== undefined
      ? pathname?.startsWith(href) === true
      : pathname === "/live" && (searchParams.get("tab") ?? "home") === tab;

  if (locked) {
    return (
      <div
        aria-disabled="true"
        className="flex items-center gap-2.5 rounded-dashboard-sm px-4 py-3 leading-default text-dashboard-text-medium"
        style={tokens.dashboardTypography.body}
      >
        <span className="flex flex-1 items-center gap-2.5 opacity-dashboard-disabled">
          <SidebarIcon
            icon={tab}
            className="size-5 shrink-0 text-dashboard-text-light"
          />
          {name}
        </span>
        <Lock
          aria-label="Locked"
          className="size-5 shrink-0 text-dashboard-text-medium"
        />
      </div>
    );
  }

  return (
    <Link
      href={href ?? `/live?tab=${tab}`}
      aria-current={isActive ? "page" : undefined}
      className={navLinkClass(isActive)}
      style={tokens.dashboardTypography.body}
    >
      <SidebarIcon
        icon={tab}
        className={cn(
          "size-5 shrink-0 transition-colors",
          isActive
            ? "text-dashboard-text-active"
            : "text-dashboard-text-light group-hover:text-dashboard-text-heavy",
        )}
      />
      {name}
      {badge !== undefined && badge > 0 && (
        <NotificationBadge count={badge} className="ml-auto" />
      )}
    </Link>
  );
};

export const IconlessLink = ({ tab, name }: { tab: string; name: string }) => {
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const activeStep = searchParams.get("step");
  const step = tab === "contact-us" ? "6" : tab === "faq" ? "7" : "1";

  const isActive =
    pathname === "/live" &&
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
