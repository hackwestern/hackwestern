import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";

import { cn } from "~/lib/utils";

// Matches lucide's square-check: an 18px box inside a 24px icon frame
const DashboardCheckbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer m-[3px] size-[18px] shrink-0 cursor-pixel-hover rounded-dashboard-xs border-2 border-dashboard-border-medium bg-transparent transition-colors hover:border-dashboard-border-strong",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
      "data-[state=checked]:border-dashboard-action-primary data-[state=checked]:bg-dashboard-action-primary",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-dashboard-text-inverse">
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
