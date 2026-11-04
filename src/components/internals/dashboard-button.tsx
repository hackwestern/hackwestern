import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

export const dashboardButtonVariants = cva(
  cn(
    "inline-flex cursor-pixel-hover items-center justify-center whitespace-nowrap font-figtree font-medium leading-default transition-colors",
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
    "disabled:pointer-events-none",
    "[&_svg]:size-4 [&_svg]:shrink-0",
  ),
  {
    variants: {
      variant: {
        primary:
          "h-11 w-full gap-2.5 rounded-dashboard-lg bg-dashboard-action-primary px-4 pb-3 pt-2.5 text-base text-dashboard-text-inverse shadow-dashboard-primary-btn hover:bg-dashboard-text-active md:h-auto md:w-auto",
        secondary:
          "gap-0 rounded-full border border-dashboard-border-default bg-dashboard-bg-surface p-[10px] text-[0px] text-dashboard-text-medium shadow-dashboard-secondary-btn hover:bg-dashboard-bg-highlight disabled:opacity-dashboard-disabled md:gap-2 md:px-4 md:py-[9px] md:text-[16px]",
        tertiary:
          "gap-2.5 py-1 text-sm text-dashboard-text-medium hover:text-dashboard-text-light md:text-[16px]",
        outline:
          "h-10 gap-2 rounded-dashboard-md border border-dashboard-border-control bg-dashboard-bg-surface px-3.5 text-sm text-dashboard-text-heavy hover:bg-dashboard-bg-highlight",
      },
    },
    defaultVariants: { variant: "primary" },
  },
);

export interface DashboardButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof dashboardButtonVariants> {
  asChild?: boolean;
}

export const DashboardButton = React.forwardRef<
  HTMLButtonElement,
  DashboardButtonProps
>(({ className, variant, asChild = false, ...props }, ref) => {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      ref={ref}
      className={cn(dashboardButtonVariants({ variant }), className)}
      {...props}
    />
  );
});
DashboardButton.displayName = "DashboardButton";
