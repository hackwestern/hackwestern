import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "",
        primary: "bg-button-primary text-white",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive-dark",
        outline:
          "bg-violet-100 hover:bg-muted border border-[1px] border-muted",
        secondary:
          "bg-white text-secondary-foreground hover:bg-white/60 border border-[1px] border-primary-300",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        "apply-ghost":
          "text-slate-400 hover:bg-primary-300 hover:text-primary-600",
        apply: "bg-primary-300 text-primary-600 hover:bg-primary-400",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const buttonClass = cn(buttonVariants({ variant, size, className }));

    return (
      <div className="group relative inline-block">
        {variant === "primary" && (
          <button
            className="active:bg-button-primary-click absolute left-0 top-0 z-10 h-full w-full rounded-lg bg-white text-sm text-white opacity-0 transition-opacity duration-150 group-hover:cursor-pointer group-hover:opacity-10"
            {...props}
          />
        )}
        <Comp className={cn(buttonClass)} ref={ref} {...props} />
      </div>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
