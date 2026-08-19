import * as React from "react";
import { motion, useDragControls } from "framer-motion";
import { cn } from "~/lib/utils";

const TITLE_BAR_HEIGHT = 34;
const DOT_SPACING = 12;

export interface WindowProps {
  title: string;
  children?: React.ReactNode;
  className?: string;
  width?: number;
  height?: number;
  showDots?: boolean;
  minimized?: boolean;
  onMinimizedChange?: (minimized: boolean) => void;
  onClose?: () => void;
  draggable?: boolean;
  disableExpand?: boolean;
  autoHeight?: boolean;
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
  onClose,
  draggable = true,
  disableExpand = false,
  autoHeight = false,
}: WindowProps) {
  const [internalMinimized, setInternalMinimized] = React.useState(false);
  const isControlled = minimizedProp !== undefined;
  const minimized = isControlled ? minimizedProp : internalMinimized;

  const setMinimized = (value: boolean) => {
    if (!isControlled) setInternalMinimized(value);
    onMinimizedChange?.(value);
  };

  const patternId = React.useId();
  const dragControls = useDragControls();

  const titleBar = (
    <div
      className="relative flex h-[34px] cursor-move items-center rounded-t-[10px] border-b-[0.9px] border-b-white bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.2)_0px,rgba(255,255,255,0.2)_1px,rgba(0,0,0,0.035)_1px,rgba(0,0,0,0.035)_2px),linear-gradient(180deg,#eceeef_0%,#c8cbcf_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(40,45,55,0.25)] active:cursor-grabbing"
      onPointerDown={(event) => {
        if (draggable && !(event.target as HTMLElement).closest("button")) {
          event.preventDefault();
          dragControls.start(event);
        }
      }}
    >
      <div className="z-10 flex items-center gap-2">
        <button
          type="button"
          aria-label="Close window"
          onClick={onClose}
          disabled={!onClose}
          className="relative size-[13px] rounded-full border border-[#c93a2b] bg-[radial-gradient(circle_at_50%_30%,#ff8a80,#ec4c3c_70%)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.18)] transition-[transform,filter] duration-100 before:pointer-events-none before:absolute before:left-[3px] before:right-[3px] before:top-px before:h-[5px] before:rounded-full before:bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.15))] before:content-[''] hover:scale-110 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43484f]/50 active:scale-95 disabled:cursor-default"
        />
        <button
          type="button"
          aria-label="Minimize window"
          onClick={() => setMinimized(true)}
          disabled={minimized}
          title="Minimize window"
          className="relative size-[13px] rounded-full border border-[#cf9325] bg-[radial-gradient(circle_at_50%_30%,#ffe082,#f5b731_70%)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.18)] transition-[transform,filter] duration-100 before:pointer-events-none before:absolute before:left-[3px] before:right-[3px] before:top-px before:h-[5px] before:rounded-full before:bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.15))] before:content-[''] hover:scale-110 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43484f]/50 active:scale-95 disabled:opacity-50"
        />
        <button
          type="button"
          aria-label="Maximize window"
          onClick={() => setMinimized(false)}
          disabled={!minimized || disableExpand}
          title="Maximize window"
          className="relative size-[13px] rounded-full border border-[#43a12f] bg-[radial-gradient(circle_at_50%_30%,#b9f6a5,#56c93f_70%)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.25),0_1px_1px_rgba(0,0,0,0.18)] transition-[transform,filter] duration-100 before:pointer-events-none before:absolute before:left-[3px] before:right-[3px] before:top-px before:h-[5px] before:rounded-full before:bg-[linear-gradient(180deg,rgba(255,255,255,0.9),rgba(255,255,255,0.15))] before:content-[''] hover:scale-110 hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#43484f]/50 active:scale-95 disabled:opacity-50"
        />
      </div>
      <p className="pointer-events-none absolute inset-x-0 text-center font-cossetteTexte text-[10.8px] font-normal leading-normal text-[#626262]">
        {title}
      </p>
    </div>
  );

  if (autoHeight) {
    return (
      <motion.div
        className={cn("relative select-none", className)}
        style={{ width }}
        drag={draggable}
        dragControls={dragControls}
        dragListener={false}
        dragMomentum={false}
      >
        <div
          className="relative overflow-hidden rounded-[10px] border-[0.9px] border-[#9F9F9F] bg-[#f4f5f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(30,40,60,0.3),0_4px_10px_rgba(30,40,60,0.2)]"
          style={{ width }}
        >
          {titleBar}
          {children && (
            <div
              className={cn(
                "grid transition-[grid-template-rows] duration-200",
                minimized ? "grid-rows-[0fr]" : "grid-rows-[1fr]",
              )}
            >
              <div className="relative min-h-0 overflow-hidden bg-[#f4f5f8] font-cossetteTexte text-[10.8px] font-normal leading-normal text-black">
                <div className="relative grid place-items-center px-4 py-3">
                  <div className="relative z-10">{children}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      className={cn("relative select-none", className)}
      style={{ width, height }}
      drag={draggable}
      dragControls={dragControls}
      dragListener={false}
      dragMomentum={false}
    >
      <div
        className="relative overflow-hidden rounded-[10px] border-[0.9px] border-[#9F9F9F] bg-[#f4f5f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(30,40,60,0.3),0_4px_10px_rgba(30,40,60,0.2)] transition-[height] duration-200"
        style={{ width, height: minimized ? TITLE_BAR_HEIGHT : height }}
      >
        <div className="absolute left-0 right-0 top-0 z-20">{titleBar}</div>

        {showDots && (
          <svg
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 top-[34px] z-0 block h-full w-full"
          >
            <defs>
              <pattern
                id={patternId}
                x={((width - 8) % DOT_SPACING) / 2}
                y={((height - TITLE_BAR_HEIGHT) % DOT_SPACING) / 2}
                width={DOT_SPACING}
                height={DOT_SPACING}
                patternUnits="userSpaceOnUse"
              >
                <rect width="1" height="1" className="fill-[#C8C8C8]" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill={`url(#${patternId})`} />
          </svg>
        )}
      </div>

      {children && (
        <div
          className="pointer-events-none absolute left-0 right-0 top-0 overflow-hidden transition-[height] duration-200"
          style={{ height: minimized ? TITLE_BAR_HEIGHT : height }}
        >
          <div
            className={cn(
              "pointer-events-auto absolute inset-x-0 bottom-0 top-[34px] z-10 grid place-items-center font-cossetteTexte text-[10.8px] font-normal leading-normal text-black",
              "transition-opacity duration-150 ease-in-out",
              minimized ? "pointer-events-none opacity-0" : "opacity-100",
            )}
            style={{ height: height - TITLE_BAR_HEIGHT }}
          >
            {children}
          </div>
        </div>
      )}
    </motion.div>
  );
}
