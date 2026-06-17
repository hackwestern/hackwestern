import React from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
import Arrow from "./arrow";
import { ButtonProps } from "./buttonProps";

export default function SecondaryButton({
  children,
  isSkeleton = false,
  disabled = false,
  isLoading = false,
  size = "lg",
  direction,
  onClick,
  className,
}: ButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-10 w-max shrink-0 px-4 py-2 text-transparent">
        {children}
      </Skeleton>
    );
  else
    return (
      <Button
        variant="secondary"
        className={`${size == "sm" ? "px-[12px] py-[7px]" : "px-[18px] py-[12px]"}${className}`}
        isPending={disabled || isLoading}
        onClick={onClick}
        size={size}
      >
        {/* <Spinner isLoading={isLoading}></Spinner> */}

        {direction == "left" && (
          <Arrow
            margin={size == "sm" ? "mr-[10px]" : "mr-3"}
            size={size}
            direction={direction}
          />
        )}

        <div>{children}</div>

        {direction == "right" && (
          <Arrow
            margin={size == "sm" ? "ml-[10px]" : "ml-3"}
            size={size}
            direction={direction}
          />
        )}
      </Button>
    );
}
