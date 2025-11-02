import * as React from "react";
import Image from "next/image";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";

const buttonBase =
  "inline-flex items-center justify-center whitespace-nowrap rounded-lg text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 text-white font-figtree cursor-pointer";

const lift =
  "-translate-y-[3px] group-hover:-translate-y-[4px] group-active:-translate-y-[1px] transition-all duration-100";

export const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      default: "",
      primary: cn(
        "bg-button-primary shadow-button-primary hover:bg-button-primary-hover active:bg-button-primary-active",
        lift,
      ),
      secondary: cn(
        "text-[#625679] bg-button-secondary hover:bg-button-secondary-hover active:bg-button-secondary-active active:shadow-button-secondary",
        lift,
      ),
      tertiary: "bg-transparent text-[#625679] px-4 active:text-[#8F57AD]",
      "tertiary-arrow":
        "bg-transparent text-[#625679] px-4 active:text-[#8F57AD] flex items-center gap-2",
      destructive:
        "bg-destructive text-destructive-foreground hover:bg-destructive-dark",
      outline: "bg-violet-100 hover:bg-muted border border-[1px] border-muted",
      ghost: "hover:bg-accent hover:text-accent-foreground",
      link: "text-primary underline-offset-4 hover:underline",
      "apply-ghost":
        "bg-[#ebdff7] bg-opacity-50 text-heavy font-semibold hover:bg-[#e6cdff] w-full justify-start",
      apply: "text-medium hover:bg-[#ebdff7] hover:text-heavy",
    },
    size: {
      default: "h-10 px-4 py-2",
      sm: "h-8 rounded-md px-3",
      lg: "h-11 rounded-md px-8",
      icon: "h-10 w-10",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isPending?: boolean;
  full?: boolean;
  secondClass?: string;
}

const overlays = {
  primary: { bg: "bg-button-primary-back", border: "border border-white/30" },
  secondary: {
    bg: "bg-button-secondary-back",
    border: "border border-white/50",
  },
} as const;

const pressedByVariant: Record<"primary" | "secondary", string> = {
  primary:
    "!-translate-y-[1px] shadow-none bg-button-primary-active hover:!bg-button-primary-active",
  secondary:
    "!-translate-y-[1px] shadow-button-secondary bg-button-secondary-active hover:!bg-button-secondary-active",
};

const noLift =
  "group-hover:!translate-y-[1px] group-active:!translate-y-[1px] transition-none";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "default",
      size,
      isPending = false,
      full = false,
      asChild = false,
      disabled,
      secondClass = "",
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";
    const lockPressed =
      isPending && (variant === "primary" || variant === "secondary");

    const btnClasses = cn(
      buttonVariants({ variant, size, className }),
      lockPressed && [pressedByVariant[variant], noLift],
      full && "w-full",
    );

    const overlay = overlays[variant as keyof typeof overlays];

    const wrapperClasses = cn(
      "group relative inline-block w-max",
      full && "block w-full",
      lockPressed && ["pointer-events-none", noLift],
    );

    return (
      <div className={wrapperClasses}>
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
                lockPressed ? "-translate-y-[1px] " + noLift : lift,
              )}
            />
          </>
        )}

        <Comp
          ref={ref}
          {...props}
          className={cn("flex flex-row gap-2", btnClasses)}
          disabled={disabled ?? isPending}
        >
          {variant === "tertiary-arrow" ? (
            <div className="w-full">
              <Image
                src="/arrow-left.svg"
                alt="Left Arrow"
                width={10}
                height={10}
              />
              {children}
            </div>
          ) : (
            children
          )}
        </Comp>

        {(variant === "tertiary" || variant === "tertiary-arrow") && (
          <span
            className={cn(
              "block h-0 max-w-0 border-b-2 border-dashed border-[#625679] transition-all duration-200 group-hover:max-w-full group-active:border-[#8F57AD]",
              secondClass,
            )}
          />
        )}
      </div>
    );
  },
);

Button.displayName = "Button";
