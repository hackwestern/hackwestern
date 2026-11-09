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
      {/* Frosted backing: the realm backgrounds are mid-tone photos, so bare
          text can't stay readable on all of them. */}
      <p className="rounded-full bg-white/80 px-4 py-1.5 font-figtree text-md-p font-medium text-medium shadow-sm backdrop-blur-sm">
        Hi, {firstName}!{" "}
        <span aria-hidden className="mx-1 text-medium/50">
          |
        </span>{" "}
        {onSignOut ? (
          <button
            type="button"
            onClick={onSignOut}
            className="font-medium text-medium underline-offset-2 hover:underline"
          >
            Sign Out
          </button>
        ) : (
          <span className="font-medium text-medium">Sign Out</span>
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
