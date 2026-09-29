/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { HWLogo } from "~/components/apply/hw-logo";
import { UserBadge } from "~/components/apply/user-badge";
import { cn } from "~/lib/utils";

export interface PortalShellProps {
  firstName?: string | null;
  onSignOut?: () => void;
  children: React.ReactNode;
  className?: string;
  background?: string;
}

export function PortalShell({
  firstName,
  onSignOut,
  children,
  className,
  background = "/apply/realm/background.png",
}: PortalShellProps) {
  return (
    <div className={cn("relative min-h-screen w-full overflow-hidden", className)}>
      <img
        src={background}
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      <div className="absolute left-10 top-16 z-10 px-3">
        <HWLogo className="h-[60px] w-[40px]" />
      </div>

      <div className="absolute right-9 top-9 z-10">
        <UserBadge
          firstName={firstName ?? "there"}
          onSignOut={onSignOut}
        />
      </div>

      <div className="relative z-[5] flex min-h-screen items-center justify-center px-6">
        {children}
      </div>
    </div>
  );
}
