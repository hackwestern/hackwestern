import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import { Circle } from "lucide-react";

import { cn } from "~/lib/utils";
import { Label } from "./label";

const RadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid gap-2", className)}
      {...props}
      ref={ref}
    />
  );
});
RadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioGroupItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "aspect-square h-4 w-4 rounded-full border border-primary text-primary ring-offset-background focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    >
      <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
        <Circle className="h-2.5 w-2.5 fill-current text-current" />
      </RadioGroupPrimitive.Indicator>
    </RadioGroupPrimitive.Item>
  );
});
RadioGroupItem.displayName = RadioGroupPrimitive.Item.displayName;

export const RadioButtonGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroup>,
  React.ComponentPropsWithoutRef<typeof RadioGroup>
>(({ className, ...props }) => {
  return <RadioGroup className={cn("flex flex-wrap gap-4")} {...props} />;
});
RadioButtonGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioButtonItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & {
    label: string;
  }
>(({ className, value, label, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
      ref={ref}
      className={cn(
        "group inline-flex w-full items-center gap-3 whitespace-nowrap rounded-lg border border-primary-200 px-3 py-2 text-sm font-medium text-violet-500 ring-offset-background transition-colors hover:bg-primary-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=checked]:bg-primary-200 data-[state=checked]:text-primary-600 lg:w-28",
        className,
      )}
      value={value}
      {...props}
    >
      <div
        className={cn(
          "flex aspect-square h-4 w-4 items-center justify-center rounded-full border border-primary-200 ring-offset-background group-focus:outline-none group-disabled:cursor-not-allowed group-disabled:opacity-50",
        )}
      >
        <RadioGroupPrimitive.Indicator className="flex items-center justify-center">
          <Circle className="h-4 w-4 rounded-full border-[5px] border-primary-600 fill-primary-50 text-primary-50" />
        </RadioGroupPrimitive.Indicator>
      </div>
      <Label className="text-sm text-violet-500 group-data-[state=checked]:text-primary-600">
        {label}
      </Label>
    </RadioGroupPrimitive.Item>
  );
});
RadioButtonItem.displayName = RadioGroupPrimitive.Item.displayName;

export { RadioGroup, RadioGroupItem, RadioButtonItem };
