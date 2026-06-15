import * as React from "react";
import Image from "next/image";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "~/lib/utils";
import { colors, fonts, shadows } from "~/lib/tokens";

// ─── Lift animation (shared, matches original) ────────────────────────────────

const lift =
  "-translate-y-[3px] group-hover:-translate-y-[4px] group-active:-translate-y-[1px] transition-all duration-100";

const noLift =
  "group-hover:!translate-y-[1px] group-active:!translate-y-[1px] transition-none";

// ─── Primary shadow states (from tokens.shadows.button) ───────────────────────
//
// tokens.shadows.button is the default/hover state.
// Pressed inverts: drops go flat, inner lights/darks swap depth.

const shadowDefault = shadows.button;
// Pressed: shallow drop + inverted inner bevel
const shadowPressed = [
  "2px 2px 2px 0px rgba(0,0,0,0.12)",
  "inset 2px 2px 0px 0px rgba(5,6,8,0.50)",
  "inset -2px -2px 0px 0px rgba(255,255,255,0.30)",
  "inset 5px 5px 0px 0px rgba(137,139,143,0.50)",
  "inset -4px -4px 0px 0px rgba(222,223,225,0.50)",
].join(", ");

// ─── Pressed lock helpers (isPending) ─────────────────────────────────────────

const pressedByVariant: Record<"primary" | "secondary", string> = {
  primary: `!-translate-y-[1px] !bg-[#adadad] !text-[${colors.grays["black-9"]}]`,
  secondary: `!-translate-y-[1px] !bg-[${colors.text.light}] !border-transparent !text-white !shadow-none`,
};

// ─── Overlay layers (primary only — for border shimmer, matches original) ─────

const overlays = {
  primary: {
    // Subtle white-tinted bg behind the button for depth
    bg: `bg-[${colors.grays["gray-3"]}]/20`,
    // White border shimmer on top
    border: "border border-white/30",
  },
} as const;

// ─── CVA ──────────────────────────────────────────────────────────────────────

const buttonBase =
  "inline-flex items-center justify-center whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 cursor-pointer";

export const buttonVariants = cva(buttonBase, {
  variants: {
    variant: {
      // ── Primary ─────────────────────────────────────────────────────────────
      // Figma: gray-2 bg, Pix32 font, neumorphic pixel shadow, lifts on hover
      // Text: black-9 default/pressed, gray-4 on hover
      primary: cn(
        `bg-[${colors.grays["gray-2"]}] text-[${colors.grays["black-9"]}]`,
        `hover:bg-[#cbcbcb] hover:text-[${colors.grays["gray-4"]}]`,
        `active:bg-[#adadad] active:text-[${colors.grays["black-9"]}]`,
        `[font-family:${fonts.pix32}] text-[16px] leading-[1.2]`,
        `shadow-button-primary`,
        lift,
      ),

      // ── Secondary ───────────────────────────────────────────────────────────
      // Figma: pill, bg-light + bg-highlight border → blue-1 hover → text-light pressed
      // Figtree Medium, text-medium colour
      secondary: cn(
        "rounded-full",
        `bg-[${colors.bg.light}] border border-[${colors.bg.highlight}]`,
        `text-[${colors.text.medium}]`,
        `[font-family:${fonts.figtree}] font-medium text-[16px]`,
        `hover:bg-[${colors.blues["blue-1"]}] hover:border-transparent`,
        `active:bg-[${colors.text.light}] active:border-transparent active:text-white`,
        "shadow-[0px_2px_4px_rgba(0,0,0,0.12)]",
        lift,
      ),

      // ── Tertiary ────────────────────────────────────────────────────────────
      // Figma: no bg, text-medium → blue-4 hover → text-heavy pressed
      // Animated dashed underline on hover (matches original pattern)
      tertiary: cn(
        "bg-transparent px-0 py-1",
        `text-[${colors.text.medium}] [font-family:${fonts.figtree}] font-medium text-[16px]`,
        `hover:text-[${colors.blues["blue-4"]}]`,
        `active:text-[${colors.text.heavy}]`,
      ),

      // ── Tertiary arrow (matches original) ───────────────────────────────────
      "tertiary-arrow": cn(
        "bg-transparent px-0 py-1 flex items-center gap-2",
        `text-[${colors.text.medium}] [font-family:${fonts.figtree}] font-medium text-[16px]`,
        `hover:text-[${colors.blues["blue-4"]}]`,
        `active:text-[${colors.text.heavy}]`,
      ),

      // ── Legacy / backwards compat ────────────────────────────────────────────
      default: "",
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
      // Primary: asymmetric padding from Figma (more bottom padding for pixel font baseline)
      default: "h-10 px-4 py-2",
      lg: "px-[18px] pb-[15px] pt-[12px]",   // primary large / secondary uses pill-lg
      sm: "px-[16px] pb-[10px] pt-[7px]",    // primary small
      "pill-lg": "px-[18px] py-[12px]",      // secondary large
      "pill-sm": "px-[12px] py-[7px]",       // secondary small — text-[14px] set in variant
      icon: "h-10 w-10",
    },
  },
  defaultVariants: { variant: "default", size: "default" },
});

// ─── Props ─────────────────────────────────────────────────────────────────────

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  isPending?: boolean;
  full?: boolean;
  /** Extra class on the tertiary dashed underline span */
  secondClass?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

// ─── Component ─────────────────────────────────────────────────────────────────

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
      leftIcon,
      rightIcon,
      children,
      ...props
    },
    ref,
  ) => {
    const Comp = asChild ? Slot : "button";

    const lockPressed =
      isPending && (variant === "primary" || variant === "secondary");

    const overlay = overlays[variant as keyof typeof overlays];

    const wrapperClasses = cn(
      "group relative inline-block w-max",
      full && "block w-full",
      lockPressed && ["pointer-events-none", noLift],
    );

    const btnClasses = cn(
      buttonVariants({ variant, size, className }),
      // Primary: apply shadow here so active can override it
      variant === "primary" && [
        `shadow-[${shadowDefault}]`,
        `active:shadow-[${shadowPressed}]`,
        `focus-visible:ring-[${colors.blues["blue-5"]}]`,
      ],
      lockPressed && variant === "primary" && [
        pressedByVariant.primary,
        `!shadow-[${shadowPressed}]`,
        noLift,
      ],
      lockPressed && variant === "secondary" && [
        pressedByVariant.secondary,
        noLift,
      ],
      full && "w-full",
    );

    return (
      <div className={wrapperClasses}>
        {/* Primary shimmer overlay layers (matches original overlay pattern) */}
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
          {leftIcon && (
            <span className="inline-flex shrink-0 items-center">{leftIcon}</span>
          )}

          {variant === "tertiary-arrow" ? (
            <>
              <Image
                src="/shared/arrow-left.svg"
                alt="Left Arrow"
                width={10}
                height={10}
              />
              {children}
            </>
          ) : (
            children
          )}

          {rightIcon && (
            <span className="inline-flex shrink-0 items-center">{rightIcon}</span>
          )}
        </Comp>

        {/* Tertiary: dashed underline animates in on hover */}
        {(variant === "tertiary" || variant === "tertiary-arrow") && (
          <span
            className={cn(
              `block h-0 max-w-0 border-b-2 border-dashed border-[${colors.text.medium}]`,
              "transition-all duration-200",
              `group-hover:max-w-full group-hover:border-[${colors.blues["blue-4"]}]`,
              `group-active:border-[${colors.text.heavy}]`,
              secondClass,
            )}
          />
        )}
      </div>
    );
  },
);

Button.displayName = "Button";