import * as React from "react";
import { cn } from "~/lib/utils";
import { Window, type WindowProps } from "~/components/internals/window";
import Image from "next/image";

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
}

/**
 * Desktop-style folder icon — Figma node 561:838.
 *
 * The frame in Figma is the HOVER state: a dark translucent rounded-rect
 * behind the icon (rgba(88,88,88,0.7), border #7e7e7e) and a matching pill
 * behind the label (rgba(113,113,113,0.8)). The resting state (not shown in
 * that frame) is just the bare icon + white label text — so those two
 * backgrounds are implemented here as hover-only via `group-hover`, not as
 * permanent chrome.
 */
export function WindowFolder({
  label,
  windowTitle,
  children,
  windowProps,
  className,
  defaultOpen = false,
}: FolderProps) {
  const [isOpen, setIsOpen] = React.useState(defaultOpen);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        className={cn(
          "group flex flex-col items-center gap-[7.2px] cursor-pixel-hover",
          className,
        )}
      >
        <div
          className="flex size-[62.1px] items-center justify-center rounded-[1.8px]
                     border-[0.9px] border-transparent p-[9px] transition-colors
                     group-hover:border-[#7e7e7e] group-hover:bg-[rgba(88,88,88,0.7)]"
        >
            <Image
              src="/landing/home/folder.png"
              alt=""
              className="size-[56.7px] object-cover pointer-events-none"
              width={125}
              height={125}
            />
        </div>
        <p
          className="rounded-[4.5px] border-[0.9px] border-transparent px-[9px] py-[4.5px]
                     font-cossetteTexte text-[13.5px] text-white transition-colors
                     group-hover:border-[#7e7e7e] group-hover:bg-[rgba(113,113,113,0.8)]"
        >
          {label}
        </p>
      </button>
      
      {isOpen && (
        <Window
          title={windowTitle ?? label}
          onClose={() => setIsOpen(false)}
          {...windowProps}
          className={cn(
            windowProps?.className,
          )}
          draggable
        >
          {children}
        </Window>
      )}
    </>
  );
}
  