import * as React from "react";
import Link from "next/link";
import { ChevronRight, Presentation, Utensils } from "lucide-react";
import { cn } from "~/lib/utils";

export type ActivityKind = "meal" | "activity";

// Extract activity kind from scavenger hunt item code (meals end with "_meal")
export const activityKindFromCode = (code: string | null | undefined) =>
  code?.endsWith("_meal") ? "meal" : "activity";

export function ActivityIcon({
  kind,
  className,
}: {
  kind: ActivityKind;
  className?: string;
}) {
  const Icon = kind === "meal" ? Utensils : Presentation;
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-[45px] shrink-0 items-center justify-center rounded-dashboard-iconBadge",
        kind === "meal"
          ? "bg-dashboard-status-iconBadge text-dashboard-status-iconBadgeIcon"
          : "bg-dashboard-bg-nav text-dashboard-action-primary",
        className,
      )}
    >
      <Icon className="size-5" strokeWidth={1.67} />
    </span>
  );
}

export interface ActivityCardProps {
  title: string;
  meta?: string;
  kind: ActivityKind;
  variant?: "default" | "featured";
  href?: string;
  onClick?: () => void;
  children?: React.ReactNode;
  className?: string;
}

export function ActivityCard({
  title,
  meta,
  kind,
  variant = "default",
  href,
  onClick,
  children,
  className,
}: ActivityCardProps) {
  const featured = variant === "featured";
  const interactive =
    !featured && (href !== undefined || onClick !== undefined);

  const row = (
    <>
      <ActivityIcon kind={kind} />
      <div className="flex min-w-0 flex-1 flex-col gap-[5px] text-left">
        <span
          className={cn(
            "truncate text-dashboard-text-heavy",
            featured ? "text-lg font-semibold" : "text-base font-medium",
          )}
        >
          {title}
        </span>
        {meta && (
          <span className="truncate text-sm text-dashboard-text-light">
            {meta}
          </span>
        )}
      </div>
      {interactive && (
        <ChevronRight
          aria-hidden="true"
          className="size-5 shrink-0 text-dashboard-text-light"
        />
      )}
    </>
  );

  const base = cn(
    "w-full rounded-dashboard-2xl bg-dashboard-bg-surface font-figtree font-medium leading-default shadow-dashboard-card",
    featured
      ? "flex flex-col gap-4 p-4"
      : "flex items-center gap-3 border border-dashboard-border-faint p-3",
  );

  if (featured) {
    return (
      <div className={cn(base, className)}>
        <div className="flex items-center gap-3">{row}</div>
        {children}
      </div>
    );
  }

  const interactiveClasses = cn(
    base,
    "cursor-pixel-hover transition-colors hover:bg-dashboard-bg-highlight",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
    className,
  );

  if (href !== undefined) {
    return (
      <Link href={href} className={interactiveClasses}>
        {row}
      </Link>
    );
  }

  if (onClick !== undefined) {
    return (
      <button type="button" onClick={onClick} className={interactiveClasses}>
        {row}
      </button>
    );
  }

  return <div className={cn(base, className)}>{row}</div>;
}
