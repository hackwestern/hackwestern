/* eslint-disable @next/next/no-img-element */
import * as React from "react";
import { HWLogo } from "~/components/apply/hw-logo";
import { MacWindow } from "~/components/apply/mac-window";
import { cn } from "~/lib/utils";

export interface AuthLayoutProps {
  title?: string;
  windowTitle?: string;
  children: React.ReactNode;
  windowClassName?: string;
}

const DOT_SPACING = 12;

function DotPattern() {
  const patternId = React.useId();
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full"
    >
      <defs>
        <pattern
          id={patternId}
          width={DOT_SPACING}
          height={DOT_SPACING}
          patternUnits="userSpaceOnUse"
        >
          <rect width="1" height="1" className="fill-[#C8C8C8]" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#${patternId})`} />
    </svg>
  );
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
        <MacWindow
          title={windowTitle}
          className={cn(
            "w-full max-w-[600px] bg-[#ededed] shadow-2xl",
            windowClassName,
          )}
          contentClassName="relative p-6 sm:p-12"
        >
          <DotPattern />
          <div className="relative flex flex-col gap-8">
            {title && (
              <h1 className="font-figtree text-sm-display font-bold text-gray-5">
                {title}
              </h1>
            )}
            {children}
          </div>
        </MacWindow>
      </div>
    </div>
  );
}
