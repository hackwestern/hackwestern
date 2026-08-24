import React from "react";
import { Button } from "~/components/ui/button";
import Arrow from "./arrow";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
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
  onMouseDown,
  className,
  variant = "primary-1",
}: ButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-10 w-max shrink-0 px-4 py-2 text-transparent">
        {children}
      </Skeleton>
    );
  else
    if (variant == "primary-2")
      return (
        <Button
          variant="primary-2"
          isPending={disabled || isLoading}
          onClick={onClick}
          onMouseDown={onMouseDown}
          size={size}
          className={`${size == "sm" ? "px-[16px] pb-[10px] pt-[7px]" : "px-[18px] pb-[15px] pt-[12px]"} ${className}`}
          full={full}
        >
          {/* {(!direction || direction == "right") && <Spinner isLoading={isLoading}></Spinner>} */}

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
    return (
      <Button
        variant="primary"
        isPending={disabled || isLoading}
        onClick={onClick}
        onMouseDown={onMouseDown}
        size={size}
        className={`${size == "sm" ? "px-[16px] pb-[10px] pt-[7px]" : "px-[18px] pb-[15px] pt-[12px]"} ${className}`}
        full={full}
      >
        {/* {(!direction || direction == "right") && <Spinner isLoading={isLoading}></Spinner>} */}

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
