/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { HWLogo } from "~/components/apply/hw-logo";
import { Window } from "~/components/internals/window";
import { cn } from "~/lib/utils";

export interface AuthLayoutProps {
  title?: string;
  windowTitle?: string;
  children: React.ReactNode;
  windowClassName?: string;
}

export function AuthLayout({
  title,
  windowTitle = "Hack Western 13: Discover the Unknown",
  children,
  windowClassName,
}: AuthLayoutProps) {
  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <img
        src="/apply/realm/background.png"
        alt=""
        aria-hidden
        className="absolute inset-0 h-full w-full object-cover"
        draggable={false}
      />

      <div className="absolute left-10 top-16 z-10 px-3">
        <HWLogo className="h-[60px] w-[40px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-16">
        <Window
          fluid
          draggable={false}
          title={windowTitle}
          className={cn("w-full max-w-[600px]", windowClassName)}
          contentClassName="p-6 sm:p-12"
        >
          <div className="relative flex flex-col gap-8">
            {title && (
              <h1 className="font-figtree text-sm-display font-bold text-gray-5">
                {title}
              </h1>
            )}
            {children}
          </div>
        </Window>
      </div>
    </div>
  );
}
