import * as React from "react";
import Image from "next/image";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import * as tokens from "~/lib/tokens"

type TypographyVariant = "primary" | "secondary" | "tertiary";
type TypographySize = "sm" | "lg";
//figure out padding, arrows, hovering cursor hand

const buttonBase =
  "inline-flex items-center justify-center whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

const lift =
  "-translate-y-[3px] group-hover:-translate-y-[4px] group-active:-translate-y-[1px] transition-all duration-100";

const typography:Record<TypographyVariant,Record<TypographySize,React.CSSProperties>> = {
  primary: {
    "sm": tokens.typography.button2,
    "lg": tokens.typography.button1},
  secondary: {
    "sm": tokens.typography.p3,
    "lg": tokens.typography.p2},
  tertiary: {
    "sm": tokens.typography.p2,
    "lg": tokens.typography.p2}
} as const

export const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      // default: "",
      primary: cn(
        "bg-gray-2 shadow-button-primary hover:bg-[#CBCBCB] active:bg-gray-2 active:shadow-button-primary-active",
        lift,
      ),
      secondary: cn(
        "rounded-full bg-offwhite border border-bg-highlight shadow-button-secondary hover:bg-blue-1 hover:border-blue-1 active:bg-light active:border-light text-medium",
        lift,
      ),
      tertiary: "bg-transparent text-medium px-4 active:text-heavy hover:text-blue-4 ",

      // destructive:
      //   "bg-destructive text-destructive-foreground hover:bg-destructive-dark",
      // outline: "bg-violet-100 hover:bg-muted border border-[1px] border-muted",
      // ghost: "hover:bg-accent hover:text-accent-foreground",
      // link: "text-primary underline-offset-4 hover:underline",
      // "apply-ghost":
      //   "bg-[#ebdff7] bg-opacity-50 text-heavy font-semibold hover:bg-[#e6cdff] w-full justify-start",
      // apply: "text-medium hover:bg-[#ebdff7] hover:text-heavy",
    },
    size: {
      // default: "h-10 px-4 py-2",
      sm: "h-8 px-3",
      lg: "h-11 px-8",
      // icon: "h-10 w-10",
    },
  },
  defaultVariants: { variant: "primary", size: "lg" },
});

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isPending?: boolean;
  full?: boolean;
  secondClass?: string;
}

const pressedByVariant: Record<"primary" | "secondary", string> = {
  primary:
    "!-translate-y-[1px] shadow-button-primary-active",
  secondary:
    "!-translate-y-[1px] shadow-button-secondary bg-button-secondary-active hover:!bg-button-secondary-active",
};

const noLift =
  "group-hover:!translate-y-[1px] group-active:!translate-y-[1px] transition-none";

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      className,
      variant = "primary",
      size = "lg",
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

    const wrapperClasses = cn(
      "group relative inline-block w-max",
      full && "block w-full",
      lockPressed && ["pointer-events-none", noLift],
    );

    return (
      <div className={wrapperClasses}>

        <Comp
          ref={ref}
          {...props}
          className={cn("flex flex-row gap-2", btnClasses)}
          disabled={disabled ?? isPending}
          style={typography[variant as TypographyVariant][size as TypographySize]}
        >
          {children}
        </Comp>
      </div>
    );
  },
);

Button.displayName = "Button";
