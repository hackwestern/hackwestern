import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "~/lib/utils";

const Tabs = TabsPrimitive.Root;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex w-fit items-center rounded-dashboard-lg border border-dashboard-border-faint bg-dashboard-bg-nav",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      cn(
        "inline-flex cursor-pixel-hover items-center justify-center whitespace-nowrap rounded-dashboard-lg px-4 py-[11px] font-figtree text-base font-medium leading-default text-dashboard-text-heavy transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary disabled:pointer-events-none disabled:opacity-dashboard-disabled",
        "data-[state=active]:bg-dashboard-action-primary data-[state=active]:text-dashboard-text-inverse data-[state=inactive]:hover:bg-dashboard-bg-navSelected",
        "[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
      ),
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-dashboard-action-primary focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
