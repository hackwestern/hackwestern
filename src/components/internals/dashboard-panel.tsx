import * as React from "react";
import { cn } from "~/lib/utils";

export interface DashboardPanelProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
}

// White card used by the home overview ("Upcoming", "Your Hacker Pass:")
export function DashboardPanel({
  title,
  children,
  className,
}: DashboardPanelProps) {
  return (
    <section
      className={cn(
        "flex flex-col gap-3 rounded-dashboard-lg bg-dashboard-bg-surface p-6 font-figtree shadow-dashboard-card",
        className,
      )}
    >
      {title && (
        <h2 className="text-base font-semibold leading-default text-dashboard-text-heavy">
          {title}
        </h2>
      )}
      {children}
    </section>
  );
}
