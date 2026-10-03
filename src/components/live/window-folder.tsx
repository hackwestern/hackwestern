import * as React from "react";
import Image from "next/image";

import { Window, type WindowProps } from "~/components/internals/window";
import { cn } from "~/lib/utils";

export interface FolderProps {
  label: string;
  windowTitle?: string;
  /** Content rendered inside the opened Window. */
  children?: React.ReactNode;
  /** Passed straight to the opened Window (width, height, autoHeight, etc.) — everything except
   *  title/children/onClose, which this component manages. `className` here positions the window
   *  itself; defaults to a fixed, screen-centered overlay since the Figma frame doesn't specify
   *  where the opened window should land relative to the folder. */
  windowProps?: Partial<Omit<WindowProps, "title" | "children" | "onClose">>;
  className?: string;
  defaultOpen?: boolean;
  /**
   * `hover` (default) — Figma node 561:838: bare icon + white label, chrome on hover.
   * `labelled` — Figma node 402:6199 (past projects): the label pill is always
   * shown so it stays legible against the light sky, and the icon is 1.11x larger.
   */
  variant?: "hover" | "labelled";
}

/**
 * Desktop-style folder icon — Figma node 561:838.
 *
 * The frame in Figma is the HOVER state: a dark translucent rounded-rect
 * behind the icon (rgba(88,88,88,0.7), border #7e7e7e) and a matching pill
 * behind the label (rgba(113,113,113,0.8)). The resting state (not shown in
 * that frame) is just the bare icon + white label text — so those two
 * backgrounds are implemented here as hover-only via `group-hover`, not as
 * permanent chrome. The `labelled` variant keeps the label pill visible.
 */
export function WindowFolder({
  label,
  windowTitle,
  children,
  windowProps,
  className,
  defaultOpen = false,
  variant = "hover",
}: FolderProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);
  const [attentionKey, setAttentionKey] = React.useState(0);
  const labelled = variant === "labelled";

  React.useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (isOpen) setAttentionKey((key) => key + 1);
          else setIsOpen(true);
        }}
        aria-expanded={isOpen}
        className={cn(
          "group flex cursor-pixel-hover flex-col items-center",
          labelled ? "gap-[6px]" : "gap-[7.2px]",
          className,
        )}
      >
        <div
          className={cn(
            "flex items-center justify-center border-transparent transition-colors group-hover:border-[#7e7e7e] group-hover:bg-[rgba(88,88,88,0.7)]",
            labelled
              ? "size-[69px] rounded-[2px] border p-[3px]"
              : "size-[62.1px] rounded-[1.8px] border-[0.9px] p-[9px]",
          )}
        >
          <Image
            src="/landing/home/folder.png"
            alt=""
            className={cn(
              "pointer-events-none object-cover [image-rendering:pixelated]",
              labelled ? "size-[63px]" : "size-[56.7px]",
            )}
            width={125}
            height={125}
          />
        </div>
        <p
          className={cn(
            "whitespace-nowrap font-cossetteTexte text-white transition-colors",
            labelled
              ? "rounded-[5px] bg-[rgba(113,113,113,0.8)] px-[10px] py-[5px] text-[15px] group-hover:bg-[rgba(88,88,88,0.9)]"
              : "rounded-[4.5px] border-[0.9px] border-transparent px-[9px] py-[4.5px] text-[13.5px] group-hover:border-[#7e7e7e] group-hover:bg-[rgba(113,113,113,0.8)]",
          )}
        >
          {label}
        </p>
      </button>

      {isOpen && (
        <Window
          title={windowTitle ?? label}
          onClose={() => setIsOpen(false)}
          {...windowProps}
          className={cn(windowProps?.className)}
          draggable
          attentionKey={attentionKey}
        >
          {children}
        </Window>
      )}
    </>
  );
}
