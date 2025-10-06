import { type VariantProps, cva } from "class-variance-authority";
import * as React from "react";

import { cn } from "~/lib/utils";

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement>,
    VariantProps<typeof inputVariants> {}

const inputVariants = cva(
  "flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 font-figtree",
  {
    variants: {
      variant: {
        default: "",
        primary: "rounded-md bg-faint-lilac px-3 py-2 text-heavy border-muted",
        noRing:
          "focus-visible:outline-none focus-visible:ring-0 focus-visible:ring-offset-0",
        "invalid":
          "rounded-md bg-[#f6f3f9] px-3 py-2 text-heavy outline outline-1 outline-[#f76b7c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f76b7c] focus-visible:ring-offset-2",
      },
    },
  },
);

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, variant, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(inputVariants({ variant, className }))}
        ref={ref}
        {...props}
      />
    );
  },
);

Input.displayName = "Input";

export { Input };
