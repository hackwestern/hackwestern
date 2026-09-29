import * as React from "react";
import { cn } from "~/lib/utils";

export interface UserBadgeProps {
  firstName: string;
  emoji?: string;
  onSignOut?: () => void;
  className?: string;
}

export function UserBadge({
  firstName,
  emoji = "🐴",
  onSignOut,
  className,
}: UserBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-[13px] whitespace-nowrap",
        className,
      )}
    >
      <p className="font-secondary text-md-p font-medium text-light">
        Hi, {firstName}!{" "}
        <span aria-hidden className="mx-1 text-light/70">
          |
        </span>{" "}
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="font-medium text-light underline-offset-2 hover:underline"
          >
            Sign Out
          </button>
        ) : (
          <span className="font-medium text-light">Sign Out</span>
        )}
      </p>
      <span
        aria-hidden
        className="font-primary text-3xl leading-none text-white drop-shadow"
      >
        {emoji}
      </span>
    </div>
  );
}
