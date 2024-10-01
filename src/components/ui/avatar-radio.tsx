import * as React from "react";
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group";
import Avatar from "../apply/avatar";
import { cn } from "~/lib/utils";

type AvatarType =
  | "Wildlife Wanderer"
  | "City Cruiser"
  | "Foodie Fanatic"
  | "Beach Bum";

interface AvatarRadioProps {
  value: AvatarType | null | undefined;
  onChange: (avatar: AvatarType) => void;
}

const avatarOptions: AvatarType[] = [
  "Wildlife Wanderer",
  "City Cruiser",
  "Foodie Fanatic",
  "Beach Bum",
];

const AvatarRadioGroup = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root> & AvatarRadioProps
>(({ value, onChange, className, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Root
      className={cn("grid grid-cols-2 gap-8", className)}
      value={value}
      onValueChange={onChange}
      ref={ref}
      {...props}
    >
      {avatarOptions.map((option, index) => (
        <RadioButtonItem
          key={index}
          value={option}
        >
          <Avatar
            avatar={option}
            selection={true}
          />
        </RadioButtonItem>
      ))}
    </RadioGroupPrimitive.Root>
  );
});
AvatarRadioGroup.displayName = RadioGroupPrimitive.Root.displayName;

const RadioButtonItem = React.forwardRef<
  React.ElementRef<typeof RadioGroupPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  return (
    <RadioGroupPrimitive.Item
    ref={ref}
    className={cn(
      "hidden inline-flex w-full cursor-pointer rounded-lg border border-grey-200 px-1 pt-1 text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 data-[state=checked]:bg-primary-200 data-[state=checked]:border-primary-500",
    )}
    {...props}
  >
    {children}
  </RadioGroupPrimitive.Item>
  );
});
RadioButtonItem.displayName = RadioGroupPrimitive.Item.displayName;

export default AvatarRadioGroup;
