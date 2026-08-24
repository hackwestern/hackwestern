import * as React from "react";
import Image from "next/image";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import * as tokens from "~/lib/tokens";

type TypographyVariant = "primary" | "primary-2" | "secondary" | "tertiary";
type TypographySize = "sm" | "lg";
//figure out padding, arrows, hovering cursor hand

const buttonBase =
  "inline-flex cursor-pixel-hover items-center justify-center whitespace-nowrap ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 ";

const typography: Record<TypographyVariant, Record<TypographySize, string>> = {
  primary: {
    sm: "button-sm",
    lg: "button-lg",
  },
  "primary-2":{
    sm: "button-sm",
    lg: "button-lg",
  },
  secondary: {
    sm: "p3",
    lg: "p2",
  },
  tertiary: {
    sm: "p2",
    lg: "p2",
  },
} as const;

export const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      // default: "",
      primary: cn(
        "relative overflow-hidden items-center gap-[10px] rounded-full border",
        "border-button-primary-border bg-button-primary text-gray-7 shadow-primary-btn",
        "hover:border-button-primary-hover-border hover:bg-button-primary-hover hover:text-gray-4 hover:shadow-primary-btn-hover hover:cursor-pixel-hover",
        "active:border-button-primary-active-border active:bg-button-primary-active active:text-gray-7 active:shadow-primary-btn-active",
        "transition-[background-color,box-shadow,border-color,color] duration-200",
      ),
      "primary-2": cn(
        "relative overflow-hidden items-center gap-[10px] rounded-full border",
        "border-blue-5 bg-blue-4 text-offwhite shadow-primary-btn-2",
        "hover:border-blue-3 hover:bg-blue-2 hover:text-blue-1 hover:cursor-pixel-hover",
        "active:border-blue-8 active:bg-blue-5 active:text-blue-8",
        "transition-[background-color,box-shadow,border-color,color] duration-200",
      ),
      secondary: cn(
        "rounded-full bg-offwhite border border-highlight shadow-secondary-btn hover:bg-blue-1 hover:border-blue-1 active:bg-light active:border-light text-medium",
      ),
      tertiary:
        "bg-transparent text-medium px-4 active:text-heavy hover:text-blue-4",

      icon: cn("bg-gray-2 shadow-icon-btn hover:bg-[#CBCBCB]"),
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
      sm: "px-[12px] py-[7px] h-[33px]",
      lg: "px-[18px] py-[12px] h-[43px]",
      icon: "h-10 w-10",
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

const pressedByVariant: Record<"primary" | "primary-2" | "secondary", string> = {
  primary:
    "shadow-primary-btn-active bg-button-primary-active border-button-primary-active-border text-gray-7",
  "primary-2": "bg-blue-5 border-blue-8 text-blue-8",
  secondary:
    "shadow-secondary-btn bg-button-secondary-active",
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
      isPending && (variant === "primary" || variant == "primary-2" || variant === "secondary");

    // Keep the button visually sunken for a beat after release, like an XP
    // button holding its depressed state before springing back.
    const canHoldPress = variant === "primary" || variant === "secondary";
    const [held, setHeld] = React.useState(false);
    const releaseTimer = React.useRef<ReturnType<typeof setTimeout> | null>(
      null,
    );
    React.useEffect(
      () => () => {
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
      },
      [],
    );
    const holdDown = (e: React.PointerEvent<HTMLButtonElement>) => {
      if (canHoldPress) {
        if (releaseTimer.current) clearTimeout(releaseTimer.current);
        setHeld(true);
      }
      props.onPointerDown?.(e);
    };
    const releaseSoon = () => {
      if (!canHoldPress) return;
      if (releaseTimer.current) clearTimeout(releaseTimer.current);
      releaseTimer.current = setTimeout(() => setHeld(false), 160);
    };
    const showPressed = held && canHoldPress && !lockPressed;

    const btnClasses = cn(
      buttonVariants({ variant, size, className }),
      lockPressed && [pressedByVariant[variant], noLift],
      showPressed && pressedByVariant[variant],
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
          onPointerDown={holdDown}
          onPointerUp={(e: React.PointerEvent<HTMLButtonElement>) => {
            releaseSoon();
            props.onPointerUp?.(e);
          }}
          onPointerLeave={(e: React.PointerEvent<HTMLButtonElement>) => {
            releaseSoon();
            props.onPointerLeave?.(e);
          }}
          className={cn(
            "flex items-end",
            (variant === "primary" ||
              variant === "primary-2" ||
              variant === "secondary" ||
              variant === "tertiary") &&
              (size === "sm" || size === "lg") &&
              typography[variant as TypographyVariant][size as TypographySize],
            btnClasses,
          )}
          disabled={disabled ?? isPending}
        >
          {(variant === "primary" || variant === "primary-2") && (
            <span
              aria-hidden
              className={cn(
                "pointer-events-none absolute -top-px inset-x-[9.67px] h-[17.8px] rounded-full bg-gradient-to-b from-gray-0/80 to-gray-0/0",
                variant === "primary" && "group-active:from-gray-0/[64%]",
              )}
            />
          )}
          {variant === "primary" || variant === "primary-2" ? (
            <span className="relative z-10 inline-flex items-center">
              {children}
            </span>
          ) : (
            children
          )}
        </Comp>
      </div>
    );
  },
);

Button.displayName = "Button";
