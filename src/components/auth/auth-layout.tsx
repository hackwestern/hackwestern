/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { HWLogoLink } from "~/components/apply/hw-logo";
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

      {/* Above the full-screen content layer, or it can't be clicked. Below lg
          it sits higher and the content starts under it, so it can't cover
          the window. */}
      <div className="absolute left-4 top-6 z-20 px-3 lg:left-10 lg:top-16">
        <HWLogoLink className="h-[60px] w-[40px]" />
      </div>

      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 pb-16 pt-24 lg:py-16">
        <Window
          fluid
          draggable={false}
          disableControls
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
