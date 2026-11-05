import * as React from "react";
import { cn } from "~/lib/utils";

export interface DashboardChipProps {
  children: React.ReactNode;
  selected?: boolean;
  onClick: () => void;
  className?: string;
}

export function DashboardChip({
  children,
  selected = false,
  onClick,
  className,
}: DashboardChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cn(
        "inline-flex cursor-pixel-hover items-center whitespace-nowrap rounded-dashboard-lg px-3 py-2 font-figtree text-sm font-medium leading-default transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
        selected
          ? "bg-dashboard-action-primary text-dashboard-text-inverse"
          : "bg-dashboard-bg-nav text-dashboard-text-heavy hover:bg-dashboard-bg-navSelected",
        className,
      )}
    >
      {children}
    </button>
  );
}
