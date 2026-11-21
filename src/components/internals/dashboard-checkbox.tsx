import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { cn } from "~/lib/utils";

// Matches lucide's square-check: an 18px box inside a 24px icon frame.
// `round` gives a circle (multi-select lists like the sponsor filter) whose
// check fades in and out over 150ms (instant with reduced motion).
const DashboardCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root> & {
    round?: boolean;
  }
>(({ className, round = false, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer m-[3px] size-[18px] shrink-0 cursor-pixel-hover border-2 border-dashboard-border-medium bg-transparent transition-colors hover:border-dashboard-border-strong",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
      "data-[state=checked]:border-dashboard-action-primary data-[state=checked]:bg-dashboard-action-primary",
      round ? "rounded-full" : "rounded-dashboard-xs",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator
      forceMount={round ? true : undefined}
      className={cn(
        "flex items-center justify-center text-dashboard-text-inverse",
        round &&
          "data-[state=unchecked]:opacity-0 motion-safe:transition-opacity motion-safe:duration-150 motion-safe:ease-out",
      )}
    >
      <svg
        viewBox="5 5 14 14"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="size-[14px]"
      >
        <path d="m9 12 2 2 4-4" />
      </svg>
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
DashboardCheckbox.displayName = "DashboardCheckbox";

export { DashboardCheckbox };
