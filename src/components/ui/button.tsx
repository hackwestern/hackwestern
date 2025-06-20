import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "~/lib/utils";

const buttonBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-white font-figtree cursor-grab";

const move =
  "-translate-y-[3px] group-hover:-translate-y-[4px] group-active:-translate-y-[2px] transition-all duration-100";

const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      default: "",
      primary: cn(
        "bg-button-primary shadow-button-primary hover:bg-button-primary-hover active:bg-button-primary-active",
        move,
      ),
      secondary: cn(
        "text-[#625679] bg-button-secondary hover:bg-button-secondary-hover active:bg-button-secondary-active active:shadow-button-secondary",
        move,
      ),
      tertiary: "bg-transparent text-[#625679] px-4 active:text-[#8F57AD]",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive-dark",
      outline: "bg-violet-100 hover:bg-muted border border-[1px] border-muted",
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
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const overlayStyles = {
  primary: { bg: "bg-button-primary-back", border: "border border-white/30" },
  secondary: {
    bg: "bg-button-secondary-back",
    border: "border border-white/50",
  },
} as const;

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    const classes = cn(buttonVariants({ variant, size, className }));

    const overlay =
      overlayStyles[variant as keyof typeof overlayStyles] ?? undefined;

    return (
      <div className="group relative inline-block w-max">
        {overlay && (
          <>
            <span
              className={cn(
                "pointer-events-none absolute inset-0 h-full w-full rounded-lg",
                overlay.bg,
              )}
            />
            <span
              className={cn(
                "pointer-events-none absolute inset-0 z-50 h-full w-full rounded-lg",
                overlay.border,
                move,
              )}
            />
          </>
        )}

        <Comp ref={ref} {...props} className={classes} />

        {variant === "tertiary" && (
          <span className="block h-0 max-w-0 border-b-2 border-dashed border-[#625679] transition-all duration-200 group-hover:max-w-full group-active:border-[#8F57AD]" />
        )}
      </div>
    );
  },
);

Button.displayName = "Button";

export { Button, buttonVariants };
