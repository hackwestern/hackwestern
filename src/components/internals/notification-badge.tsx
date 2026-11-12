import { cn } from "~/lib/utils";

export interface NotificationBadgeProps {
  count: number;
  className?: string;
}

// 18px on mobile, 22px on desktop
export function NotificationBadge({
  count,
  className,
}: NotificationBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-dashboard-status-warning px-[5px] font-figtree text-[11px] font-bold leading-none text-dashboard-text-inverse md:h-[22px] md:min-w-[22px] md:px-[7px] md:text-xs",
        className,
      )}
    >
      {count}
    </span>
  );
}
