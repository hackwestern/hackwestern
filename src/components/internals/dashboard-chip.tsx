import * as React from "react";
import { cn } from "~/lib/utils";

export interface DashboardChipProps {
  children: React.ReactNode;
  selected?: boolean;
  /** Shown greyed out and not pressable (e.g. a length that won't fit). */
  disabled?: boolean;
  onClick: () => void;
  className?: string;
}

export function DashboardChip({
  children,
  selected = false,
  disabled = false,
  onClick,
  className,
}: DashboardChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "inline-flex min-h-11 cursor-pixel-hover items-center whitespace-nowrap rounded-dashboard-lg px-3 py-2 font-figtree text-sm font-medium leading-default transition-colors md:min-h-0",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
        disabled
          ? "cursor-not-allowed bg-dashboard-bg-inset text-dashboard-text-light"
          : selected
            ? "bg-dashboard-action-primary text-dashboard-text-inverse"
            : "bg-dashboard-bg-nav text-dashboard-text-heavy hover:bg-dashboard-bg-navSelected",
        className,
      )}
    >
      {children}
    </button>
  );
}
