import * as React from "react";
import { cn } from "~/lib/utils";

// ------------------------------------------------------------
// Shared Win95 bevel primitives (mirrors window.tsx)
// ------------------------------------------------------------

const win95Bevel =
  "shadow-[inset_-1px_-1px_0px_0px_#0a0a0a,inset_1px_1px_0px_0px_#ffffff,inset_-2px_-2px_0px_0px_#808080,inset_2px_2px_0px_0px_#dfdfdf]";

const win95BevelInverted =
  "shadow-[inset_-1px_-1px_0px_0px_#0a0a0a,inset_1px_1px_0px_0px_#dfdfdf,inset_-2px_-2px_0px_0px_#808080,inset_2px_2px_0px_0px_#ffffff]";

// Sunken groove — same two-line technique as win95Bevel/win95BevelInverted
// (a dark line then a light line to read as "carved in"), but in softer
// greys instead of near-black, so it separates content from footer without
// the stark high-contrast look of the outer bevels.
const win95Sunken = "shadow-[inset_0_1px_0_0_#75777a,inset_0_2px_0_0_#dedede]";

// Dot texture: DOT_SIZE is the dot itself, DOT_GAP is the space between
// dots. Neither one stands in for the width/height of the box being
// tiled — the tile size is derived from the two (see DOT_TILE below).
const DOT_SIZE = 1;
const DOT_GAP = 16;
const DOT_TILE = DOT_SIZE + DOT_GAP;

// ------------------------------------------------------------
// Card
// ------------------------------------------------------------

function Card({ className, children, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card"
      className={cn(
        "relative flex flex-col overflow-hidden bg-gray-2 text-medium",
        // Drop shadow lives on the main box.
        "shadow-[1px_1px_2px_0px_rgba(0,0,0,0.24),4px_4px_10px_0px_rgba(0,0,0,0.12)]",
        className,
      )}
      {...props}
    >
      {children}
      {/* Outer frame bevel — a separate layer, same as window.tsx's frame
          bevel. Two shadow-[...] utilities on one element don't merge; only
          one would ever actually render. */}
      <div
        aria-hidden
        className={cn("pointer-events-none absolute inset-0", win95Bevel)}
      />
    </div>
  );
}

// ------------------------------------------------------------
// CardHeader — acts as the window title bar
// ------------------------------------------------------------

function CardHeader({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) {
  return (
    <div data-slot="card-header" className={cn("p-[3px]", win95BevelInverted)}>
      <div
        className={cn(
          "flex w-full items-center justify-between bg-gradient-to-r from-blue-8 to-blue-4 pb-[6px] pl-[10px] pr-[6px] pt-[10px]",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

function CardTitle({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-title"
      className={cn(
        "subtitle-sm truncate whitespace-nowrap tracking-[-0.36px] text-white",
        className,
      )}
      {...props}
    />
  );
}

function CardAction({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-action"
      className={cn("flex shrink-0 items-center gap-[2px]", className)}
      {...props}
    />
  );
}

// ------------------------------------------------------------
// CardDescription
// ------------------------------------------------------------

function CardDescription({ className, ...props }: React.ComponentProps<"p">) {
  return (
    <p
      data-slot="card-description"
      className={cn("p3 text-light", className)}
      {...props}
    />
  );
}

// ------------------------------------------------------------
// CardContent — optional dotted texture, like the window body
// ------------------------------------------------------------

function CardContent({
  className,
  showDots = false,
  children,
  ...props
}: React.ComponentProps<"div"> & { showDots?: boolean }) {
  const patternId = React.useId();
  const contentRef = React.useRef<HTMLDivElement>(null);
  const [size, setSize] = React.useState({ width: 0, height: 0 });

  React.useEffect(() => {
    if (!showDots || !contentRef.current) return;
    const el = contentRef.current;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;

      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [showDots]);

  return (
    <div
      data-slot="card-content"
      ref={contentRef}
      className={cn("relative p2 px-4 py-4 text-heavy", className)}
      {...props}
    >
      {showDots && (
        <svg
          aria-hidden
          className="pointer-events-none absolute inset-0 block h-full w-full"
        >
          <defs>
            <pattern
              id={patternId}
              // Center the pattern within whatever size this box actually
              // renders at — same idea as window.tsx's offset math, just
              // measured instead of taking width/height as props.
              x={(size.width % DOT_TILE) / 2}
              y={(size.height % DOT_TILE) / 2}
              width={DOT_TILE}
              height={DOT_TILE}
              patternUnits="userSpaceOnUse"
            >
              <rect
                width={DOT_SIZE}
                height={DOT_SIZE}
                className="fill-gray-4"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill={`url(#${patternId})`} />
        </svg>
      )}
      <div className="relative">{children}</div>
    </div>
  );
}

// ------------------------------------------------------------
// CardFooter — status-bar style strip, sunken divider
// ------------------------------------------------------------

function CardFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        "p3 flex items-center justify-between gap-2 bg-gray-1 px-4 py-2 text-medium",
        win95Sunken,
        className,
      )}
      {...props}
    />
  );
}

export {
  Card,
  CardHeader,
  CardTitle,
  CardAction,
  CardDescription,
  CardContent,
  CardFooter,
};