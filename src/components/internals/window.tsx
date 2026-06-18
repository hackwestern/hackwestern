import * as React from "react";
import { cn } from "~/lib/utils";
import IconButton from "./icon-button";

// ─── Window Chrome ──────────────────────────────────────────────────────────
//
// Retro Windows-95-style window frame. Bevel borders use the classic
// Win95 4-corner inset shadow trick (light top-left, dark bottom-right).
// Title bar is a gradient from blue-8 (#042239) to blue-4 (#3B94EC).
// Body has a dotted/textured grid background (generated, not hardcoded).

const win95Bevel =
  "shadow-[inset_-1px_-1px_0px_0px_#0a0a0a,inset_1px_1px_0px_0px_#ffffff,inset_-2px_-2px_0px_0px_#808080,inset_2px_2px_0px_0px_#dfdfdf]";

const win95BevelInverted =
  "shadow-[inset_-1px_-1px_0px_0px_#0a0a0a,inset_1px_1px_0px_0px_#dfdfdf,inset_-2px_-2px_0px_0px_#808080,inset_2px_2px_0px_0px_#ffffff]";

// Title bar height (padding + content) — used to collapse the window when minimized
const TITLE_BAR_HEIGHT = 49;

export interface WindowProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  /** Width/height of the dotted texture body — defaults match Figma (374x208) */
  width?: number;
  height?: number;
  /** Render the dotted background texture */
  showDots?: boolean;
  /** Controlled minimized state. If omitted, the component manages its own state. */
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
}

export function Window({
  title,
  children,
  className,
  width = 374,
  height = 208,
  showDots = true,
  minimized: minimizedProp,
  onMinimizedChange,
}: WindowProps) {
  const [internalMinimized, setInternalMinimized] = React.useState(false);
  const isControlled = minimizedProp !== undefined;
  const minimized = isControlled ? minimizedProp : internalMinimized;

  

  const setMinimized = (value: boolean) => {
    if (!isControlled) setInternalMinimized(value);
    onMinimizedChange?.(value);
  };
  
  const minDisabled = minimized;
  const maxDisabled = !minimized;
  
  return (
    <div
      className={cn(
        "relative overflow-clip shadow-[1px_1px_2px_0px_rgba(0,0,0,0.24),4px_4px_10px_0px_rgba(0,0,0,0.12)] transition-[height] duration-150",
        className,
      )}
      style={{ width, height: minimized ? TITLE_BAR_HEIGHT : height }}
    >
      {/* Body background */}
      <div aria-hidden className="absolute inset-0 pointer-events-none" />

      {/* Dotted texture */}
      {showDots && !minimized && (
        <div
          aria-hidden
          className="absolute inset-[58px_15.5px_13px_15.5px] flex flex-wrap content-center items-center gap-[16px] pointer-events-none"
        >
          {Array.from({ length: 244 }).map((_, i) => (
            <div key={i} className="size-px shrink-0 bg-gray-4" />
          ))}
        </div>
      )}

      {/* Title bar wrapper (carries outer bevel) */}
      <div className={cn("absolute left-0 right-0 top-0 p-[3px]", win95BevelInverted)}>
        <div aria-hidden className="absolute inset-0 bg-[#c0c0c0] pointer-events-none" />

        {/* Gradient: blue-8 (#042239) -> blue-4 (#3B94EC), left to right */}
        <div className="relative flex w-full items-center justify-between bg-gradient-to-r from-blue-8 to-blue-4 pb-[6px] pl-[10px] pr-[2px] pt-[10px]">
          <p className="subtitle-sm whitespace-nowrap tracking-[-0.36px] text-white">
            {title}
          </p>

          <div className="flex items-center">
            {/* Minimize: collapses content into the title bar */}
            <IconButton onClick={() => setMinimized(true)} className="pl-[4px] pr-[6px] pt-[9px] pb-[3px]" disabled={minDisabled}>
              <svg width="6" height="2" viewBox="0 0 6 2" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M0 0H6V2H0V0Z" fill="black"/>
                </svg>

            </IconButton> 
            {/* add disabled wen clicked */}
            <IconButton onClick={() => setMinimized(false)} className="pl-[3px] pr-[4px] pt-[2px] pb-[3px]" disabled={maxDisabled}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fill-rule="evenodd" clip-rule="evenodd" d="M9 0H0V9H9V0ZM8 2H1V8H8V2Z" fill="black"/>
                </svg>
            </IconButton> 

          </div>
        </div>
      </div>

      {/* Window body content (renders above dots, hidden when minimized) */}
      {children && !minimized && (
        <div className="absolute inset-[58px_15.5px_13px_15.5px] z-[1]">
          {children}
        </div>
      )}

      {/* Outer frame bevel */}
      <div aria-hidden className={cn("pointer-events-none absolute inset-0 rounded-[inherit]", win95Bevel)} />
    </div>
  );
}