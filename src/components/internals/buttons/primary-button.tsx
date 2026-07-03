import React from "react";
import { Button } from "~/components/ui/button";
import Arrow from "./arrow";
import { Skeleton } from "../../ui/skeleton";
import { Spinner } from "../../loading-spinner";
import { ButtonProps } from "./buttonProps";

export default function PrimaryButton({
  children,
  isSkeleton = false,
  disabled = false,
  isLoading = false,
  full = false,
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
        variant="primary"
        isPending={disabled || isLoading}
        onClick={onClick}
        size={size}
        className={`${size == "sm" ? "px-[16px] pb-[10px] pt-[7px]" : "px-[18px] pb-[15px] pt-[12px]"} ${className}`}
        full = {full}
      >
        {/* {(!direction || direction == "right") && <Spinner isLoading={isLoading}></Spinner>} */}

        {direction == "left" && (
          <Arrow
            fill="#111111"
            margin={size == "sm" ? "mr-2" : "mr-4"}
            size={size}
            direction={direction}
          />
        )}

        <div>{children}</div>

        {direction == "right" && (
          <Arrow
            fill="#111111"
            margin={size == "sm" ? "ml-2" : "ml-4"}
            size={size}
            direction={direction}
          />
        )}
      </Button>
    );
}
