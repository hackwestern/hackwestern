/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { HWLogo } from "~/components/apply/hw-logo";
import { UserBadge } from "~/components/apply/user-badge";
import { cn } from "~/lib/utils";
import { realmTint, type Realm } from "~/constants/realms";

export interface PortalShellProps {
  firstName?: string | null;
  onSignOut?: () => void;
  children: React.ReactNode;
  className?: string;
  background?: string;
  realm?: Realm | null;
}

export function PortalShell({
  firstName,
  onSignOut,
  children,
  className,
  background,
  realm = null,
}: PortalShellProps) {
  const tint = realm ? realmTint[realm] : null;
  const bgSrc = background ?? tint?.background ?? "/apply/realm/background.png";
  return (
    <div
      className={cn("relative min-h-screen w-full overflow-hidden", className)}
    >
      <AnimatePresence mode="sync" initial={false}>
        <motion.img
          key={bgSrc}
          src={bgSrc}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
          draggable={false}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
        />
      </AnimatePresence>

      <div className="absolute left-10 top-16 z-10 px-3">
        <HWLogo className="h-[60px] w-[40px]" />
      </div>

      <div className="absolute right-9 top-9 z-10">
        <UserBadge firstName={firstName ?? "there"} onSignOut={onSignOut} />
      </div>

      <div className="relative z-[5] flex min-h-screen items-center justify-center px-6">
        {children}
      </div>
    </div>
  );
}
