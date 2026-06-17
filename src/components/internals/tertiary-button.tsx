import React from "react";
import { Button } from "~/components/ui/button";
import { Skeleton } from "../ui/skeleton";
import { Spinner } from "../loading-spinner";
import Arrow from "./arrow";
import { ButtonProps } from "./buttonProps";

export default function TertiaryButton({
  children,
  isSkeleton,
  disabled = false,
  isLoading = false,
  onClick,
  direction,
  className,
}: ButtonProps) {
  if (isSkeleton)
    return (
      <Skeleton className="h-max w-max text-transparent">{children}</Skeleton>
    );

  return (
    <Button
      variant="tertiary"
      className={`px-0 py-1 ${className}`}
      isPending={disabled || isLoading}
      onClick={onClick}
    >
      {direction == "left" && (
        <Arrow margin="mr-[10px]" direction={direction} />
      )}
      <div>{children}</div>

      {direction == "right" && (
        <Arrow margin="ml-[10px]" direction={direction} />
      )}
      {/* <Spinner isLoading={isLoading}></Spinner> */}
    </Button>
  );
}
