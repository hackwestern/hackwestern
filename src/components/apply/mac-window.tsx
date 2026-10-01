import * as React from "react";
import { cn } from "~/lib/utils";

export interface MacWindowProps {
  title?: string;
  children?: React.ReactNode;
  className?: string;
  contentClassName?: string;
}

function TrafficLights() {
  return (
    <div className="flex items-center gap-[5px]">
      <span className="size-3 rounded-full bg-[#ff5f56] shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]" />
      <span className="size-3 rounded-full bg-[#ffbd2e] shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]" />
      <span className="size-3 rounded-full bg-[#27c93f] shadow-[inset_0_-1px_0_rgba(0,0,0,0.15)]" />
    </div>
  );
}

export function MacWindow({
  title,
  children,
  className,
  contentClassName,
}: MacWindowProps) {
  return (
    <div
      className={cn(
        "relative flex flex-col overflow-hidden rounded-[6px] border border-[#9f9f9f] bg-[rgba(237,237,237,0.6)] shadow-lg backdrop-blur-sm",
        className,
      )}
    >
      <div className="relative flex h-[23px] shrink-0 items-center justify-between border-b border-[#9f9f9f] bg-[rgba(240,240,240,0.8)] px-[6px]">
        <TrafficLights />
        {title && (
          <p className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap font-primary text-[12px] text-[#626262]">
            {title}
          </p>
        )}
        <div className="size-[12px] opacity-0" aria-hidden />
      </div>

      <div className={cn("flex-1 overflow-auto", contentClassName)}>
        {children}
      </div>
    </div>
  );
}
