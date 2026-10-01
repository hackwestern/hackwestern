import * as React from "react";
import { motion, useDragControls, type MotionProps } from "framer-motion";
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
  dragConstraints?: MotionProps["dragConstraints"];
  disableExpand?: boolean;
  autoHeight?: boolean;
  /** Size comes from className instead of width/height; content scrolls. */
  fluid?: boolean;
  contentClassName?: string;
  /** Traffic lights render but do nothing. */
  disableControls?: boolean;
  /** Fluid only: a bar pinned under the scrolling content. */
  footer?: React.ReactNode;
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
  dragConstraints,
  disableExpand = false,
  autoHeight = false,
  fluid = false,
  contentClassName,
  disableControls = false,
  footer,
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
      className={cn(
        "relative flex h-[34px] select-none items-center rounded-t-[10px] border-b-[0.9px] border-b-white bg-[repeating-linear-gradient(180deg,rgba(255,255,255,0.2)_0px,rgba(255,255,255,0.2)_1px,rgba(0,0,0,0.035)_1px,rgba(0,0,0,0.035)_2px),linear-gradient(180deg,#eceeef_0%,#c8cbcf_100%)] px-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),inset_0_-1px_0_rgba(40,45,55,0.25)]",
        draggable && "cursor-move active:cursor-grabbing",
      )}
      onPointerDown={(event) => {
        if (draggable && !(event.target as HTMLElement).closest("button")) {
          event.preventDefault();
          dragControls.start(event);
        }
      }}
    >
      <div
        className={cn(
          "z-10 flex items-center gap-2",
          disableControls &&
            "pointer-events-none [&>button:disabled]:opacity-100",
        )}
      >
        <button
          type="button"
          aria-label="Close window"
          onClick={onClose}
          disabled={disableControls || !onClose}
          className="window-traffic-light window-traffic-light-red"
        />
        <button
          type="button"
          aria-label="Minimize window"
          onClick={() => setMinimized(true)}
          disabled={disableControls || minimized}
          title="Minimize window"
          className="window-traffic-light window-traffic-light-yellow"
        />
        <button
          type="button"
          aria-label="Restore window"
          onClick={() => setMinimized(false)}
          disabled={disableControls || !minimized || disableExpand}
          title="Restore window"
          className="window-traffic-light window-traffic-light-green"
        />
      </div>
      <p className="pointer-events-none absolute inset-x-0 text-center font-cossetteTexte text-[10.8px] font-normal leading-normal text-[#626262]">
        {title}
      </p>
    </div>
  );

  if (fluid) {
    return (
      <motion.div
        className={cn("relative flex flex-col", className)}
        drag={draggable}
        dragControls={dragControls}
        dragConstraints={dragConstraints}
        dragListener={false}
        dragMomentum={false}
      >
        <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-[10px] border-[0.9px] border-[#9F9F9F] bg-[#f4f5f8] shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_18px_40px_rgba(30,40,60,0.3),0_4px_10px_rgba(30,40,60,0.2)]">
          <div className="shrink-0">{titleBar}</div>
          {!minimized && (
            <div className="relative min-h-0 flex-1">
              {showDots && (
                <svg
                  aria-hidden
                  className="pointer-events-none absolute inset-0 z-0 h-full w-full"
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
                  <rect
                    width="100%"
                    height="100%"
                    fill={`url(#${patternId})`}
                  />
                </svg>
              )}
              <div
                className={cn(
                  "relative z-10 h-full overflow-auto",
                  contentClassName,
                )}
              >
                {children}
              </div>
            </div>
          )}
          {!minimized && footer && (
            <div className="shrink-0 border-t-[0.9px] border-[#9F9F9F] bg-[#f4f5f8] px-6 py-2">
              {footer}
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  if (autoHeight) {
    return (
      <motion.div
        className={cn("relative", className)}
        style={{ width }}
        drag={draggable}
        dragControls={dragControls}
        dragConstraints={dragConstraints}
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
                {showDots && (
                  <svg
                    aria-hidden
                    className="pointer-events-none absolute inset-0 z-0 h-full w-full"
                  >
                    <defs>
                      <pattern
                        id={patternId}
                        x={((width - 8) % DOT_SPACING) / 2}
                        y={0}
                        width={DOT_SPACING}
                        height={DOT_SPACING}
                        patternUnits="userSpaceOnUse"
                      >
                        <rect width="1" height="1" className="fill-[#C8C8C8]" />
                      </pattern>
                    </defs>
                    <rect
                      width="100%"
                      height="100%"
                      fill={`url(#${patternId})`}
                    />
                  </svg>
                )}
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
      className={cn("relative", className)}
      style={{ width, height }}
      drag={draggable}
      dragControls={dragControls}
      dragConstraints={dragConstraints}
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

        {children && (
          <div
            className={cn(
              "absolute inset-x-0 bottom-0 top-[34px] z-10 grid place-items-center overflow-hidden font-cossetteTexte text-[10.8px] font-normal leading-normal text-black",
              "transition-opacity duration-150 ease-in-out",
              minimized ? "pointer-events-none opacity-0" : "opacity-100",
            )}
          >
            {children}
          </div>
        )}
      </div>
    </motion.div>
  );
}
