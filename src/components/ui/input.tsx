import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const inputVariants = cva(
  cn(
    "flex w-full relative bg-white px-[8px] py-[8px] outline-none",
    `font-figtree font-medium text-[16px] leading-normal`,
    `text-gray-6`,
    `placeholder:text-gray-3`,
    "disabled:cursor-not-allowed disabled:opacity-50",
    "transition-shadow duration-100",
  ),
  {
    variants: {
      variant: {
        default: cn(
          `border rounded-[4px] border-gray-2`,
          `shadow-[inset_1px_1px_3px_0px_rgba(137,139,143,0.5),inset_-1px_-1px_3px_0px_rgba(137,139,143,0.5)]`,
          `hover:placeholder:text-gray-2 hover:border-gray-1`,
          `focus:border-black`,
          `focus:placeholder:opacity-0`,
        ),
        primary: "rounded-md bg-faint-lilac px-3 py-2 text-heavy border-muted",
        noRing:
          "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        invalid:
          "rounded-md bg-[#f6f3f9] px-3 py-2 text-heavy outline outline-1 outline-[#f76b7c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f76b7c] focus-visible:ring-offset-2",
      },
    },
  },
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type, ...props }, ref) => {
    return (
      <div className="drop-shadow-[2px_2px_2px_rgba(0,0,0,0.08)]">
        <input
          type={type}
          className={cn(inputVariants({ variant, className }))}
          ref={ref}
          {...props}
        />
      </div>
    );
  },
);

Input.displayName = "Input";

export { Input };
