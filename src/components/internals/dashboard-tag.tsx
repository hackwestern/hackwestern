import * as React from "react";
import { cn } from "~/lib/utils";

export type DashboardTagProps = {
  children: React.ReactNode;
  className?: string;
} & (
  | { onClick?: undefined; selected?: never }
  | { onClick: () => void; selected?: boolean }
);

export function DashboardTag({
  children,
  selected,
  onClick,
  className,
}: DashboardTagProps) {
  const classes = cn(
    "inline-flex items-center whitespace-nowrap rounded-dashboard-sm px-2 py-1 font-figtree text-xs font-medium leading-5 transition-colors",
    selected
      ? "bg-dashboard-action-primary text-dashboard-text-inverse"
      : "bg-dashboard-bg-nav text-dashboard-text-light",
  );

  if (!onClick) {
    return <span className={cn(classes, className)}>{children}</span>;
  }

  return (
    <button
      type="button"
      aria-pressed={selected ?? false}
      onClick={onClick}
      className={cn(
        classes,
        "cursor-pixel-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
        !selected && "hover:bg-dashboard-bg-navSelected",
        className,
      )}
    >
      {children}
    </button>
  );
}
